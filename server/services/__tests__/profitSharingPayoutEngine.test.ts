// Framework-free assertions for the JC ON THE MOVE profit-share payout engine.
//
// Run directly:
//   npx --no-install tsx server/services/__tests__/profitSharingPayoutEngine.test.ts
//
// Also auto-discovered by:
//   bash scripts/run-server-tests.sh

import assert from "node:assert/strict";
import type { ProfitShareJobInput, ProfitShareRole } from "../../../shared/jobPayout";
import {
  calculateProfitSharingPayout,
  defaultBonusWeightsForCrew,
  normalizeProfitShareSettings,
} from "../profitSharingPayoutEngine";

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function baseJob(overrides: Partial<ProfitShareJobInput> = {}): ProfitShareJobInput {
  return {
    jobId: "job_1000",
    customerName: "Example Customer",
    jobType: "moving",
    status: "customer_approved",
    grossRevenue: 1000,
    dumpFees: 0,
    otherExpenses: 0,
    referralPartnerId: "partner_1",
    referralPartnerName: "Referral Partner",
    settings: normalizeProfitShareSettings(),
    workers: [
      {
        workerId: "lead_1",
        workerName: "Lead Mover",
        roleOnJob: "lead_mover",
        hourlyRate: 30,
        hoursWorked: 4,
        bonusWeight: 1.5,
      },
      {
        workerId: "mover_1",
        workerName: "Mover",
        roleOnJob: "mover",
        hourlyRate: 25,
        hoursWorked: 4,
        bonusWeight: 1,
      },
    ],
    ...overrides,
  };
}

console.log("profitSharingPayoutEngine()");

test("matches the $1,000 launch-plan example with referral partner", () => {
  const preview = calculateProfitSharingPayout(baseJob());

  assert.equal(preview.guaranteedLaborTotal, 220);
  assert.equal(preview.fuelReserve, 50);
  assert.equal(preview.vehicleReserve, 50);
  assert.equal(preview.insuranceReserve, 25);
  assert.equal(preview.processingFees, 30);
  assert.equal(preview.totalExpensesAndReserves, 155);
  assert.equal(preview.netJobProfit, 625);
  assert.equal(preview.companyProfit, 437.5);
  assert.equal(preview.crewBonusPool, 125);
  assert.equal(preview.referralPayout, 31.25);
  assert.equal(preview.growthFund, 31.25);
  assert.equal(preview.totalLaborHours, 8);
  assert.equal(preview.profitPerLaborHour, 78.13);
  assert.equal(preview.profitMarginPct, 0.625);
  assert.equal(preview.adminOverrideRequired, false);

  assert.equal(preview.workerPayouts[0].hourlyPay, 120);
  assert.equal(preview.workerPayouts[0].bonusPay, 75);
  assert.equal(preview.workerPayouts[0].totalPay, 195);
  assert.equal(preview.workerPayouts[0].jcmovesRewardAmount, 0);

  assert.equal(preview.workerPayouts[1].hourlyPay, 100);
  assert.equal(preview.workerPayouts[1].bonusPay, 50);
  assert.equal(preview.workerPayouts[1].totalPay, 150);
});

test("rolls referral share into company profit when no referral partner is attached", () => {
  const preview = calculateProfitSharingPayout(baseJob({
    referralPartnerId: null,
    referralPartnerName: null,
  }));

  assert.equal(preview.referralPayout, 0);
  assert.equal(preview.companyProfit, 468.75);
  assert.ok(preview.notes.some((note) => note.includes("referral share rolls into company profit")));
});

test("zero-profit jobs require override and pay no non-hourly pools", () => {
  const preview = calculateProfitSharingPayout(baseJob({
    grossRevenue: 1000,
    workers: [
      {
        workerId: "lead_1",
        workerName: "Lead Mover",
        roleOnJob: "lead_mover",
        hourlyRate: 211.25,
        hoursWorked: 4,
        bonusWeight: 100,
      },
    ],
  }));

  assert.equal(preview.guaranteedLaborTotal, 845);
  assert.equal(preview.totalExpensesAndReserves, 155);
  assert.equal(preview.netJobProfit, 0);
  assert.equal(preview.companyProfit, 0);
  assert.equal(preview.crewBonusPool, 0);
  assert.equal(preview.referralPayout, 0);
  assert.equal(preview.growthFund, 0);
  assert.equal(preview.adminOverrideRequired, true);
});

test("negative-profit jobs preserve hourly pay but block bonus/referral/growth pools", () => {
  const preview = calculateProfitSharingPayout(baseJob({
    grossRevenue: 500,
    referralPartnerId: "partner_1",
    workers: [
      {
        workerId: "lead_1",
        workerName: "Lead Mover",
        roleOnJob: "lead_mover",
        hourlyRate: 200,
        hoursWorked: 3,
        bonusWeight: 100,
      },
    ],
  }));

  assert.equal(preview.guaranteedLaborTotal, 600);
  assert.equal(preview.totalExpensesAndReserves, 77.5);
  assert.equal(preview.netJobProfit, -177.5);
  assert.equal(preview.companyProfit, -177.5);
  assert.equal(preview.crewBonusPool, 0);
  assert.equal(preview.referralPayout, 0);
  assert.equal(preview.growthFund, 0);
  assert.equal(preview.workerPayouts[0].hourlyPay, 600);
  assert.equal(preview.workerPayouts[0].bonusPay, 0);
  assert.equal(preview.adminOverrideRequired, true);
});

test("default quarterly profit-bonus weights follow worker classification", () => {
  const two: ProfitShareRole[] = ["lead_mover", "mover"];
  const three: ProfitShareRole[] = ["lead_mover", "mover", "helper"];
  const four: ProfitShareRole[] = ["lead_mover", "mover", "mover", "helper"];

  assert.deepEqual(defaultBonusWeightsForCrew(two), [1.5, 1]);
  assert.deepEqual(defaultBonusWeightsForCrew(three), [1.5, 1, 0.75]);
  assert.deepEqual(defaultBonusWeightsForCrew(four), [1.5, 1, 1, 0.75]);
});

test("adds a driver premium and snapshots a Silver 5% authority bonus", () => {
  const preview = calculateProfitSharingPayout(baseJob({
    workers: [{
      workerId: "lead_1",
      workerName: "Lead Driver",
      roleOnJob: "lead_mover",
      hourlyRate: 30,
      hoursWorked: 4,
      bonusWeight: 1.5,
      isDriverForJob: true,
      driverHourlyPremium: 5,
      authorityTier: "silver",
    }],
  }));
  const worker = preview.workerPayouts[0];
  assert.equal(worker.classificationPay, 120);
  assert.equal(worker.driverPremiumPay, 20);
  assert.equal(worker.authorityBonusPct, 0.05);
  assert.equal(worker.authorityBonusPay, 7);
  assert.equal(worker.jcmovesRewardAmount, 0);
});

console.log(`\n${passed} profit-share payout test(s) passed.`);
if (process.exitCode) {
  console.error("Some profit-share payout tests FAILED.");
} else {
  console.log("All profit-share payout tests passed.");
}
