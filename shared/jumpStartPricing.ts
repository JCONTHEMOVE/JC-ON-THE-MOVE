export type JumpStartDistanceTier =
  | "≤5 mi"
  | "5–15 mi"
  | "15–50 mi"
  | "50–100 mi"
  | "100+ mi";

export interface JumpStartQuote {
  flatPrice: number;
  isCustomQuote: boolean;
  distanceTier: JumpStartDistanceTier;
}

export const JUMP_START_TIERS: {
  label: JumpStartDistanceTier;
  maxMiles: number;
  price: number | null;
}[] = [
  { label: "≤5 mi",     maxMiles: 5,        price: 50  },
  { label: "5–15 mi",   maxMiles: 15,       price: 65  },
  { label: "15–50 mi",  maxMiles: 50,       price: 95  },
  { label: "50–100 mi", maxMiles: 100,      price: 175 },
  { label: "100+ mi",   maxMiles: Infinity, price: null },
];

/**
 * Returns the flat-rate price for a Jump Start job based on distance from Ironwood, MI.
 * distanceMiles=0 → assumes local (≤5 mi, $50).
 */
export function calculateJumpStartQuote(distanceMiles: number): JumpStartQuote {
  const d = distanceMiles <= 0 ? 0 : distanceMiles;
  for (const tier of JUMP_START_TIERS) {
    if (d <= tier.maxMiles) {
      if (tier.price === null) {
        return { flatPrice: 0, isCustomQuote: true, distanceTier: tier.label };
      }
      return { flatPrice: tier.price, isCustomQuote: false, distanceTier: tier.label };
    }
  }
  return { flatPrice: 0, isCustomQuote: true, distanceTier: "100+ mi" };
}
