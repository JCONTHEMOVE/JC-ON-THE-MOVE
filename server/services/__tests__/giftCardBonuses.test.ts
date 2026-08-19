import assert from "node:assert/strict";
import {
  GIFT_CARD_BONUS_TIERS,
  calculateCustomerRewardBase,
  calculateGiftCardBonusTokens,
  calculateProportionalGiftCardReversal,
  classifyGiftCardDisputeState,
  classifySquareGiftCardOrder,
  giftCardOrderReviewReason,
  giftCardStatusAfterReversal,
  isGoldGiftCardOrder,
} from "../../../shared/giftCardBonuses";

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

console.log("Square eGift purchase bonuses");

test("awards a true 5% service-credit bonus at the current redemption rate", () => {
  assert.equal(calculateGiftCardBonusTokens(5_000), 1_250);
  assert.equal(calculateGiftCardBonusTokens(10_000), 2_500);
  assert.equal(calculateGiftCardBonusTokens(500_000), 125_000);
  assert.deepEqual(GIFT_CARD_BONUS_TIERS.map((tier) => tier.currentServiceCreditUsd), [2.5, 5, 12.5, 25, 50, 250]);
});

test("does not award purchases below the $50 minimum", () => {
  assert.equal(calculateGiftCardBonusTokens(4_999), 0);
  assert.equal(calculateGiftCardBonusTokens(5_000), 1_250);
});

test("reverses refunds proportionally and never more than the original bonus", () => {
  assert.equal(calculateProportionalGiftCardReversal(2_500, 10_000, 2_500), 625);
  assert.equal(calculateProportionalGiftCardReversal(2_500, 10_000, 99_999), 2_500);
});

test("excludes only gift-card-funded dollars from the customer reward base", () => {
  assert.equal(calculateCustomerRewardBase(1_000, 300), 700);
  assert.equal(calculateCustomerRewardBase(1_000, 2_000), 0);
  assert.equal(calculateCustomerRewardBase(1_000, 0), 1_000);
});

test("recognizes completed initial gift-card order lines and discounts", () => {
  assert.deepEqual(classifySquareGiftCardOrder({
    state: "COMPLETED",
    line_items: [
      { uid: "gift-1", item_type: "GIFT_CARD", total_money: { amount: 50_000 } },
      { uid: "service-1", item_type: "ITEM", total_money: { amount: 1_000 } },
    ],
    total_discount_money: { amount: 500 },
  }), {
    giftCardLineItemUids: ["gift-1"],
    giftCardLineValueCents: 50_000,
    hasDiscount: true,
    completed: true,
  });
});

test("marks Gold from a $5,000 multi-card order, not one impossible card", () => {
  assert.equal(isGoldGiftCardOrder(499_999), false);
  assert.equal(isGoldGiftCardOrder(500_000), true);
});

test("keeps unsafe Square orders in manual review", () => {
  assert.equal(giftCardOrderReviewReason({ hasDiscount: false, orderCompleted: true, locationMismatch: false }), null);
  assert.equal(giftCardOrderReviewReason({ hasDiscount: true, orderCompleted: true, locationMismatch: false }), "discounted_gift_card_order");
  assert.equal(giftCardOrderReviewReason({ hasDiscount: false, orderCompleted: false, locationMismatch: false }), "order_not_completed");
  assert.equal(giftCardOrderReviewReason({ hasDiscount: false, orderCompleted: true, locationMismatch: true }), "location_mismatch");
});

test("treats an accepted Square dispute as a loss, not a win", () => {
  assert.equal(classifyGiftCardDisputeState("WON"), "won");
  assert.equal(classifyGiftCardDisputeState("LOST"), "lost");
  assert.equal(classifyGiftCardDisputeState("ACCEPTED"), "lost");
  assert.equal(classifyGiftCardDisputeState("PROCESSING"), "pending");
});

test("returns a partially lost pre-release dispute to its prior hold state", () => {
  assert.equal(giftCardStatusAfterReversal({
    fullyReversed: false,
    credited: false,
    currentStatus: "disputed",
    preDisputeStatus: "assigned_pending",
  }), "assigned_pending");
  assert.equal(giftCardStatusAfterReversal({
    fullyReversed: false,
    credited: true,
    currentStatus: "disputed",
    preDisputeStatus: "released",
  }), "partially_reversed");
  assert.equal(giftCardStatusAfterReversal({
    fullyReversed: true,
    credited: false,
    currentStatus: "disputed",
  }), "reversed");
});

if (!process.exitCode) console.log(`  ${passed} tests passed`);
