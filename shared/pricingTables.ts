// Task #169 — shared pricing matrix tables. The server's unified
// `server/services/pricingEngine.ts` re-exports these so the server-side
// `quoteMoving` / `quoteJunk` helpers and the client-side /pricing,
// /book, chatbot, and admin pricing-calibrate surfaces all read from the
// same numbers. Change a value here and every quote surface updates.

import { CANONICAL_PRICING_2026_08, calculateMovingLabor } from "./canonicalPricing";

export const MOVING_LOAD_TYPE_MULTIPLIER: Record<string, number> = {
  labor_only: 1.0,
  local: 1.0,
  long_distance: 1.0,
};

export const MOVING_BASE_MATRIX: Record<string, Record<string, number>> = {
  studio: { "0": 380, "1": 380, "2": 380, "3": 380 },
  "1br": { "0": 570, "1": 570, "2": 570, "3": 570 },
  "2br": { "0": 722, "1": 722, "2": 722, "3": 722 },
  "3br": { "0": 1353.75, "1": 1353.75, "2": 1353.75, "3": 1353.75 },
  "4br": { "0": 2052, "1": 2052, "2": 2052, "3": 2052 },
  "5br+": { "0": 2584, "1": 2584, "2": 2584, "3": 2584 },
};

export interface JunkTier {
  code: string;
  label: string;
  shortLabel: string;
  loadFraction: string;
  weightCap: string;
  price: number;
}

export const JUNK_TIERS: JunkTier[] = [
  { code: "tiny", label: "Tiny Load", shortLabel: "Tiny", loadFraction: "≤ 1/8 truck", weightCap: "≤ 300 lbs", price: 125 },
  { code: "small", label: "Small Load", shortLabel: "Small", loadFraction: "1/4 truck", weightCap: "≤ 600 lbs", price: 225 },
  { code: "medium", label: "Medium Load", shortLabel: "Medium", loadFraction: "1/2 truck", weightCap: "≤ 1200 lbs", price: 375 },
  { code: "large", label: "Large Load", shortLabel: "Large", loadFraction: "3/4 truck", weightCap: "≤ 1800 lbs", price: 525 },
  { code: "xlarge", label: "X-Large Load", shortLabel: "X-Large", loadFraction: "Full truck", weightCap: "≤ 2400 lbs", price: 675 },
];

/** Bedroom → canonical crew size for moving matrix. Mirrors the labor
 *  tuples in SERVICE_LABOR_DEFAULTS["moving"] (small=2, medium=2, large=4)
 *  so any caller of quoteMovingFromTable can render a chat-card breakdown
 *  whose crew × hours × the canonical worker rate = the matrix amount. */
const MOVING_MATRIX_CREW: Record<string, number> = {
  studio: 2,  // small
  "1br": 2,   // small
  "2br": 2,   // medium
  "3br": 3,   // large-ish — 3 movers handles the matrix range cleanly
  "4br": 4,   // large
  "5br+": 4,  // x-large still 4-mover crew per spec (matrix uses "5br+" key)
};

export function quoteMovingFromTable(opts: { bedrooms?: string; stairs?: number | string; loadType?: string }): {
  amount: number;
  base: number;
  multiplier: number;
  /** Canonical labor tuple — crew × hours × canonical rate = `amount`. */
  labor: { crewSize: number; laborHours: number; totalLaborHours: number; ratePerHour: number };
} {
  const br = String(opts.bedrooms || "1br");
  const stairs = String(Math.max(0, Math.min(3, Number(opts.stairs ?? 0))));
  const lt = String(opts.loadType || "local");
  const base = MOVING_BASE_MATRIX[br]?.[stairs] ?? MOVING_BASE_MATRIX["1br"]["0"];
  const multiplier = MOVING_LOAD_TYPE_MULTIPLIER[lt] ?? 1;
  const amount = Math.round(base * multiplier * 100) / 100;
  // Canonical labor tuple: crew is fixed by bedroom tier, hours derived
  // so crew × hours × the canonical rate approximates amount (within $1
  // due to 2-decimal hour rounding, so some matrix values produce
  // some cent-level slip is unavoidable). The tuple is what the chat
  // card displays; the matrix `amount` remains the billed truth.
  const crewSize = MOVING_MATRIX_CREW[br] ?? 2;
  const laborHours = amount > 0
    ? +(amount / (crewSize * LABOR_RATE_PER_HOUR)).toFixed(2)
    : 0;
  const totalLaborHours = +(crewSize * laborHours).toFixed(2);
  return {
    amount,
    base,
    multiplier,
    labor: { crewSize, laborHours, totalLaborHours, ratePerHour: LABOR_RATE_PER_HOUR },
  };
}

export function quoteJunkFromTable(tierCode: string): { amount: number; tier: JunkTier | null } {
  const tier = JUNK_TIERS.find((t) => t.code === tierCode) ?? null;
  return { amount: tier?.price ?? 0, tier };
}

// ── Moving crew-rate / truck-add tables (display on /pricing) ────────────
export const MOVER_RATE_PER_HOUR = CANONICAL_PRICING_2026_08.labor.workerHourlyRate;
/** @deprecated Trucks are flat equipment lines, not hourly add-ons. */
export const MOVER_TRUCK_ADD_PER_HOUR = 0;
export const MOVING_MIN_HOURS: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 3, 5: 4,
};
export const JC222_FLAT_PRICE = 272;
export const JC222_REGULAR_EQUIVALENT = 360;

// ── Window cleaning tier display rows ────────────────────────────────────
export interface WindowTier {
  label: string;
  price: number | null;
  desc: string;
}
export const WINDOW_TIERS: WindowTier[] = [
  { label: "Minimum",     price: 125,  desc: "Per visit" },
  { label: "One Side",    price: 5,    desc: "Per pane" },
  { label: "Both Sides",  price: 8,    desc: "Per pane" },
  { label: "20+ Windows", price: null, desc: "Custom quote" },
];

// ── Trash Valet monthly plan display rows ────────────────────────────────
export interface TrashPlan {
  label: string;
  mo: number | null;
  perVisit: string;
}
export const TRASH_PLANS: TrashPlan[] = [
  { label: "1 Can",   mo: 35,   perVisit: "Monthly plan" },
  { label: "2 Cans",  mo: 42,   perVisit: "Monthly plan" },
  { label: "3 Cans",  mo: 49,   perVisit: "Monthly plan" },
  { label: "4+ Cans", mo: null, perVisit: "+$7/can" },
];

// ── Lawn-care package matrix (by property size) ──────────────────────────
export interface LawnPackage {
  label: string;
  small: number;
  medium: number;
  large: number;
  xlarge: number;
  popular?: boolean;
}
export const LAWN_PACKAGES: LawnPackage[] = [
  { label: "Mowing",       small: 55, medium: 75,  large: 105, xlarge: 155 },
  { label: "Trimming",     small: 35, medium: 55,  large: 80,  xlarge: 120 },
  { label: "Yard Cleanup", small: 50, medium: 75,  large: 110, xlarge: 160 },
  { label: "Full Service", small: 100, medium: 140, large: 195, xlarge: 275, popular: true },
];
export const LAWN_ADDONS: Array<{ label: string; price: number }> = [
  { label: "Edging",          price: 15 },
  { label: "Blowing",         price: 10 },
  { label: "Weeding",         price: 25 },
  { label: "Fertilization",   price: 35 },
  { label: "Leaf Removal",    price: 40 },
  { label: "Mulching",        price: 50 },
  { label: "Hedge Trimming",  price: 30 },
  { label: "Gutter Cleaning", price: 60 },
];

// ── Per-service line-item minimum floors (keep parity with the server
//    SERVICE_LINE_MINIMUMS constant in bookingPricing). Explicit client
//    copy so /pricing, /book, the chatbot, and admin pricing-calibrate
//    can show the same floors without a server round-trip. Keep these
//    numbers in sync with server/services/bookingPricing.ts. */
export const SERVICE_LINE_FLOORS: Record<string, number> = {
  cleaning:       125,
  move_cleaning:  300,   // Task #169 — new distinct service code
  deep_clean_turnover: 300,
  handyman:       190,
  labor:          300,
  delivery:       225,
  assembly:       190,
  assembly_finish: 95,
  snow_removal:    65,
  demolition:     450,
  roofing:        750,
  lawn_care:       55,
  junk_removal:   125,
  moving:         300,
  window_cleaning: 125,
  trash_valet:     35,
  jump_start:      50,
  painting:       500,
  flooring:       500,
};

// ─────────────────────────────────────────────────────────────────────────
// Task #218 — Labor-hours pricing model. Every service is fundamentally
// "crew × hours × the canonical worker rate". The matrices above stay (they encode all the
// per-service nuance — bedrooms/stairs for moving, tier for junk, etc.),
// but every quoted line ALSO carries a labor-hours breakdown so the
// chat-intake card, /book wizard, and admin pricing-calibrate can show
// "2 movers × 4 hrs at the active rate" and have it match the actual price.
// ─────────────────────────────────────────────────────────────────────────

/** Single rate that drives every labor-hours quote across the platform.
 *  Aliased to MOVER_RATE_PER_HOUR so the moving matrices and the labor-
 *  hours helper can never drift. Bumping this is the one knob that
 *  changes the platform-wide hourly rate. */
export const LABOR_RATE_PER_HOUR = MOVER_RATE_PER_HOUR;

/** Per-service crew × hours defaults for the labor-hours pricing model.
 *  Source of truth for every "X movers × Y hrs" string the customer sees.
 *  When jobSize is provided, the per-size tuple overrides the default.
 *
 *  Spec (Task #218):
 *    moving small  = 2×2hr (special)
 *    moving medium = 2×4hr ≈ 16ft truck load+unload
 *    moving large  = 4×4hr ≈ 26ft truck load
 *    lawn_care     ≈ 0.5hr ($45)
 *    trash_valet   ≈ 0.33hr (~$28)
 *    rate          canonical pricing snapshot
 */
export interface ServiceLaborDefaults {
  defaultCrew: number;
  defaultHours: number;
  jobSize?: Partial<Record<"small" | "medium" | "large", { crew: number; hours: number }>>;
}

export const SERVICE_LABOR_DEFAULTS: Record<string, ServiceLaborDefaults> = {
  moving: {
    // Default = medium so a chat-intake "moving" line without a size hint
    // still produces a sensible 16ft-truck estimate.
    defaultCrew: 2, defaultHours: 4,
    jobSize: {
      small:  { crew: 2, hours: 2 },  // 4 labor-hr → $340
      medium: { crew: 2, hours: 4 },  // 8 labor-hr → $680 (16ft truck load+unload)
      large:  { crew: 4, hours: 4 },  // 16 labor-hr → $1360 (26ft truck load)
    },
  },
  junk_removal: {
    defaultCrew: 2, defaultHours: 1,  // 2 labor-hr → $170 (matches existing floor)
    jobSize: {
      small:  { crew: 2, hours: 1 },  // 2 labor-hr → $170
      medium: { crew: 2, hours: 2 },  // 4 labor-hr → $340
      large:  { crew: 2, hours: 3 },  // 6 labor-hr → $510 (full truckload, per spec)
    },
  },
  cleaning: {
    defaultCrew: 2, defaultHours: 3,  // 6 labor-hr → $510
    jobSize: {
      small:  { crew: 1, hours: 3 },  // 3 labor-hr → $255
      medium: { crew: 2, hours: 3 },  // 6 labor-hr → $510
      large:  { crew: 3, hours: 4 },  // 12 labor-hr → $1020
    },
  },
  move_cleaning: {
    defaultCrew: 2, defaultHours: 4,  // 8 labor-hr → $680
    jobSize: {
      small:  { crew: 2, hours: 2 },
      medium: { crew: 2, hours: 4 },
      large:  { crew: 3, hours: 5 },
    },
  },
  lawn_care:       { defaultCrew: 1, defaultHours: 0.5 },   // ~$43 base mowing
  trash_valet:     { defaultCrew: 1, defaultHours: 0.33 },  // ~$28 per pickup
  snow_removal:    { defaultCrew: 1, defaultHours: 0.75 },  // ~$64 per driveway visit (per spec)
  window_cleaning: { defaultCrew: 1, defaultHours: 2 },     // ~$170 whole home (per spec)
  handyman:        { defaultCrew: 1, defaultHours: 2 },     // 2-hr min → $170
  labor:           { defaultCrew: 2, defaultHours: 2 },     // 4 labor-hr → $340
  delivery:        { defaultCrew: 2, defaultHours: 1 },     // 2 labor-hr → $170
  assembly:        { defaultCrew: 1, defaultHours: 2 },     // 2 labor-hr → $170
  demolition: {
    defaultCrew: 2, defaultHours: 3,  // light demo (room) per spec → $510
    jobSize: {
      small:  { crew: 2, hours: 3 },  // 6 labor-hr → $510 (light demo room)
      medium: { crew: 3, hours: 4 },  // 12 labor-hr → $1020
      large:  { crew: 4, hours: 6 },  // 24 labor-hr → $2040
    },
  },
  // Painting & Flooring keep their sqft-driven dollar math (services/
  // quoteRules/painting.ts & flooring.ts) — these defaults exist purely
  // so the customer-facing card can still show a labor-hours breakdown.
  painting:        { defaultCrew: 1, defaultHours: 6 },
  flooring:        { defaultCrew: 2, defaultHours: 8 },
  junk_reset:      { defaultCrew: 2, defaultHours: 2 },
  deep_clean_turnover: { defaultCrew: 2, defaultHours: 4 },
  assembly_finish: { defaultCrew: 2, defaultHours: 2 },
  walkway_priority: { defaultCrew: 1, defaultHours: 0.5 },
};

export interface LaborQuote {
  crewSize: number;
  laborHours: number;
  /** crewSize × laborHours — the multiplier applied to ratePerHour. */
  totalLaborHours: number;
  ratePerHour: number;
  amount: number;
  /** Which slot in SERVICE_LABOR_DEFAULTS / catalog produced this tuple. */
  source: "explicit" | "jobSize" | "default" | "unknown" | "catalog";
}

/** Catalog-driven labor metadata — when the caller passes a catalog row
 *  the helper prefers its values over the SERVICE_LABOR_DEFAULTS fallback
 *  AND clamps the final amount to the catalog's suggestedMin/suggestedMax
 *  band. Per spec line 33 / step 2: the catalog is the source of truth. */
export interface LaborCatalogContext {
  minCrew?: number | null;
  defaultLaborHours?: { small?: number; medium?: number; large?: number; default?: number } | null;
  /** Inclusive lower bound for the returned amount. */
  suggestedMin?: number | null;
  /** Inclusive upper bound for the returned amount. */
  suggestedMax?: number | null;
}

/** Pure helper — never throws. Returns null only when the service code is
 *  not in SERVICE_LABOR_DEFAULTS, the caller passed no catalog metadata,
 *  AND no explicit crew/hours were supplied. */
export function quoteByLaborHours(
  serviceCode: string,
  opts: {
    jobSize?: "small" | "medium" | "large";
    crewSize?: number;
    laborHours?: number;
    /** Optional catalog row (already loaded by the caller). When present,
     *  its minCrew / defaultLaborHours win over the static fallback table
     *  and its suggestedMin / suggestedMax clamp the returned amount. */
    catalog?: LaborCatalogContext;
  } = {},
): LaborQuote | null {
  const def = SERVICE_LABOR_DEFAULTS[serviceCode];
  const cat = opts.catalog;
  const sized = opts.jobSize && def?.jobSize ? def.jobSize[opts.jobSize] : null;
  // Catalog defaults: prefer the per-job-size override, falling back to
  // the catalog's `default` slot, then to the SERVICE_LABOR_DEFAULTS
  // fallback. These are read-only — the helper still returns a single
  // resolved tuple regardless of where the numbers came from.
  const catalogHours =
    (opts.jobSize && cat?.defaultLaborHours?.[opts.jobSize]) ??
    cat?.defaultLaborHours?.default ??
    null;

  let source: LaborQuote["source"];
  let crewSize: number;
  let laborHours: number;

  if (opts.crewSize != null && opts.laborHours != null) {
    crewSize = opts.crewSize;
    laborHours = opts.laborHours;
    source = "explicit";
  } else if (catalogHours != null) {
    // Catalog-driven path: the catalog row carries default labor hours
    // and (optionally) a min crew. We prefer size-specific crew
    // (e.g., moving large = 4) over the row-level minCrew (which is the
    // floor across ALL sizes); minCrew is enforced as a floor below.
    crewSize = opts.crewSize ?? sized?.crew ?? def?.defaultCrew ?? cat?.minCrew ?? 1;
    laborHours = opts.laborHours ?? catalogHours;
    source = "catalog";
  } else if (sized) {
    // Size-specific tuple wins; minCrew applied as floor below.
    crewSize = opts.crewSize ?? sized.crew;
    laborHours = opts.laborHours ?? sized.hours;
    source = "jobSize";
  } else if (def) {
    crewSize = opts.crewSize ?? def.defaultCrew;
    laborHours = opts.laborHours ?? def.defaultHours;
    source = "default";
  } else if (opts.crewSize != null || opts.laborHours != null) {
    // Unknown service code but caller supplied at least one knob — honor it.
    crewSize = opts.crewSize ?? cat?.minCrew ?? 1;
    laborHours = opts.laborHours ?? 1;
    source = "unknown";
  } else {
    return null;
  }
  // Catalog minCrew is a FLOOR, never an override. Larger size-specific
  // crews (e.g., moving large = 4) must not be flattened down to the
  // row-level minimum (moving minCrew = 2). This preserves the chat
  // card's promised tuple — "4 movers × 4 hrs" for a large move — even
  // when the catalog row defines a smaller minimum.
  if (cat?.minCrew != null && opts.crewSize == null) {
    crewSize = Math.max(crewSize, cat.minCrew);
  }

  // Defensive clamp: at least 1 mover, at least 0.25 hr (15-min minimum).
  // Amount uses 2-decimal rounding (matches the route layer's
  // toFixed(2) override) so unit tests, e2e pipeline, and the live
  // /api/bookings/quote response all agree on the same dollar figure.
  crewSize = Math.max(1, Math.round(crewSize));
  laborHours = Math.max(0.25, +laborHours.toFixed(2));
  const totalLaborHours = +(crewSize * laborHours).toFixed(2);
  let amount = serviceCode === "moving" || serviceCode === "labor"
    ? calculateMovingLabor({ workers: crewSize, hours: laborHours }).total
    : +(totalLaborHours * LABOR_RATE_PER_HOUR).toFixed(2);
  // Catalog-driven clamp per spec step 2: suggestedMin/suggestedMax
  // bound the returned amount so a missing or undersized catalog value
  // can't produce an estimate that undercuts a real-world minimum or
  // overshoots the published range. Applied symmetrically — if the
  // catalog provides only one bound, only that side is clamped.
  if (cat?.suggestedMin != null && amount < cat.suggestedMin) {
    amount = +Number(cat.suggestedMin).toFixed(2);
  }
  if (cat?.suggestedMax != null && amount > cat.suggestedMax) {
    amount = +Number(cat.suggestedMax).toFixed(2);
  }
  return { crewSize, laborHours, totalLaborHours, ratePerHour: LABOR_RATE_PER_HOUR, amount, source };
}

/** Friendly "2 movers × 4 hrs" string for use in chat cards & line items.
 *  Singularises "mover" / "hr" when count is 1. */
export function formatLaborSummary(meta: { crewSize: number; laborHours: number }): string {
  const crewWord = meta.crewSize === 1 ? "mover" : "movers";
  const hrs = Number.isInteger(meta.laborHours)
    ? `${meta.laborHours}`
    : `${meta.laborHours}`;
  const hrWord = meta.laborHours === 1 ? "hr" : "hrs";
  return `${meta.crewSize} ${crewWord} × ${hrs} ${hrWord}`;
}
