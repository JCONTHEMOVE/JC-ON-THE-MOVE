import { dollarsToTokens } from "./tokenRedemptionRules";
import {
  TREASURY_CONVERSION_POLICY,
  TREASURY_CUSTODY_POLICY,
  TREASURY_VALUATION_CURRENCY,
} from "./treasuryAssetPolicy";

/** Customer-facing Bitcoin Lightning job-payment offer. */
export const BTC_LIGHTNING_DISCOUNT_PERCENT = 5;
export const BTC_LIGHTNING_REWARD_PERCENT = 0;
export const BTC_LIGHTNING_TREASURY_RETENTION_PERCENT = 100;
export const BTC_LIGHTNING_PAYMENT_RAIL = "btc_lightning";
export const BTC_LIGHTNING_SETTLEMENT_CURRENCY = "BTC";

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type BtcLightningOffer = {
  originalAmountUsd: number;
  discountPercent: number;
  discountAmountUsd: number;
  amountDueUsd: number;
  rewardPercent: number;
  rewardValueUsd: number;
  rewardTokens: number;
  treasuryRetentionPercent: number;
  receivedAsset: typeof BTC_LIGHTNING_SETTLEMENT_CURRENCY;
  valuationCurrency: typeof TREASURY_VALUATION_CURRENCY;
  custodyPolicy: typeof TREASURY_CUSTODY_POLICY;
  conversionPolicy: typeof TREASURY_CONVERSION_POLICY;
};

/**
 * Crypto receives the site-wide 5% price discount. The separate 5% JCMOVES
 * bonus belongs to regular payments, so this rail does not mint a payment
 * bonus. Normal job-completion rewards remain governed by the job program.
 */
export function calculateBtcLightningOffer(originalAmountUsd: number): BtcLightningOffer {
  if (!Number.isFinite(originalAmountUsd) || originalAmountUsd <= 0) {
    throw new Error("Bitcoin Lightning job amount must be greater than zero");
  }

  const original = roundCurrency(originalAmountUsd);
  const discountAmountUsd = roundCurrency(original * (BTC_LIGHTNING_DISCOUNT_PERCENT / 100));
  const amountDueUsd = roundCurrency(original - discountAmountUsd);
  const rewardValueUsd = roundCurrency(amountDueUsd * (BTC_LIGHTNING_REWARD_PERCENT / 100));
  const rewardTokens = Math.round(dollarsToTokens(rewardValueUsd));

  return {
    originalAmountUsd: original,
    discountPercent: BTC_LIGHTNING_DISCOUNT_PERCENT,
    discountAmountUsd,
    amountDueUsd,
    rewardPercent: BTC_LIGHTNING_REWARD_PERCENT,
    rewardValueUsd,
    rewardTokens,
    treasuryRetentionPercent: BTC_LIGHTNING_TREASURY_RETENTION_PERCENT,
    receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
    valuationCurrency: TREASURY_VALUATION_CURRENCY,
    custodyPolicy: TREASURY_CUSTODY_POLICY,
    conversionPolicy: TREASURY_CONVERSION_POLICY,
  };
}
