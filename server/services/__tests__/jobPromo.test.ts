import assert from "node:assert/strict";
import { applyFixedMovingPackageOffer, applyPercentageMovingPromo, jobPromoAvailabilityReason } from "../jobPromo";
import { calculateJobQuoteFromRateCard } from "../jobRateCard";

const rateCard = {
  laborRatePerMoverHour: 87.5,
  truckFlat: 300,
  trailerFlat: 175,
  stairsPerFlight: 25,
  elevatorFlat: 30,
  jcmovesPerDollar: 15,
};

const automaticQuote = calculateJobQuoteFromRateCard(rateCard, {
  crewSize: 4,
  confirmedHours: 4,
  truckConfig: "company_truck",
  trailerRequested: true,
});

const promo = {
  code: "LOCAL4X4",
  description: "Local 4 movers x 4 hours special",
  jobOffer: {
    kind: "fixed_moving_package" as const,
    fixedBasePrice: 1000,
    requiredCrewSize: 4,
    requiredHours: 4,
    localMilesMax: 10,
    requiresCompanyTruck: true,
    requiresTrailer: true,
  },
};

const applied = applyFixedMovingPackageOffer({
  promo,
  automaticQuote,
  crewSize: 4,
  confirmedHours: 4,
  verifiedLocalMiles: 8,
});
assert.equal(applied.applied, true);
assert.equal(applied.quote.total, 1000);
assert.equal(applied.quote.packagePrice, 1000);
assert.equal(applied.quote.rewardEligibleTotal, automaticQuote.total);
assert.equal(applied.quote.projectedCustomerJcMoves, 28125);
assert.equal(applied.quote.promotion?.includesCompanyTruck, true);
assert.equal(applied.quote.promotion?.includesTrailer, true);

const access = applyFixedMovingPackageOffer({
  promo,
  automaticQuote: calculateJobQuoteFromRateCard(rateCard, {
    crewSize: 4,
    confirmedHours: 4,
    truckConfig: "company_truck",
    trailerRequested: true,
    stairsFlights: 2,
    hasElevator: true,
  }),
  crewSize: 4,
  confirmedHours: 4,
  verifiedLocalMiles: 8,
});
assert.equal(access.quote.total, 1080);

const remote = applyFixedMovingPackageOffer({
  promo,
  automaticQuote,
  crewSize: 4,
  confirmedHours: 4,
  verifiedLocalMiles: 11,
});
assert.equal(remote.applied, false);
assert.match(remote.reason || "", /within 10 miles/);

const wrongHours = applyFixedMovingPackageOffer({
  promo,
  automaticQuote,
  crewSize: 4,
  confirmedHours: 3,
  verifiedLocalMiles: 8,
});
assert.equal(wrongHours.applied, false);
assert.match(wrongHours.reason || "", /exactly 4 movers for 4 hours/);

const localThreeByTwoPromo = {
  code: "LOCAL3X2",
  description: "September local labor special",
  isActive: true,
  expiresAt: new Date("2026-10-01T04:59:59.999Z"),
  maxUses: null,
  usesCount: 0,
  jobOffer: {
    kind: "fixed_moving_package" as const,
    fixedBasePrice: 450,
    requiredCrewSize: 3,
    requiredHours: 2,
    allowedWorkScopes: ["load_only", "unload_only"] as const,
    equipmentPolicy: "labor_only" as const,
    localZoneCodes: ["IRONWOOD_LOCAL"],
  },
};
const localThreeByTwoRateCard = calculateJobQuoteFromRateCard(rateCard, {
  crewSize: 3,
  confirmedHours: 2,
  truckConfig: "customer_truck",
});
const localThreeByTwo = applyFixedMovingPackageOffer({
  promo: localThreeByTwoPromo,
  automaticQuote: localThreeByTwoRateCard,
  crewSize: 3,
  confirmedHours: 2,
  workScope: "load_only",
  truckConfig: "customer_truck",
  trailerRequested: false,
  verifiedLocalZoneCode: "IRONWOOD_LOCAL",
});
assert.equal(localThreeByTwo.applied, true);
assert.equal(localThreeByTwo.quote.total, 450);
assert.equal(localThreeByTwo.quote.rewardEligibleTotal, 525);
assert.equal(localThreeByTwo.quote.projectedCustomerJcMoves, 7_875);
assert.equal(localThreeByTwo.quote.promotion?.includesCompanyTruck, false);
assert.equal(localThreeByTwo.quote.promotion?.includesTrailer, false);

for (const [label, override, reason] of [
  ["crew", { crewSize: 2 }, /exactly 3 movers for 2 hours/],
  ["hours", { confirmedHours: 3 }, /exactly 3 movers for 2 hours/],
  ["scope", { workScope: "load_unload" }, /limited to load only or unload only/],
  ["truck", { truckConfig: "company_truck" }, /labor-only/],
  ["trailer", { trailerRequested: true }, /labor-only/],
  ["location", { verifiedLocalZoneCode: null }, /approved local service zone/],
] as const) {
  const rejected = applyFixedMovingPackageOffer({
    promo: localThreeByTwoPromo,
    automaticQuote: localThreeByTwoRateCard,
    crewSize: 3,
    confirmedHours: 2,
    workScope: "load_only",
    truckConfig: "customer_truck",
    trailerRequested: false,
    verifiedLocalZoneCode: "IRONWOOD_LOCAL",
    ...override,
  });
  assert.equal(rejected.applied, false, `${label} mismatch must be rejected`);
  assert.match(rejected.reason || "", reason);
}

assert.equal(jobPromoAvailabilityReason(localThreeByTwoPromo, new Date("2026-10-01T04:59:59.999Z")), null);
assert.match(jobPromoAvailabilityReason(localThreeByTwoPromo, new Date("2026-10-01T05:00:00.000Z")) || "", /expired/);

const jcmoves = applyPercentageMovingPromo({
  promo: { code: "JCMOVES", description: "10% off", discountPercent: "10" },
  automaticQuote: {
    ...automaticQuote,
    total: 340,
    rewardEligibleTotal: 340,
    projectedCustomerJcMoves: 5_100,
    projectedCrewPoolJcMoves: 5_100,
  },
});
assert.equal(jcmoves.applied, true);
assert.equal(jcmoves.quote.total, 306);
assert.equal(jcmoves.quote.rewardEligibleTotal, 340);
assert.equal(jcmoves.quote.projectedCustomerJcMoves, 5_100);
assert.equal(jcmoves.quote.projectedCrewPoolJcMoves, 5_100);

console.log("jobPromo tests passed");
