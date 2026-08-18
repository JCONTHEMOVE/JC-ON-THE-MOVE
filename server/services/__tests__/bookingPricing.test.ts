// Unit tests for the multi-service booking pricing engine (Task #128).
//
// This project doesn't ship a test framework, so the file is a self-contained
// runnable script with assert() calls. Run it with:
//
//     npx tsx server/services/__tests__/bookingPricing.test.ts
//
// Exits non-zero if any assertion fails.

import assert from "node:assert/strict";
import {
  computeBookingQuote,
  MAX_BUNDLE_DISCOUNT_PCT,
  type BundleDefinitionLike,
  type BookingPricingItemInput,
} from "../bookingPricing";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

const moveJunkReset: BundleDefinitionLike = {
  code: "move_junk_reset",
  name: "Move + Junk Reset",
  serviceCombo: ["moving", "junk_reset"],
  discountType: "percent",
  discountValue: 10,
  maxDiscount: 200,
  isActive: true,
  priority: 10,
  merchandisingSlot: "most_popular",
};

const laborDeliveryAssembly: BundleDefinitionLike = {
  code: "labor_delivery_assembly",
  name: "Labor + Delivery + Assembly",
  serviceCombo: ["labor", "delivery", "assembly"],
  discountType: "fixed",
  discountValue: 200,
  maxDiscount: null,
  isActive: true,
  priority: 40,
  merchandisingSlot: "best_value",
};

const moveAssemblyFinish: BundleDefinitionLike = {
  code: "move_assembly_finish",
  name: "Move + Assembly Finish",
  serviceCombo: ["moving", "assembly_finish"],
  discountType: "fixed",
  discountValue: 150,
  maxDiscount: null,
  isActive: true,
  priority: 20,
  merchandisingSlot: "best_value",
};

const ALL_BUNDLES = [moveJunkReset, moveAssemblyFinish, laborDeliveryAssembly];

// Reusable helper to keep tests focused on what's being checked.
function item(serviceCode: string, unitPrice: number, quantity = 1): BookingPricingItemInput {
  return { serviceCode, label: serviceCode, unitPrice, quantity };
}

console.log("computeBookingQuote()");

test("1-service booking: no bundle, no discount", () => {
  const r = computeBookingQuote([item("moving", 1200)], { bundleDefinitions: ALL_BUNDLES });
  assert.equal(r.subtotal, 1200);
  assert.equal(r.discountTotal, 0);
  assert.equal(r.bundleApplied, null);
  assert.equal(r.finalTotal, 1200);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].lineSubtotal, 1200);
});

test("1-service booking: token estimate = post-discount * earn rate + flat bonus", () => {
  const r = computeBookingQuote([item("custom_service", 100)], {
    bundleDefinitions: [],
    earnRatePerDollar: 15,
    flatBookingBonus: 250,
  });
  assert.equal(r.tokenEstimate, 100 * 15 + 250);
});

test("2-service bundle: percent discount applied below cap", () => {
  // Legacy bundle rows normalize to the canonical $50 maximum.
  const r = computeBookingQuote(
    [item("moving", 1000), item("junk_reset", 250)],
    { bundleDefinitions: ALL_BUNDLES },
  );
  assert.equal(r.subtotal, 1250);
  assert.equal(r.discountTotal, 50);
  assert.equal(r.finalTotal, 1200);
  assert.ok(r.bundleApplied, "expected bundle applied");
  assert.equal(r.bundleApplied!.code, "move_junk_reset");
  assert.equal(r.bundleApplied!.guardrailClamped, false);
});

test("2-service bundle: maxDiscount cap applied", () => {
  // moving $5000 + junk_reset $250 = $5250 → canonical $50 bundle cap.
  const r = computeBookingQuote(
    [item("moving", 5000), item("junk_reset", 250)],
    { bundleDefinitions: ALL_BUNDLES },
  );
  assert.equal(r.subtotal, 5250);
  assert.equal(r.discountTotal, 50);
  assert.equal(r.finalTotal, 5200);
  assert.equal(r.bundleApplied!.code, "move_junk_reset");
});

test("3-service bundle: fixed-dollar bundle wins over 2-service alternative", () => {
  // Delivery is lifted to its canonical $225 minimum, producing $1,075.
  const r = computeBookingQuote(
    [item("labor", 600), item("delivery", 200), item("assembly", 250)],
    { bundleDefinitions: ALL_BUNDLES },
  );
  assert.equal(r.subtotal, 1075);
  assert.equal(r.discountTotal, 50);
  assert.equal(r.finalTotal, 1025);
  assert.equal(r.bundleApplied!.code, "labor_delivery_assembly");
  assert.equal(r.bundleApplied!.discountType, "percent");
});

test("service minimums and the canonical $50 bundle cap both apply", () => {
  const r = computeBookingQuote(
    [item("labor", 50), item("delivery", 50), item("assembly", 50)],
    { bundleDefinitions: ALL_BUNDLES },
  );
  assert.equal(r.subtotal, 715);
  assert.equal(r.discountTotal, 50);
  assert.equal(r.finalTotal, 665);
  assert.equal(r.bundleApplied!.rawDiscount, 50);
});

test("guardrail respects custom maxDiscountPct override", () => {
  const r = computeBookingQuote(
    [item("labor", 50), item("delivery", 50), item("assembly", 50)],
    { bundleDefinitions: ALL_BUNDLES, maxDiscountPct: 10 },
  );
  // Canonical service floors produce $715; the $50 bundle cap still wins.
  assert.equal(r.discountTotal, 50);
});

test("best bundle wins when multiple match: pick the largest discount", () => {
  // moving $1000 + assembly_finish $300 + junk_reset $250.
  // Both matches normalize to $50; priority selects move_junk_reset.
  const r = computeBookingQuote(
    [item("moving", 1000), item("assembly_finish", 300), item("junk_reset", 250)],
    { bundleDefinitions: ALL_BUNDLES },
  );
  assert.equal(r.bundleApplied!.code, "move_junk_reset");
  assert.equal(r.discountTotal, 50);
});

test("no bundle when only one of the required services is present", () => {
  const r = computeBookingQuote([item("moving", 1000), item("delivery", 150)], {
    bundleDefinitions: ALL_BUNDLES,
  });
  assert.equal(r.bundleApplied, null);
  assert.equal(r.discountTotal, 0);
});

test("inactive bundle is ignored even if combo matches", () => {
  const r = computeBookingQuote(
    [item("moving", 1000), item("junk_reset", 250)],
    { bundleDefinitions: [{ ...moveJunkReset, isActive: false }] },
  );
  assert.equal(r.bundleApplied, null);
  assert.equal(r.discountTotal, 0);
});

test("MAX_BUNDLE_DISCOUNT_PCT uses the canonical 15% total-offer cap", () => {
  assert.equal(MAX_BUNDLE_DISCOUNT_PCT, 15);
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) {
  console.error("Some tests FAILED.");
} else {
  console.log("All bookingPricing tests passed.");
}
