import { pool } from "../db";
import { ensureRegionalAutomationSchema } from "../services/regionalAutomationMigration";
import { emitCustomerLifecycleEvent } from "../services/customerLifecycle";
import { rankCandidates } from "./engine";
import { isDispatchable } from "./isDispatchable";
import { sendOffer } from "./notify";
import { loadJob, logDispatchEvent, persistState } from "./store";
import { OFFER_TTL_MS } from "./types";

const timers = new Map<string, NodeJS.Timeout>();

type AcceptedSlot = {
  slot_key: string;
  role_on_job: string;
  requires_driver: boolean;
  worker_id: string;
  is_driver: boolean;
};

function slotDefinitions(crewSize: number) {
  return Array.from({ length: Math.max(1, crewSize) }, (_, index) => ({
    key: index === 0 ? "crew_lead" : `mover_${index + 1}`,
    role: index === 0 ? "crew_lead" : "mover",
  }));
}

async function acceptedSlots(leadId: string): Promise<AcceptedSlot[]> {
  const { rows } = await pool.query<AcceptedSlot>(
    `SELECT o.slot_key, o.role_on_job, o.requires_driver, o.worker_id,
            COALESCE(u.is_driver,false) AS is_driver
       FROM dispatch_offers o
       JOIN users u ON u.id=o.worker_id
      WHERE o.lead_id=$1 AND o.status='accepted'
      ORDER BY o.created_at ASC`,
    [leadId],
  );
  return rows;
}

async function leadTruckMode(leadId: string) {
  const { rows } = await pool.query<{
    truck_provider: string | null;
    truck_config: string | null;
    confirmed_hours: number | string | null;
  }>(`SELECT truck_provider, truck_config, confirmed_hours FROM leads WHERE id=$1`, [leadId]);
  const row = rows[0];
  return {
    companyTruck: row?.truck_provider === "jc_on_the_move" || row?.truck_config === "company_truck",
    scheduledHours: Math.max(0, Number(row?.confirmed_hours || 0)),
  };
}

export async function startCrewSlotDispatch(leadId: string): Promise<void> {
  await ensureRegionalAutomationSchema();
  const gate = await isDispatchable(leadId);
  const job = await loadJob(leadId);
  if (!job) return;
  if (!gate.ok) {
    await logDispatchEvent(leadId, "skipped", null, null, job.dispatchState, "pending", `dispatch gate held: ${gate.reason || "not dispatchable"}`);
    return;
  }
  if (["in_progress", "completed", "cancelled"].includes(job.status) || ["en_route", "on_site", "completed"].includes(job.dispatchState)) return;

  const active = await pool.query(`SELECT id FROM dispatch_offers WHERE lead_id=$1 AND status='offered' AND expires_at>NOW() LIMIT 1`, [leadId]);
  if (active.rows.length) return;

  const accepted = await acceptedSlots(leadId);
  const slots = slotDefinitions(job.crewSize);
  if (accepted.length >= slots.length) {
    await finalizeRoster(leadId, job, accepted);
    return;
  }

  const acceptedKeys = new Set(accepted.map((row) => row.slot_key));
  const openSlot = slots.find((slot) => !acceptedKeys.has(slot.key));
  if (!openSlot) return;
  const truck = await leadTruckMode(leadId);
  const needsDriver = truck.companyTruck && !accepted.some((row) => row.is_driver);
  const tried = await pool.query<{ worker_id: string }>(
    `SELECT worker_id FROM dispatch_offers WHERE lead_id=$1 AND slot_key=$2`,
    [leadId, openSlot.key],
  );
  const exclude = Array.from(new Set([
    ...job.crewMembers,
    ...accepted.map((row) => row.worker_id),
    ...tried.rows.map((row) => row.worker_id),
  ]));
  const ranked = await rankCandidates({
    id: job.id,
    serviceType: job.serviceType,
    lat: job.lat,
    lng: job.lng,
    urgency: job.urgency,
    totalPrice: job.totalPrice,
    serviceDate: job.serviceDate,
  }, exclude);
  const candidate = ranked.find((row) => !needsDriver || row.isDriver);
  if (!candidate) {
    await persistState(leadId, { dispatchState: "failed", dispatchOfferedTo: null, dispatchOfferExpiresAt: null });
    await logDispatchEvent(leadId, "roster_exhausted", null, null, job.dispatchState, "failed", needsDriver ? "no eligible driver for open crew slot" : "no eligible worker for open crew slot", { slotKey: openSlot.key });
    return;
  }

  const expiresAt = new Date(Date.now() + OFFER_TTL_MS);
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO dispatch_offers
       (lead_id, slot_key, role_on_job, requires_driver, worker_id, score, distance_miles, reasons, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [leadId, openSlot.key, openSlot.role, needsDriver, candidate.crewId, candidate.score, candidate.distanceMi, JSON.stringify(candidate.reasons), expiresAt],
  );
  if (!inserted.rows[0]) return;

  await persistState(leadId, { dispatchState: "offering", dispatchOfferedTo: candidate.crewId, dispatchOfferExpiresAt: expiresAt });
  await logDispatchEvent(leadId, "slot_offer_sent", candidate.crewId, null, job.dispatchState, "offering", `slot=${openSlot.key} score=${candidate.score}`, { offerId: inserted.rows[0].id, role: openSlot.role, requiresDriver: needsDriver });
  await sendOffer({
    crewId: candidate.crewId,
    leadId,
    customerName: job.customerName,
    serviceType: job.serviceType,
    distanceMi: candidate.distanceMi,
    totalPrice: job.totalPrice,
    ttlSec: Math.round(OFFER_TTL_MS / 1000),
  });
  scheduleTimeout(inserted.rows[0].id, leadId, candidate.crewId);
}

function scheduleTimeout(offerId: string, leadId: string, workerId: string) {
  const previous = timers.get(offerId);
  if (previous) clearTimeout(previous);
  timers.set(offerId, setTimeout(() => void expireOffer(offerId, leadId, workerId), OFFER_TTL_MS));
}

async function expireOffer(offerId: string, leadId: string, workerId: string) {
  timers.delete(offerId);
  const result = await pool.query(
    `UPDATE dispatch_offers SET status='expired', responded_at=NOW(), updated_at=NOW()
      WHERE id=$1 AND status='offered' AND expires_at<=NOW() RETURNING id`,
    [offerId],
  );
  if (!result.rows.length) return;
  await pool.query(
    `UPDATE leads SET dispatch_state='pending', dispatch_offered_to=NULL, dispatch_offer_expires_at=NULL
      WHERE id=$1 AND dispatch_offered_to=$2`,
    [leadId, workerId],
  );
  await logDispatchEvent(leadId, "slot_offer_expired", workerId, null, "offering", "pending", "crew slot offer expired", { offerId });
  void startCrewSlotDispatch(leadId);
}

export async function acceptCrewSlotOffer(leadId: string, workerId: string): Promise<{ ok: boolean; message?: string; rosterComplete?: boolean }> {
  await ensureRegionalAutomationSchema();
  const accepted = await pool.query<{ id: string; slot_key: string; role_on_job: string; requires_driver: boolean }>(
    `UPDATE dispatch_offers
        SET status='accepted', responded_at=NOW(), updated_at=NOW()
      WHERE lead_id=$1 AND worker_id=$2 AND status='offered' AND expires_at>NOW()
      RETURNING id, slot_key, role_on_job, requires_driver`,
    [leadId, workerId],
  );
  const offer = accepted.rows[0];
  if (!offer) return { ok: false, message: "offer expired or no longer yours" };
  const timer = timers.get(offer.id);
  if (timer) clearTimeout(timer);
  timers.delete(offer.id);

  const truck = await leadTruckMode(leadId);
  const settings = await pool.query<{ lead_mover_hourly_rate: string; mover_hourly_rate: string; driver_hourly_premium: string }>(
    `SELECT lead_mover_hourly_rate, mover_hourly_rate, driver_hourly_premium
       FROM job_payout_settings WHERE is_default=true ORDER BY created_at DESC LIMIT 1`,
  );
  const config = settings.rows[0];
  const hourlyRate = offer.role_on_job === "crew_lead" ? Number(config?.lead_mover_hourly_rate || 30) : Number(config?.mover_hourly_rate || 25);
  await pool.query(
    `INSERT INTO job_assignments
       (lead_id, worker_id, role_on_job, hourly_rate, scheduled_hours, is_driver_for_job, driver_hourly_premium)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (lead_id, worker_id)
     DO UPDATE SET role_on_job=EXCLUDED.role_on_job, scheduled_hours=EXCLUDED.scheduled_hours,
                   is_driver_for_job=EXCLUDED.is_driver_for_job, updated_at=NOW()`,
    [leadId, workerId, offer.role_on_job, hourlyRate, truck.scheduledHours, offer.requires_driver, Number(config?.driver_hourly_premium || 5)],
  );
  await pool.query(
    `UPDATE leads
        SET crew_members=CASE WHEN $2=ANY(COALESCE(crew_members,'{}')) THEN crew_members ELSE array_append(COALESCE(crew_members,'{}'),$2) END,
            dispatch_state='pending', dispatch_offered_to=NULL, dispatch_offer_expires_at=NULL
      WHERE id=$1`,
    [leadId, workerId],
  );
  await logDispatchEvent(leadId, "slot_offer_accepted", workerId, workerId, "offering", "pending", `accepted ${offer.slot_key}`, { offerId: offer.id, role: offer.role_on_job });

  const job = await loadJob(leadId);
  if (!job) return { ok: true };
  const roster = await acceptedSlots(leadId);
  if (roster.length >= job.crewSize) {
    await finalizeRoster(leadId, job, roster);
    return { ok: true, rosterComplete: true };
  }
  void startCrewSlotDispatch(leadId);
  return { ok: true, rosterComplete: false };
}

export async function declineCrewSlotOffer(leadId: string, workerId: string): Promise<{ ok: boolean; message?: string }> {
  await ensureRegionalAutomationSchema();
  const declined = await pool.query<{ id: string; slot_key: string }>(
    `UPDATE dispatch_offers SET status='declined', responded_at=NOW(), updated_at=NOW()
      WHERE lead_id=$1 AND worker_id=$2 AND status='offered'
      RETURNING id, slot_key`,
    [leadId, workerId],
  );
  if (!declined.rows[0]) return { ok: false, message: "offer expired or no longer yours" };
  const timer = timers.get(declined.rows[0].id);
  if (timer) clearTimeout(timer);
  timers.delete(declined.rows[0].id);
  await pool.query(`UPDATE leads SET dispatch_state='pending', dispatch_offered_to=NULL, dispatch_offer_expires_at=NULL WHERE id=$1`, [leadId]);
  await pool.query(`UPDATE users SET dispatch_decline_count=COALESCE(dispatch_decline_count,0)+1, dispatch_last_declined_at=NOW() WHERE id=$1`, [workerId]).catch(() => undefined);
  await logDispatchEvent(leadId, "slot_offer_declined", workerId, workerId, "offering", "pending", `declined ${declined.rows[0].slot_key}`);
  void startCrewSlotDispatch(leadId);
  return { ok: true };
}

async function finalizeRoster(leadId: string, job: Awaited<ReturnType<typeof loadJob>> & {}, roster: AcceptedSlot[]) {
  if (!job) return;
  const crewIds = Array.from(new Set(roster.map((row) => row.worker_id)));
  const lead = roster.find((row) => row.role_on_job === "crew_lead")?.worker_id || crewIds[0] || null;
  const driver = roster.find((row) => row.is_driver)?.worker_id || null;
  await pool.query(
    `UPDATE leads SET crew_members=$2, crew_lead_user_id=$3, driver_user_id=$4,
            dispatch_state='accepted', dispatch_offered_to=NULL, dispatch_offer_expires_at=NULL,
            status=CASE WHEN status IN ('new','open','quote_requested','paid','confirmed','available') THEN 'accepted' ELSE status END
      WHERE id=$1`,
    [leadId, crewIds, lead, driver],
  );
  await logDispatchEvent(leadId, "roster_complete", null, null, job.dispatchState, "accepted", `${crewIds.length}/${job.crewSize} crew slots accepted`, { crewIds, lead, driver });
  await emitCustomerLifecycleEvent({
    leadId,
    type: "crew_confirmed",
    eventKey: `${leadId}:crew_confirmed:${crewIds.sort().join(",")}`,
    title: "Your JC crew is confirmed",
    message: `All ${crewIds.length} required crew positions are filled. Watch your job page for the arrival update.`,
    payload: { crewSize: crewIds.length },
  }).catch((error) => console.warn("[dispatch] customer roster notification failed", error));
}

export async function hasActiveCrewSlotOffer(leadId: string, workerId?: string): Promise<boolean> {
  await ensureRegionalAutomationSchema();
  const params: unknown[] = [leadId];
  let workerClause = "";
  if (workerId) {
    params.push(workerId);
    workerClause = ` AND worker_id=$${params.length}`;
  }
  const result = await pool.query(`SELECT 1 FROM dispatch_offers WHERE lead_id=$1 AND status='offered' AND expires_at>NOW()${workerClause} LIMIT 1`, params);
  return result.rows.length > 0;
}

export async function sweepStaleCrewSlotOffers(): Promise<number> {
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query<{ lead_id: string }>(
    `UPDATE dispatch_offers SET status='expired', responded_at=NOW(), updated_at=NOW()
      WHERE status='offered' AND expires_at<=NOW()
      RETURNING lead_id`,
  );
  const ids = Array.from(new Set(rows.map((row) => row.lead_id)));
  for (const leadId of ids) {
    await pool.query(`UPDATE leads SET dispatch_state='pending', dispatch_offered_to=NULL, dispatch_offer_expires_at=NULL WHERE id=$1 AND dispatch_state='offering'`, [leadId]);
  }
  return rows.length;
}

export function cancelCrewSlotTimers(leadId: string) {
  void pool.query<{ id: string }>(`SELECT id FROM dispatch_offers WHERE lead_id=$1 AND status='offered'`, [leadId]).then(({ rows }) => {
    for (const row of rows) {
      const timer = timers.get(row.id);
      if (timer) clearTimeout(timer);
      timers.delete(row.id);
    }
  });
}
