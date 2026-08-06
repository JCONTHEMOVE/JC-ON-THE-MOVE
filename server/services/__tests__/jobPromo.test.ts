import assert from "node:assert/strict";
import { applyFixedMovingPackageOffer } from "../jobPromo";
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
assert.equal(applied.quote.projectedCustomerJcMoves, 15000);
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

console.log("jobPromo tests passed");
