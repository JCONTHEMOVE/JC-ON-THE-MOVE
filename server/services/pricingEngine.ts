// Unified pricing engine — single importable surface for every quote
// surface in the app (Task #169).
//
// This module is the *source of truth* for booking pricing. The legacy
// `bookingPricing.ts` engine remains the pure math kernel (computeBookingQuote
// + computeBookingReward) and the per-service shared modules
// (trashValetPricing, windowCleaningPricing, jumpStartPricing) remain the
// per-line calculators. This file re-exports them all and adds two
// convenience functions the upstream pipeline orchestrator and admin
// pricing-calibrate can call directly without going through HTTP:
//
//   * quoteService(serviceCode, inputs) — quote a single service line
//   * quoteBundle(items, options)       — wraps computeBookingQuote with
//                                         catalog + bundle DB loading
//
// Every other file that needs a price (chatbot, /book, /pricing, admin
// pricing-calibrate, dispatch) should import from THIS file. That way a
// single number change in the catalog or in this module flows to every
// surface automatically.

import { db } from "../db";
import { eq } from "drizzle-orm";
import {
  serviceCatalog,
  bundleDefinitions,
  type ServiceCatalogEntry,
  type BundleDefinition,
} from "@shared/schema";
import {
  computeBookingQuote,
  computeBookingReward,
  SERVICE_LINE_MINIMUMS,
  MAX_BUNDLE_DISCOUNT_PCT,
  DEFAULT_FLAT_BOOKING_BONUS,
  type BookingPricingItemInput,
  type BookingPricingResult,
  type BundleDefinitionLike,
  type ComputeBookingQuoteOptions,
  type AppliedBundle,
} from "./bookingPricing";
import {
  calculateTrashValetQuote,
} from "../../shared/trashValetPricing";
import {
  calculateWindowCleaningQuote,
} from "../../shared/windowCleaningPricing";
import {
  calculateJumpStartQuote,
} from "../../shared/jumpStartPricing";
// Task #211 — handwritten rule files for painting & flooring estimates.
// Lives under server/services/quoteRules/ so a non-engineer note can tune
// the per-room base, ceiling/trim adders, removal & haul-away charges,
// etc. without touching the routing layer.
import { estimatePainting, type PaintingAnswers } from "./quoteRules/painting";
import { estimateFlooring, type FlooringAnswers } from "./quoteRules/flooring";

export { estimatePainting, estimateFlooring };
export type { PaintingAnswers, FlooringAnswers };

// Re-export the kernel so callers only need to import from one place.
export {
  computeBookingQuote,
  computeBookingReward,
  SERVICE_LINE_MINIMUMS,
  MAX_BUNDLE_DISCOUNT_PCT,
  DEFAULT_FLAT_BOOKING_BONUS,
};
export type {
  BookingPricingItemInput,
  BookingPricingResult,
  BundleDefinitionLike,
  ComputeBookingQuoteOptions,
  AppliedBundle,
};

// ── Handwritten pricing matrices ─────────────────────────────────────────
// The actual numbers live in `shared/pricingTables.ts` so /pricing, /book,
// the chatbot, and admin pricing-calibrate (all client-side) can import
// them too. This file re-exports them and provides server-side quote
// helpers that wrap `quoteMovingFromTable` / `quoteJunkFromTable`.
import {
  MOVING_BASE_MATRIX,
  MOVING_LOAD_TYPE_MULTIPLIER,
  JUNK_TIERS,
  type JunkTier,
  quoteMovingFromTable,
  quoteJunkFromTable,
  quoteByLaborHours,
  LABOR_RATE_PER_HOUR,
  type LaborQuote,
} from "../../shared/pricingTables";

export {
  MOVING_BASE_MATRIX,
  MOVING_LOAD_TYPE_MULTIPLIER,
  JUNK_TIERS,
  quoteMovingFromTable,
  quoteJunkFromTable,
  quoteByLaborHours,
  LABOR_RATE_PER_HOUR,
};
export type { JunkTier, LaborQuote };

export function quoteMoving(opts: { bedrooms?: string; stairs?: number | string; loadType?: string }): { amount: number; breakdown: Record<string, unknown> } {
  const r = quoteMovingFromTable(opts);
  return {
    amount: r.amount,
    breakdown: {
      bedrooms: opts.bedrooms ?? "1br",
      stairs: String(opts.stairs ?? 0),
      loadType: opts.loadType ?? "local",
      base: r.base,
      multiplier: r.multiplier,
    },
  };
}

export function quoteJunk(tierCode: string): { amount: number; tier: JunkTier | null } {
  return quoteJunkFromTable(tierCode);
}

/** Pure per-service quote — used by the chatbot, /pricing, and the admin
 *  pricing-calibrate page. Knows about the per-service shared calculators
 *  (trash valet, windows, jump start) and falls back to the catalog
 *  defaultPrice/suggestedMin..suggestedMax for any other service. */
export interface ServiceQuoteResult {
  serviceCode: string;
  /** Estimated total in USD. Always present. */
  amount: number;
  /** Range when the quote is a band rather than an exact figure. */
  minPrice?: number;
  maxPrice?: number;
  /** True when the engine could not produce a numeric quote (e.g. unknown
   *  service, or service marked as priceMode: "quote" with no inputs). */
  isQuoteOnly: boolean;
  /** Free-form per-service breakdown for the caller to display. */
  breakdown?: unknown;
}

export interface QuoteServiceInputs {
  /** When the caller already has the catalog loaded (to avoid a DB hit on
   *  every line in a bulk quote). */
  catalogEntry?: ServiceCatalogEntry | null;
  /** Service-specific inputs — see the per-service shared modules for
   *  shapes. Unknown shapes are forwarded as-is into `breakdown`. */
  details?: Record<string, any>;
}

export async function quoteService(
  serviceCode: string,
  inputs: QuoteServiceInputs = {},
): Promise<ServiceQuoteResult> {
  const cat = inputs.catalogEntry ?? (await loadCatalogEntry(serviceCode));
  const d = inputs.details || {};

  // ── Per-service calculators that already live in shared/ ────────────────
  if (serviceCode === "trash_valet" && d.cans != null) {
    const q = calculateTrashValetQuote({
      cans: Number(d.cans) || 1,
      bagCount: Number(d.bagCount) || 0,
      recyclingEnabled: !!d.recyclingEnabled,
      recyclingCans: d.recyclingCans != null ? Number(d.recyclingCans) : undefined,
      recyclingAnchorDate: d.recyclingAnchorDate ?? null,
      planType: d.planType === "yearly" ? "yearly" : "monthly",
      // Travel surcharge requires lat/lng. Callers without coords skip it
      // (matches the customer-facing /api/trash/subscribe fallback).
      lat: d.lat != null ? Number(d.lat) : null,
      lng: d.lng != null ? Number(d.lng) : null,
    });
    return {
      serviceCode,
      amount: q.finalMonthlyPrice,
      minPrice: q.finalMonthlyPrice,
      maxPrice: q.finalMonthlyPrice,
      isQuoteOnly: false,
      breakdown: q,
    };
  }

  if (serviceCode === "window_cleaning" && (d.standardWindows || d.largeWindows || d.ladderWindows)) {
    const q = calculateWindowCleaningQuote({
      standardWindows: Number(d.standardWindows) || 0,
      largeWindows: Number(d.largeWindows) || 0,
      ladderWindows: Number(d.ladderWindows) || 0,
      includeInside: d.includeInside ?? d.cleanInside ?? false,
      includeOutside: (d.includeOutside ?? d.cleanOutside) !== false,
      seasonMode: d.seasonMode === "winter_inside_only" ? "winter_inside_only" : "normal",
      promoCode: d.promoCode,
      addonSelected: !!d.addonSelected,
    });
    return {
      serviceCode,
      amount: q.total,
      minPrice: q.subtotal,
      maxPrice: q.total,
      isQuoteOnly: false,
      breakdown: q,
    };
  }

  if (serviceCode === "moving" && (d.bedrooms || d.stairs != null || d.loadType)) {
    const rawLoadType = String(d.loadType ?? "").toLowerCase();
    const normalizedLoadType =
      rawLoadType.includes("load + unload") || rawLoadType.includes("both")
        ? "local"
        : rawLoadType.includes("load only") || rawLoadType.includes("unload only")
          ? "labor_only"
          : d.loadType;
    const matrix = quoteMovingFromTable({ bedrooms: d.bedrooms, stairs: d.stairs, loadType: normalizedLoadType });
    const q = quoteMoving({ bedrooms: d.bedrooms, stairs: d.stairs, loadType: normalizedLoadType });
    // Task #218 round-9 rev2 — pull the labor tuple straight from the matrix
    // helper instead of back-computing through a coarse jobSize bucket. This
    // keeps `quoteService` aligned with the route layer for matrix-specific
    // bedroom tiers (e.g., 3br → crew=3, not the "medium" jobSize crew=2).
    const labor = matrix.labor
      ?? quoteByLaborHours("moving", { jobSize: inferJobSizeFromBedrooms(d.bedrooms) });
    const derivedHours = labor && labor.crewSize > 0
      ? +(q.amount / (labor.crewSize * LABOR_RATE_PER_HOUR)).toFixed(2)
      : labor?.laborHours ?? 0;
    const truckFee = Number(d.truckFee ?? 0);
    const truckMileageFee = Number(d.truckMileageFee ?? 0);
    const oversizedItemFee = Number(d.oversizedItemFee ?? 0);
    const amount = q.amount
      + (Number.isFinite(truckFee) && truckFee > 0 ? truckFee : 0)
      + (!truckFee && Number.isFinite(truckMileageFee) && truckMileageFee > 0 ? truckMileageFee : 0)
      + (Number.isFinite(oversizedItemFee) && oversizedItemFee > 0 ? oversizedItemFee : 0);
    return {
      serviceCode,
      amount,
      minPrice: amount,
      maxPrice: amount,
      isQuoteOnly: false,
      breakdown: {
        ...q.breakdown,
        truckFee,
        truckMileageFee,
        oversizedItemFee,
        crewSize: labor?.crewSize ?? null,
        laborHours: derivedHours,
        ratePerHour: LABOR_RATE_PER_HOUR,
        totalLaborHours: labor ? +(labor.crewSize * derivedHours).toFixed(2) : null,
      },
    };
  }

  if (serviceCode === "junk_removal" && d.tier) {
    const q = quoteJunk(String(d.tier));
    const tierToSize: Record<string, "small" | "medium" | "large"> = {
      tiny: "small", small: "small", medium: "medium", large: "large", xlarge: "large",
    };
    const labor = quoteByLaborHours("junk_removal", { jobSize: tierToSize[String(d.tier)] });
    return {
      serviceCode,
      amount: q.amount,
      minPrice: q.amount,
      maxPrice: q.amount,
      isQuoteOnly: !q.tier,
      breakdown: {
        ...(q.tier ?? {}),
        crewSize: labor?.crewSize ?? 2,
        laborHours: labor && labor.crewSize > 0
          ? +(q.amount / (labor.crewSize * LABOR_RATE_PER_HOUR)).toFixed(2)
          : labor?.laborHours ?? 0,
        ratePerHour: LABOR_RATE_PER_HOUR,
      },
    };
  }

  // ── Explicit handwritten-rule services (not catalog-fallback) ──────────
  // These services have per-input rules captured directly in the engine so
  // every quote surface hits the same math instead of falling back to
  // catalog defaultPrice.
  if (serviceCode === "cleaning" || serviceCode === "move_cleaning") {
    // Per-square-foot flat-rate tiers with $300 floor; deep / move-out adds
    // a 40% surcharge. Inputs: { squareFeet, depthMode }.
    const sqft = Math.max(0, Number(d.squareFeet ?? 0));
    const depthMode = String(d.depthMode || (serviceCode === "move_cleaning" ? "deep" : "standard"));
    const base = sqft > 0
      ? Math.max(300, Math.round(sqft * (depthMode === "deep" ? 0.42 : 0.28)))
      : (serviceCode === "move_cleaning" ? 300 : 0);
    const amount = depthMode === "deep" ? Math.round(base * 1.4) : base;
    const cleaningSize = inferCleaningJobSize(sqft);
    const labor = quoteByLaborHours(serviceCode, { jobSize: cleaningSize });
    return {
      serviceCode,
      amount,
      minPrice: amount || 300,
      maxPrice: amount || 1200,
      isQuoteOnly: amount === 0,
      breakdown: {
        squareFeet: sqft, depthMode, base,
        crewSize: labor?.crewSize ?? 2,
        laborHours: labor?.laborHours ?? 3,
        ratePerHour: LABOR_RATE_PER_HOUR,
      },
    };
  }

  if (serviceCode === "handyman") {
    // Per-hour labor model at the canonical worker rate. Two-hour minimum;
    // crewSize defaults to one.
    const crewSize = Math.max(1, Number(d.crewSize ?? d.movers ?? 1));
    const hours = Math.max(2, Number(d.hours ?? 2));
    const totalLaborHours = +(crewSize * hours).toFixed(2);
    const amount = Math.round(totalLaborHours * LABOR_RATE_PER_HOUR);
    return {
      serviceCode, amount, minPrice: 170, maxPrice: Math.max(amount, 750), isQuoteOnly: false,
      breakdown: { crewSize, laborHours: hours, totalLaborHours, ratePerHour: LABOR_RATE_PER_HOUR },
    };
  }

  if (serviceCode === "labor") {
    // Crew × hours × the canonical worker rate. Two-mover, two-hour minimum.
    const crewSize = Math.max(1, Number(d.crewSize ?? d.movers ?? 2));
    const hours = Math.max(2, Number(d.hours ?? 2));
    const totalLaborHours = +(crewSize * hours).toFixed(2);
    const amount = Math.round(totalLaborHours * LABOR_RATE_PER_HOUR);
    return {
      serviceCode, amount, minPrice: Math.max(200, amount), maxPrice: Math.max(amount, 1000), isQuoteOnly: false,
      breakdown: { crewSize, laborHours: hours, totalLaborHours, ratePerHour: LABOR_RATE_PER_HOUR },
    };
  }

  if (serviceCode === "delivery") {
    // $100 base + $3/mile past 10 miles. Labor breakdown surfaced for
    // chat-card display; dollars unchanged (mile-driven, not pure labor).
    const miles = Math.max(0, Number(d.miles ?? 0));
    const amount = Math.round(100 + Math.max(0, miles - 10) * 3);
    const labor = quoteByLaborHours("delivery");
    return {
      serviceCode, amount, minPrice: 100, maxPrice: Math.max(amount, 400), isQuoteOnly: false,
      breakdown: {
        miles, base: 100,
        crewSize: labor?.crewSize ?? 2, laborHours: labor?.laborHours ?? 1,
        ratePerHour: LABOR_RATE_PER_HOUR,
      },
    };
  }

  // Task #211 — Painting & Flooring estimate from chatbot answer set.
  // Falls back to the catalog suggested-min when no answers are present so
  // any caller (wizard, chatbot, admin pricing-calibrate) gets a real
  // number instead of $0. Crew still confirms — these are estimates.
  if (serviceCode === "painting") {
    const fallbackMin = cat?.suggestedMin != null ? parseFloat(cat.suggestedMin) : undefined;
    const fallbackMax = cat?.suggestedMax != null ? parseFloat(cat.suggestedMax) : undefined;
    const est = estimatePainting({ answers: d as PaintingAnswers, fallbackMin, fallbackMax });
    return {
      serviceCode,
      amount: est.amount,
      minPrice: fallbackMin ?? est.amount,
      maxPrice: fallbackMax ?? est.amount,
      isQuoteOnly: est.amount === 0,
      breakdown: est.breakdown,
    };
  }

  if (serviceCode === "flooring") {
    const fallbackMin = cat?.suggestedMin != null ? parseFloat(cat.suggestedMin) : undefined;
    const fallbackMax = cat?.suggestedMax != null ? parseFloat(cat.suggestedMax) : undefined;
    const est = estimateFlooring({ answers: d as FlooringAnswers, fallbackMin, fallbackMax });
    return {
      serviceCode,
      amount: est.amount,
      minPrice: fallbackMin ?? est.amount,
      maxPrice: fallbackMax ?? est.amount,
      isQuoteOnly: est.amount === 0,
      breakdown: est.breakdown,
    };
  }

  if (serviceCode === "snow_removal") {
    // Handwritten tiers: per-event $50, yearly contract $2500, winter storm
    // rod-out $3800. Surface labor breakdown so the chat card matches.
    const planRaw = String(d.plan || "per_event").toLowerCase();
    const amount = planRaw.includes("year") ? 2500 : planRaw.includes("rod") || planRaw.includes("storm") ? 3800 : 50;
    const labor = quoteByLaborHours("snow_removal");
    return {
      serviceCode, amount, minPrice: amount, maxPrice: amount, isQuoteOnly: false,
      breakdown: {
        plan: planRaw,
        crewSize: labor?.crewSize ?? 1,
        laborHours: labor?.laborHours ?? 0.6,
        ratePerHour: LABOR_RATE_PER_HOUR,
      },
    };
  }

  if (serviceCode === "jump_start" || serviceCode === "jumpstart") {
    const miles = Number(d.distanceMiles ?? d.milesFromIronwood ?? 0);
    const q = calculateJumpStartQuote(miles);
    return {
      serviceCode,
      amount: q.flatPrice,
      minPrice: q.flatPrice,
      maxPrice: q.flatPrice,
      isQuoteOnly: q.isCustomQuote,
      breakdown: q,
    };
  }

  // ── Task #218 — Labor-hours fallback ────────────────────────────────────
  // Any service that didn't match a per-service handler above and is in
  // SERVICE_LABOR_DEFAULTS gets priced from the canonical worker rate. Honors
  // an explicit `jobSize` from the chat-intake parser when present.
  // Currently catches: lawn_care, trash_valet, window_cleaning,
  // demolition, junk_reset, deep_clean_turnover, assembly_finish,
  // walkway_priority, assembly — i.e. every "simple labor" service.
  const jobSizeHint = (typeof d.jobSize === "string" &&
    (d.jobSize === "small" || d.jobSize === "medium" || d.jobSize === "large"))
    ? d.jobSize as "small" | "medium" | "large"
    : undefined;
  const laborOnly = quoteByLaborHours(serviceCode, {
    jobSize: jobSizeHint,
    crewSize: d.crewSize != null ? Number(d.crewSize) : undefined,
    laborHours: d.laborHours != null ? Number(d.laborHours) : (d.hours != null ? Number(d.hours) : undefined),
  });
  if (laborOnly && cat?.defaultPriceMode === "quote") {
    const floor = SERVICE_LINE_MINIMUMS[serviceCode] ?? 0;
    const amount = Math.max(laborOnly.amount, floor);
    return {
      serviceCode,
      amount,
      minPrice: amount,
      maxPrice: amount,
      isQuoteOnly: false,
      breakdown: {
        crewSize: laborOnly.crewSize,
        laborHours: laborOnly.laborHours,
        totalLaborHours: laborOnly.totalLaborHours,
        ratePerHour: laborOnly.ratePerHour,
        source: laborOnly.source,
      },
    };
  }

  // ── Fallback: catalog default + suggested band ──────────────────────────
  if (!cat) {
    return { serviceCode, amount: 0, isQuoteOnly: true };
  }
  const def = cat.defaultPrice != null ? parseFloat(cat.defaultPrice) : 0;
  const min = cat.suggestedMin != null ? parseFloat(cat.suggestedMin) : def;
  const max = cat.suggestedMax != null ? parseFloat(cat.suggestedMax) : def;
  const floor = SERVICE_LINE_MINIMUMS[serviceCode];
  const amount = Math.max(def, floor || 0);
  // Even on the catalog-default path, attach a labor breakdown when we can
  // so the chat card always has crewSize/laborHours to render.
  const labor = quoteByLaborHours(serviceCode, { jobSize: jobSizeHint });
  return {
    serviceCode,
    amount,
    minPrice: Math.max(min, floor || 0),
    maxPrice: Math.max(max, floor || 0),
    isQuoteOnly: cat.defaultPriceMode === "quote" && def === 0,
    breakdown: labor ? {
      crewSize: labor.crewSize,
      laborHours: labor.laborHours,
      totalLaborHours: labor.totalLaborHours,
      ratePerHour: labor.ratePerHour,
    } : undefined,
  };
}

/** Map a moving bedrooms tag (studio/1br/.../5br+) onto the small/medium/
 *  large jobSize bucket used by SERVICE_LABOR_DEFAULTS. */
function inferJobSizeFromBedrooms(bedrooms: unknown): "small" | "medium" | "large" | undefined {
  const b = String(bedrooms || "").toLowerCase();
  if (!b) return undefined;
  if (b === "studio" || b === "1br") return "small";
  if (b === "2br" || b === "3br") return "medium";
  if (b === "4br" || b === "5br+" || b === "5br") return "large";
  return undefined;
}

/** Map cleaning sqft onto the small/medium/large jobSize bucket. */
function inferCleaningJobSize(sqft: number): "small" | "medium" | "large" | undefined {
  if (!sqft || sqft <= 0) return undefined;
  if (sqft < 1000) return "small";
  if (sqft < 2500) return "medium";
  return "large";
}

async function loadCatalogEntry(code: string): Promise<ServiceCatalogEntry | null> {
  const rows = await db
    .select()
    .from(serviceCatalog)
    .where(eq(serviceCatalog.code, code))
    .limit(1);
  return rows[0] ?? null;
}

function bundleRowToLike(row: BundleDefinition): BundleDefinitionLike {
  const combo = Array.isArray(row.serviceComboJson)
    ? (row.serviceComboJson as string[])
    : [];
  return {
    code: row.code,
    name: row.name,
    serviceCombo: combo,
    discountType: row.discountType as "percent" | "fixed",
    discountValue: parseFloat(row.discountValue),
    maxDiscount: row.maxDiscount != null ? parseFloat(row.maxDiscount) : null,
    priority: row.priority,
    isActive: row.isActive,
    merchandisingSlot: row.merchandisingSlot ?? null,
    bonusMultiplier:
      row.bonusMultiplier != null ? parseFloat(row.bonusMultiplier) : 1,
  };
}

/** Convenience wrapper around `computeBookingQuote` that loads the active
 *  bundle definitions on the caller's behalf. The orchestrator (Task
 *  #170) and the /api/bookings/quote route both use this so neither has
 *  to re-implement the bundle DB loading. */
export async function quoteBundle(
  items: BookingPricingItemInput[],
  options: Omit<ComputeBookingQuoteOptions, "bundleDefinitions"> & {
    bundleDefinitions?: BundleDefinitionLike[];
  } = {},
): Promise<BookingPricingResult> {
  const { getActivePricingSnapshot } = await import("./pricingVersions");
  const activePricing = await getActivePricingSnapshot();
  const operations = activePricing.snapshot.operationsPolicy;
  const activeServiceMinimums = operations ? {
    moving: operations.serviceMinimums.moving,
    labor: operations.serviceMinimums.labor,
    junk_removal: operations.serviceMinimums.junkRemoval,
  } : undefined;
  const bundles =
    options.bundleDefinitions ??
    (await db
      .select()
      .from(bundleDefinitions)
      .where(eq(bundleDefinitions.isActive, true))
      .then((rows) => rows.map(bundleRowToLike)));
  return computeBookingQuote(items, {
    ...options,
    serviceMinimums: options.serviceMinimums || activeServiceMinimums,
    bundleDefinitions: bundles,
  });
}
