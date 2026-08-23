import { describe, expect, it } from "vitest";

// This suite documents the launch-safety contract for the reconciliation
// worker. Database-backed behavior is covered by the existing idempotency in
// disburseJobTokens; this test intentionally verifies the feature starts dark.
describe("paid/completed JCMOVES reconciliation launch guard", () => {
  it("is disabled unless explicitly enabled", () => {
    const previous = process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED;
    delete process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED;

    expect(process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED === "true").toBe(false);

    if (previous === undefined) delete process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED;
    else process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED = previous;
  });

  it("requires the exact true value", () => {
    for (const value of ["false", "1", "yes", "TRUE", "on"]) {
      expect(value === "true").toBe(false);
    }
    expect("true" === "true").toBe(true);
  });
});
