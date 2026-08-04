import assert from "node:assert/strict";
import { calculateJobQuoteFromRateCard } from "../jobRateCard";

const rateCard = {
  laborRatePerMoverHour: 87.5,
  truckFlat: 300,
  trailerFlat: 175,
  jcmovesPerDollar: 15,
};

const laborOnly = calculateJobQuoteFromRateCard(rateCard, {
  crewSize: 2,
  confirmedHours: 2,
  truckConfig: "no_truck",
  trailerRequested: false,
});
assert.equal(laborOnly.total, 350);
assert.equal(laborOnly.projectedCustomerJcMoves, 5250);
assert.equal(laborOnly.projectedCrewPoolJcMoves, 5250);

const equipped = calculateJobQuoteFromRateCard(rateCard, {
  crewSize: 2,
  confirmedHours: 2,
  truckConfig: "company_truck",
  trailerRequested: true,
});
assert.equal(equipped.truck, 300);
assert.equal(equipped.trailer, 175);
assert.equal(equipped.total, 825);

console.log("jobRateCard tests passed");
