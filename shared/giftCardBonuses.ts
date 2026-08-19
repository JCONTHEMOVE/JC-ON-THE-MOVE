import { PLATFORM_REDEEM_RATE } from "./tokenRedemptionRules";

// At the current redemption rate (500 JCMOVES = $1), 25 tokens per gift-card
// dollar is a true 5% service-credit reward.
export const GIFT_CARD_BONUS_TOKENS_PER_DOLLAR = 25;
export const GIFT_CARD_BONUS_MINIMUM_CENTS = 5_000;
export const GIFT_CARD_BONUS_HOLD_DAYS = 14;
export const GIFT_CARD_RECIPIENT_INVITE_DAYS = 30;

export const GIFT_CARD_BONUS_AMOUNTS = [50, 100, 250, 500, 1_000, 5_000] as const;

export type GiftCardBonusTier = {
  amountUsd: number;
  bonusTokens: number;
  currentServiceCreditUsd: number;
  gold: boolean;
};

export function calculateGiftCardBonusTokens(faceValueCents: number): number {
  if (!Number.isFinite(faceValueCents) || faceValueCents < GIFT_CARD_BONUS_MINIMUM_CENTS) return 0;
  return Math.round((faceValueCents / 100) * GIFT_CARD_BONUS_TOKENS_PER_DOLLAR);
}

export function currentGiftCardBonusValueUsd(tokens: number): number {
  return Math.round((tokens / PLATFORM_REDEEM_RATE) * 100) / 100;
}

export function calculateProportionalGiftCardReversal(
  originalTokens: number,
  originalPaidCents: number,
  cumulativeRefundedCents: number,
): number {
  if (originalTokens <= 0 || originalPaidCents <= 0 || cumulativeRefundedCents <= 0) return 0;
  const boundedRefund = Math.min(originalPaidCents, cumulativeRefundedCents);
  return Math.min(originalTokens, Math.round(originalTokens * (boundedRefund / originalPaidCents)));
}

export function calculateCustomerRewardBase(
  finalizedQuoteUsd: number,
  giftCardFundedUsd: number,
): number {
  const quote = Number.isFinite(finalizedQuoteUsd) ? Math.max(0, finalizedQuoteUsd) : 0;
  const giftFunded = Number.isFinite(giftCardFundedUsd) ? Math.max(0, giftCardFundedUsd) : 0;
  return Math.max(0, quote - Math.min(quote, giftFunded));
}

export type GiftOrderClassification = {
  giftCardLineItemUids: string[];
  giftCardLineValueCents: number;
  hasDiscount: boolean;
  completed: boolean;
};

export type GiftCardOrderRiskSignals = {
  hasDiscount: boolean;
  orderCompleted: boolean;
  locationMismatch: boolean;
};

export function giftCardOrderReviewReason(signals: GiftCardOrderRiskSignals): string | null {
  if (signals.locationMismatch) return "location_mismatch";
  if (!signals.orderCompleted) return "order_not_completed";
  if (signals.hasDiscount) return "discounted_gift_card_order";
  return null;
}

export type GiftCardDisputeResolution = "won" | "lost" | "pending";

export function classifyGiftCardDisputeState(state: unknown): GiftCardDisputeResolution {
  const normalized = String(state || "").toUpperCase();
  if (normalized === "WON") return "won";
  if (normalized === "LOST" || normalized === "ACCEPTED") return "lost";
  return "pending";
}

export function giftCardStatusAfterReversal(input: {
  fullyReversed: boolean;
  credited: boolean;
  currentStatus: string;
  preDisputeStatus?: string | null;
}): string {
  if (input.fullyReversed) return "reversed";
  if (input.credited) return "partially_reversed";
  if (input.currentStatus === "disputed") return input.preDisputeStatus || "needs_review";
  return input.currentStatus;
}

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function cents(value: unknown): number {
  const amount = plainRecord(value).amount;
  const number = typeof amount === "bigint" ? Number(amount) : Number(amount);
  return Number.isSafeInteger(number) ? number : 0;
}

export function classifySquareGiftCardOrder(orderValue: unknown): GiftOrderClassification {
  const order = plainRecord(orderValue);
  const lineItems = Array.isArray(order.lineItems)
    ? order.lineItems
    : Array.isArray(order.line_items) ? order.line_items : [];
  const giftLines = lineItems.map(plainRecord).filter((line) =>
    String(line.itemType ?? line.item_type ?? "").toUpperCase() === "GIFT_CARD"
  );
  const totalDiscount = cents(order.totalDiscountMoney ?? order.total_discount_money);
  const discounts = Array.isArray(order.discounts) ? order.discounts : [];
  return {
    giftCardLineItemUids: giftLines
      .map((line) => typeof line.uid === "string" ? line.uid : "")
      .filter(Boolean),
    giftCardLineValueCents: giftLines.reduce((sum, line) => sum + cents(line.totalMoney ?? line.total_money), 0),
    hasDiscount: discounts.length > 0 || totalDiscount > 0,
    completed: String(order.state || "").toUpperCase() === "COMPLETED",
  };
}

export function isGoldGiftCardOrder(totalInitialActivationCents: number): boolean {
  return Number.isFinite(totalInitialActivationCents) && totalInitialActivationCents >= 500_000;
}

export const GIFT_CARD_BONUS_TIERS: GiftCardBonusTier[] = GIFT_CARD_BONUS_AMOUNTS.map((amountUsd) => {
  const bonusTokens = calculateGiftCardBonusTokens(amountUsd * 100);
  return {
    amountUsd,
    bonusTokens,
    currentServiceCreditUsd: currentGiftCardBonusValueUsd(bonusTokens),
    gold: amountUsd === 5_000,
  };
});
