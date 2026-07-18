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

test("prices the easy two-mover menu exactly", () => {
  assert.equal(calculateLaborBooking({ crewSize: 2, hours: 1 }).laborTotal, 175);
  assert.equal(calculateLaborBooking({ crewSize: 2, hours: 2 }).laborTotal, 350);
});

test("discounts only the third and fourth mover", () => {
  assert.equal(calculateLaborBooking({ crewSize: 3, hours: 1 }).laborTotal, 249.38);
  assert.equal(calculateLaborBooking({ crewSize: 4, hours: 1 }).laborTotal, 323.75);
});

test("doubles labor hours for a load and unload job", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 2, workScope: "load_unload" });
  assert.equal(quote.billableHours, 4);
  assert.equal(quote.laborTotal, 700);
});

test("uses the fallback long-booking rate after the fourth hour", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 5 });
  assert.equal(quote.discountedHours, 1);
  assert.equal(quote.laborTotal, 857.5);
});

test("enforces the oversized minimum and applies a zone multiplier", () => {
  const quote = calculateLaborBooking({ crewSize: 2, hours: 1, oversized: true, zoneMultiplier: 1.2 });
  assert.equal(quote.crewSize, 3);
  assert.equal(quote.billableHours, 2);
  assert.equal(quote.laborTotal, 598.5);
});

test("recommends crew and hours from truck size", () => {
  assert.deepEqual(recommendLaborBooking({ truckSize: "15' truck" }), { crewSize: 2, hours: 3, reason: "15–17 ft truck" });
  assert.deepEqual(recommendLaborBooking({ truckSize: "26 ft truck" }), { crewSize: 4, hours: 4, reason: "24–26 ft truck" });
});

console.log(`laborBooking tests passed: ${passed}`);
