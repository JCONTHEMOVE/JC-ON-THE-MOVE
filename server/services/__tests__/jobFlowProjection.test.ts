import assert from "node:assert/strict";
import { buildJobFlow } from "../../../shared/job-flow";

let passed = 0;
function test(name: string, run: () => void) {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
}

console.log("jobFlow projection()");

test("keeps incomplete quotes out of the crew board", () => {
  const flow = buildJobFlow({
    status: "available",
    totalPrice: "350",
    crewSize: 2,
    confirmedHours: null,
    moveDate: "2026-07-20",
  });
  assert.equal(flow.stage, "needs_quote");
  assert.equal(flow.canClaim, false);
});

test("opens a fully quoted and scheduled job to crew", () => {
  const flow = buildJobFlow({
    status: "available",
    totalPrice: "350",
    crewSize: 2,
    confirmedHours: 2,
    moveDate: "2026-07-20",
  });
  assert.equal(flow.stage, "ready_for_crew");
  assert.equal(flow.canClaim, true);
});

test("shows a provisional crew claim to Admin before dispatch", () => {
  const flow = buildJobFlow({
    status: "available",
    totalPrice: "350",
    crewSize: 2,
    confirmedHours: 2,
    moveDate: "2026-07-20",
    crewMembers: ["worker-1"],
  });
  assert.equal(flow.stage, "crew_claimed");
  assert.equal(flow.crew.openSlots, 1);
  assert.equal(flow.nextAction.key, "confirm_crew");
});

test("keeps completion on the payout approval step", () => {
  const flow = buildJobFlow(
    { status: "completed", completedAt: new Date() },
    { payout: { state: "approval_required", label: "Payout approval needed" } },
  );
  assert.equal(flow.stage, "payout_ready");
  assert.equal(flow.nextAction.key, "approve_payout");
});

console.log(`jobFlow projection tests passed: ${passed}`);
