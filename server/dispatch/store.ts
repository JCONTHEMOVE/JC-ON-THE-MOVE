// Task #172 — Thin persistence layer for the dispatch service. The new
// columns live on the existing leads table so we don't disturb any
// upstream query that reads crewMembers / status directly. All writes
// go through parameterized raw SQL because drizzle's leads table
// declaration doesn't know about the dispatch_* columns yet (and
// schema push is blocked — see scratchpad).

import { pool } from "../db";
import type { DispatchState } from "./types";

export interface LoadedJob {
  id: string;
  customerName: string;
  serviceType: string;
  lat: number | null;
  lng: number | null;
  urgency: "low" | "normal" | "high";
  totalPrice: number;
  serviceDate: string | null;
  crewSize: number;
  crewMembers: string[];
  status: string;
  dispatchState: DispatchState;
  dispatchOfferedTo: string | null;
  dispatchOfferExpiresAt: Date | null;
  dispatchTriedIds: string[];
}

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  service_type: string;
  lat: string | number | null;
  lng: string | number | null;
  urgency: string;
  price: string | number;
  service_date: string | null;
  crew_size: string | number;
  crew_members: string[] | null;
  status: string;
  dispatch_state: string;
  dispatch_offered_to: string | null;
  dispatch_offer_expires_at: Date | null;
  dispatch_tried_ids: string[] | null;
};

type UrgencyLevel = "low" | "normal" | "high";
const URGENCY_VALUES: UrgencyLevel[] = ["low", "normal", "high"];
function asUrgency(v: string | null | undefined): UrgencyLevel {
  return URGENCY_VALUES.includes(v as UrgencyLevel) ? (v as UrgencyLevel) : "normal";
}

function normalizeDispatchService(value: string): string {
  const service = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (/residential|commercial|moving|move/.test(service)) return "moving";
  if (/junk|cleanout|haul/.test(service)) return "junk";
  if (/labor|helping_hands|load_unload/.test(service)) return "labor";
  if (/snow/.test(service)) return "snow";
  if (/handyman|assembly/.test(service)) return "handyman";
  if (/demolition|demo/.test(service)) return "demolition";
  if (/clean/.test(service)) return "cleaning";
  return service;
}

export async function loadJob(id: string): Promise<LoadedJob | null> {
  const { rows } = await pool.query<LeadRow>(
    `SELECT id, first_name, last_name, service_type,
            lat, lng, COALESCE(urgency, 'normal') AS urgency,
            COALESCE(total_price, base_price, '0') AS price,
            COALESCE(confirmed_date, move_date) AS service_date,
            COALESCE(crew_size, 2) AS crew_size,
            COALESCE(crew_members, '{}') AS crew_members,
            status,
            COALESCE(dispatch_state, 'pending') AS dispatch_state,
            dispatch_offered_to,
            dispatch_offer_expires_at,
            COALESCE(dispatch_tried_ids, '{}') AS dispatch_tried_ids
       FROM leads
      WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    customerName: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Customer",
    serviceType: normalizeDispatchService(r.service_type),
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
    urgency: asUrgency(r.urgency),
    totalPrice: Number(r.price) || 0,
    serviceDate: r.service_date ? String(r.service_date).slice(0, 10) : null,
    crewSize: Number(r.crew_size) || 2,
    crewMembers: Array.isArray(r.crew_members) ? r.crew_members : [],
    status: r.status,
    dispatchState: r.dispatch_state as DispatchState,
    dispatchOfferedTo: r.dispatch_offered_to,
    dispatchOfferExpiresAt: r.dispatch_offer_expires_at,
    dispatchTriedIds: Array.isArray(r.dispatch_tried_ids) ? r.dispatch_tried_ids : [],
  };
}

export async function persistState(
  id: string,
  patch: {
    dispatchState?: DispatchState;
    dispatchOfferedTo?: string | null;
    dispatchOfferExpiresAt?: Date | null;
    dispatchTriedIds?: string[];
    status?: string;
    enRouteAt?: Date | null;
    onSiteAt?: Date | null;
    completedAt?: Date | null;
    crewMembers?: string[];
  },
): Promise<void> {
  type Param = string | number | boolean | Date | string[] | null;
  const sets: string[] = [];
  const params: Param[] = [];
  let i = 1;
  const push = (col: string, val: Param) => { sets.push(`${col} = $${i++}`); params.push(val); };

  if (patch.dispatchState !== undefined) push("dispatch_state", patch.dispatchState);
  if (patch.dispatchOfferedTo !== undefined) push("dispatch_offered_to", patch.dispatchOfferedTo);
  if (patch.dispatchOfferExpiresAt !== undefined) push("dispatch_offer_expires_at", patch.dispatchOfferExpiresAt);
  if (patch.dispatchTriedIds !== undefined) push("dispatch_tried_ids", patch.dispatchTriedIds);
  if (patch.status !== undefined) push("status", patch.status);
  if (patch.enRouteAt !== undefined) push("en_route_at", patch.enRouteAt);
  if (patch.onSiteAt !== undefined) push("on_site_at", patch.onSiteAt);
  if (patch.completedAt !== undefined) push("completed_at", patch.completedAt);
  if (patch.crewMembers !== undefined) push("crew_members", patch.crewMembers);

  if (sets.length === 0) return;
  params.push(id);
  await pool.query(`UPDATE leads SET ${sets.join(", ")} WHERE id = $${i}`, params);
}

/**
 * Conditional accept. Atomic: only flips to `assigned` when the offer
 * is still held by `crewId` and hasn't expired. Returns `true` if the
 * row was updated.
 */
export async function tryAcceptOffer(id: string, crewId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE leads
        SET dispatch_state = 'accepted',
            dispatch_offered_to = NULL,
            dispatch_offer_expires_at = NULL,
            crew_members = (
              CASE WHEN $2 = ANY(COALESCE(crew_members, '{}'))
                   THEN crew_members
                   ELSE array_append(COALESCE(crew_members, '{}'), $2)
              END
            ),
            status = CASE WHEN status IN ('new','open','quote_requested','chatbot_pending','pending')
                          THEN 'available' ELSE status END
      WHERE id = $1
        AND dispatch_state = 'offering'
        AND dispatch_offered_to = $2
        AND (dispatch_offer_expires_at IS NULL OR dispatch_offer_expires_at > now())
      RETURNING id`,
    [id, crewId],
  );
  return rows.length > 0;
}

/**
 * Race-safe offer start. Performs an atomic compare-and-set on
 * dispatch_state: the UPDATE only lands if the row is currently in a
 * state that permits starting an offer (pending, OR an offering row
 * whose crew is already in our tried_ids — meaning the previous offer
 * finished). Returns true if the row was successfully transitioned.
 * This prevents two concurrent dispatch triggers (e.g., retry cron +
 * manual admin dispatch) from racing against one another and one
 * clobbering the other's offer.
 */
export async function tryStartOffer(
  id: string,
  offeredTo: string,
  expiresAt: Date,
  triedIds: string[],
): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE leads
        SET dispatch_state = 'offering',
            dispatch_offered_to = $2,
            dispatch_offer_expires_at = $3,
            dispatch_tried_ids = $4
      WHERE id = $1
        -- pending = brand-new lead; failed = exhausted earlier and
        -- now being retried (admin clicked "Dispatch now" or the retry
        -- cron re-picked it up with fresh eligible crew).
        AND COALESCE(dispatch_state, 'pending') IN ('pending', 'failed')
        AND COALESCE(archived_at IS NULL, true)
        AND status NOT IN ('completed', 'cancelled')
      RETURNING id`,
    [id, offeredTo, expiresAt, triedIds],
  );
  return rows.length > 0;
}

export async function tryDeclineOffer(id: string, crewId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `UPDATE leads
        SET dispatch_state = 'pending',
            dispatch_offered_to = NULL,
            dispatch_offer_expires_at = NULL
      WHERE id = $1
        AND dispatch_state = 'offering'
        AND dispatch_offered_to = $2
      RETURNING id`,
    [id, crewId],
  );
  return rows.length > 0;
}

export async function logDispatchEvent(
  leadId: string,
  event: string,
  crewId: string | null,
  actorUserId: string | null,
  fromState: string | null,
  toState: string | null,
  reason: string,
  data?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO dispatch_log (lead_id, event, crew_id, actor_user_id, from_state, to_state, reason, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [leadId, event, crewId, actorUserId, fromState, toState, reason, data ? JSON.stringify(data) : null],
    );
  } catch (e) {
    console.warn("[dispatch.log] insert failed:", e);
  }
}

// Kill switch (global). Per-service flags land next to this later.
const KILL_SWITCH_KEY = "dispatch.global.enabled";
export async function recheckKillSwitch(): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = $1`,
      [KILL_SWITCH_KEY],
    );
    if (rows.length === 0) return true; // default enabled
    return rows[0].value !== "false";
  } catch {
    return true;
  }
}

export async function setKillSwitch(enabled: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [KILL_SWITCH_KEY, enabled ? "true" : "false"],
  );
}

export async function getDispatchMetrics(): Promise<{
  activeOffers: number;
  pendingJobs: number;
  assignedToday: number;
  avgTimeToAssignSec: number;
  acceptRate7d: number;
  failedToday: number;
}> {
  const [activeQ, pendingQ, assignedQ, ttfoQ, acceptQ, failedQ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS c FROM leads WHERE dispatch_state = 'offering'`),
    pool.query(`SELECT COUNT(*)::int AS c FROM leads
                 WHERE dispatch_state = 'pending' AND archived_at IS NULL
                   AND status NOT IN ('completed','cancelled')`),
    pool.query(`SELECT COUNT(*)::int AS c FROM dispatch_log
                 WHERE event = 'offer_accepted' AND created_at >= date_trunc('day', now())`),
    pool.query(`
      WITH pairs AS (
        SELECT lead_id,
               MIN(CASE WHEN event = 'offer_sent' THEN created_at END) AS first_offer,
               MIN(CASE WHEN event = 'offer_accepted' THEN created_at END) AS accepted
          FROM dispatch_log
         WHERE created_at >= date_trunc('day', now())
         GROUP BY lead_id
      )
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (accepted - first_offer))), 0)::float AS s
        FROM pairs WHERE accepted IS NOT NULL AND first_offer IS NOT NULL`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE event = 'offer_sent') AS sent,
        COUNT(*) FILTER (WHERE event = 'offer_accepted') AS accepted
        FROM dispatch_log
       WHERE created_at >= now() - interval '7 days'`),
    pool.query(`SELECT COUNT(*)::int AS c FROM dispatch_log
                 WHERE event IN ('exhausted','failed') AND created_at >= date_trunc('day', now())`),
  ]);

  const sent = Number(acceptQ.rows[0]?.sent ?? 0);
  const accepted = Number(acceptQ.rows[0]?.accepted ?? 0);
  const acceptRate7d = sent > 0 ? accepted / sent : 0;

  return {
    activeOffers: activeQ.rows[0].c,
    pendingJobs: pendingQ.rows[0].c,
    assignedToday: assignedQ.rows[0].c,
    avgTimeToAssignSec: Math.round(ttfoQ.rows[0].s),
    acceptRate7d,
    failedToday: failedQ.rows[0].c,
  };
}
