import { z } from "zod";
import { normalizeLaborWorkScope, type LaborWorkScope } from "@shared/laborBooking";
import type { JobQuotePreview } from "./jobRateCard";

/**
 * A fixed moving package is intentionally narrow: it cannot be turned into a
 * generic client-side discount by changing a request payload.  The route that
 * uses this helper verifies the promo record, its active/usage status, and the
 * local route before calling it.
 */
export const fixedMovingPackageOfferSchema = z.object({
  kind: z.literal("fixed_moving_package"),
  fixedBasePrice: z.number().finite().min(0).max(100000),
  requiredCrewSize: z.number().int().min(1).max(12),
  requiredHours: z.number().int().min(1).max(24),
  localMilesMax: z.number().finite().positive().max(500).optional(),
  requiresCompanyTruck: z.boolean().default(false),
  requiresTrailer: z.boolean().default(false),
  allowedWorkScopes: z.array(z.enum(["load_only", "unload_only", "load_unload"])).min(1).max(3).optional(),
  equipmentPolicy: z.enum(["labor_only", "company_truck", "company_truck_and_trailer", "any"]).optional(),
  localZoneCodes: z.array(z.string().trim().min(1).max(64)).min(1).max(20).optional(),
});

export type FixedMovingPackageOffer = z.infer<typeof fixedMovingPackageOfferSchema>;

export type JobPromoRecord = {
  code: string;
  description: string;
  discountPercent?: string | number | null;
  jobOffer?: unknown;
  isActive?: boolean | null;
  expiresAt?: string | Date | null;
  maxUses?: number | null;
  usesCount?: number | null;
};

export type JobPromoEvaluation = {
  quote: JobQuotePreview;
  applied: boolean;
  reason?: string;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function jobPromoAvailabilityReason(promo: JobPromoRecord, now = new Date()) {
  if (promo.isActive === false) return "This promo code is no longer active.";
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < now.getTime()) return "This promo code has expired.";
  if (promo.maxUses !== null && promo.maxUses !== undefined && Number(promo.usesCount || 0) >= promo.maxUses) {
    return "This promo code has reached its usage limit.";
  }
  return null;
}

/**
 * A standard service promo and a fixed moving package are mutually
 * exclusive. This keeps every moving channel on the same rule: one offer,
 * one final customer price, and one immutable pre-discount reward basis.
 */
export function applyPercentageMovingPromo(args: {
  promo: JobPromoRecord;
  automaticQuote: JobQuotePreview;
}): JobPromoEvaluation {
  const discountPercent = Math.max(0, Math.min(100, Number(args.promo.discountPercent || 0)));
  if (!Number.isFinite(discountPercent) || discountPercent <= 0) {
    return { quote: args.automaticQuote, applied: false };
  }

  const preDiscountTotal = args.automaticQuote.total;
  const discountAmount = roundCurrency(preDiscountTotal * (discountPercent / 100));
  const total = roundCurrency(preDiscountTotal - discountAmount);
  const projectedTokens = Math.round(args.automaticQuote.rewardEligibleTotal * args.automaticQuote.rateCard.jcmovesPerDollar);
  return {
    applied: true,
    quote: {
      ...args.automaticQuote,
      total,
      preDiscountTotal,
      discountAmount,
      rewardEligibleTotal: args.automaticQuote.rewardEligibleTotal,
      projectedCustomerJcMoves: projectedTokens,
      projectedCrewPoolJcMoves: projectedTokens,
      promotion: {
        code: args.promo.code,
        description: args.promo.description,
        kind: "percentage_discount",
        discountPercent,
        discountAmount,
      },
    },
  };
}

/**
 * Apply a verified fixed package to a rate-card result. Access charges remain
 * visible and are added on top of the package, while the included truck and
 * trailer are represented as a reservation rather than separate fees.
 */
export function applyFixedMovingPackageOffer(args: {
  promo: JobPromoRecord;
  automaticQuote: JobQuotePreview;
  crewSize: number;
  confirmedHours: number;
  workScope?: LaborWorkScope | string | null;
  truckConfig?: string | null;
  trailerRequested?: boolean | null;
  verifiedLocalZoneCode?: string | null;
  locationReason?: string | null;
  verifiedLocalMiles?: number | null;
  configuredLocalMilesMax?: number;
}): JobPromoEvaluation {
  const parsed = fixedMovingPackageOfferSchema.safeParse(args.promo.jobOffer);
  if (!parsed.success) {
    return { quote: args.automaticQuote, applied: false };
  }

  const offer = parsed.data;
  if (args.crewSize !== offer.requiredCrewSize || args.confirmedHours !== offer.requiredHours) {
    return {
      quote: args.automaticQuote,
      applied: false,
      reason: `${args.promo.code} is for exactly ${offer.requiredCrewSize} movers for ${offer.requiredHours} hours.`,
    };
  }

  const workScope = normalizeLaborWorkScope(args.workScope);
  if (offer.allowedWorkScopes && !offer.allowedWorkScopes.includes(workScope)) {
    return {
      quote: args.automaticQuote,
      applied: false,
      reason: `${args.promo.code} is limited to ${offer.allowedWorkScopes.map((scope) => scope.replace(/_/g, " ")).join(" or ")}.`,
    };
  }

  const truckConfig = String(args.truckConfig || "no_truck");
  const trailerRequested = Boolean(args.trailerRequested || truckConfig === "trailer_only");
  if (offer.equipmentPolicy === "labor_only" && (truckConfig === "company_truck" || truckConfig === "trailer_only" || trailerRequested)) {
    return {
      quote: args.automaticQuote,
      applied: false,
      reason: `${args.promo.code} is labor-only and requires a customer truck or no JC equipment.`,
    };
  }
  if (offer.equipmentPolicy === "company_truck" && truckConfig !== "company_truck") {
    return { quote: args.automaticQuote, applied: false, reason: `${args.promo.code} requires the JC truck.` };
  }
  if (offer.equipmentPolicy === "company_truck_and_trailer" && (truckConfig !== "company_truck" || !trailerRequested)) {
    return { quote: args.automaticQuote, applied: false, reason: `${args.promo.code} requires the JC truck and trailer.` };
  }

  if (offer.localZoneCodes?.length) {
    const verifiedZone = String(args.verifiedLocalZoneCode || "").trim().toUpperCase();
    if (!verifiedZone || !offer.localZoneCodes.includes(verifiedZone)) {
      return {
        quote: args.automaticQuote,
        applied: false,
        reason: args.locationReason || `${args.promo.code} is available only in the approved local service zone.`,
      };
    }
  }

  const localMilesMax = offer.localMilesMax ?? args.configuredLocalMilesMax ?? 10;
  if (!offer.localZoneCodes?.length) {
    if (!Number.isFinite(args.verifiedLocalMiles) || Number(args.verifiedLocalMiles) <= 0) {
      return {
        quote: args.automaticQuote,
        applied: false,
        reason: "Enter both pickup and destination addresses so local eligibility can be verified.",
      };
    }
    if (Number(args.verifiedLocalMiles) > localMilesMax) {
      return {
        quote: args.automaticQuote,
        applied: false,
        reason: `${args.promo.code} is available for local moves within ${localMilesMax} miles of Ironwood.`,
      };
    }
  }

  const total = roundCurrency(offer.fixedBasePrice + args.automaticQuote.stairs + args.automaticQuote.elevator);
  const projectedTokens = Math.round(args.automaticQuote.rewardEligibleTotal * args.automaticQuote.rateCard.jcmovesPerDollar);
  return {
    applied: true,
    quote: {
      ...args.automaticQuote,
      // The package replaces labor and included equipment rather than adding
      // another discount to them.
      labor: 0,
      truck: 0,
      trailer: 0,
      total,
      preDiscountTotal: args.automaticQuote.total,
      discountAmount: roundCurrency(Math.max(0, args.automaticQuote.total - total)),
      rewardEligibleTotal: args.automaticQuote.rewardEligibleTotal,
      projectedCustomerJcMoves: projectedTokens,
      projectedCrewPoolJcMoves: projectedTokens,
      packagePrice: offer.fixedBasePrice,
      promotion: {
        code: args.promo.code,
        description: args.promo.description,
        kind: "fixed_moving_package",
        fixedBasePrice: offer.fixedBasePrice,
        requiredCrewSize: offer.requiredCrewSize,
        requiredHours: offer.requiredHours,
        verifiedLocalMiles: Number.isFinite(args.verifiedLocalMiles) ? Number(args.verifiedLocalMiles) : undefined,
        localMilesMax: offer.localZoneCodes?.length ? undefined : localMilesMax,
        includesCompanyTruck: offer.requiresCompanyTruck || offer.equipmentPolicy === "company_truck" || offer.equipmentPolicy === "company_truck_and_trailer",
        includesTrailer: offer.requiresTrailer || offer.equipmentPolicy === "company_truck_and_trailer",
      },
    },
  };
}
