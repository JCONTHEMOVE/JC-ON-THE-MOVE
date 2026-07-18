import { db } from "../db";
import { users, leads, notifications } from "@shared/schema";
import { eq, and, inArray, or, sql } from "drizzle-orm";

export type JobKind = "moving" | "labor";

interface DispatchGenericOptions {
  leadId: string;
  kind: JobKind;
  crewSize: number;
  existingCrew?: string[];
  excludeIds?: string[];
}

/**
 * Capability-aware dispatch for Moving and Labor jobs.
 *
 * Moving: requires at least one `driver`; remaining slots filled by `mover`.
 * Labor:  requires only `mover` capability; workers with truck caps are also eligible.
 * Truck:  requires `driver` with `truck_small` or `truck_large` cap (not used here directly).
 *
 * Falls back to `isDriver` flag when no capability tags are set, mirroring junk dispatch.
 */
export async function dispatchGenericJob(opts: DispatchGenericOptions): Promise<string[]> {
  const { leadId, kind, crewSize, existingCrew = [], excludeIds = [] } = opts;
  const skipIds = [...new Set([...existingCrew, ...excludeIds])];
  const slotsNeeded = crewSize - existingCrew.length;
  if (slotsNeeded <= 0) return [];

  const baseWhere = and(
    eq(users.isAvailable, true),
    or(
      eq(users.role, "employee"),
      and(
        inArray(users.role, ["admin", "business_owner"]),
        sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
      ),
    ),
    eq(users.status, "approved"),
    skipIds.length > 0
      ? sql`${users.id} != ALL(${skipIds}::text[])`
      : undefined,
  );

  const fetchLimit = Math.max(slotsNeeded * 4, slotsNeeded + 8);

  const candidates = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      isDriver: users.isDriver,
      capabilities: users.capabilities,
    })
    .from(users)
    .where(baseWhere)
    .limit(fetchLimit);

  const hasCapability = (caps: string[] | null, ...required: string[]): boolean => {
    if (!caps || caps.length === 0) return false;
    return required.some(r => caps.includes(r));
  };

  let sorted: typeof candidates;

  if (kind === "moving") {
    // Moving: driver first, then movers; fall back to isDriver flag
    const drivers = candidates.filter(c =>
      hasCapability(c.capabilities, "driver") || c.isDriver
    );
    const movers = candidates.filter(c =>
      !hasCapability(c.capabilities, "driver") && !c.isDriver &&
      (hasCapability(c.capabilities, "mover") || (c.capabilities ?? []).length === 0)
    );
    sorted = [...drivers, ...movers];
  } else {
    // Labor: any mover-capable or truck-capable worker; drivers also eligible
    const primary = candidates.filter(c =>
      hasCapability(c.capabilities, "mover", "truck_small", "truck_large") ||
      (c.capabilities ?? []).length === 0
    );
    const fallback = candidates.filter(c => !primary.includes(c));
    sorted = [...primary, ...fallback];
  }

  const picked = sorted.slice(0, slotsNeeded);
  const newIds = picked.map(w => w.id);
  const mergedCrew = [...existingCrew, ...newIds];
  const fullyStaffed = mergedCrew.length >= crewSize;

  await db.update(leads)
    .set({
      crewMembers: mergedCrew,
      status: fullyStaffed ? "available" : "new",
    })
    .where(eq(leads.id, leadId));

  for (const worker of picked) {
    await db.insert(notifications).values({
      userId: worker.id,
      type: "job_assigned",
      title: "New Job Assignment",
      message: "You've been assigned to a job. Please accept or decline from your dashboard.",
      data: { leadId },
    });
  }

  return newIds;
}
