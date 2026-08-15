import assert from "node:assert/strict";
import { calculateCashSplitAdjustment, earningsPeriodForSource, parsePayrollPeriodKey, payrollSourceAuditKey, summarizePayrollCandidates } from "../../../shared/payroll";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed += 1; console.log(`OK ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); process.exitCode = 1; }
}

console.log("payroll ledger helpers");

test("parses monthly payroll boundaries", () => {
  assert.deepEqual(parsePayrollPeriodKey("2026-08"), {
    periodKey: "2026-08", periodType: "monthly_payroll", startDate: "2026-08-01", endDate: "2026-08-31", nextPeriodStart: "2026-09-01", nextMonthStart: "2026-09-01",
  });
});

test("parses quarterly profit-bonus boundaries across year end", () => {
  assert.deepEqual(parsePayrollPeriodKey("2026-Q4"), {
    periodKey: "2026-Q4", periodType: "quarterly_profit_bonus", startDate: "2026-10-01", endDate: "2026-12-31", nextPeriodStart: "2027-01-01", nextMonthStart: "2027-01-01",
  });
});

test("routes customer tips monthly and profit bonuses quarterly", () => {
  assert.equal(earningsPeriodForSource("customer_tip"), "monthly_payroll");
  assert.equal(earningsPeriodForSource("classification_wage"), "monthly_payroll");
  assert.equal(earningsPeriodForSource("profit_bonus"), "quarterly_profit_bonus");
  assert.equal(earningsPeriodForSource("company_tip"), "quarterly_profit_bonus");
  assert.equal(earningsPeriodForSource("crew_profit_bonus"), "quarterly_profit_bonus");
  assert.equal(payrollSourceAuditKey("company_tip", "payout-1"), payrollSourceAuditKey("profit_bonus", "payout-1"));
});

test("cash dial edits return an append-only delta", () => {
  assert.deepEqual(calculateCashSplitAdjustment({ eligibleEarnings: 200, previousPercent: 25, previousCashAmount: 50, targetPercent: 60 }), {
    eligibleEarnings: 200, targetPercent: 60, previousPercent: 25, previousCashAmount: 50, targetCashAmount: 120, deltaAmount: 70, remainingPayrollAmount: 80,
  });
  assert.equal(calculateCashSplitAdjustment({ eligibleEarnings: 200, previousPercent: 60, previousCashAmount: 120, targetPercent: 10 }).deltaAmount, -100);
});

test("payroll summaries preserve cash offsets", () => {
  const summary = summarizePayrollCandidates([
    { workerId: "a", leadId: "j", sourceType: "classification_wage", sourceId: "1", amount: 200, earningDate: new Date(), description: "wages" },
    { workerId: "a", leadId: "j", sourceType: "daily_cash_offset", sourceId: "2", amount: -80, earningDate: new Date(), description: "cash" },
  ]);
  assert.equal(summary.total, 120);
  assert.deepEqual(summary.byWorker, [{ workerId: "a", amount: 120 }]);
});

console.log(`\n${passed} payroll ledger test(s) passed.`);
