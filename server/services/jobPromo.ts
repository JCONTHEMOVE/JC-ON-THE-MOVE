import { z } from "zod";
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
});

export type FixedMovingPackageOffer = z.infer<typeof fixedMovingPackageOfferSchema>;

export type JobPromoRecord = {
  code: string;
  description: string;
  jobOffer?: unknown;
};

export type JobPromoEvaluation = {
  quote: JobQuotePreview;
  applied: boolean;
  reason?: string;
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
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

  const localMilesMax = offer.localMilesMax ?? args.configuredLocalMilesMax ?? 10;
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

  const total = roundCurrency(offer.fixedBasePrice + args.automaticQuote.stairs + args.automaticQuote.elevator);
  const projectedTokens = Math.round(total * args.automaticQuote.rateCard.jcmovesPerDollar);
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
      projectedCustomerJcMoves: projectedTokens,
      projectedCrewPoolJcMoves: projectedTokens,
      packagePrice: offer.fixedBasePrice,
      promotion: {
        code: args.promo.code,
        description: args.promo.description,
        fixedBasePrice: offer.fixedBasePrice,
        requiredCrewSize: offer.requiredCrewSize,
        requiredHours: offer.requiredHours,
        verifiedLocalMiles: Number(args.verifiedLocalMiles),
        localMilesMax,
        includesCompanyTruck: offer.requiresCompanyTruck,
        includesTrailer: offer.requiresTrailer,
      },
    },
  };
}
