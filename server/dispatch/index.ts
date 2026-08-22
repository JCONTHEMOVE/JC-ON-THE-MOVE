// Task #172 — Public dispatch entry point.
//
// Every code path that previously called dispatchGenericJob() or
// crewSuggestionService.suggestCrewForJob() (inside an assignment flow)
// should call dispatchJob(leadId). It handles:
//
//   1. lat/lng backfill via geocoding if the job is missing coords.
//   2. Starting the Uber-style offer loop (pick best → SMS → 20s TTL →
//      advance on decline/timeout).
//   3. Writing an audit trail to dispatch_log for every transition.
//
// The function is fire-and-forget friendly; it awaits the first offer
// send so callers can surface immediate errors, but the timeout/roll
// loop continues in the background.

import { pool } from "../db";
import { geocodeAddress } from "./geo";
import { startOfferLoop, sweepStaleOffers, cancelOfferTimer } from "./offerQueue";
import {
  loadJob,
  logDispatchEvent,
  persistState,
  tryAcceptOffer,
  tryDeclineOffer,
  recheckKillSwitch,
  setKillSwitch,
  getDispatchMetrics,
} from "./store";
import { migrateDispatchSchema } from "./migrate";
import { rankCandidates } from "./engine";
import {
  acceptCrewSlotOffer,
  cancelCrewSlotTimers,
  declineCrewSlotOffer,
  hasActiveCrewSlotOffer,
  startCrewSlotDispatch,
  sweepStaleCrewSlotOffers,
} from "./multiSlot";

export interface DispatchJobOptions {
  actorUserId?: string | null;
  reason?: string;
}

export async function dispatchJob(
  leadId: string,
  opts: DispatchJobOptions = {},
): Promise<{ ok: boolean; state: string; message?: string }> {
  if (!(await recheckKillSwitch())) {
    return { ok: false, state: "pending", message: "dispatch disabled" };
  }

  // Backfill coords if we can — non-blocking on failure.
  await backfillCoords(leadId).catch(() => {});

  await logDispatchEvent(
    leadId,
    "dispatch_requested",
    null,
    opts.actorUserId ?? null,
    null,
    null,
    opts.reason ?? "manual",
  );

  // Kick off offer loop. startOfferLoop swallows its own errors; we just
  // surface whether an offer was actually sent.
  await startCrewSlotDispatch(leadId);
  const fresh = await loadJob(leadId);
  return {
    ok: !!fresh && fresh.dispatchState !== "failed",
    state: fresh?.dispatchState ?? "unknown",
    message: fresh?.dispatchState === "failed" ? "no eligible crew" : undefined,
  };
}

async function backfillCoords(leadId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT lat, lng, from_address FROM leads WHERE id = $1`,
    [leadId],
  );
  if (rows.length === 0) return;
  const r = rows[0];
  if (r.lat != null && r.lng != null) return;
  if (!r.from_address) return;

  const coords = await geocodeAddress(r.from_address);
  if (!coords) return;
  await pool.query(`UPDATE leads SET lat = $1, lng = $2 WHERE id = $3`,
    [coords.lat, coords.lng, leadId]);
}

/** Admin manual override: pins a specific crew to a job and bypasses the
 *  offer queue. Logs to dispatch_log with reason so audits stay complete. */
export async function adminReassign(opts: {
  leadId: string;
  crewId: string;
  actorUserId: string;
  reason?: string;
}): Promise<{ ok: boolean; message?: string }> {
  const job = await loadJob(opts.leadId);
  if (!job) return { ok: false, message: "lead not found" };
  if (["completed", "in_progress"].includes(job.status)) {
    return { ok: false, message: `cannot override a ${job.status} job` };
  }

  cancelOfferTimer(opts.leadId);
  cancelCrewSlotTimers(opts.leadId);

  const newCrew = Array.from(new Set([opts.crewId, ...job.crewMembers.filter(id => id !== opts.crewId)]));
  await persistState(opts.leadId, {
    dispatchState: "assigned",
    dispatchOfferedTo: null,
    dispatchOfferExpiresAt: null,
    crewMembers: newCrew,
    status: job.status === "new" || job.status === "open" || job.status === "quote_requested"
      ? "available" : job.status,
  });
  await logDispatchEvent(opts.leadId, "manual_override", opts.crewId, opts.actorUserId,
    job.dispatchState, "assigned", opts.reason ?? "admin reassign");
  return { ok: true };
}

/** Crew accept handler — atomic DB guard then side effects. */
export async function crewAccept(leadId: string, crewId: string): Promise<{ ok: boolean; message?: string }> {
  if (await hasActiveCrewSlotOffer(leadId, crewId)) {
    return acceptCrewSlotOffer(leadId, crewId);
  }
  const before = await loadJob(leadId);
  if (!before) return { ok: false, message: "lead not found" };
  if (before.dispatchState !== "offering" || before.dispatchOfferedTo !== crewId) {
    return { ok: false, message: "offer no longer yours" };
  }
  const accepted = await tryAcceptOffer(leadId, crewId);
  if (!accepted) return { ok: false, message: "offer expired" };
  cancelOfferTimer(leadId);
  await logDispatchEvent(leadId, "offer_accepted", crewId, crewId,
    before.dispatchState, "accepted", "crew accepted");
  return { ok: true };
}

/** Crew decline handler — advances to next candidate if applicable. */
export async function crewDecline(leadId: string, crewId: string): Promise<{ ok: boolean; message?: string }> {
  if (await hasActiveCrewSlotOffer(leadId, crewId)) {
    return declineCrewSlotOffer(leadId, crewId);
  }
  const before = await loadJob(leadId);
  if (!before) return { ok: false, message: "lead not found" };
  if (before.dispatchState !== "offering" || before.dispatchOfferedTo !== crewId) {
    return { ok: false, message: "offer no longer yours" };
  }
  const declined = await tryDeclineOffer(leadId, crewId);
  if (!declined) return { ok: false, message: "offer expired" };
  cancelOfferTimer(leadId);
  await logDispatchEvent(leadId, "offer_declined", crewId, crewId,
    before.dispatchState, "pending", "crew declined");
  // Task #173 — surface chronic decliners to admin. Increment on every
  // confirmed decline. Wrapped so a stat failure never blocks the core
  // dispatch flow (the offer already rolled).
  try {
    await pool.query(
      `UPDATE users
          SET dispatch_decline_count = COALESCE(dispatch_decline_count,0) + 1,
              dispatch_last_declined_at = now()
        WHERE id = $1`,
      [crewId],
    );
  } catch (e) {
    console.warn(`[dispatch.decline] stat bump failed for ${crewId}:`, e);
  }
  // Roll to next candidate asynchronously.
  void startOfferLoop(leadId);
  return { ok: true };
}

// Retry loop: picks up jobs still in 'pending' (expired offers, fresh
// unassigned) and re-runs the engine. Run every 2 min from registerRoutes.
export async function dispatchRetryTick(): Promise<{ picked: number; swept: number }> {
  const swept = (await sweepStaleOffers()) + (await sweepStaleCrewSlotOffers());
  const { rows } = await pool.query(
    `SELECT id FROM leads
      WHERE archived_at IS NULL
        AND dispatch_state = 'pending'
        AND status NOT IN ('completed','cancelled')
        AND created_at >= now() - interval '24 hours'
      ORDER BY created_at ASC
      LIMIT 25`,
  );
  for (const r of rows) {
    try {
      await startCrewSlotDispatch(r.id);
    } catch (e) {
      console.warn(`[dispatch.retry] ${r.id} failed:`, e);
    }
  }
  return { picked: rows.length, swept };
}

let retryHandle: NodeJS.Timeout | null = null;

export async function initDispatchModule(): Promise<void> {
  await migrateDispatchSchema();
  try {
    const swept = (await sweepStaleOffers()) + (await sweepStaleCrewSlotOffers());
    if (swept > 0) console.log(`[dispatch] swept ${swept} stale offers on boot`);
  } catch (e) {
    console.warn("[dispatch] sweepStaleOffers failed:", e);
  }
  if (retryHandle) clearInterval(retryHandle);
  retryHandle = setInterval(() => {
    void dispatchRetryTick().catch((error) => {
      console.error("[dispatch] retry cron failed:", error);
    });
  }, 2 * 60 * 1000);
  console.log("[dispatch] initialized — retry cron every 2min");
}

// Re-exports for route handlers.
export { logDispatchEvent, persistState, loadJob, recheckKillSwitch, setKillSwitch, getDispatchMetrics };
export { rankCandidates };
