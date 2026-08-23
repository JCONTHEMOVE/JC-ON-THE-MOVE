import assert from "node:assert/strict";
import {
  calculateLaborBooking,
  recommendLaborBooking,
} from "../../../shared/laborBooking";

let passed = 0;
function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
}

console.log("laborBooking()");

test("uses the canonical $95 worker-hour rate and two-hour minimum", () => {
  assert.equal(calculateLaborBooking({ crewSize: 2, hours: 1 }).laborTotal, 380);
  assert.equal(calculateLaborBooking({ crewSize: 2, hours: 2 }).laborTotal, 380);
});

test("prices every selected mover from the same canonical rate", () => {
  assert.equal(calculateLaborBooking({ crewSize: 3, hours: 1 }).laborTotal, 570);
  assert.equal(calculateLaborBooking({ crewSize: 4, hours: 1 }).laborTotal, 760);
});

test("doubles labor hours for a load and unload job", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 2, workScope: "load_unload" });
  assert.equal(quote.billableHours, 4);
  assert.equal(quote.longBookingDiscountPct, 5);
  assert.equal(quote.discountAmount, 38);
  assert.equal(quote.laborTotal, 722);
});

test("uses the canonical long-job discount tier", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 5 });
  assert.equal(quote.longBookingDiscountPct, 5);
  assert.equal(quote.discountedHours, 5);
  assert.equal(quote.laborTotal, 902.5);
});

test("enforces the oversized minimum and applies a zone multiplier", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 1, oversized: true, zoneMultiplier: 1.2 });
  assert.equal(quote.crewSize, 3);
  assert.equal(quote.billableHours, 2);
  assert.equal(quote.laborBeforeZone, 570);
  assert.equal(quote.zoneAdjustment, 114);
  assert.equal(quote.laborTotal, 684);
});

test("recommends crew and hours from truck size", () => {
  assert.deepEqual(recommendLaborBooking({ truckSize: "15' truck" }), { crewSize: 2, hours: 3, reason: "15–17 ft truck" });
  assert.deepEqual(recommendLaborBooking({ truckSize: "26 ft truck" }), { crewSize: 4, hours: 4, reason: "24–26 ft truck" });
});

console.log(`laborBooking tests passed: ${passed}`);
