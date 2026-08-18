import { z } from "zod";

const money = z.number().finite().nonnegative();

const hourlyRateCardRowSchema = z.object({
  serviceCode: z.enum(["load_unload", "pack_unpack", "cleaning"]),
  crewSize: z.number().int().positive(),
  regularHourlyRate: money,
  discountAfterHours: money,
  discountedHourlyRate: money,
});

const geographicPricingPolicySchema = z.object({
  origin: z.object({
    zip: z.string().min(1),
    city: z.string().min(1),
    lat: z.number().finite(),
    lng: z.number().finite(),
  }),
  bubbleRadiusMiles: money.positive(),
  outsideBubbleMultiplier: money.positive(),
  weekendDays: z.array(z.number().int().min(0).max(6)),
  weekendMultiplier: money.positive(),
  autoTravelMaxMinutes: money,
  reviewTravelMaxMinutes: money,
  extendedMinimumPreTax: money,
  timezone: z.string().min(1),
});

export const canonicalPricingSnapshotSchema = z.object({
  version: z.string().min(1),
  currency: z.literal("USD"),
  effectiveAt: z.string().min(1),
  marketPosition: z.literal("premium"),
  labor: z.object({
    workerHourlyRate: money,
    minimumHours: money,
    minimumInvoice: money,
    longJobDiscounts: z.array(z.object({ minHours: money, maxHours: money.nullable(), percent: money })),
  }),
  equipment: z.object({
    truck15Ft: money,
    truck26Ft: money,
    trailer: money,
  }),
  travel: z.object({
    includedCrewHours: money,
    regionalCrewHourlyRate: money,
    roundingHours: money.positive(),
    longDistanceThresholdLoadedMiles: money,
    longDistanceRatePerLoadedMile: money,
    longDistanceMinimumMiles: money,
    replacesRegionalTravel: z.boolean(),
  }),
  services: z.object({
    junkRemoval: z.object({
      tiers: z.object({ tiny: money, small: money, medium: money, large: money, xlarge: money }),
      disposalSeparate: z.boolean(),
    }),
    delivery: z.object({ singleItem: money, storePickup: money, appliance: money, heavyItemMinimum: money }),
    handyman: z.object({ workerHourlyRate: money, minimumInvoice: money }),
    assembly: z.object({ standaloneMinimum: money, moveDayFirstTwoItems: money }),
    cleaning: z.object({
      standardByBedrooms: z.object({ one: money, two: money, three: money, four: money }),
      moveOutByBedrooms: z.object({ one: money, two: money, three: money, four: money }),
    }),
    windows: z.object({
      oneSidePerPane: money,
      bothSidesPerPane: money,
      minimumInvoice: money,
      ladderPerPane: money,
      screenOrTrackEach: money,
    }),
    lawn: z.object({
      mowing: z.object({ small: money, medium: money, large: money, xlarge: money }),
      fullService: z.object({ small: money, medium: money, large: money, xlarge: money }),
    }),
    snow: z.object({
      perPush: z.object({ small: money, medium: money, large: money, xlarge: money }),
      customHourlyRate: money,
    }),
    trashValet: z.object({
      monthlyByCans: z.object({ one: money, two: money, three: money }),
      additionalCanMonthly: money,
      outOfAreaMinimumMonthly: money,
      yearlyMonthsCharged: money,
    }),
    jumpStart: z.object({
      distanceBands: z.object({ upTo5: money, upTo15: money, upTo50: money, upTo100: money }),
      over100RequiresApproval: z.boolean(),
    }),
    projects: z.object({
      paintingWorkerHourlyRate: money,
      paintingMinimum: money,
      flooringLaborPerSqFt: money,
      flooringMinimum: money,
      demolitionMinimum: money,
      roofRepairMinimum: money,
    }),
  }),
  offers: z.object({
    totalPercentageCap: money,
    bundlePercent: money,
    bundleMaximumDollars: money,
    routeDayPercent: money,
    shopCardPrice: money,
    shopCardCredit: money,
  }),
  rewards: z.object({
    tokensPerDollar: money,
    servicePromotionPercent: money,
    btcSettlementRewardPercent: money,
  }),
  policies: z.object({
    standardConsumablesIncluded: z.boolean(),
    passThroughCostsItemized: z.boolean(),
    passThroughCostsDiscountEligible: z.boolean(),
  }),
  // Added in 2026.08.1. Optional so an already-published 2026.08 database
  // snapshot remains readable until the owner publishes the new draft.
  marketplaceRateCard: z.object({
    hourly: z.array(hourlyRateCardRowSchema),
    ubox: z.object({
      loadUnloadPerBox: money,
      deliveryLoadUnloadPerBox: money,
      deliveryLoadUnloadFirstBoxPerMile: money,
      deliveryLoadUnloadAdditionalBoxPerMile: money,
      deliveryOnlyFlat: money,
      deliveryOnlyPerBoxPerMile: money,
    }),
    pianoFlat: money,
    safeFlat: money,
  }).optional(),
  geographicPolicy: geographicPricingPolicySchema.optional(),
});

export type CanonicalPricingSnapshot = z.infer<typeof canonicalPricingSnapshotSchema>;

/**
 * Emergency, code-owned fallback. Runtime pricing should normally come from
 * the active database version; this object is also the seed for version
 * 2026.08 and the single source for client-safe display defaults.
 */
export const CANONICAL_PRICING_2026_08: CanonicalPricingSnapshot = {
  version: "2026.08",
  currency: "USD",
  effectiveAt: "2026-08-17T00:00:00-05:00",
  marketPosition: "premium",
  labor: {
    workerHourlyRate: 95,
    minimumHours: 2,
    minimumInvoice: 300,
    longJobDiscounts: [
      { minHours: 4, maxHours: 5, percent: 5 },
      { minHours: 6, maxHours: 7, percent: 10 },
      { minHours: 8, maxHours: null, percent: 15 },
    ],
  },
  equipment: { truck15Ft: 250, truck26Ft: 600, trailer: 175 },
  travel: {
    includedCrewHours: 0.5,
    regionalCrewHourlyRate: 100,
    roundingHours: 0.5,
    longDistanceThresholdLoadedMiles: 50,
    longDistanceRatePerLoadedMile: 4,
    longDistanceMinimumMiles: 100,
    replacesRegionalTravel: true,
  },
  services: {
    junkRemoval: {
      tiers: { tiny: 125, small: 225, medium: 375, large: 525, xlarge: 675 },
      disposalSeparate: true,
    },
    delivery: { singleItem: 225, storePickup: 250, appliance: 300, heavyItemMinimum: 350 },
    handyman: { workerHourlyRate: 95, minimumInvoice: 190 },
    assembly: { standaloneMinimum: 190, moveDayFirstTwoItems: 95 },
    cleaning: {
      standardByBedrooms: { one: 125, two: 165, three: 220, four: 285 },
      moveOutByBedrooms: { one: 300, two: 425, three: 575, four: 750 },
    },
    windows: {
      oneSidePerPane: 5,
      bothSidesPerPane: 8,
      minimumInvoice: 125,
      ladderPerPane: 4,
      screenOrTrackEach: 2,
    },
    lawn: {
      mowing: { small: 55, medium: 75, large: 105, xlarge: 155 },
      fullService: { small: 100, medium: 140, large: 195, xlarge: 275 },
    },
    snow: {
      perPush: { small: 65, medium: 90, large: 125, xlarge: 175 },
      customHourlyRate: 95,
    },
    trashValet: {
      monthlyByCans: { one: 35, two: 42, three: 49 },
      additionalCanMonthly: 7,
      outOfAreaMinimumMonthly: 129,
      yearlyMonthsCharged: 11,
    },
    jumpStart: {
      distanceBands: { upTo5: 50, upTo15: 65, upTo50: 95, upTo100: 175 },
      over100RequiresApproval: true,
    },
    projects: {
      paintingWorkerHourlyRate: 95,
      paintingMinimum: 500,
      flooringLaborPerSqFt: 5,
      flooringMinimum: 500,
      demolitionMinimum: 450,
      roofRepairMinimum: 750,
    },
  },
  offers: {
    totalPercentageCap: 15,
    bundlePercent: 10,
    bundleMaximumDollars: 50,
    routeDayPercent: 5,
    shopCardPrice: 90,
    shopCardCredit: 100,
  },
  rewards: {
    tokensPerDollar: 500,
    servicePromotionPercent: 20,
    btcSettlementRewardPercent: 5,
  },
  policies: {
    standardConsumablesIncluded: true,
    passThroughCostsItemized: true,
    passThroughCostsDiscountEligible: false,
  },
};

/**
 * Owner-publishable draft that adds the MovingHelper-derived rate card and
 * one explainable geographic policy for every booking channel. This is kept
 * separate from 2026.08 so deployment never silently activates new prices.
 */
export const CANONICAL_PRICING_2026_08_1: CanonicalPricingSnapshot = {
  ...CANONICAL_PRICING_2026_08,
  version: "2026.08.1",
  effectiveAt: "2026-08-17T00:00:00-05:00",
  marketplaceRateCard: {
    hourly: [
      { serviceCode: "load_unload", crewSize: 1, regularHourlyRate: 150, discountAfterHours: 5, discountedHourlyRate: 125 },
      { serviceCode: "load_unload", crewSize: 2, regularHourlyRate: 250, discountAfterHours: 4, discountedHourlyRate: 225 },
      { serviceCode: "load_unload", crewSize: 3, regularHourlyRate: 325, discountAfterHours: 4, discountedHourlyRate: 275 },
      { serviceCode: "load_unload", crewSize: 4, regularHourlyRate: 400, discountAfterHours: 4, discountedHourlyRate: 350 },
      { serviceCode: "pack_unpack", crewSize: 1, regularHourlyRate: 150, discountAfterHours: 4, discountedHourlyRate: 100 },
      { serviceCode: "pack_unpack", crewSize: 2, regularHourlyRate: 250, discountAfterHours: 5, discountedHourlyRate: 200 },
      { serviceCode: "cleaning", crewSize: 1, regularHourlyRate: 200, discountAfterHours: 8, discountedHourlyRate: 150 },
      { serviceCode: "cleaning", crewSize: 2, regularHourlyRate: 300, discountAfterHours: 5, discountedHourlyRate: 200 },
    ],
    ubox: {
      loadUnloadPerBox: 800,
      deliveryLoadUnloadPerBox: 1000,
      deliveryLoadUnloadFirstBoxPerMile: 2,
      deliveryLoadUnloadAdditionalBoxPerMile: 3,
      deliveryOnlyFlat: 1000,
      deliveryOnlyPerBoxPerMile: 2,
    },
    pianoFlat: 800,
    safeFlat: 800,
  },
  geographicPolicy: {
    origin: { zip: "49938", city: "Ironwood, MI", lat: 46.4539, lng: -90.1715 },
    bubbleRadiusMiles: 50,
    outsideBubbleMultiplier: 1.5,
    weekendDays: [0, 6],
    weekendMultiplier: 1.15,
    autoTravelMaxMinutes: 180,
    reviewTravelMaxMinutes: 240,
    extendedMinimumPreTax: 2000,
    timezone: "America/Chicago",
  },
};

export type MarketplaceHourlyServiceCode = "load_unload" | "pack_unpack" | "cleaning";

export type RateCardLineResult = {
  serviceCode: MarketplaceHourlyServiceCode;
  crewSize: number;
  billableHours: number;
  regularHourlyRate: number;
  discountedHourlyRate: number;
  discountAfterHours: number;
  regularHours: number;
  discountedHours: number;
  subtotal: number;
};

export function calculateRateCardLine(input: {
  serviceCode: MarketplaceHourlyServiceCode;
  crewSize: number;
  hours: number;
  snapshot?: CanonicalPricingSnapshot;
}): RateCardLineResult | null {
  const snapshot = input.snapshot ?? CANONICAL_PRICING_2026_08_1;
  const row = snapshot.marketplaceRateCard?.hourly.find((candidate) => (
    candidate.serviceCode === input.serviceCode && candidate.crewSize === Math.round(input.crewSize)
  ));
  if (!row) return null;
  const billableHours = Math.max(0, Number(input.hours) || 0);
  const regularHours = Math.min(billableHours, row.discountAfterHours);
  const discountedHours = Math.max(0, billableHours - row.discountAfterHours);
  return {
    serviceCode: row.serviceCode,
    crewSize: row.crewSize,
    billableHours,
    regularHourlyRate: row.regularHourlyRate,
    discountedHourlyRate: row.discountedHourlyRate,
    discountAfterHours: row.discountAfterHours,
    regularHours,
    discountedHours,
    subtotal: roundCurrency(
      regularHours * row.regularHourlyRate + discountedHours * row.discountedHourlyRate,
    ),
  };
}

export type MarketplaceFlatServiceCode =
  | "ubox_load_unload"
  | "ubox_delivery_load_unload"
  | "ubox_delivery_only"
  | "piano"
  | "safe";

export function calculateMarketplaceFlatRate(input: {
  serviceCode: MarketplaceFlatServiceCode;
  quantity?: number;
  boxes?: number;
  miles?: number;
  snapshot?: CanonicalPricingSnapshot;
}): number | null {
  const snapshot = input.snapshot ?? CANONICAL_PRICING_2026_08_1;
  const card = snapshot.marketplaceRateCard;
  if (!card) return null;
  const quantity = Math.max(1, Math.round(Number(input.quantity) || 1));
  const boxes = Math.max(1, Math.round(Number(input.boxes) || quantity));
  const miles = Math.max(0, Number(input.miles) || 0);
  if (input.serviceCode === "piano") return roundCurrency(card.pianoFlat * quantity);
  if (input.serviceCode === "safe") return roundCurrency(card.safeFlat * quantity);
  if (input.serviceCode === "ubox_load_unload") {
    return roundCurrency(card.ubox.loadUnloadPerBox * boxes);
  }
  if (input.serviceCode === "ubox_delivery_load_unload") {
    const mileage = miles * (
      card.ubox.deliveryLoadUnloadFirstBoxPerMile
      + Math.max(0, boxes - 1) * card.ubox.deliveryLoadUnloadAdditionalBoxPerMile
    );
    return roundCurrency(card.ubox.deliveryLoadUnloadPerBox * boxes + mileage);
  }
  return roundCurrency(card.ubox.deliveryOnlyFlat + card.ubox.deliveryOnlyPerBoxPerMile * boxes * miles);
}

export type QuoteStopCoordinate = { lat: number; lng: number };
export type TravelEligibilityStatus =
  | "local"
  | "extended_auto"
  | "owner_review"
  | "unverified"
  | "out_of_range";

export type QuoteApprovalActor = {
  isOwner: boolean;
  canApproveStandard: boolean;
};

export function assertQuoteApprovalAllowed(input: {
  travelEligibility: Record<string, unknown>;
  actor: QuoteApprovalActor;
  overrideReason?: string | null;
}) {
  const eligibility = input.travelEligibility;
  if (eligibility.canApprove === false || eligibility.status === "out_of_range") {
    throw new Error("This job exceeds the four-hour one-way service limit and cannot be approved");
  }
  const requiresOwner = eligibility.requiresOwner === true;
  if (requiresOwner && !input.actor.isOwner) {
    throw new Error("Business-owner approval is required for this travel exception");
  }
  if (!requiresOwner && !input.actor.canApproveStandard) {
    throw new Error("Gold authority or business-owner access is required");
  }
  const overrideReason = String(input.overrideReason || "").trim();
  if (requiresOwner && overrideReason.length < 5) {
    throw new Error("Record the owner override reason before approving");
  }
  return { requiresOwner, overrideReason: requiresOwner ? overrideReason : null };
}

export type GeographicQuotePolicyResult = {
  baseSubtotal: number;
  adjustedSubtotal: number;
  automaticDiscountTotal: number;
  finalPreTaxTotal: number;
  pricingAdjustments: {
    insideBubble: boolean | null;
    farthestStopMiles: number | null;
    bubbleRadiusMiles: number;
    geographicMultiplier: number;
    geographicAmount: number;
    weekend: boolean;
    weekendMultiplier: number;
    weekendAmount: number;
    compoundedMultiplier: number;
  };
  travelEligibility: {
    status: TravelEligibilityStatus;
    routeVerified: boolean;
    oneWayMinutes: number | null;
    oneWayMiles: number | null;
    minimumPreTax: number;
    minimumSatisfied: boolean;
    requiresOwner: boolean;
    canApprove: boolean;
    reasons: string[];
  };
};

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusMiles = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radiusMiles * 2 * Math.asin(Math.sqrt(a));
}

function serviceDayIndex(value: string | null | undefined, timezone: string): number | null {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone }).format(parsed);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

export function applyGeographicQuotePolicy(input: {
  baseSubtotal: number;
  automaticDiscountTotal?: number;
  serviceDate?: string | null;
  stopCoordinates?: QuoteStopCoordinate[];
  routeVerified?: boolean;
  oneWayMinutes?: number | null;
  oneWayMiles?: number | null;
  snapshot?: CanonicalPricingSnapshot;
}): GeographicQuotePolicyResult | null {
  const snapshot = input.snapshot ?? CANONICAL_PRICING_2026_08_1;
  const policy = snapshot.geographicPolicy;
  if (!policy) return null;

  const stops = (input.stopCoordinates || []).filter((stop) => (
    Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
  ));
  const distances = stops.map((stop) => haversineMiles(
    policy.origin.lat,
    policy.origin.lng,
    stop.lat,
    stop.lng,
  ));
  const farthestStopMiles = distances.length ? Math.max(...distances) : null;
  // A tiny numerical tolerance keeps a mathematically exact point on the
  // inclusive radius from becoming outside due to floating-point noise.
  const insideBubble = farthestStopMiles == null ? null : farthestStopMiles <= policy.bubbleRadiusMiles + 1e-6;
  const geographicMultiplier = insideBubble === false ? policy.outsideBubbleMultiplier : 1;
  const dayIndex = serviceDayIndex(input.serviceDate, policy.timezone);
  const weekend = dayIndex != null && policy.weekendDays.includes(dayIndex);
  const weekendMultiplier = weekend ? policy.weekendMultiplier : 1;
  const baseSubtotal = roundCurrency(Math.max(0, Number(input.baseSubtotal) || 0));
  const afterGeographic = roundCurrency(baseSubtotal * geographicMultiplier);
  const adjustedSubtotal = roundCurrency(afterGeographic * weekendMultiplier);
  const automaticDiscountTotal = roundCurrency(Math.max(0, Number(input.automaticDiscountTotal) || 0));
  const finalPreTaxTotal = roundCurrency(Math.max(0, adjustedSubtotal - automaticDiscountTotal));
  const routeVerified = input.routeVerified === true;
  const oneWayMinutes = Number.isFinite(Number(input.oneWayMinutes)) ? Math.max(0, Number(input.oneWayMinutes)) : null;
  const oneWayMiles = Number.isFinite(Number(input.oneWayMiles)) ? Math.max(0, Number(input.oneWayMiles)) : null;
  const minimumSatisfied = finalPreTaxTotal >= policy.extendedMinimumPreTax;
  const reasons: string[] = [];
  let status: TravelEligibilityStatus;
  let requiresOwner = false;
  let canApprove = true;

  if (insideBubble == null || !routeVerified || oneWayMinutes == null) {
    status = "unverified";
    requiresOwner = true;
    reasons.push("Address or routed drive time could not be verified.");
  } else if (insideBubble) {
    status = "local";
    reasons.push(`Every service stop is within the ${policy.bubbleRadiusMiles}-mile Ironwood bubble.`);
  } else if (oneWayMinutes > policy.reviewTravelMaxMinutes) {
    status = "out_of_range";
    requiresOwner = true;
    canApprove = false;
    reasons.push(`One-way drive time exceeds the ${policy.reviewTravelMaxMinutes}-minute hard limit.`);
  } else if (oneWayMinutes > policy.autoTravelMaxMinutes) {
    status = "owner_review";
    requiresOwner = true;
    reasons.push(`One-way drive time is between ${policy.autoTravelMaxMinutes + 1} and ${policy.reviewTravelMaxMinutes} minutes.`);
  } else if (!minimumSatisfied) {
    status = "owner_review";
    requiresOwner = true;
    reasons.push(`Outside-bubble total is below the $${policy.extendedMinimumPreTax.toLocaleString()} minimum.`);
  } else {
    status = "extended_auto";
    reasons.push("Outside-bubble quote meets the drive-time and minimum-total rules.");
  }
  if (insideBubble === false && !minimumSatisfied && !reasons.some((reason) => reason.includes("below"))) {
    requiresOwner = true;
    reasons.push(`Outside-bubble total is below the $${policy.extendedMinimumPreTax.toLocaleString()} minimum.`);
  }

  return {
    baseSubtotal,
    adjustedSubtotal,
    automaticDiscountTotal,
    finalPreTaxTotal,
    pricingAdjustments: {
      insideBubble,
      farthestStopMiles: farthestStopMiles == null ? null : roundCurrency(farthestStopMiles),
      bubbleRadiusMiles: policy.bubbleRadiusMiles,
      geographicMultiplier,
      geographicAmount: roundCurrency(afterGeographic - baseSubtotal),
      weekend,
      weekendMultiplier,
      weekendAmount: roundCurrency(adjustedSubtotal - afterGeographic),
      compoundedMultiplier: Math.round(geographicMultiplier * weekendMultiplier * 1000) / 1000,
    },
    travelEligibility: {
      status,
      routeVerified,
      oneWayMinutes,
      oneWayMiles,
      minimumPreTax: policy.extendedMinimumPreTax,
      minimumSatisfied,
      requiresOwner,
      canApprove,
      reasons,
    },
  };
}

export function roundCurrency(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100;
}

export function longJobDiscountPercent(hours: number, snapshot = CANONICAL_PRICING_2026_08): number {
  const safeHours = Math.max(0, Number.isFinite(hours) ? hours : 0);
  const tier = snapshot.labor.longJobDiscounts.find(
    (candidate) => safeHours >= candidate.minHours && (candidate.maxHours == null || safeHours <= candidate.maxHours),
  );
  return tier?.percent ?? 0;
}

export function calculateMovingLabor(input: {
  workers: number;
  hours: number;
  snapshot?: CanonicalPricingSnapshot;
}) {
  const snapshot = input.snapshot ?? CANONICAL_PRICING_2026_08;
  const workers = Math.max(1, Math.round(Number(input.workers) || 1));
  const hours = Math.max(snapshot.labor.minimumHours, Number(input.hours) || 0);
  const rawLabor = roundCurrency(workers * hours * snapshot.labor.workerHourlyRate);
  const beforeDiscount = Math.max(rawLabor, snapshot.labor.minimumInvoice);
  const discountPercent = longJobDiscountPercent(hours, snapshot);
  const discountAmount = roundCurrency(beforeDiscount * discountPercent / 100);
  return {
    workers,
    hours,
    ratePerWorkerHour: snapshot.labor.workerHourlyRate,
    rawLabor,
    beforeDiscount,
    discountPercent,
    discountAmount,
    total: roundCurrency(beforeDiscount - discountAmount),
  };
}

export function calculateRegionalTravel(input: {
  roundTripCrewHours: number;
  loadedMiles?: number;
  snapshot?: CanonicalPricingSnapshot;
}) {
  const snapshot = input.snapshot ?? CANONICAL_PRICING_2026_08;
  const loadedMiles = Math.max(0, Number(input.loadedMiles) || 0);
  if (loadedMiles > snapshot.travel.longDistanceThresholdLoadedMiles) {
    const billableMiles = Math.max(Math.ceil(loadedMiles), snapshot.travel.longDistanceMinimumMiles);
    return {
      mode: "long_distance" as const,
      billableCrewHours: 0,
      billableMiles,
      total: roundCurrency(billableMiles * snapshot.travel.longDistanceRatePerLoadedMile),
    };
  }
  const beyondIncluded = Math.max(0, (Number(input.roundTripCrewHours) || 0) - snapshot.travel.includedCrewHours);
  const billableCrewHours = beyondIncluded <= 0
    ? 0
    : Math.ceil(beyondIncluded / snapshot.travel.roundingHours) * snapshot.travel.roundingHours;
  return {
    mode: "regional" as const,
    billableCrewHours,
    billableMiles: 0,
    total: roundCurrency(billableCrewHours * snapshot.travel.regionalCrewHourlyRate),
  };
}

export type PercentageOffer = {
  code: string;
  percent: number;
  maxDollars?: number | null;
};

export function calculateCappedPercentageOffers(
  eligibleSubtotal: number,
  offers: PercentageOffer[],
  capPercent = CANONICAL_PRICING_2026_08.offers.totalPercentageCap,
) {
  const subtotal = Math.max(0, Number.isFinite(eligibleSubtotal) ? eligibleSubtotal : 0);
  const applied = offers.map((offer) => {
    const percent = Math.max(0, Number.isFinite(offer.percent) ? offer.percent : 0);
    const rawAmount = roundCurrency(subtotal * percent / 100);
    const amount = offer.maxDollars == null
      ? rawAmount
      : Math.min(rawAmount, Math.max(0, offer.maxDollars));
    return { ...offer, percent, rawAmount, amount: roundCurrency(amount) };
  });
  const rawTotal = roundCurrency(applied.reduce((sum, offer) => sum + offer.amount, 0));
  const capAmount = roundCurrency(subtotal * Math.max(0, capPercent) / 100);
  const discountTotal = Math.min(rawTotal, capAmount);
  return {
    eligibleSubtotal: subtotal,
    capPercent,
    capAmount,
    rawTotal,
    discountTotal: roundCurrency(discountTotal),
    capApplied: rawTotal > capAmount,
    applied,
  };
}

export function serviceRewardTokenCost(
  cashValue: number,
  snapshot = CANONICAL_PRICING_2026_08,
): number {
  const standardTokens = Math.max(0, cashValue) * snapshot.rewards.tokensPerDollar;
  const promotionalTokens = standardTokens * (1 - snapshot.rewards.servicePromotionPercent / 100);
  return Math.max(0, Math.round(promotionalTokens / 500) * 500);
}

export function catalogPriceSummary(serviceCode: string, snapshot = CANONICAL_PRICING_2026_08): {
  defaultPrice: number | null;
  suggestedMin: number;
  suggestedMax: number;
} | null {
  const s = snapshot.services;
  const summaries: Record<string, { defaultPrice: number | null; suggestedMin: number; suggestedMax: number }> = {
    moving: { defaultPrice: null, suggestedMin: snapshot.labor.minimumInvoice, suggestedMax: 5000 },
    labor: { defaultPrice: snapshot.labor.workerHourlyRate, suggestedMin: snapshot.labor.minimumInvoice, suggestedMax: 5000 },
    junk_removal: { defaultPrice: null, suggestedMin: s.junkRemoval.tiers.tiny, suggestedMax: s.junkRemoval.tiers.xlarge },
    delivery: { defaultPrice: s.delivery.singleItem, suggestedMin: s.delivery.singleItem, suggestedMax: s.delivery.heavyItemMinimum },
    handyman: { defaultPrice: s.handyman.workerHourlyRate, suggestedMin: s.handyman.minimumInvoice, suggestedMax: 1500 },
    assembly: { defaultPrice: s.assembly.standaloneMinimum, suggestedMin: s.assembly.standaloneMinimum, suggestedMax: 750 },
    assembly_finish: { defaultPrice: s.assembly.moveDayFirstTwoItems, suggestedMin: s.assembly.moveDayFirstTwoItems, suggestedMax: 500 },
    cleaning: { defaultPrice: s.cleaning.standardByBedrooms.one, suggestedMin: s.cleaning.standardByBedrooms.one, suggestedMax: s.cleaning.standardByBedrooms.four },
    move_cleaning: { defaultPrice: s.cleaning.moveOutByBedrooms.one, suggestedMin: s.cleaning.moveOutByBedrooms.one, suggestedMax: s.cleaning.moveOutByBedrooms.four },
    deep_clean_turnover: { defaultPrice: s.cleaning.moveOutByBedrooms.one, suggestedMin: s.cleaning.moveOutByBedrooms.one, suggestedMax: s.cleaning.moveOutByBedrooms.four },
    window_cleaning: { defaultPrice: null, suggestedMin: s.windows.minimumInvoice, suggestedMax: 750 },
    lawn_care: { defaultPrice: s.lawn.mowing.small, suggestedMin: s.lawn.mowing.small, suggestedMax: s.lawn.fullService.xlarge },
    snow_removal: { defaultPrice: s.snow.perPush.small, suggestedMin: s.snow.perPush.small, suggestedMax: 400 },
    trash_valet: { defaultPrice: s.trashValet.monthlyByCans.one, suggestedMin: s.trashValet.monthlyByCans.one, suggestedMax: s.trashValet.outOfAreaMinimumMonthly },
    jump_start: { defaultPrice: s.jumpStart.distanceBands.upTo5, suggestedMin: s.jumpStart.distanceBands.upTo5, suggestedMax: s.jumpStart.distanceBands.upTo100 },
    painting: { defaultPrice: s.projects.paintingWorkerHourlyRate, suggestedMin: s.projects.paintingMinimum, suggestedMax: 8000 },
    flooring: { defaultPrice: s.projects.flooringLaborPerSqFt, suggestedMin: s.projects.flooringMinimum, suggestedMax: 8000 },
    demolition: { defaultPrice: null, suggestedMin: s.projects.demolitionMinimum, suggestedMax: 2500 },
    roofing: { defaultPrice: null, suggestedMin: s.projects.roofRepairMinimum, suggestedMax: 12000 },
    junk_reset: { defaultPrice: s.junkRemoval.tiers.small, suggestedMin: s.junkRemoval.tiers.tiny, suggestedMax: s.junkRemoval.tiers.medium },
    walkway_priority: { defaultPrice: s.snow.perPush.small, suggestedMin: s.snow.perPush.small, suggestedMax: s.snow.perPush.large },
  };
  return summaries[serviceCode] ?? null;
}

/** Backward-compatible shape used while legacy clients migrate to /pricing/v2. */
export function toLegacyPricingConfig(snapshot = CANONICAL_PRICING_2026_08) {
  return {
    pricingVersion: snapshot.version,
    ratePerMoverHour: snapshot.labor.workerHourlyRate,
    truckAdd: snapshot.equipment.truck15Ft,
    minHours: { 1: 2, 2: 2, 3: 2, 4: 3, 5: 4 },
    shortJobRate: snapshot.labor.minimumInvoice / snapshot.labor.minimumHours,
    shortJobFull: snapshot.labor.minimumInvoice,
    heavyItemFlat: snapshot.services.delivery.heavyItemMinimum,
    driveRate: snapshot.travel.regionalCrewHourlyRate,
    driveSpeedMph: 50,
    junkSmallLow: snapshot.services.junkRemoval.tiers.tiny,
    junkSmallHigh: snapshot.services.junkRemoval.tiers.small,
    junkLargeLow: snapshot.services.junkRemoval.tiers.medium,
    junkLargeHigh: snapshot.services.junkRemoval.tiers.xlarge,
    truckSmallFlat: snapshot.equipment.truck15Ft,
    truckLargeFlat: snapshot.equipment.truck26Ft,
    trailerFlat: snapshot.equipment.trailer,
    windowCleaningPerPane: snapshot.services.windows.oneSidePerPane,
    trashValetBaseMonthly: snapshot.services.trashValet.monthlyByCans.one,
    paintingHourlyRate: snapshot.services.projects.paintingWorkerHourlyRate,
    flooringPerSqFt: snapshot.services.projects.flooringLaborPerSqFt,
    snowRemovalHourlyRate: snapshot.services.snow.customHourlyRate,
    handymanHourlyRate: snapshot.services.handyman.workerHourlyRate,
    lawnCareHourlyRate: snapshot.labor.workerHourlyRate,
    localMilesMax: snapshot.travel.longDistanceThresholdLoadedMiles,
    regionalMilesMax: snapshot.travel.longDistanceThresholdLoadedMiles,
    regionalSurchargePerMile: 0,
    longDistanceRatePerMile: snapshot.travel.longDistanceRatePerLoadedMile,
    longDistanceMinMiles: snapshot.travel.longDistanceMinimumMiles,
    fuelSurchargeFlat: 0,
    fuelSurchargeMinMiles: snapshot.travel.longDistanceThresholdLoadedMiles,
  };
}
