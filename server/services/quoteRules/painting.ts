// Painting price rule (Task #211).
//
// Turns the BookingChatbot's painting questionnaire into a believable
// estimate so the wizard can show a real number instead of "TBD". Crew
// still firms it up — these are guardrail-clamped estimates only.
//
// Tunable knobs live in `PAINTING_RULES`. A non-engineer note can edit
// the per-room base, ceiling/trim adders, prep multipliers, etc. without
// touching any other file.
//
// The rule accepts the chatbot's raw answer strings (with emoji prefixes
// like "🏠 Interior", "1 room / area", etc.) so callers don't have to
// pre-parse. Unknown / missing fields fall through to sensible defaults
// and the result is always clamped to [fallbackMin, fallbackMax] (the
// catalog suggested band).

import { LABOR_RATE_PER_HOUR } from "../../../shared/pricingTables";

export const PAINTING_RULES = {
  // Room count selector → numeric rooms.
  ROOMS_BY_COUNT: {
    "1 room / area": 1,
    "2–3 rooms": 3,
    "4–5 rooms": 5,
    "6+ rooms / whole house": 8,
  } as Record<string, number>,
  ROOMS_DEFAULT: 1,

  // Room size selector → per-room base labor + paint.
  PER_ROOM_BASE_BY_SIZE: {
    "🔹 Small (under 150 sq ft)": 350,
    "🔷 Medium (150–300 sq ft)": 500,
    "🔶 Large (300–500 sq ft)": 700,
    "🟠 Extra large / open concept (500+ sq ft)": 950,
  } as Record<string, number>,
  PER_ROOM_BASE_DEFAULT: 500,

  // Per-room adders.
  CEILING_ADDER_PER_ROOM: 120,
  PRIMER_ADDER_PER_ROOM: 50,
  HIGH_CEILING_ADDER_PER_ROOM: 200,
  // Customer materials are itemized separately from discounted labor.
  JC_PROVIDES_PAINT_ADDER_PER_ROOM: 0,

  // Add-ons (chatbot multi-select).
  DOORS_TRIM_ADDER_PER_ROOM: 80,
  WINDOW_FRAMES_ADDER_PER_ROOM: 60,

  // Multipliers.
  PREP_MULTIPLIER: {
    "✅ Minimal — walls are in great shape": 1.0,
    "🔧 Some — minor patching / sanding needed": 1.15,
    "⚒️ Heavy — significant repairs or stripping": 1.4,
  } as Record<string, number>,
  PREP_MULTIPLIER_DEFAULT: 1.0,

  SURFACE_CONDITION_MULTIPLIER: {
    "✅ Good — minimal imperfections": 1.0,
    "⚠️ Fair — some cracks or peeling": 1.1,
    "🔴 Poor — significant damage or old paint": 1.25,
  } as Record<string, number>,
  SURFACE_CONDITION_MULTIPLIER_DEFAULT: 1.0,

  // Staining vs straight painting takes longer.
  STAINING_MULTIPLIER: 1.2,
  PAINT_AND_STAIN_MULTIPLIER: 1.35,

  // Exterior is priced as a flat baseline (the chatbot doesn't ask for
  // room counts on exterior jobs). Both = interior calc + exterior add.
  EXTERIOR_BASELINE: 2200,
  EXTERIOR_HIGH_CEILING_ADDER: 600,
  BOTH_INT_EXT_BONUS: 1500,
} as const;

export interface PaintingAnswers {
  paintingIntExt?: string;
  paintingType?: string;
  paintingRoomCount?: string;
  paintingRoomSize?: string;
  paintingCeilings?: string;
  paintingAddons?: string[];
  paintingPrep?: string;
  paintingMaterials?: string;
  paintingPrimer?: string;
  paintingSurfaceCondition?: string;
  paintingSpecialtyAreas?: string;
}

export interface PaintingEstimateInput {
  answers?: PaintingAnswers | null;
  /** Catalog suggested-min — clamps the estimate's low end and is the
   *  fallback when no answer fields were collected. */
  fallbackMin?: number;
  /** Catalog suggested-max — clamps the estimate's high end. */
  fallbackMax?: number;
}

export interface PaintingEstimate {
  amount: number;
  /** True when at least one answer field drove the estimate. False when
   *  the rule fell back to the catalog suggested-min. */
  isFromAnswers: boolean;
  breakdown: {
    interior?: {
      rooms: number;
      perRoomBase: number;
      ceilingsIncluded: boolean;
      addonsPerRoom: number;
      prepMultiplier: number;
      surfaceMultiplier: number;
      typeMultiplier: number;
      primerPerRoom: number;
      highCeilingsPerRoom: number;
      materialsPerRoom: number;
      subtotal: number;
    };
    exterior?: {
      baseline: number;
      highCeilings: number;
      bothBonus: number;
      subtotal: number;
    };
    rawAmount: number;
    clamped: { min: number | null; max: number | null };
    /** Task #218 — labor breakdown derived from the dollar amount so
     *  the chat card can render "1 painter × N hrs at $85/hr". */
    crewSize?: number;
    laborHours?: number;
    ratePerHour?: number;
  };
}

function hasAnyAnswer(a: PaintingAnswers | null | undefined): boolean {
  if (!a) return false;
  return !!(
    a.paintingIntExt ||
    a.paintingType ||
    a.paintingRoomCount ||
    a.paintingRoomSize ||
    a.paintingCeilings ||
    (a.paintingAddons && a.paintingAddons.length) ||
    a.paintingPrep ||
    a.paintingMaterials ||
    a.paintingPrimer ||
    a.paintingSurfaceCondition ||
    a.paintingSpecialtyAreas
  );
}

function typeMultiplier(t: string | undefined): number {
  if (!t) return 1.0;
  if (t.includes("Both")) return PAINTING_RULES.PAINT_AND_STAIN_MULTIPLIER;
  if (t.includes("Stain")) return PAINTING_RULES.STAINING_MULTIPLIER;
  return 1.0;
}

function clamp(amount: number, min: number | null, max: number | null): number {
  let n = amount;
  if (min != null && n < min) n = min;
  if (max != null && n > max) n = max;
  return Math.round(n);
}

export function estimatePainting(input: PaintingEstimateInput = {}): PaintingEstimate {
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
      breakdown: { rawAmount: amount, clamped: { min: fallbackMin, max: fallbackMax } },
    };
  }

  const intExt = a.paintingIntExt ?? "";
  const isExteriorOnly = intExt.includes("Exterior") && !intExt.includes("Both") && !intExt.includes("interior");
  const isBoth = intExt.includes("Both");
  const includesInterior = !isExteriorOnly; // interior-only OR both
  const includesExterior = isExteriorOnly || isBoth;

  let interiorSubtotal = 0;
  let interiorBreakdown: PaintingEstimate["breakdown"]["interior"] | undefined;
  if (includesInterior) {
    const rooms = PAINTING_RULES.ROOMS_BY_COUNT[a.paintingRoomCount ?? ""] ?? PAINTING_RULES.ROOMS_DEFAULT;
    const perRoomBase = PAINTING_RULES.PER_ROOM_BASE_BY_SIZE[a.paintingRoomSize ?? ""] ?? PAINTING_RULES.PER_ROOM_BASE_DEFAULT;

    const ceilingsIncluded = (a.paintingCeilings ?? "").includes("Yes");
    const ceilingsAdder = ceilingsIncluded ? PAINTING_RULES.CEILING_ADDER_PER_ROOM : 0;

    const addons = a.paintingAddons ?? [];
    const addonsPerRoom =
      (addons.some((x) => x.includes("Doors")) ? PAINTING_RULES.DOORS_TRIM_ADDER_PER_ROOM : 0) +
      (addons.some((x) => x.includes("Window")) ? PAINTING_RULES.WINDOW_FRAMES_ADDER_PER_ROOM : 0);

    const prepMult = PAINTING_RULES.PREP_MULTIPLIER[a.paintingPrep ?? ""] ?? PAINTING_RULES.PREP_MULTIPLIER_DEFAULT;
    const surfaceMult = PAINTING_RULES.SURFACE_CONDITION_MULTIPLIER[a.paintingSurfaceCondition ?? ""] ?? PAINTING_RULES.SURFACE_CONDITION_MULTIPLIER_DEFAULT;
    const typeMult = typeMultiplier(a.paintingType);

    const primerPerRoom = (a.paintingPrimer ?? "").startsWith("✅") ? PAINTING_RULES.PRIMER_ADDER_PER_ROOM : 0;
    const highCeilPerRoom = (a.paintingSpecialtyAreas ?? "").startsWith("✅") ? PAINTING_RULES.HIGH_CEILING_ADDER_PER_ROOM : 0;
    const materialsPerRoom = (a.paintingMaterials ?? "").includes("JC provides") ? PAINTING_RULES.JC_PROVIDES_PAINT_ADDER_PER_ROOM : 0;

    const perRoomTotal =
      (perRoomBase + ceilingsAdder + addonsPerRoom + primerPerRoom + highCeilPerRoom + materialsPerRoom);
    interiorSubtotal = perRoomTotal * rooms * prepMult * surfaceMult * typeMult;

    interiorBreakdown = {
      rooms,
      perRoomBase,
      ceilingsIncluded,
      addonsPerRoom,
      prepMultiplier: prepMult,
      surfaceMultiplier: surfaceMult,
      typeMultiplier: typeMult,
      primerPerRoom,
      highCeilingsPerRoom: highCeilPerRoom,
      materialsPerRoom,
      subtotal: Math.round(interiorSubtotal),
    };
  }

  let exteriorSubtotal = 0;
  let exteriorBreakdown: PaintingEstimate["breakdown"]["exterior"] | undefined;
  if (includesExterior) {
    const baseline = PAINTING_RULES.EXTERIOR_BASELINE;
    const highCeil = (a.paintingSpecialtyAreas ?? "").startsWith("✅")
      ? PAINTING_RULES.EXTERIOR_HIGH_CEILING_ADDER
      : 0;
    // Apply prep + surface multipliers to exterior too.
    const prepMult = PAINTING_RULES.PREP_MULTIPLIER[a.paintingPrep ?? ""] ?? PAINTING_RULES.PREP_MULTIPLIER_DEFAULT;
    const surfaceMult = PAINTING_RULES.SURFACE_CONDITION_MULTIPLIER[a.paintingSurfaceCondition ?? ""] ?? PAINTING_RULES.SURFACE_CONDITION_MULTIPLIER_DEFAULT;
    const bothBonus = isBoth ? PAINTING_RULES.BOTH_INT_EXT_BONUS : 0;
    exteriorSubtotal = (baseline + highCeil + bothBonus) * prepMult * surfaceMult;

    exteriorBreakdown = {
      baseline,
      highCeilings: highCeil,
      bothBonus,
      subtotal: Math.round(exteriorSubtotal),
    };
  }

  const raw = interiorSubtotal + exteriorSubtotal;
  const amount = clamp(raw, fallbackMin, fallbackMax);

  // Task #218 — surface labor hours derived from the dollar amount so
  // the chat card can render "1 painter × N hrs at $85/hr" alongside
  // the rule-driven price. Painting defaults to a 1-painter crew;
  // hours are rounded to the nearest 0.5.
  const ratePerHour = LABOR_RATE_PER_HOUR;
  const crewSize = 1;
  const laborHours = Math.max(
    0.5,
    Math.round((amount / (crewSize * ratePerHour)) * 2) / 2,
  );

  return {
    amount,
    isFromAnswers: true,
    breakdown: {
      interior: interiorBreakdown,
      exterior: exteriorBreakdown,
      rawAmount: Math.round(raw),
      clamped: { min: fallbackMin, max: fallbackMax },
      crewSize,
      laborHours,
      ratePerHour,
    },
  };
}
