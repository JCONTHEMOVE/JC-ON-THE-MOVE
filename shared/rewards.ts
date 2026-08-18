/**
 * shared/rewards.ts — Single source of truth for JCMOVES reward configuration.
 *
 * Both the frontend (for display) and backend (for award calculations) import
 * from here. The DB-stored settings take precedence at runtime; these values
 * serve as defaults when no DB override is found.
 */

import { CANONICAL_PRICING_2026_08, serviceRewardTokenCost } from "./canonicalPricing";

// ── Earn rate ────────────────────────────────────────────────────────────────
/** Default JCMOVES tokens awarded per dollar spent on a job. */
export const EARN_RATE_PER_DOLLAR = 15;

// ── Redemption rate ───────────────────────────────────────────────────────────
/**
 * Platform redemption rate: 500 JCMOVES = $1.00 service credit.
 * Canonical source: shared/tokenRedemptionRules.ts — re-exported here for
 * backward-compatible imports from shared/rewards.
 */
export { PLATFORM_REDEEM_RATE } from "./tokenRedemptionRules";

// ── Service bonuses ──────────────────────────────────────────────────────────
/**
 * Flat JCMOVES bonus awarded when a service booking is confirmed.
 * Keys match the serviceType strings used in disburseServiceTokens / leads.
 */
export const SERVICE_BONUSES: Record<string, number> = {
  moving:           500,
  junk_removal:     300,
  labor:            300,
  snow:             200,
  lawn:             200,
  window_cleaning:  200,
  handyman:         250,
  trash_valet:      200,
  default:          200,
};

// ── Redemption catalog ───────────────────────────────────────────────────────
/**
 * Canonical list of reward catalog entries.
 * This mirrors the items seeded in the database so the frontend can display
 * consistent names/costs without waiting for a shop API call.
 */
export interface RedemptionCatalogEntry {
  code: string;
  label: string;
  tokenCost: number;
  cashValue: string;
}

function pricedReward(code: string, label: string, cashValue: number): RedemptionCatalogEntry {
  return {
    code,
    label,
    tokenCost: serviceRewardTokenCost(cashValue),
    cashValue: cashValue.toFixed(2),
  };
}

export const REDEMPTION_CATALOG: RedemptionCatalogEntry[] = [
  { code: "spin_x1",          label: "Bonus Spin × 1",                   tokenCost: 500,   cashValue: "0.00" },
  { code: "spin_x3",          label: "Bonus Spin × 3",                   tokenCost: 1200,  cashValue: "0.00" },
  { code: "coupon_10",        label: "$10 Service Coupon",                tokenCost: 5000,  cashValue: "10.00" },
  { code: "coupon_25",        label: "$25 Service Coupon",                tokenCost: 12500, cashValue: "25.00" },
  { code: "coupon_50",        label: "$50 Service Coupon",                tokenCost: 25000, cashValue: "50.00" },
  { code: "mystery_box",      label: "Mystery Prize Box",                 tokenCost: 8000,  cashValue: "0.00" },
  pricedReward("window_session", "Window Cleaning Credit ($125)", CANONICAL_PRICING_2026_08.services.windows.minimumInvoice),
  pricedReward("trash_month", "1 Month Trash Valet Credit (1 Can)", CANONICAL_PRICING_2026_08.services.trashValet.monthlyByCans.one),
  pricedReward("handyman_deposit", "Handyman Service Credit ($190)", CANONICAL_PRICING_2026_08.services.handyman.minimumInvoice),
  pricedReward("junk_tiny", "Tiny Junk Removal Credit", CANONICAL_PRICING_2026_08.services.junkRemoval.tiers.tiny),
  pricedReward("movers_1hr", "$300 Moving/Labor Service Credit", CANONICAL_PRICING_2026_08.labor.minimumInvoice),
  pricedReward("movers_2hr", "$380 Moving/Labor Service Credit", 2 * 2 * CANONICAL_PRICING_2026_08.labor.workerHourlyRate),
];
