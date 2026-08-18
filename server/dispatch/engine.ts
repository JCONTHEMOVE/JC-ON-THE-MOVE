// Task #172 — Scoring engine. Given a job and the eligible crew pool,
// ranks candidates using the formula:
//
//   score = 100 - (distanceMi × 8) - (jobsToday × 6)
//           + (urgency === 'high' ? 15 : 0)
//           + (totalPrice > 800 ? max(0, 10 - jobsToday) : 0)
//
// Territory membership is a hard filter when lat/lng are known. When
// they're not, we drop the territory gate (territory data is advisory
// at that point) and rely on workload + capability alone.

import { inAnyTerritory } from "./territories";
import { getEligibleCrew } from "./crew";
import type { DispatchCandidate } from "./types";
import { getDemandForCoords } from "../demand";
import { pool } from "../db";

export interface RankJob {
  id: string;
  serviceType: string;
  lat: number | null;
  lng: number | null;
  urgency: "low" | "normal" | "high";
  totalPrice: number;
  serviceDate?: string | null;
}

async function hasApprovedExtendedQuote(leadId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ travel_eligibility: Record<string, unknown> | null }>(
      `SELECT travel_eligibility
         FROM quote_revisions
        WHERE lead_id = $1 AND status IN ('approved','sent')
        ORDER BY revision DESC LIMIT 1`,
      [leadId],
    );
    const eligibility = rows[0]?.travel_eligibility || {};
    return eligibility.canApprove !== false
      && eligibility.routeVerified === true
      && ["local", "extended_auto", "owner_review"].includes(String(eligibility.status || ""));
  } catch {
    return false;
  }
}

export async function rankCandidates(
  job: RankJob,
  excludeIds: string[] = [],
): Promise<DispatchCandidate[]> {
  const crewPool = await getEligibleCrew({
    serviceType: job.serviceType,
    excludeIds,
    leadId: job.id,
    serviceDate: job.serviceDate,
  });
  if (crewPool.length === 0) return [];

  // Task #174 — When the job's zone is hot (>0.7), reward crews who
  // are already close by doubling the per-mile distance penalty. The
  // effect is marginal today (distance is a stub 10mi flat) but the
  // hook is in place for Task #173 GPS-derived distances.
  const { demand } = await getDemandForCoords(job.lat, job.lng);
  const distanceWeight = demand && demand.score > 0.7 ? 16 : 8;

  const hasCoords = typeof job.lat === "number" && typeof job.lng === "number";
  const inTerritory = hasCoords ? inAnyTerritory(job.lat!, job.lng!) : true;

  const locationMap = new Map<string, { lat: number; lng: number; fresh: boolean }>();
  if (crewPool.length > 0) {
    const { rows } = await pool.query<{ user_id: string; lat: string; lng: string; fresh: boolean }>(
      `SELECT user_id, lat, lng, updated_at >= NOW() - INTERVAL '15 minutes' AS fresh
         FROM crew_locations
        WHERE user_id = ANY($1::varchar[])`,
      [crewPool.map((crew) => crew.id)],
    ).catch(() => ({ rows: [] }));
    for (const row of rows) {
      locationMap.set(row.user_id, { lat: Number(row.lat), lng: Number(row.lng), fresh: row.fresh === true });
    }
  }

  // Hard territory gate: when the job has coordinates AND falls outside
  // all configured service territories, no offers are sent. This
  // matches the Ironwood / Iron River / WI Border service-area policy
  // — out-of-area jobs must be handled manually by an operator rather
  // than auto-dispatched. Callers see an empty ranking and the offer
  // loop persists dispatch_state='failed' with reason 'no eligible crew'.
  if (hasCoords && !inTerritory && !(await hasApprovedExtendedQuote(job.id))) {
    return [];
  }

  const scored: DispatchCandidate[] = crewPool.map(c => {
    const location = locationMap.get(c.id);
    const locationFresh = !!location?.fresh;
    const distanceMi = hasCoords && locationFresh
      ? haversineMiles(job.lat!, job.lng!, location!.lat, location!.lng)
      : hasCoords ? 10 : 0;

    const reasons: string[] = [];
    let score = 100 - distanceMi * distanceWeight - c.jobsToday * 6;
    reasons.push(`base=100`);
    if (distanceMi > 0) reasons.push(`dist -${Math.round(distanceMi * distanceWeight)}${distanceWeight === 16 ? " (hot zone ×2)" : ""}`);
    if (c.jobsToday > 0) reasons.push(`load -${c.jobsToday * 6}`);
    if (hasCoords && !locationFresh) {
      score -= 8;
      reasons.push("stale/no GPS -8");
    }

    if (job.urgency === "high") {
      score += 15;
      reasons.push("urgency +15");
    }
    if (job.totalPrice > 800) {
      const hiBonus = Math.max(0, 10 - c.jobsToday);
      if (hiBonus > 0) {
        score += hiBonus;
        reasons.push(`hi-value +${hiBonus}`);
      }
    }

    // Slight bonus for drivers on moving/junk/snow jobs so the first
    // offer naturally lands on someone who can drive the truck.
    if ((job.serviceType === "moving" || job.serviceType === "residential" ||
         job.serviceType === "junk" || job.serviceType === "snow") && c.isDriver) {
      score += 5;
      reasons.push("driver +5");
    }

    return {
      crewId: c.id,
      isDriver: c.isDriver,
      score: Math.round(score),
      distanceMi: Math.round(distanceMi * 10) / 10,
      locationFresh,
      jobsToday: c.jobsToday,
      reasons,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusMiles = 3958.8;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
