export interface WindowCleaningInput {
  standardWindows: number;
  largeWindows: number;
  ladderWindows: number;
  includeInside: boolean;
  includeOutside: boolean;
  seasonMode: "normal" | "winter_inside_only";
  promoCode?: string;
  addonSelected?: boolean;
  screens?: number;
  tracks?: number;
}

export interface WindowCleaningQuote {
  windowCount: number;
  paneCount: number;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  promoDiscountAmount: number;
  promoDiscountPercent: number;
  addonDiscountAmount: number;
  addonDiscountApplied: boolean;
  total: number;
  breakdown: {
    standardPanes: number;
    largePanes: number;
    ladderPanes: number;
    insidePanes: number;
    outsidePanes: number;
  };
  promoApplied: boolean;
  promoError?: string;
}

const ONE_SIDE_PER_PANE = 5;
const BOTH_SIDES_PER_PANE = 8;
const MINIMUM_INVOICE = 125;
const LARGE_WINDOW_PANE_MULTIPLIER = 2;
const LADDER_ADDON_PER_PANE = 4;
const SCREEN_OR_TRACK_EACH = 2;

export const PROMO_DISCOUNT_PERCENT = 10;
export const ADDON_DISCOUNT_PERCENT = 10;

export function calculateWindowCleaningQuote(
  input: WindowCleaningInput,
  isApril: boolean = new Date().getMonth() === 3,
): WindowCleaningQuote {
  const { standardWindows, largeWindows, ladderWindows, includeInside, includeOutside, seasonMode, promoCode, addonSelected } = input;

  const effectiveIncludeOutside = seasonMode === "winter_inside_only" ? false : includeOutside;
  const sidesPerWindow = (effectiveIncludeOutside ? 1 : 0) + (includeInside ? 1 : 0);

  const windowCount = standardWindows + largeWindows + ladderWindows;

  const standardPanes = Math.max(0, standardWindows);
  const largePanes = Math.max(0, largeWindows) * LARGE_WINDOW_PANE_MULTIPLIER;
  const ladderPanes = Math.max(0, ladderWindows);
  const paneCount = standardPanes + largePanes + ladderPanes;

  const paneRate = sidesPerWindow >= 2 ? BOTH_SIDES_PER_PANE : ONE_SIDE_PER_PANE;
  const basePaneCost = sidesPerWindow > 0 ? paneCount * paneRate : 0;
  const ladderCost = sidesPerWindow > 0 ? ladderPanes * LADDER_ADDON_PER_PANE : 0;
  const screenTrackCost = (Math.max(0, input.screens || 0) + Math.max(0, input.tracks || 0)) * SCREEN_OR_TRACK_EACH;
  const computedSubtotal = basePaneCost + ladderCost + screenTrackCost;
  const subtotal = computedSubtotal > 0 ? Math.max(computedSubtotal, MINIMUM_INVOICE) : 0;

  let promoDiscountAmount = 0;
  let promoDiscountPercent = 0;
  let promoApplied = false;
  let promoError: string | undefined;

  if (promoCode && promoCode.toUpperCase() === "CLEANWINDOWS") {
    if (isApril) {
      promoDiscountPercent = PROMO_DISCOUNT_PERCENT;
      promoDiscountAmount = Math.round(subtotal * (PROMO_DISCOUNT_PERCENT / 100) * 100) / 100;
      promoApplied = true;
    } else {
      promoError = "CLEANWINDOWS is only valid in April";
    }
  } else if (promoCode && promoCode.trim().length > 0) {
    promoError = "Invalid promo code";
  }

  // Add-on bundle discount: 10% off when customer books an additional service
  const addonDiscountApplied = !!addonSelected;
  const discountCap = Math.round(subtotal * 0.15 * 100) / 100;
  const addonDiscountAmount = addonDiscountApplied
    ? Math.min(
        50,
        Math.round(subtotal * (ADDON_DISCOUNT_PERCENT / 100) * 100) / 100,
        Math.max(0, discountCap - promoDiscountAmount),
      )
    : 0;

  const discountAmount = Math.min(discountCap, promoDiscountAmount + addonDiscountAmount);
  const discountPercent = subtotal > 0 ? Math.round((discountAmount / subtotal) * 10_000) / 100 : 0;

  const total = Math.max(0, subtotal - discountAmount);

  return {
    windowCount,
    paneCount,
    subtotal,
    discountAmount,
    discountPercent,
    promoDiscountAmount,
    promoDiscountPercent,
    addonDiscountAmount,
    addonDiscountApplied,
    total,
    breakdown: {
      standardPanes,
      largePanes,
      ladderPanes,
      insidePanes: includeInside ? paneCount : 0,
      outsidePanes: effectiveIncludeOutside ? paneCount : 0,
    },
    promoApplied,
    promoError,
  };
}
