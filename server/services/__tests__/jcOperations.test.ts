import assert from "node:assert/strict";
import { applyServiceFloor, estimateJobDuration, exactHourlyStarts, quoteLocalCrewPackage } from "../../../shared/jcOperations";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log("JC operations estimator and package policy");

test("recommends three movers and plans the upper range at 1,500 sq ft", () => {
  const estimate = estimateJobDuration({ sizingBasis: "square_footage", squareFootage: 1500 });
  assert.equal(estimate.recommendedCrewSize, 3);
  assert.equal(estimate.minimumHours, 3);
  assert.equal(estimate.maximumHours, 4);
  assert.equal(estimate.planningHours, 4);
});

test("honors the supplied home table for an alternate crew", () => {
  const estimate = estimateJobDuration({ sizingBasis: "square_footage", squareFootage: 1500, selectedCrewSize: 2 });
  assert.equal(estimate.minimumHours, 4);
  assert.equal(estimate.maximumHours, 4);
});

test("uses the 26-foot truck baseline", () => {
  const estimate = estimateJobDuration({ sizingBasis: "truck", truckSize: "26_ft" });
  assert.equal(estimate.recommendedCrewSize, 4);
  assert.equal(estimate.minimumHours, 3.5);
  assert.equal(estimate.maximumHours, 4);
});

test("plans 4,000+ square feet at 12 hours for two movers and flags review", () => {
  const estimate = estimateJobDuration({ sizingBasis: "square_footage", squareFootage: 5000, selectedCrewSize: 2 });
  assert.equal(estimate.planningHours, 12);
  assert.equal(estimate.manualReview, true);
});

test("quotes the two-mover package plus mover-hour overtime", () => {
  const quote = quoteLocalCrewPackage({ serviceCode: "moving", crewSize: 2, plannedHours: 4, oneWayRoadMiles: 10, oneWayRoadMinutes: 20 });
  assert.equal(quote.eligible, true);
  assert.equal(quote.packagePrice, 555);
  assert.equal(quote.overtimeAmount, 185);
  assert.equal(quote.serviceSubtotal, 740);
});

test("quotes one extra half-hour for three movers at $138.75", () => {
  const quote = quoteLocalCrewPackage({ serviceCode: "junk_removal", crewSize: 3, plannedHours: 2.5, oneWayRoadMiles: 12, oneWayRoadMinutes: 25 });
  assert.equal(quote.eligible, true);
  assert.equal(quote.overtimeAmount, 138.75);
});

test("bills only travel beyond the included first 15 one-way miles", () => {
  const quote = quoteLocalCrewPackage({ serviceCode: "labor", crewSize: 2, plannedHours: 3, oneWayRoadMiles: 20, oneWayRoadMinutes: 40 });
  assert.equal(quote.travelAmount, 50);
  assert.equal(quote.serviceSubtotal, 605);
});

test("routes a package outside 30 miles or with oversized items to review", () => {
  assert.equal(quoteLocalCrewPackage({ serviceCode: "moving", crewSize: 2, plannedHours: 3, oneWayRoadMiles: 31, oneWayRoadMinutes: 40 }).eligible, false);
  assert.equal(quoteLocalCrewPackage({ serviceCode: "moving", crewSize: 2, plannedHours: 3, oneWayRoadMiles: 10, oversized: true }).eligible, false);
});

test("applies the service floor before a standard discount", () => {
  const quote = applyServiceFloor({ serviceCode: "junk_removal", laborOrServiceSubtotal: 200, discountAmount: 50, passThroughAmount: 25 });
  assert.deepEqual(quote, { floor: 400, beforeDiscount: 400, discountAmount: 50, passThroughAmount: 25, total: 375 });
});

test("offers exact hourly starts from 8 AM through 5 PM", () => {
  assert.deepEqual(exactHourlyStarts(), ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
});

if (!process.exitCode) console.log(`\n${passed} tests passed.`);
