export const DEFAULT_PAYROLL_TIMEZONE = "America/Chicago";

export type PayrollEntryType =
  | "classification_wage"
  | "driver_premium"
  | "profit_bonus"
  // Historical names remain readable so older ledger entries retain their audit trail.
  | "company_tip"
  | "crew_profit_bonus"
  | "authority_bonus"
  | "customer_tip"
  | "daily_cash_offset"
  | "manual_adjustment";

export type PayrollCandidate = {
  workerId: string;
  leadId: string | null;
  sourceType: PayrollEntryType;
  sourceId: string;
  amount: number;
  earningDate: Date;
  description: string;
  metadata?: Record<string, unknown>;
};

export type EarningsPeriodType = "monthly_payroll" | "quarterly_profit_bonus";

export function earningsPeriodForSource(sourceType: PayrollEntryType): EarningsPeriodType {
  return sourceType === "profit_bonus" || sourceType === "company_tip" || sourceType === "crew_profit_bonus"
    ? "quarterly_profit_bonus"
    : "monthly_payroll";
}

export function payrollSourceAuditKey(sourceType: PayrollEntryType | string, sourceId: string): string {
  const canonicalType = sourceType === "company_tip" || sourceType === "crew_profit_bonus" ? "profit_bonus" : sourceType;
  return `${canonicalType}:${sourceId}`;
}

export function roundPayrollMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parsePayrollPeriodKey(periodKey: string) {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (!monthMatch && !quarterMatch) throw new Error("Earnings period must use YYYY-MM or YYYY-Q1 through YYYY-Q4.");
  const year = Number((monthMatch || quarterMatch)![1]);
  if (year < 2000 || year > 2200) throw new Error("Earnings period is outside the supported range.");

  if (monthMatch) {
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) throw new Error("Payroll month is outside the supported range.");
    const startDate = `${monthMatch[1]}-${monthMatch[2]}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextPeriodStart = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(nextYear, nextMonth - 1, 0));
    const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
    return { periodKey, periodType: "monthly_payroll" as const, startDate, endDate, nextPeriodStart, nextMonthStart: nextPeriodStart };
  }

  const quarter = Number(quarterMatch![2]);
  const startMonth = (quarter - 1) * 3 + 1;
  const nextQuarterMonth = startMonth + 3;
  const nextYear = nextQuarterMonth > 12 ? year + 1 : year;
  const normalizedNextMonth = nextQuarterMonth > 12 ? 1 : nextQuarterMonth;
  const startDate = `${year}-${String(startMonth).padStart(2, "0")}-01`;
  const nextPeriodStart = `${nextYear}-${String(normalizedNextMonth).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(nextYear, normalizedNextMonth - 1, 0));
  const endDate = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`;
  return { periodKey, periodType: "quarterly_profit_bonus" as const, startDate, endDate, nextPeriodStart, nextMonthStart: nextPeriodStart };
}

export function calculateCashSplitAdjustment(input: {
  eligibleEarnings: number;
  targetPercent: number;
  previousPercent?: number;
  previousCashAmount?: number;
}) {
  const eligibleEarnings = roundPayrollMoney(Math.max(0, Number(input.eligibleEarnings) || 0));
  const targetPercent = Math.min(100, Math.max(0, Number(input.targetPercent) || 0));
  const previousPercent = Math.min(100, Math.max(0, Number(input.previousPercent) || 0));
  const previousCashAmount = roundPayrollMoney(Math.max(0, Number(input.previousCashAmount) || 0));
  const targetCashAmount = roundPayrollMoney(eligibleEarnings * targetPercent / 100);
  const deltaAmount = roundPayrollMoney(targetCashAmount - previousCashAmount);
  return {
    eligibleEarnings,
    targetPercent,
    previousPercent,
    previousCashAmount,
    targetCashAmount,
    deltaAmount,
    remainingPayrollAmount: roundPayrollMoney(eligibleEarnings - targetCashAmount),
  };
}

export function summarizePayrollCandidates(candidates: PayrollCandidate[]) {
  const byWorker = new Map<string, number>();
  let total = 0;
  for (const candidate of candidates) {
    total = roundPayrollMoney(total + candidate.amount);
    byWorker.set(candidate.workerId, roundPayrollMoney((byWorker.get(candidate.workerId) || 0) + candidate.amount));
  }
  return {
    total,
    byWorker: Array.from(byWorker, ([workerId, amount]) => ({ workerId, amount })),
  };
}
