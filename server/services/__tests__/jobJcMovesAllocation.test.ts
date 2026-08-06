import assert from "node:assert/strict";
import { calculateCrewPoolAllocation } from "../disburse-job-tokens";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok ${name}`);
  } catch (error) {
    console.error(`  fail ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log("calculateCrewPoolAllocation()");

test("gives the selected lead the 15% bonus and any rounding remainder", () => {
    const allocation = calculateCrewPoolAllocation(5_250, ["lead", "crew"], "lead");

    assert.equal(allocation.leadBonus, 787);
    assert.equal(allocation.baseShare, 2_231);
    assert.equal(allocation.roundingRemainder, 1);
    assert.deepEqual(allocation.amounts, { lead: 3_019, crew: 2_231 });
    assert.equal(Object.values(allocation.amounts).reduce((sum, amount) => sum + amount, 0), 5_250);
});

test("deduplicates crew and falls back to the first selected member as lead", () => {
    const allocation = calculateCrewPoolAllocation(100, ["a", "a", "b"], "not-selected");

    assert.deepEqual(allocation.crewIds, ["a", "b"]);
    assert.equal(allocation.crewLeadId, "a");
    assert.deepEqual(allocation.amounts, { a: 58, b: 42 });
});

console.log(`${passed} tests passed.`);
