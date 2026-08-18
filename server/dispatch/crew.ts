// Task #172 — Crew adapter. Fetches the eligible worker pool + their
// today-load for the engine to score. Capability filtering follows the
// pattern from services/dispatchGeneric.ts so existing workflows stay
// consistent.

import { db, pool } from "../db";
import { users } from "@shared/schema";
import { eq, and, inArray, or, sql } from "drizzle-orm";

export interface CrewCandidate {
  id: string;
  firstName: string | null;
  phoneNumber: string | null;
  capabilities: string[];
  isDriver: boolean;
  acceptedJobTypes: string[] | null;
  jobsToday: number;
  activeJobs: number;
}

const SERVICE_TO_CAPS: Record<string, string[]> = {
  residential: ["mover", "driver"],
  moving: ["mover", "driver"],
  commercial: ["mover", "driver"],
  junk: ["mover", "driver"],
  labor: ["mover"],
  handyman: ["mover"],
  cleaning: [],
  demolition: ["mover"],
  snow: ["driver"],
  flooring: [],
  painting: [],
};

export async function getEligibleCrew(opts: {
  serviceType: string;
  excludeIds?: string[];
  leadId?: string;
  serviceDate?: string | null;
}): Promise<CrewCandidate[]> {
  const skip = new Set(opts.excludeIds ?? []);

  const roster = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      phoneNumber: users.phoneNumber,
      capabilities: users.capabilities,
      isDriver: users.isDriver,
      acceptedJobTypes: users.acceptedJobTypes,
      status: users.status,
      role: users.role,
      isAvailable: users.isAvailable,
    })
    .from(users)
    .where(
      and(
        or(
          eq(users.role, "employee"),
          and(
            inArray(users.role, ["admin", "business_owner"]),
            sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
          ),
        ),
        eq(users.status, "approved"),
        eq(users.isAvailable, true),
      ),
    );

  // Count today's jobs per candidate (raw SQL — index hits are fine here).
  let ids = roster.map(r => r.id).filter(id => !skip.has(id));
  if (ids.length === 0) return [];

  // Never offer two overlapping jobs to the same mover. Exact-time online
  // bookings use their hold windows; legacy jobs without a window reserve
  // the service day conservatively until staff supplies a schedule.
  if (opts.leadId && opts.serviceDate) {
    try {
      const target = await pool.query<{ start_at: Date | null; end_at: Date | null }>(
        `SELECT h.start_at,
                h.start_at + (h.duration_minutes * INTERVAL '1 minute') AS end_at
           FROM booking_slot_holds h
          WHERE h.lead_id = $1 AND h.status IN ('pending_review','awaiting_deposit','confirmed')
          ORDER BY h.created_at DESC LIMIT 1`,
        [opts.leadId],
      );
      const startAt = target.rows[0]?.start_at || null;
      const endAt = target.rows[0]?.end_at || null;
      const conflicts = await pool.query<{ uid: string }>(
        `SELECT DISTINCT uid
           FROM leads l
           CROSS JOIN LATERAL unnest(COALESCE(l.crew_members, '{}')) uid
           LEFT JOIN LATERAL (
             SELECT h.start_at,
                    h.start_at + (h.duration_minutes * INTERVAL '1 minute') AS end_at
               FROM booking_slot_holds h
              WHERE h.lead_id = l.id AND h.status IN ('pending_review','awaiting_deposit','confirmed')
              ORDER BY h.created_at DESC LIMIT 1
           ) scheduled ON true
          WHERE l.id <> $1
            AND l.archived_at IS NULL
            AND l.status NOT IN ('completed','cancelled','archived')
            AND substring(COALESCE(l.confirmed_date, l.move_date, ''), 1, 10) = $2
            AND uid = ANY($3::text[])
            AND (
              $4::timestamptz IS NULL OR $5::timestamptz IS NULL
              OR scheduled.start_at IS NULL OR scheduled.end_at IS NULL
              OR (scheduled.start_at < $5::timestamptz AND scheduled.end_at > $4::timestamptz)
            )`,
        [opts.leadId, opts.serviceDate, ids, startAt, endAt],
      );
      const blocked = new Set(conflicts.rows.map((row) => row.uid));
      ids = ids.filter((id) => !blocked.has(id));
      if (ids.length === 0) return [];
    } catch (error) {
      // Older databases may not have the hold table until the booking route
      // initializes. Fall back to a same-day conflict check and fail closed
      // for workers already assigned to another active job.
      console.warn("[dispatch.crew] exact schedule check unavailable; using date conflict fallback:", error instanceof Error ? error.message : error);
      const conflicts = await pool.query<{ uid: string }>(
        `SELECT DISTINCT uid
           FROM leads l, unnest(COALESCE(l.crew_members, '{}')) uid
          WHERE l.id <> $1
            AND l.archived_at IS NULL
            AND l.status NOT IN ('completed','cancelled','archived')
            AND substring(COALESCE(l.confirmed_date, l.move_date, ''), 1, 10) = $2
            AND uid = ANY($3::text[])`,
        [opts.leadId, opts.serviceDate, ids],
      );
      const blocked = new Set(conflicts.rows.map((row) => row.uid));
      ids = ids.filter((id) => !blocked.has(id));
      if (ids.length === 0) return [];
    }
  }

  const todayRows = await pool.query(
    `SELECT uid, COUNT(*)::int AS c
       FROM leads, unnest(COALESCE(crew_members, '{}')) uid
      WHERE archived_at IS NULL
        AND COALESCE(confirmed_date::date, move_date::date, created_at::date) = CURRENT_DATE
        AND uid = ANY($1::text[])
      GROUP BY uid`,
    [ids],
  );
  const todayMap = new Map<string, number>(
    (todayRows.rows as Array<{ uid: string; c: number }>).map(r => [r.uid, Number(r.c) || 0]),
  );

  // Active (non-completed, non-cancelled) assignments — soft workload signal.
  const activeRows = await pool.query(
    `SELECT uid, COUNT(*)::int AS c
       FROM leads l, unnest(COALESCE(l.crew_members, '{}')) uid
      WHERE l.archived_at IS NULL
        AND l.status NOT IN ('completed', 'cancelled')
        AND uid = ANY($1::text[])
      GROUP BY uid`,
    [ids],
  );
  const activeMap = new Map<string, number>(
    (activeRows.rows as Array<{ uid: string; c: number }>).map(r => [r.uid, Number(r.c) || 0]),
  );

  const required = SERVICE_TO_CAPS[opts.serviceType] ?? [];

  const candidates: CrewCandidate[] = roster
    .filter(r => ids.includes(r.id))
    .map(r => ({
      id: r.id,
      firstName: r.firstName,
      phoneNumber: r.phoneNumber,
      capabilities: r.capabilities ?? [],
      isDriver: !!r.isDriver,
      acceptedJobTypes: r.acceptedJobTypes ?? null,
      jobsToday: todayMap.get(r.id) ?? 0,
      activeJobs: activeMap.get(r.id) ?? 0,
    }))
    .filter(c => {
      // Accepted job types opt-in (empty array = default all).
      if (c.acceptedJobTypes && c.acceptedJobTypes.length > 0) {
        if (!c.acceptedJobTypes.includes(opts.serviceType)) return false;
      }
      // Capability gate: require at least one if any are listed.
      if (required.length === 0) return true;
      if (c.capabilities.length === 0 && c.isDriver) return true; // legacy fallback
      if (c.capabilities.length === 0) return true; // untagged workers still eligible
      return required.some(cap => c.capabilities.includes(cap)) || (required.includes("driver") && c.isDriver);
    });

  return candidates;
}
