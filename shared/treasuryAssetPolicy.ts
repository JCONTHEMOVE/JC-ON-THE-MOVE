/**
 * Company-wide custody policy for received payments.
 *
 * USD remains the operating/accounting valuation currency, but it is never
 * evidence that a received asset was converted. A conversion must be a
 * separate, future, audited admin action.
 */
export const TREASURY_CUSTODY_POLICY = "preserve_received_asset" as const;
export const TREASURY_CONVERSION_POLICY = "manual_only" as const;
export const TREASURY_VALUATION_CURRENCY = "USD" as const;

export type TreasuryCustodyPolicy = typeof TREASURY_CUSTODY_POLICY;
export type TreasuryConversionPolicy = typeof TREASURY_CONVERSION_POLICY;
