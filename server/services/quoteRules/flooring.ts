// Flooring price rule (Task #211).
//
// Turns the BookingChatbot's flooring questionnaire into a believable
// estimate so the wizard can show a real number instead of "TBD". Crew
// still firms it up — these are guardrail-clamped estimates only.
//
// Tunable knobs live in `FLOORING_RULES`. A non-engineer note can edit
// the per-sqft labor rates, removal/haul-away surcharges, and trim
// adders without touching any other file.

import { LABOR_RATE_PER_HOUR } from "../../../shared/pricingTables";

//
// The rule accepts the chatbot's raw answer strings (with emoji prefixes
// like "🪵 Hardwood", "✅ Yes — remove existing floor", etc.) plus the
// free-text "rooms / sqft" answer ("e.g. 2 rooms, ~400 sq ft"). Sqft is
// parsed from the text; if absent we fall back to a default 200 sqft per
// room (one room minimum). Result is always clamped to [fallbackMin,
// fallbackMax] (the catalog suggested band).

export const FLOORING_RULES = {
  // Per-sqft labor by new-product tier ($/sqft).
  PER_SQFT_BY_PRODUCT: {
    "🪵 Hardwood (solid or engineered)": 5,
    "🔲 Luxury vinyl plank (LVP)": 5,
    "⬛ Tile / Stone": 5,
    "🟫 Carpet": 5,
    "Other / Undecided": 5,
  } as Record<string, number>,
  PER_SQFT_DEFAULT: 5,

  // Removal of the existing floor adds $/sqft.
  REMOVAL_PER_SQFT: 2,
  // Haul away the old material adds $/sqft (with a minimum so a tiny job
  // still covers truck + dump fees).
  HAUL_AWAY_PER_SQFT: 1,
  HAUL_AWAY_MINIMUM: 75,

  // JC-supplied materials adds a $/sqft markup that approximates the
  // material cost passed through to the customer.
  // Materials are an itemized pass-through and do not change labor price.
  MATERIALS_SUPPLIED_BY_JC_PER_SQFT: 0,

  // Trim treatment.
  TRIM_NEW: 200,
  TRIM_REINSTALL: 75,

  // Default sqft when the text input is unparseable.
  DEFAULT_SQFT_PER_ROOM: 200,
  DEFAULT_ROOMS: 1,

  // Per-job minimum service fee (covers truck, drop-off, day labor).
  MIN_JOB_FEE: 500,
} as const;

export interface FlooringAnswers {
  flooringOldRemoval?: string;
  flooringCurrentType?: string;
  flooringNewProduct?: string;
  flooringMaterials?: string;
  /** Free-text "e.g. 2 rooms, ~400 sq ft" */
  flooringRoomsSqft?: string;
  flooringHaulAway?: string;
  flooringTrim?: string;
}

export interface FlooringEstimateInput {
  answers?: FlooringAnswers | null;
  /** Catalog suggested-min — clamps the estimate's low end and is the
   *  fallback when no answer fields were collected. */
  fallbackMin?: number;
  /** Catalog suggested-max — clamps the estimate's high end. */
  fallbackMax?: number;
}

export interface FlooringEstimate {
  amount: number;
  /** True when at least one answer field drove the estimate. False when
   *  the rule fell back to the catalog suggested-min. */
  isFromAnswers: boolean;
  breakdown: {
    sqft: number;
    rooms: number;
    sqftSource: "parsed" | "default";
    perSqft: number;
    removalPerSqft: number;
    haulAwayCharge: number;
    materialsPerSqft: number;
    trimAdder: number;
    laborSubtotal: number;
    minJobFloor: number;
    rawAmount: number;
    clamped: { min: number | null; max: number | null };
    /** Task #218 — labor breakdown derived from the dollar amount so
     *  the chat card can render "2 floorers × N hrs at $85/hr". */
    crewSize?: number;
    laborHours?: number;
    ratePerHour?: number;
  };
}

function hasAnyAnswer(a: FlooringAnswers | null | undefined): boolean {
  if (!a) return false;
  return !!(
    a.flooringOldRemoval ||
    a.flooringCurrentType ||
    a.flooringNewProduct ||
    a.flooringMaterials ||
    a.flooringRoomsSqft ||
    a.flooringHaulAway ||
    a.flooringTrim
  );
}

/** Pull a sqft figure out of the free-text "rooms / sqft" answer. Accepts:
 *    "2 rooms, ~400 sq ft"  → { sqft: 400, rooms: 2 }
 *    "about 1200 sqft"      → { sqft: 1200, rooms: 1 }
 *    "3 rooms"              → { sqft: 600, rooms: 3 }   (default 200/room)
 *    ""                     → { sqft: 200, rooms: 1 }
 */
export function parseRoomsSqft(text: string | undefined): { sqft: number; rooms: number; source: "parsed" | "default" } {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) {
    return { sqft: FLOORING_RULES.DEFAULT_SQFT_PER_ROOM, rooms: FLOORING_RULES.DEFAULT_ROOMS, source: "default" };
  }
  // sqft like "400 sq ft", "400 sqft", "400sf", "400 ft²"
  const sqftMatch = t.match(/(\d{2,5})\s*(?:sq\.?\s*ft|sqft|sf|ft\b|square\s*feet|ft²)/);
  // Bare rooms count — matches "2 rooms", "3 bed", "4 br", "2 bedrooms", etc.
  const roomsMatch = t.match(/(\d{1,2})\s*(?:rooms?|bedrooms?|beds?|br)\b/);

  let rooms = roomsMatch ? Math.max(1, parseInt(roomsMatch[1], 10)) : 1;
  if (sqftMatch) {
    const sqft = Math.max(20, parseInt(sqftMatch[1], 10));
    return { sqft, rooms, source: "parsed" };
  }
  // No sqft → estimate from rooms.
  if (roomsMatch) {
    return {
      sqft: rooms * FLOORING_RULES.DEFAULT_SQFT_PER_ROOM,
      rooms,
      source: "default",
    };
  }
  // Last-ditch: any standalone number > 50 might be sqft.
  const bareNum = t.match(/(\d{2,5})/);
  if (bareNum) {
    const n = parseInt(bareNum[1], 10);
    if (n >= 50) return { sqft: n, rooms: 1, source: "parsed" };
  }
  return { sqft: FLOORING_RULES.DEFAULT_SQFT_PER_ROOM, rooms: 1, source: "default" };
}

function clamp(amount: number, min: number | null, max: number | null): number {
  let n = amount;
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return Math.round(n);
}

export function estimateFlooring(input: FlooringEstimateInput = {}): FlooringEstimate {
  const a = input.answers ?? null;
  const fallbackMin = input.fallbackMin ?? null;
  const fallbackMax = input.fallbackMax ?? null;
  const fromAnswers = hasAnyAnswer(a);

  // No answer set → use catalog suggested-min as the "starting at" estimate.
  if (!fromAnswers || !a) {
    const amount = clamp(fallbackMin ?? 0, fallbackMin, fallbackMax);
    return {
      amount,
      isFromAnswers: false,
      breakdown: {
        sqft: 0,
        rooms: 0,
        sqftSource: "default",
        perSqft: 0,
        removalPerSqft: 0,
        haulAwayCharge: 0,
        materialsPerSqft: 0,
        trimAdder: 0,
        laborSubtotal: 0,
        minJobFloor: FLOORING_RULES.MIN_JOB_FEE,
        rawAmount: amount,
        clamped: { min: fallbackMin, max: fallbackMax },
      },
    };
  }

  const { sqft, rooms, source } = parseRoomsSqft(a.flooringRoomsSqft);

  const perSqft = FLOORING_RULES.PER_SQFT_BY_PRODUCT[a.flooringNewProduct ?? ""] ?? FLOORING_RULES.PER_SQFT_DEFAULT;
  const removalPerSqft = (a.flooringOldRemoval ?? "").startsWith("✅") ? FLOORING_RULES.REMOVAL_PER_SQFT : 0;
  const materialsPerSqft = (a.flooringMaterials ?? "").includes("JC provides") ? FLOORING_RULES.MATERIALS_SUPPLIED_BY_JC_PER_SQFT : 0;

  const haulAwayBase = (a.flooringHaulAway ?? "").startsWith("✅") ? sqft * FLOORING_RULES.HAUL_AWAY_PER_SQFT : 0;
  const haulAwayCharge = haulAwayBase > 0 ? Math.max(haulAwayBase, FLOORING_RULES.HAUL_AWAY_MINIMUM) : 0;

  let trimAdder = 0;
  const trim = a.flooringTrim ?? "";
  if (trim.includes("Install new")) trimAdder = FLOORING_RULES.TRIM_NEW;
  else if (trim.includes("Reinstall")) trimAdder = FLOORING_RULES.TRIM_REINSTALL;

  const laborSubtotal = sqft * (perSqft + removalPerSqft + materialsPerSqft);
  const raw = Math.max(FLOORING_RULES.MIN_JOB_FEE, laborSubtotal + haulAwayCharge + trimAdder);
  const amount = clamp(raw, fallbackMin, fallbackMax);

  // Task #218 — derive labor hours from the dollar amount; flooring uses
  // a 2-person crew by default, hours rounded to nearest 0.5.
  const ratePerHour = LABOR_RATE_PER_HOUR;
  const crewSize = 2;
  const laborHours = Math.max(
    1,
    Math.round((amount / (crewSize * ratePerHour)) * 2) / 2,
  );

  return {
    amount,
    isFromAnswers: true,
    breakdown: {
      sqft,
      rooms,
      sqftSource: source,
      perSqft,
      removalPerSqft,
      haulAwayCharge,
      materialsPerSqft,
      trimAdder,
      laborSubtotal: Math.round(laborSubtotal),
      minJobFloor: FLOORING_RULES.MIN_JOB_FEE,
      rawAmount: Math.round(raw),
      clamped: { min: fallbackMin, max: fallbackMax },
      crewSize,
      laborHours,
      ratePerHour,
    },
  };
}
