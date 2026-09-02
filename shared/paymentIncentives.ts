export const SITEWIDE_CRYPTO_DISCOUNT_PERCENT = 5;
export const REGULAR_PAYMENT_JCMOVES_BONUS_PERCENT = 5;

export function applySitewideCryptoDiscount(cents: number) {
  const originalCents = Math.max(0, Math.round(cents));
  const discountCents = Math.round(originalCents * SITEWIDE_CRYPTO_DISCOUNT_PERCENT / 100);
  return { originalCents, discountCents, dueCents: originalCents - discountCents };
}
export function regularPaymentRewardBonus(baseMoves: number) {
  return Math.round(Math.max(0, baseMoves) * REGULAR_PAYMENT_JCMOVES_BONUS_PERCENT / 100);
}
