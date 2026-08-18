import { CANONICAL_PRICING_2026_08, calculateMovingLabor } from "./canonicalPricing";

export const PRICING_BASE = {
  laborRatePerMoverHour: CANONICAL_PRICING_2026_08.labor.workerHourlyRate,
  travelRatePerCrewHour: CANONICAL_PRICING_2026_08.travel.regionalCrewHourlyRate,
  truckSmallAddOnFlat: CANONICAL_PRICING_2026_08.equipment.truck15Ft,
  truckLargeAddOnFlat: CANONICAL_PRICING_2026_08.equipment.truck26Ft,
  localTruckMilesIncluded: CANONICAL_PRICING_2026_08.travel.longDistanceThresholdLoadedMiles,
  longDistanceRatePerMile: CANONICAL_PRICING_2026_08.travel.longDistanceRatePerLoadedMile,
  longDistanceMinimumMiles: CANONICAL_PRICING_2026_08.travel.longDistanceMinimumMiles,
  stairFlightRatePerAssignment: 100,
  specialtyItemBaseFee: 250,
  hotTubFlatFee: 400,
  assemblyRatePerAssignment: 100,
  laborOnlyMinimumHours: 2,
  truckMinimumHours: 2,
  driveSpeedMph: 50,
  travelWarningHours: 4,
  origin: {
    zip: "49938",
    city: "Ironwood, MI",
    lat: 46.4539,
    lng: -90.1715,
  },
} as const;

export type PricingAddOns = {
  truck: boolean;
  packing: boolean;
  stairs: boolean;
  piano: boolean;
  hotTub: boolean;
  assembly: boolean;
};

export type TruckSize = "sixteen" | "large";

export type ZipLocation = {
  zip: string;
  city: string;
  lat: number;
  lng: number;
};

export type TravelRoute = "loadOnly" | "loadUnload";

export type PricingPromoInput = {
  code: string;
  discountPercent?: number | null;
  description?: string | null;
};

export type PricingInput = {
  movers: number;
  hours: number;
  addOns: PricingAddOns;
  truckSize?: TruckSize | null;
  promo?: PricingPromoInput | null;
  pickup: ZipLocation;
  dropoff?: ZipLocation | null;
  route?: TravelRoute;
};

export type PricingResult = {
  billableMovers: number;
  billableHours: number;
  truckAddOnCost: number;
  loadedMiles: number;
  longDistanceMilesBilled: number;
  longDistanceCost: number;
  isLongDistance: boolean;
  laborSubtotal: number;
  discountRate: number;
  discountAmount: number;
  discountedLaborTotal: number;
  addOnTotal: number;
  travelMiles: number;
  travelHours: number;
  travelCost: number;
  subtotalBeforePromo: number;
  promoCode: string | null;
  promoDescription: string | null;
  promoDiscountAmount: number;
  grandTotal: number;
  route: TravelRoute;
  warnings: {
    travelOverCap: boolean;
  };
};

export const DEFAULT_ADD_ONS: PricingAddOns = {
  truck: false,
  packing: false,
  stairs: false,
  piano: false,
  hotTub: false,
  assembly: false,
};

export function getMinimumLaborHours(addOns: PricingAddOns) {
  return addOns.truck ? PRICING_BASE.truckMinimumHours : PRICING_BASE.laborOnlyMinimumHours;
}

export function getMinimumMovers(addOns: PricingAddOns, truckSize?: TruckSize | null) {
  const specialtyMinimum = addOns.piano || addOns.hotTub ? 3 : 1;
  if (!addOns.truck) {
    return specialtyMinimum;
  }

  return Math.max(specialtyMinimum, 2 + (addOns.stairs ? 1 : 0) + (truckSize === "large" ? 1 : 0));
}

export function getTruckAddOnCost(addOns: PricingAddOns, truckSize?: TruckSize | null) {
  if (!addOns.truck) {
    return 0;
  }

  return truckSize === "large" ? PRICING_BASE.truckLargeAddOnFlat : PRICING_BASE.truckSmallAddOnFlat;
}

export function getDiscountRate(hours: number) {
  if (hours >= 8) return 0.15;
  if (hours >= 6) return 0.10;
  if (hours >= 4) return 0.05;
  return 0;
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radiusMiles = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return radiusMiles * 2 * Math.asin(Math.sqrt(a));
}

export function roundUpToHalfHour(hours: number) {
  return Math.ceil(hours * 2) / 2;
}

export function computeTravelMetrics(input: PricingInput) {
  const route = input.route ?? (input.dropoff ? "loadUnload" : "loadOnly");
  const pickupMiles = haversineMiles(
    PRICING_BASE.origin.lat,
    PRICING_BASE.origin.lng,
    input.pickup.lat,
    input.pickup.lng
  );

  let totalMiles = pickupMiles * 2;
  let loadedMiles = 0;
  if (route === "loadUnload" && input.dropoff) {
    const dropoffMiles = haversineMiles(
      input.pickup.lat,
      input.pickup.lng,
      input.dropoff.lat,
      input.dropoff.lng
    );
    loadedMiles = dropoffMiles;
    const returnMiles = haversineMiles(
      input.dropoff.lat,
      input.dropoff.lng,
      PRICING_BASE.origin.lat,
      PRICING_BASE.origin.lng
    );
    totalMiles = pickupMiles + dropoffMiles + returnMiles;
  }

  const roundedTravelHours = roundUpToHalfHour(totalMiles / PRICING_BASE.driveSpeedMph);
  const isLongDistance = Boolean(
    input.addOns.truck &&
      route === "loadUnload" &&
      loadedMiles > PRICING_BASE.localTruckMilesIncluded
  );
  const longDistanceMilesBilled = isLongDistance
    ? Math.max(Math.ceil(loadedMiles), PRICING_BASE.longDistanceMinimumMiles)
    : 0;
  const longDistanceCost = longDistanceMilesBilled * PRICING_BASE.longDistanceRatePerMile;
  const travelHours = isLongDistance
    ? 0
    : Math.max(0, roundedTravelHours - CANONICAL_PRICING_2026_08.travel.includedCrewHours);
  const travelCost = travelHours * PRICING_BASE.travelRatePerCrewHour;

  return {
    route,
    loadedMiles,
    travelMiles: totalMiles,
    travelHours,
    travelCost,
    longDistanceMilesBilled,
    longDistanceCost,
    isLongDistance,
  };
}

export function calculatePromoDiscount(
  pricingBase: {
    billableMovers: number;
    billableHours: number;
    discountRate: number;
    discountedLaborTotal: number;
    addOnTotal: number;
    travelCost: number;
    longDistanceCost: number;
  },
  promo?: PricingPromoInput | null
) {
  if (!promo?.code?.trim()) {
    return {
      promoCode: null,
      promoDescription: null,
      promoDiscountAmount: 0,
      subtotalBeforePromo: roundMoney(
        pricingBase.discountedLaborTotal +
          pricingBase.addOnTotal +
          pricingBase.travelCost +
          pricingBase.longDistanceCost
      ),
    };
  }

  const normalizedCode = promo.code.trim().toUpperCase();
  const subtotalBeforePromo = roundMoney(
    pricingBase.discountedLaborTotal +
      pricingBase.addOnTotal +
      pricingBase.travelCost +
      pricingBase.longDistanceCost
  );

  let promoDiscountAmount = 0;

  if (normalizedCode === "MOVER3" && pricingBase.billableMovers >= 3) {
    promoDiscountAmount = roundMoney(
      PRICING_BASE.laborRatePerMoverHour *
        pricingBase.billableHours *
        (1 - pricingBase.discountRate)
    );
  } else if ((promo.discountPercent || 0) > 0) {
    const remainingPercent = Math.max(
      0,
      CANONICAL_PRICING_2026_08.offers.totalPercentageCap - pricingBase.discountRate * 100,
    );
    promoDiscountAmount = roundMoney(
      subtotalBeforePromo * (Math.min(promo.discountPercent || 0, remainingPercent) / 100),
    );
  }

  const totalOfferCap = roundMoney(
    subtotalBeforePromo * Math.max(0, CANONICAL_PRICING_2026_08.offers.totalPercentageCap / 100 - pricingBase.discountRate),
  );
  promoDiscountAmount = Math.min(promoDiscountAmount, totalOfferCap);

  return {
    promoCode: normalizedCode,
    promoDescription: promo.description?.trim() || null,
    promoDiscountAmount,
    subtotalBeforePromo,
  };
}

export function calculateMovingPrice(input: PricingInput): PricingResult {
  const route = input.route ?? (input.dropoff ? "loadUnload" : "loadOnly");
  const serviceAssignments = route === "loadUnload" ? 2 : 1;
  const billableMovers = Math.max(input.movers, getMinimumMovers(input.addOns, input.truckSize));
  const billableHours = Math.max(input.hours, getMinimumLaborHours(input.addOns));
  const truckAddOnCost = getTruckAddOnCost(input.addOns, input.truckSize);
  const laborQuote = calculateMovingLabor({ workers: billableMovers, hours: billableHours });
  const laborSubtotal = laborQuote.beforeDiscount;
  const discountRate = laborQuote.discountPercent / 100;
  const discountAmount = laborQuote.discountAmount;
  const discountedLaborTotal = laborQuote.total;

  const addOnTotal = roundMoney(
    truckAddOnCost +
      (input.addOns.packing ? billableMovers * 50 * billableHours : 0) +
      (input.addOns.stairs ? PRICING_BASE.stairFlightRatePerAssignment * serviceAssignments : 0) +
      (input.addOns.piano ? PRICING_BASE.specialtyItemBaseFee * 2 : 0) +
      (input.addOns.hotTub ? PRICING_BASE.hotTubFlatFee : 0) +
      (input.addOns.assembly ? PRICING_BASE.assemblyRatePerAssignment * serviceAssignments : 0)
  );

  const travel = computeTravelMetrics({ ...input, route });
  const promo = calculatePromoDiscount(
    {
      billableMovers,
      billableHours,
      discountRate,
      discountedLaborTotal,
      addOnTotal,
      travelCost: travel.travelCost,
      longDistanceCost: travel.longDistanceCost,
    },
    input.promo
  );
  const grandTotal = roundMoney(promo.subtotalBeforePromo - promo.promoDiscountAmount);

  return {
    billableMovers,
    billableHours,
    truckAddOnCost,
    loadedMiles: roundMoney(travel.loadedMiles),
    longDistanceMilesBilled: travel.longDistanceMilesBilled,
    longDistanceCost: travel.longDistanceCost,
    isLongDistance: travel.isLongDistance,
    laborSubtotal,
    discountRate,
    discountAmount,
    discountedLaborTotal,
    addOnTotal,
    travelMiles: roundMoney(travel.travelMiles),
    travelHours: travel.travelHours,
    travelCost: travel.travelCost,
    subtotalBeforePromo: promo.subtotalBeforePromo,
    promoCode: promo.promoCode,
    promoDescription: promo.promoDescription,
    promoDiscountAmount: promo.promoDiscountAmount,
    grandTotal,
    route: travel.route,
    warnings: {
      travelOverCap: travel.travelHours > PRICING_BASE.travelWarningHours,
    },
  };
}

export async function fetchZipLocation(zip: string): Promise<ZipLocation> {
  const normalizedZip = zip.trim();
  const response = await fetch(`https://api.zippopotam.us/us/${normalizedZip}`);
  if (!response.ok) {
    throw new Error("Zip code not found");
  }

  const data = await response.json();
  const place = data.places?.[0];
  if (!place) {
    throw new Error("Zip code not found");
  }

  return {
    zip: normalizedZip,
    city: `${place["place name"]}, ${place["state abbreviation"]}`,
    lat: Number(place.latitude),
    lng: Number(place.longitude),
  };
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
