import assert from "node:assert/strict";
import {
  applySitewideCryptoDiscount,
  regularPaymentRewardBonus,
  REGULAR_PAYMENT_JCMOVES_BONUS_PERCENT,
  SITEWIDE_CRYPTO_DISCOUNT_PERCENT,
} from "../../../shared/paymentIncentives";

assert.equal(SITEWIDE_CRYPTO_DISCOUNT_PERCENT, 5);
assert.equal(REGULAR_PAYMENT_JCMOVES_BONUS_PERCENT, 5);
assert.deepEqual(applySitewideCryptoDiscount(10_000), {
  originalCents: 10_000,
  discountCents: 500,
  dueCents: 9_500,
});
assert.deepEqual(applySitewideCryptoDiscount(999), {
  originalCents: 999,
  discountCents: 50,
  dueCents: 949,
});
assert.equal(regularPaymentRewardBonus(1_500), 75);
assert.equal(regularPaymentRewardBonus(-20), 0);

console.log("site-wide payment incentive tests passed");
