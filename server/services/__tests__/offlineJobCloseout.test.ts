import assert from "node:assert/strict";
import {
  businessDateString,
  normalizeJobDate,
  offlineCloseoutEligibility,
} from "../offlineJobCloseout";

let passed = 0;
function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
}

console.log("offline past-job closeout");

test("recognizes the pictured past available job as eligible", () => {
  const result = offlineCloseoutEligibility({
    scheduledDate: "2026-08-24",
    currentDate: "2026-08-25",
    status: "available",
    total: "1250.00",
    validCrewAccountCount: 1,
  });
  assert.deepEqual(result, {
    eligible: true,
    scheduledDate: "2026-08-24",
    status: "available",
    total: 1250,
  });
});

test("blocks closeout until a crew user account is assigned", () => {
  const result = offlineCloseoutEligibility({
    scheduledDate: "08/24/2026",
    currentDate: "2026-08-25",
    status: "available",
    total: 1250,
    validCrewAccountCount: 0,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.code, "crew_missing");
});

test("does not record a second payment over an existing payment rail", () => {
  const result = offlineCloseoutEligibility({
    scheduledDate: "2026-08-24",
    currentDate: "2026-08-25",
    status: "completed",
    total: 1250,
    paymentPaidAt: "2026-08-24T17:00:00.000Z",
    validCrewAccountCount: 2,
  });
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.code, "already_paid");
});

test("rejects same-day or future work from the past-job action", () => {
  for (const scheduledDate of ["2026-08-25", "2026-08-26"]) {
    const result = offlineCloseoutEligibility({
      scheduledDate,
      currentDate: "2026-08-25",
      status: "available",
      total: 1250,
      validCrewAccountCount: 1,
    });
    assert.equal(result.eligible, false);
    if (!result.eligible) assert.equal(result.code, "not_past");
  }
});

test("normalizes legacy US job dates", () => {
  assert.equal(normalizeJobDate("8/4/2026"), "2026-08-04");
});

test("uses America/Chicago rather than the server UTC date", () => {
  assert.equal(businessDateString(new Date("2026-08-25T04:30:00.000Z")), "2026-08-24");
});

console.log(`offline closeout tests passed: ${passed}`);
