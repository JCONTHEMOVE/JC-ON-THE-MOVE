export type RouteDay = {
  key: string;
  day: string;
  dayIndex: number;
  city: string;
  state: string;
  zipCodes: string[];
  label: string;
  area: string;
  note: string;
  seoTitle: string;
  seoDescription: string;
  nearbyAreas: string[];
  serviceKeywords: string[];
};

export const ROUTE_DAY_SERVICE_TAGS = [
  "Moving",
  "Junk Removal",
  "Handyman",
  "Light Demo",
  "Flooring",
  "Painting",
  "Roofing",
];

export const ROUTE_DAY_DISCOUNT = "Save 5% when you book your area on its route day.";
export const ROUTE_DAY_DISCOUNT_CODE = "ROUTEDAY5";
export const IRONWOOD_DAILY_DISCOUNT = "Ironwood clients can save 5% every day.";
export const IRONWOOD_DAILY_DISCOUNT_CODE = "IRONWOOD5";
export const SERVICE_ADDRESS_DISCOUNT_NOTE = "Discount eligibility is based on the service address.";
export const ROUTE_DAY_DISCOUNT_PERCENT = 5;
export const ROUTE_DAY_TRAVEL_PRICE_NOTE =
  "Route days group nearby work. Actual regional or long-distance travel is itemized under the active rate sheet.";
export const ROUTE_DAY_OUT_OF_TOWN_MULTIPLIER = 1;
export const ROUTE_DAY_NON_DISCOUNT_DAY_MULTIPLIER = 1;
export const ROUTE_DAY_OUT_OF_TOWN_NOTE =
  "Surrounding-area and out-of-town requests do not receive the route-day discount; actual travel is itemized separately.";
export const ROUTE_DAY_NON_DISCOUNT_DAY_NOTE =
  "Promo-town requests outside their assigned route day do not receive the discount; no whole-invoice multiplier applies.";

export const ROUTE_DAY_PROMO_PACKAGES = [
  {
    id: "travel-minimum",
    title: "Travel minimum",
    crew: "2 movers",
    hours: "2 hours",
    priceRange: "$425-$600 minimum",
    priceBand: "425-600",
    crewTarget: "2",
    hoursTarget: "2",
    bestFor: "Small moves, load or unload help, single-item moves, pickup runs, and quick junk removal.",
  },
  {
    id: "target-route-package",
    title: "Target route-day package",
    crew: "3-4 movers",
    hours: "3-4 hours",
    priceRange: "$850-$1,200 promo target",
    priceBand: "850-1200",
    crewTarget: "3-4",
    hoursTarget: "3-4",
    bestFor: "Larger moving jobs, cleanouts, light demo, flooring prep, painting prep, and multi-task work blocks.",
  },
] as const;

export type RouteDayPromoPackage = typeof ROUTE_DAY_PROMO_PACKAGES[number];

export const ROUTE_DAY_TRACKING_POINTS = [
  "Promo code",
  "Campaign ID",
  "UTM source",
  "UTM medium",
  "UTM campaign",
  "Route city",
  "Route state",
  "Route ZIP",
  "Route day",
  "Route key",
  "Service focus",
  "Package type",
  "Crew target",
  "Hours target",
  "Price band",
];

export type RouteDayDiscountEligibility = {
  eligible: boolean;
  code: string | null;
  label: string | null;
  reason: string;
  discountPercent: number;
  priceMultiplier: number;
  pricingAdjustment: {
    type: "none" | "out_of_town" | "non_discount_day";
    label: string | null;
    reason: string | null;
    multiplier: number;
    surchargePercent: number;
  };
};

export const ROUTE_DAY_SCHEDULE: RouteDay[] = [
  {
    key: "minocqua-monday",
    day: "Monday",
    dayIndex: 1,
    city: "Minocqua",
    state: "WI",
    zipCodes: ["54548"],
    label: "Minocqua Monday",
    area: "Minocqua, WI",
    note: "Build a Monday customer base around moving, junk removal, handyman, light demo, flooring, painting, roofing, and more.",
    seoTitle: "Minocqua Monday Movers, Junk Removal & Handyman Help | JC ON THE MOVE",
    seoDescription:
      "Book JC ON THE MOVE for Minocqua Monday moving, junk removal, handyman work, light demo, flooring, painting, roofing, and local labor. Save 5% when your Minocqua service address books Monday.",
    nearbyAreas: ["Arbor Vitae", "Woodruff", "Lake Tomahawk", "Hazelhurst", "Rhinelander"],
    serviceKeywords: [
      "Minocqua movers",
      "Minocqua junk removal",
      "Minocqua handyman",
      "Minocqua flooring",
      "Minocqua painting",
      "Minocqua roofing",
    ],
  },
  {
    key: "houghton-tuesday",
    day: "Tuesday",
    dayIndex: 2,
    city: "Houghton",
    state: "MI",
    zipCodes: ["49931"],
    label: "Houghton Tuesday",
    area: "Houghton, MI",
    note: "Stack Tuesday requests so the crew can serve the Keweenaw with fewer repeat trips.",
    seoTitle: "Houghton Tuesday Movers, Junk Removal & Handyman Help | JC ON THE MOVE",
    seoDescription:
      "Book JC ON THE MOVE for Houghton Tuesday moving, junk removal, handyman projects, light demo, flooring, painting, roofing, and crew labor. Save 5% when your Houghton service address books Tuesday.",
    nearbyAreas: ["Hancock", "Calumet", "Chassell", "Dollar Bay", "South Range"],
    serviceKeywords: [
      "Houghton movers",
      "Houghton junk removal",
      "Houghton handyman",
      "Keweenaw moving help",
      "Houghton painting",
      "Houghton roofing",
    ],
  },
  {
    key: "iron-river-wednesday",
    day: "Wednesday",
    dayIndex: 3,
    city: "Iron River",
    state: "MI",
    zipCodes: ["49935"],
    label: "Iron River Wednesday",
    area: "Iron River, MI",
    note: "Group midweek work for moving, cleanouts, repairs, light demo, flooring, painting, roofing, and local labor.",
    seoTitle: "Iron River Wednesday Movers, Junk Removal & Handyman Help | JC ON THE MOVE",
    seoDescription:
      "Book JC ON THE MOVE for Iron River Wednesday moving, junk removal, handyman tasks, cleanouts, light demo, flooring, painting, roofing, and local labor. Save 5% when your Iron River service address books Wednesday.",
    nearbyAreas: ["Crystal Falls", "Caspian", "Stambaugh", "Gaastra", "Florence"],
    serviceKeywords: [
      "Iron River movers",
      "Iron River junk removal",
      "Iron River handyman",
      "Iron River cleanouts",
      "Iron River flooring",
      "Iron River roofing",
    ],
  },
  {
    key: "ashland-thursday",
    day: "Thursday",
    dayIndex: 4,
    city: "Ashland",
    state: "WI",
    zipCodes: ["54806"],
    label: "Ashland Thursday",
    area: "Ashland, WI",
    note: "Make Thursday the Ashland-area route for moves, junk, delivery, handyman tasks, and project help.",
    seoTitle: "Ashland Thursday Movers, Junk Removal & Handyman Help | JC ON THE MOVE",
    seoDescription:
      "Book JC ON THE MOVE for Ashland Thursday moving, junk removal, delivery, handyman tasks, light demo, flooring, painting, roofing, and local labor. Save 5% when your Ashland service address books Thursday.",
    nearbyAreas: ["Washburn", "Bayfield", "Odanah", "Mellen", "Marengo"],
    serviceKeywords: [
      "Ashland movers",
      "Ashland junk removal",
      "Ashland handyman",
      "Ashland delivery help",
      "Ashland painting",
      "Ashland roofing",
    ],
  },
];

export const ROUTE_DAY_SUMMARY = ROUTE_DAY_SCHEDULE
  .map((route) => `${route.city} ${route.day}`)
  .join(", ");

export const ROUTE_DAY_CAMPAIGN_NOTE =
  `Route-day scheduling: ${ROUTE_DAY_SUMMARY}. ${ROUTE_DAY_DISCOUNT} ${IRONWOOD_DAILY_DISCOUNT} ${SERVICE_ADDRESS_DISCOUNT_NOTE} No whole-invoice route multiplier applies. ${ROUTE_DAY_TRAVEL_PRICE_NOTE} Labor is $95 per worker-hour with a two-hour minimum and $300 minimum invoice; truck and travel charges are separate. Stack moving, junk removal, handyman, light demo, flooring, painting, roofing, and similar jobs by area to reduce repeat drive time. More route days coming as demand grows.`;

export function routeDayCampaignId(route: RouteDay, promoPackage?: RouteDayPromoPackage | null) {
  const packagePart = promoPackage?.id || "general";
  return `route-${route.key}-${packagePart}`;
}

export function routeDayTrackingParams(route: RouteDay, service = "custom", promoPackage?: RouteDayPromoPackage | null) {
  const params = new URLSearchParams({
    promo: ROUTE_DAY_DISCOUNT_CODE,
    utm_source: "website",
    utm_medium: "route_day_seo",
    utm_campaign: `route-day-${route.key}`,
    utm_content: routeDayCampaignId(route, promoPackage),
    jc_campaign: routeDayCampaignId(route, promoPackage),
    jc_area: route.area,
    jc_focus: `${route.city} ${service.replace(/_/g, " ")} route day`,
    jc_route_city: route.city,
    jc_route_state: route.state,
    jc_route_zip: route.zipCodes[0] || "",
    jc_route_day: route.day,
    jc_route_key: route.key,
    jc_promo_type: "route_day_5_percent",
  });

  if (promoPackage) {
    params.set("jc_package", promoPackage.id);
    params.set("jc_crew_target", promoPackage.crewTarget);
    params.set("jc_hours_target", promoPackage.hoursTarget);
    params.set("jc_price_band", promoPackage.priceBand);
  }

  return params;
}

export function routeDayBookingHref(route: RouteDay, service = "custom", promoPackage?: RouteDayPromoPackage | null) {
  const params = new URLSearchParams({
    mode: "quick",
    service,
    area: route.area,
    routeDay: route.day,
    routeKey: route.key,
  });

  routeDayTrackingParams(route, service, promoPackage).forEach((value, key) => {
    params.set(key, value);
  });

  return `/book?${params.toString()}`;
}

export function routeDayLandingHref(route: RouteDay) {
  return `/route-days/${route.key}`;
}

function normalizeAddress(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function addressHasCityOrZip(address: string, route: RouteDay) {
  const normalized = normalizeAddress(address);
  if (!normalized) return false;
  const cityNeedle = normalizeAddress(route.city);
  if (normalized.includes(cityNeedle)) return true;
  return route.zipCodes.some((zip) => new RegExp(`\\b${zip}\\b`).test(normalized));
}

function matchingNearbyArea(address: string, route: RouteDay) {
  const normalized = normalizeAddress(address);
  if (!normalized) return null;
  return route.nearbyAreas.find((area) => normalized.includes(normalizeAddress(area))) || null;
}

function addressIsIronwood(address: string) {
  const normalized = normalizeAddress(address);
  return normalized.includes("ironwood") || /\b49938\b/.test(normalized);
}

function dayIndexFromDate(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getDay();
}

export function getRouteDayDiscountEligibility(input: {
  serviceAddress?: string | null;
  requestedDate?: string | null;
}): RouteDayDiscountEligibility {
  const noAdjustment = {
    type: "none" as const,
    label: null,
    reason: null,
    multiplier: 1,
    surchargePercent: 0,
  };
  const serviceAddress = String(input.serviceAddress || "").trim();
  if (!serviceAddress) {
    return {
      eligible: false,
      code: null,
      label: null,
      reason: "Enter the service address to check route-day savings.",
      discountPercent: 0,
      priceMultiplier: 1,
      pricingAdjustment: noAdjustment,
    };
  }

  if (addressIsIronwood(serviceAddress)) {
    return {
      eligible: true,
      code: IRONWOOD_DAILY_DISCOUNT_CODE,
      label: "Ironwood 5% every day",
      reason: IRONWOOD_DAILY_DISCOUNT,
      discountPercent: ROUTE_DAY_DISCOUNT_PERCENT,
      priceMultiplier: 1,
      pricingAdjustment: noAdjustment,
    };
  }

  const route = ROUTE_DAY_SCHEDULE.find((candidate) => addressHasCityOrZip(serviceAddress, candidate));
  const nearbyRoute = ROUTE_DAY_SCHEDULE.find((candidate) => matchingNearbyArea(serviceAddress, candidate));
  if (!route && nearbyRoute) {
    const area = matchingNearbyArea(serviceAddress, nearbyRoute);
    return {
      eligible: false,
      code: null,
      label: nearbyRoute.label,
      reason: `${area} is near ${nearbyRoute.city}, but the 5% route-day discount only applies to ${nearbyRoute.city} service addresses on ${nearbyRoute.day}. Actual travel is itemized separately.`,
      discountPercent: 0,
      priceMultiplier: ROUTE_DAY_OUT_OF_TOWN_MULTIPLIER,
      pricingAdjustment: noAdjustment,
    };
  }

  if (!route) {
    return {
      eligible: false,
      code: null,
      label: null,
      reason: "This service address is outside Ironwood and the current promo towns. No route-day discount applies; actual travel is itemized separately.",
      discountPercent: 0,
      priceMultiplier: ROUTE_DAY_OUT_OF_TOWN_MULTIPLIER,
      pricingAdjustment: noAdjustment,
    };
  }

  const dayIndex = dayIndexFromDate(input.requestedDate);
  if (dayIndex == null) {
    return {
      eligible: false,
      code: null,
      label: route.label,
      reason: `Choose ${route.day} for ${route.city} to unlock 5% route-day savings.`,
      discountPercent: 0,
      priceMultiplier: 1,
      pricingAdjustment: noAdjustment,
    };
  }

  if (dayIndex !== route.dayIndex) {
    return {
      eligible: false,
      code: null,
      label: route.label,
      reason: `${route.city} saves 5% on ${route.day}. Requests for other days pay the active rate sheet with actual travel itemized separately.`,
      discountPercent: 0,
      priceMultiplier: ROUTE_DAY_NON_DISCOUNT_DAY_MULTIPLIER,
      pricingAdjustment: noAdjustment,
    };
  }

  return {
    eligible: true,
    code: ROUTE_DAY_DISCOUNT_CODE,
    label: route.label,
    reason: `5% route-day savings applied for ${route.label}.`,
    discountPercent: ROUTE_DAY_DISCOUNT_PERCENT,
    priceMultiplier: 1,
    pricingAdjustment: noAdjustment,
  };
}
