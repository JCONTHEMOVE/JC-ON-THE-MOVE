import assert from "node:assert/strict";
import {
  EARLY_CANCELLATION_FEE,
  FULL_PREPAY_DISCOUNT_PERCENT,
  calculateCancellationPolicy,
  calculateCheckoutPayment,
  calculateCommerceDiscounts,
} from "@shared/commerceCatalog";

const labor = [{
  code: "moving_2_worker_hour",
  name: "Two movers",
  quantity: 5,
  unitPrice: 190,
  discountEligible: true,
  category: "moving",
}];

{
  const result = calculateCommerceDiscounts(labor, [
    { code: "BUNDLE_10", name: "Bundle", discountType: "percent", value: 10, maximumAmount: 50, priority: 10 },
    { code: "FULL_PREPAY_5", name: "Full prepayment", discountType: "percent", value: FULL_PREPAY_DISCOUNT_PERCENT, priority: 20 },
  ]);
  assert.equal(result.subtotal, 950);
  assert.equal(result.discountTotal, 97.5);
  assert.equal(result.total, 852.5);
  assert.equal(result.percentCap, 15);
}

{
  const result = calculateCommerceDiscounts(labor, [
    { code: "LONG_JOB_15", name: "Long job", discountType: "percent", value: 15, priority: 10 },
    { code: "FULL_PREPAY_5", name: "Full prepayment", discountType: "percent", value: 5, priority: 20 },
  ]);
  assert.equal(result.discountTotal, 142.5);
  assert.equal(result.total, 807.5);
  assert.equal(result.applied.some((offer) => offer.code === "FULL_PREPAY_5"), false, "the 15% long-job tier consumes the full percentage cap");
}

{
  const result = calculateCommerceDiscounts([
    ...labor,
    { code: "loaded_mile", name: "Travel", quantity: 100, unitPrice: 4, discountEligible: false, category: "travel" },
    { code: "packing_kit", name: "Supplies", quantity: 1, unitPrice: 350, discountEligible: false, category: "supplies" },
  ], [{ code: "OWNER_100", name: "Owner offer", discountType: "fixed", value: 100, priority: 1 }]);
  assert.equal(result.subtotal, 1700);
  assert.equal(result.eligibleSubtotal, 950);
  assert.equal(result.discountTotal, 100);
  assert.equal(result.total, 1600);
}

{
  const suppliesOnly = calculateCommerceDiscounts([
    { code: "kit", name: "Kit", quantity: 1, unitPrice: 350, discountEligible: false, category: "supplies" },
  ], [{ code: "OWNER_100", name: "Owner offer", discountType: "fixed", value: 100 }]);
  assert.equal(suppliesOnly.discountTotal, 0, "pass-through supplies are not discounted");
  assert.equal(suppliesOnly.total, 350);
}

assert.deepEqual(calculateCheckoutPayment({ total: 1000, paymentChoice: "deposit", itemType: "service" }), {
  paymentChoice: "deposit",
  amountDue: 300,
  depositPercent: 30,
});
assert.deepEqual(calculateCheckoutPayment({ total: 350, paymentChoice: "deposit", itemType: "supply" }), {
  paymentChoice: "full",
  amountDue: 350,
  depositPercent: 100,
});

{
  const early = calculateCancellationPolicy({ hoursBeforeStart: 24.01, jobTotal: 1000, amountPaid: 300 });
  assert.equal(early.policy, "early_flat_fee");
  assert.equal(early.fee, EARLY_CANCELLATION_FEE);
  assert.equal(early.retained, 175);
  assert.equal(early.refund, 125);
  assert.equal(early.amountDue, 0);
}

{
  const within = calculateCancellationPolicy({ hoursBeforeStart: 24, jobTotal: 1000, amountPaid: 950 });
  assert.equal(within.policy, "within_24h_deposit");
  assert.equal(within.fee, 300);
  assert.equal(within.retained, 300);
  assert.equal(within.refund, 650);
}

{
  const earlyUnderpaid = calculateCancellationPolicy({ hoursBeforeStart: 48, jobTotal: 300, amountPaid: 90 });
  assert.equal(earlyUnderpaid.retained, 90);
  assert.equal(earlyUnderpaid.amountDue, 85, "the unpaid portion becomes an owner-approved cancellation invoice, not an automatic charge");
}

console.log("commerce catalog pricing and policy tests passed");
