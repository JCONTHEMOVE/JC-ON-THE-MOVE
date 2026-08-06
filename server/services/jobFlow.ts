import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { jobPayoutCalculations, jobWorkerPayouts, type Lead } from "@shared/schema";
import {
  buildJobFlow,
  type JobFlow,
  type JobPayoutSummary,
} from "@shared/job-flow";
import { derivePaymentStatusFromRecord } from "./paymentStatus";

export type JobFlowRecord = Lead & { flow: JobFlow };

type PayoutCalculationRow = {
  leadId: string;
  status: string;
  createdAt: Date;
};

type WorkerPayoutRow = {
  leadId: string;
  payoutStatus: string;
  rewardsIssuedAt: Date | null;
};

function payoutSummaryFor(
  lead: Lead,
  calculation: PayoutCalculationRow | undefined,
  workerPayouts: WorkerPayoutRow[],
): JobPayoutSummary {
  const completed = String(lead.status || "").toLowerCase() === "completed" || Boolean(lead.completedAt);
  if (!completed) {
    return { state: "not_ready", label: "Not ready", workerPayoutCount: 0, rewardsIssued: 0 };
  }

  const workerPayoutCount = workerPayouts.length;
  const rewardsIssued = workerPayouts.filter((row) => Boolean(row.rewardsIssuedAt)).length;
  const paid = workerPayoutCount > 0 && workerPayouts.every((row) => ["manual_paid", "stripe_paid"].includes(String(row.payoutStatus || "").toLowerCase()));

  if (!calculation) {
    return {
      state: "approval_required",
      label: "Payout approval needed",
      workerPayoutCount,
      rewardsIssued,
      calculationStatus: null,
    };
  }
  if (paid && rewardsIssued >= workerPayoutCount) {
    return {
      state: "paid",
      label: "Payout and JCMOVES issued",
      workerPayoutCount,
      rewardsIssued,
      calculationStatus: calculation.status,
    };
  }
  return {
    state: "pending",
    label: "Payout in progress",
    workerPayoutCount,
    rewardsIssued,
    calculationStatus: calculation.status,
  };
}

/** Build the one job card projection consumed by Admin and crew surfaces. */
export async function buildJobFlowRecords(leadRows: Lead[]): Promise<JobFlowRecord[]> {
  const leadIds = leadRows.map((lead) => lead.id).filter(Boolean);
  if (leadIds.length === 0) return [];

  const [calculationRows, workerRows] = await Promise.all([
    db.select({
      leadId: jobPayoutCalculations.leadId,
      status: jobPayoutCalculations.status,
      createdAt: jobPayoutCalculations.createdAt,
    })
      .from(jobPayoutCalculations)
      .where(inArray(jobPayoutCalculations.leadId, leadIds))
      .orderBy(desc(jobPayoutCalculations.createdAt)),
    db.select({
      leadId: jobWorkerPayouts.leadId,
      payoutStatus: jobWorkerPayouts.payoutStatus,
      rewardsIssuedAt: jobWorkerPayouts.rewardsIssuedAt,
    })
      .from(jobWorkerPayouts)
      .where(inArray(jobWorkerPayouts.leadId, leadIds)),
  ]);

  const latestCalculationByLead = new Map<string, PayoutCalculationRow>();
  for (const row of calculationRows) {
    if (!latestCalculationByLead.has(row.leadId)) latestCalculationByLead.set(row.leadId, row);
  }
  const workerPayoutsByLead = new Map<string, WorkerPayoutRow[]>();
  for (const row of workerRows) {
    const group = workerPayoutsByLead.get(row.leadId) || [];
    group.push(row);
    workerPayoutsByLead.set(row.leadId, group);
  }

  return leadRows.map((lead) => {
    const payment = derivePaymentStatusFromRecord(lead as any);
    const payout = payoutSummaryFor(
      lead,
      latestCalculationByLead.get(lead.id),
      workerPayoutsByLead.get(lead.id) || [],
    );
    return {
      ...lead,
      flow: buildJobFlow(lead, { payment, payout }),
    };
  });
}

export function jobBelongsToCrew(lead: Pick<Lead, "crewMembers" | "assignedToUserId">, userId: string) {
  return lead.assignedToUserId === userId
    || (Array.isArray(lead.crewMembers) && lead.crewMembers.includes(userId));
}

export function boardLocation(address: string | null | undefined) {
  const parts = String(address || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return parts[0] || null;
}

/** Do not send customer address, contact, notes, or quote internals to unassigned crew. */
export function toCrewBoardFlow(record: JobFlowRecord, userId: string) {
  const { firstName, lastName, phone, email, details, dispatchNotes, toAddress, quoteSnapshot, zoneSnapshot, jobPlanDetails, accessInstructionsCiphertext, ...safe } = record as any;
  return {
    ...safe,
    fromAddress: boardLocation(record.fromAddress),
    toAddress: null,
    details: null,
    dispatchNotes: null,
    quoteSnapshot: null,
    zoneSnapshot: null,
    alreadyApplied: record.flow.crew.isClaimed && (record.crewMembers || []).includes(userId),
    crewSlotsFilled: record.flow.crew.claimed,
  };
}
