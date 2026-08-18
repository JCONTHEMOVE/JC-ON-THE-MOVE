// Bundle add-on manifest — single source of truth for the "Bundle & Save"
// chips on every service quote screen. Both the customer-facing UI
// (ServiceBundleAddon, BookingChatbot) and the server (bundleBilling,
// square-invoice) read from this file so a new add-on only has to be
// added in one place.
//
// Two kinds of add-ons today:
//   • fulfillmentType: "companion_service" — generates a child lead in
//     bundleScheduling. Not billed up front; priced when the crew quotes.
//   • fulfillmentType: "shop_card" — billed alongside the primary
//     service on the same Square invoice. On payment, the equivalent
//     dollar amount is minted as JCMOVES USD service credit in the
//     customer's wallet.
//
// Shop cards are only billed when the customer explicitly selects one.
// Companion-service selections never create an implicit wallet purchase.

export type BundleAddonFulfillment = "companion_service" | "shop_card";

export interface BundleAddon {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  fulfillmentType: BundleAddonFulfillment;
  priceUsd?: number;            // present iff billed up front
  walletCreditUsd?: number;     // credit granted after verified payment
  grantsWalletCredit?: boolean; // shop_card → mint equivalent JCMOVES USD on payment
  shortDescription?: string;    // used in confirmation email + admin email
  redeemableCopy?: string;      // customer-facing "where can I spend this?"
}

export const SHOP_CARD_PRICE_USD = 90;
export const SHOP_CARD_CREDIT_USD = 100;
/** Backward-compatible export; this is the credit face value, not its price. */
export const SHOP_CARD_DEFAULT_AMOUNT_USD = SHOP_CARD_CREDIT_USD;

export const BUNDLE_ADDONS: BundleAddon[] = [
  { id: "moving",          label: "Moving",          emoji: "🚛", hint: "$95/worker·hr", fulfillmentType: "companion_service" },
  { id: "junk_removal",    label: "Junk Removal",    emoji: "🗑️", hint: "from $125",     fulfillmentType: "companion_service" },
  { id: "cleaning",        label: "Cleaning",        emoji: "🧼", hint: "from $125",     fulfillmentType: "companion_service" },
  { id: "window_cleaning", label: "Window Cleaning", emoji: "🪟", hint: "from $125",     fulfillmentType: "companion_service" },
  { id: "lawn_care",       label: "Lawn Care",       emoji: "🌿", hint: "from $55/visit", fulfillmentType: "companion_service" },
  { id: "trash_valet",     label: "Trash Valet",     emoji: "♻️", hint: "from $35/mo",    fulfillmentType: "companion_service" },
  { id: "snow_removal",    label: "Snow Removal",    emoji: "❄️", hint: "from $65/push",  fulfillmentType: "companion_service" },
  { id: "assembly",        label: "Assembly",        emoji: "🔧", hint: "from $190",       fulfillmentType: "companion_service" },
  {
    id: "ashley_shop",
    label: "$100 Shop Card",
    emoji: "🛍️",
    hint: "$90 for $100 credit",
    fulfillmentType: "shop_card",
    priceUsd: SHOP_CARD_PRICE_USD,
    walletCreditUsd: SHOP_CARD_CREDIT_USD,
    grantsWalletCredit: true,
    shortDescription: "$100 JCMOVES USD added to your wallet on payment",
    redeemableCopy:
      "Spend the $100 JCMOVES USD on any future JC ON THE MOVE invoice — moving, junk, cleaning, lawn, trash valet, or Ashley's Shop. Applies at $1 = $1 off.",
  },
];

const BY_ID: Record<string, BundleAddon> = Object.fromEntries(
  BUNDLE_ADDONS.map((a) => [a.id, a]),
);

export function getBundleAddon(id: string): BundleAddon | undefined {
  return BY_ID[id];
}

export function isShopCardAddon(id: string): boolean {
  return BY_ID[id]?.fulfillmentType === "shop_card";
}

export interface BundleBillableLine {
  /** Stable id we can look up later (matches BundleAddon.id, or "shop_card_default"). */
  addonId: string;
  /** Customer-visible name on the Square invoice + email. */
  name: string;
  unitPriceUsd: number;
  walletCreditUsd: number;
  quantity: number;
  /** When true, payment of this line mints an equivalent JCMOVES USD credit. */
  grantsWalletCredit: boolean;
  shortDescription?: string;
  redeemableCopy?: string;
}

/**
 * Convert a raw `bundleAddons` selection into the line items we should
 * bill the customer for up front.
 *
 * Every explicitly selected add-on with `priceUsd` becomes its own line.
 * Companion services remain quote/scheduling requests and are not converted
 * to a shop card charge.
 */
export function getBundleBillableLines(bundleAddons: string[] | null | undefined): BundleBillableLine[] {
  const ids = (bundleAddons || []).map((s) => String(s || "").trim()).filter(Boolean);
  if (ids.length === 0) return [];

  const lines: BundleBillableLine[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const addon = BY_ID[id];
    if (!addon) continue;
    if (addon.priceUsd && addon.priceUsd > 0) {
      lines.push({
        addonId: addon.id,
        name: addon.label,
        unitPriceUsd: addon.priceUsd,
        walletCreditUsd: addon.walletCreditUsd ?? addon.priceUsd,
        quantity: 1,
        grantsWalletCredit: !!addon.grantsWalletCredit,
        shortDescription: addon.shortDescription,
        redeemableCopy: addon.redeemableCopy,
      });
    }
  }

  return lines;
}

/** Total $ value of all billable bundle lines (sum of unit × qty). */
export function sumBundleBillableLines(lines: BundleBillableLine[]): number {
  return lines.reduce((s, l) => s + l.unitPriceUsd * l.quantity, 0);
}
