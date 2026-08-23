import assert from "node:assert/strict";
import {
  CANONICAL_PRICING_2026_08,
  CANONICAL_PRICING_2026_08_1,
  CANONICAL_PRICING_2026_08_3,
  applyGeographicQuotePolicy,
  assertQuoteApprovalAllowed,
  buildMovingHelperSpecialPricingSnapshot,
  calculateMarketplaceFlatRate,
  calculateRateCardLine,
  marketplaceRateCardApplies,
  type MarketplaceHourlyServiceCode,
} from "@shared/canonicalPricing";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const policy = CANONICAL_PRICING_2026_08_1.geographicPolicy!;
function stopNorth(miles: number) {
  return {
    lat: policy.origin.lat + (miles / 3958.8) * (180 / Math.PI),
    lng: policy.origin.lng,
  };
}

function evaluate(input: {
  subtotal?: number;
  discount?: number;
  date?: string;
  milesFromOrigin?: number;
  stops?: Array<{ lat: number; lng: number }>;
  minutes?: number | null;
  verified?: boolean;
}) {
  return applyGeographicQuotePolicy({
    baseSubtotal: input.subtotal ?? 2000,
    automaticDiscountTotal: input.discount ?? 0,
    serviceDate: input.date ?? "2026-08-19",
    stopCoordinates: input.stops ?? [stopNorth(input.milesFromOrigin ?? 51)],
    routeVerified: input.verified ?? true,
    oneWayMinutes: input.minutes === undefined ? 180 : input.minutes,
    oneWayMiles: input.milesFromOrigin ?? 51,
    snapshot: CANONICAL_PRICING_2026_08_1,
  })!;
}

console.log("geographic pricing and rate-card policy");

const hourlyRows: Array<[MarketplaceHourlyServiceCode, number, number, number, number]> = [
  ["load_unload", 1, 5, 150, 125],
  ["load_unload", 2, 4, 250, 225],
  ["load_unload", 3, 4, 325, 275],
  ["load_unload", 4, 4, 400, 350],
  ["pack_unpack", 1, 4, 150, 100],
  ["pack_unpack", 2, 5, 250, 200],
  ["cleaning", 1, 8, 200, 150],
  ["cleaning", 2, 5, 300, 200],
];

for (const [serviceCode, crewSize, threshold, regular, discounted] of hourlyRows) {
  test(`${serviceCode} ${crewSize} helper(s) uses the exact threshold and fractional marginal rate`, () => {
    const atThreshold = calculateRateCardLine({ serviceCode, crewSize, hours: threshold, snapshot: CANONICAL_PRICING_2026_08_1 })!;
    const fractional = calculateRateCardLine({ serviceCode, crewSize, hours: threshold + 0.5, snapshot: CANONICAL_PRICING_2026_08_1 })!;
    assert.equal(atThreshold.subtotal, threshold * regular);
    assert.equal(fractional.subtotal, threshold * regular + 0.5 * discounted);
    assert.equal(fractional.discountedHours, 0.5);
  });
}

test("authoritative two-helper row is $250 then $225 after four hours", () => {
  const line = calculateRateCardLine({ serviceCode: "load_unload", crewSize: 2, hours: 5, snapshot: CANONICAL_PRICING_2026_08_1 })!;
  assert.equal(line.subtotal, 1225);
});

test("U-Box, piano, and safe flat/mileage prices match the attached card", () => {
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_load_unload", boxes: 2 }), 1600);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_delivery_load_unload", boxes: 2, miles: 10 }), 2050);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_delivery_only", boxes: 2, miles: 10 }), 1040);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "piano", quantity: 2 }), 1600);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "safe" }), 800);
});

const specialRows: Array<{
  serviceCode: MarketplaceHourlyServiceCode;
  crewSize: number;
  beforeHours: number;
  beforeTotal: number;
  thresholdHours: number;
  thresholdTotal: number;
}> = [
  { serviceCode: "load_unload", crewSize: 1, beforeHours: 2, beforeTotal: 500, thresholdHours: 3, thresholdTotal: 600 },
  { serviceCode: "load_unload", crewSize: 2, beforeHours: 4, beforeTotal: 1120, thresholdHours: 5, thresholdTotal: 1000 },
  { serviceCode: "load_unload", crewSize: 3, beforeHours: 4, beforeTotal: 1600, thresholdHours: 5, thresholdTotal: 1500 },
  { serviceCode: "load_unload", crewSize: 4, beforeHours: 4, beforeTotal: 2000, thresholdHours: 5, thresholdTotal: 2000 },
  { serviceCode: "cleaning", crewSize: 2, beforeHours: 2, beforeTotal: 500, thresholdHours: 3, thresholdTotal: 600 },
];

for (const row of specialRows) {
  test(`Special ${row.serviceCode} ${row.crewSize} helper(s) switches the whole booking at the inclusive threshold`, () => {
    const before = calculateRateCardLine({
      serviceCode: row.serviceCode,
      crewSize: row.crewSize,
      hours: row.beforeHours,
      snapshot: CANONICAL_PRICING_2026_08_3,
    })!;
    const threshold = calculateRateCardLine({
      serviceCode: row.serviceCode,
      crewSize: row.crewSize,
      hours: row.thresholdHours,
      snapshot: CANONICAL_PRICING_2026_08_3,
    })!;
    assert.equal(before.subtotal, row.beforeTotal);
    assert.equal(threshold.subtotal, row.thresholdTotal);
    assert.equal(threshold.regularHours, 0);
    assert.equal(threshold.discountedHours, row.thresholdHours);
    assert.equal(threshold.discountMode, "whole_booking");
    assert.equal(
      threshold.crewSize * threshold.billableHours * threshold.effectiveWorkerHourlyRate,
      threshold.subtotal,
    );
  });
}

test("Special hourly services enforce the two-hour minimum and reject unsupported combinations", () => {
  assert.equal(calculateRateCardLine({ serviceCode: "pack_unpack", crewSize: 2, hours: 1, snapshot: CANONICAL_PRICING_2026_08_3 })!.subtotal, 400);
  assert.equal(calculateRateCardLine({ serviceCode: "pack_unpack", crewSize: 3, hours: 1, snapshot: CANONICAL_PRICING_2026_08_3 })!.subtotal, 600);
  assert.equal(calculateRateCardLine({ serviceCode: "pack_unpack", crewSize: 1, hours: 3, snapshot: CANONICAL_PRICING_2026_08_3 }), null);
  assert.equal(calculateRateCardLine({ serviceCode: "cleaning", crewSize: 1, hours: 3, snapshot: CANONICAL_PRICING_2026_08_3 }), null);
  assert.equal(calculateRateCardLine({ serviceCode: "load_unload", crewSize: 5, hours: 5, snapshot: CANONICAL_PRICING_2026_08_3 }), null);
});

test("Special U-Box mileage is one-way and first/additional box pricing is exact", () => {
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_load_unload", boxes: 2, snapshot: CANONICAL_PRICING_2026_08_3 }), 1300);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_delivery_load_unload", boxes: 2, miles: 10, snapshot: CANONICAL_PRICING_2026_08_3 }), 1650);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "ubox_delivery_only", boxes: 2, miles: 10, snapshot: CANONICAL_PRICING_2026_08_3 }), 630);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "piano", quantity: 2, snapshot: CANONICAL_PRICING_2026_08_3 }), 700);
  assert.equal(calculateMarketplaceFlatRate({ serviceCode: "safe", snapshot: CANONICAL_PRICING_2026_08_3 }), 500);
});

test("Special card applies only when any stop is beyond the inclusive 50-mile local boundary", () => {
  const atBoundary = applyGeographicQuotePolicy({
    baseSubtotal: 500,
    serviceDate: "2026-08-22",
    stopCoordinates: [stopNorth(50)],
    routeVerified: true,
    oneWayMiles: 50,
    oneWayMinutes: 60,
    snapshot: CANONICAL_PRICING_2026_08_3,
  })!;
  const outside = applyGeographicQuotePolicy({
    baseSubtotal: 500,
    serviceDate: "2026-08-22",
    stopCoordinates: [stopNorth(10), stopNorth(50.01)],
    routeVerified: true,
    oneWayMiles: 50.01,
    oneWayMinutes: 60,
    snapshot: CANONICAL_PRICING_2026_08_3,
  })!;
  assert.equal(atBoundary.pricingAdjustments.insideBubble, true);
  assert.equal(marketplaceRateCardApplies(CANONICAL_PRICING_2026_08_3, atBoundary.pricingAdjustments.insideBubble), false);
  assert.equal(outside.pricingAdjustments.insideBubble, false);
  assert.equal(marketplaceRateCardApplies(CANONICAL_PRICING_2026_08_3, outside.pricingAdjustments.insideBubble), true);
  assert.equal(marketplaceRateCardApplies(CANONICAL_PRICING_2026_08_3, null), true);
  assert.equal(outside.pricingAdjustments.geographicMultiplier, 1);
  assert.equal(outside.pricingAdjustments.weekendMultiplier, 1);
  assert.equal(outside.finalPreTaxTotal, 500);
});

test("Special draft overlays only the supplied live snapshot", () => {
  const liveSnapshot = {
    ...CANONICAL_PRICING_2026_08,
    labor: { ...CANONICAL_PRICING_2026_08.labor, workerHourlyRate: 101 },
  };
  const draft = buildMovingHelperSpecialPricingSnapshot(liveSnapshot);
  assert.equal(draft.labor.workerHourlyRate, 101);
  assert.equal(draft.operationsPolicy, undefined);
  assert.equal(draft.version, "2026.08.3");
});

test("Special pricing preserves extended-route minimums and review/decline cutoffs", () => {
  const specialEligibility = (subtotal: number, minutes: number) => applyGeographicQuotePolicy({
    baseSubtotal: subtotal,
    serviceDate: "2026-08-19",
    stopCoordinates: [stopNorth(51)],
    routeVerified: true,
    oneWayMiles: 51,
    oneWayMinutes: minutes,
    snapshot: CANONICAL_PRICING_2026_08_3,
  })!.travelEligibility;
  assert.equal(specialEligibility(2000, 180).status, "extended_auto");
  assert.equal(specialEligibility(1999.99, 180).status, "owner_review");
  assert.equal(specialEligibility(2000, 181).status, "owner_review");
  assert.equal(specialEligibility(2000, 240).status, "owner_review");
  assert.equal(specialEligibility(2000, 240.01).status, "out_of_range");
});

for (const [label, miles, date, expected] of [
  ["inside weekday", 49, "2026-08-19", 1],
  ["inside weekend", 49, "2026-08-22", 1.15],
  ["outside weekday", 51, "2026-08-19", 1.5],
  ["outside weekend", 51, "2026-08-22", 1.725],
] as const) {
  test(`${label} applies ${expected}× to hourly, flat, mileage, add-on, and pass-through totals`, () => {
    for (const subtotal of [1225, 800, 50, 275, 113.47]) {
      const result = evaluate({ subtotal, milesFromOrigin: miles, date });
      assert.equal(result.pricingAdjustments.compoundedMultiplier, expected);
      assert.equal(result.finalPreTaxTotal, Math.round(subtotal * expected * 100) / 100);
    }
  });
}

test("promotions apply after compounded premiums", () => {
  const result = evaluate({ subtotal: 1000, discount: 100, milesFromOrigin: 51, date: "2026-08-22" });
  assert.equal(result.adjustedSubtotal, 1725);
  assert.equal(result.finalPreTaxTotal, 1625);
});

test("the inclusive 50-mile boundary remains inside", () => {
  const result = evaluate({ milesFromOrigin: 50, stops: [stopNorth(50)] });
  assert.equal(result.pricingAdjustments.insideBubble, true);
  assert.equal(result.pricingAdjustments.geographicMultiplier, 1);
});

test("any outside service stop classifies the whole quote outside", () => {
  const result = evaluate({ stops: [stopNorth(10), stopNorth(50.01)] });
  assert.equal(result.pricingAdjustments.insideBubble, false);
  assert.equal(result.pricingAdjustments.geographicMultiplier, 1.5);
});

test("180 minutes and exactly $2,000 are automatically eligible", () => {
  const result = evaluate({ subtotal: 2000 / 1.5, minutes: 180 });
  assert.equal(result.finalPreTaxTotal, 2000);
  assert.equal(result.travelEligibility.status, "extended_auto");
  assert.equal(result.travelEligibility.minimumSatisfied, true);
});

test("181 through 240 minutes requires owner review", () => {
  assert.equal(evaluate({ minutes: 181 }).travelEligibility.status, "owner_review");
  assert.equal(evaluate({ minutes: 240 }).travelEligibility.status, "owner_review");
});

test("over 240 minutes is a hard decline", () => {
  const result = evaluate({ minutes: 240.01 });
  assert.equal(result.travelEligibility.status, "out_of_range");
  assert.equal(result.travelEligibility.canApprove, false);
});

test("an outside quote one cent below $2,000 requires an owner exception", () => {
  const result = evaluate({ subtotal: 1333.33, discount: 0.01, minutes: 180 });
  assert.equal(result.finalPreTaxTotal, 1999.99);
  assert.equal(result.travelEligibility.status, "owner_review");
  assert.equal(result.travelEligibility.requiresOwner, true);
});

test("routing failure remains unverified", () => {
  const result = evaluate({ verified: false, minutes: null });
  assert.equal(result.travelEligibility.status, "unverified");
  assert.equal(result.travelEligibility.routeVerified, false);
});

test("Gold reviewers may approve standard quotes but ordinary staff may not", () => {
  const standard = { status: "extended_auto", requiresOwner: false, canApprove: true };
  assert.doesNotThrow(() => assertQuoteApprovalAllowed({
    travelEligibility: standard,
    actor: { isOwner: false, canApproveStandard: true },
  }));
  assert.throws(() => assertQuoteApprovalAllowed({
    travelEligibility: standard,
    actor: { isOwner: false, canApproveStandard: false },
  }), /Gold authority/);
});

test("travel exceptions require both an owner and a recorded reason", () => {
  const exception = { status: "owner_review", requiresOwner: true, canApprove: true };
  assert.throws(() => assertQuoteApprovalAllowed({
    travelEligibility: exception,
    actor: { isOwner: false, canApproveStandard: true },
    overrideReason: "Customer accepted the travel exception.",
  }), /owner approval is required/i);
  assert.throws(() => assertQuoteApprovalAllowed({
    travelEligibility: exception,
    actor: { isOwner: true, canApproveStandard: true },
  }), /override reason/i);
  assert.doesNotThrow(() => assertQuoteApprovalAllowed({
    travelEligibility: exception,
    actor: { isOwner: true, canApproveStandard: true },
    overrideReason: "Crew availability and margin were manually verified.",
  }));
});

test("no actor can approve a route over four hours", () => {
  assert.throws(() => assertQuoteApprovalAllowed({
    travelEligibility: { status: "out_of_range", requiresOwner: true, canApprove: false },
    actor: { isOwner: true, canApproveStandard: true },
    overrideReason: "Owner accepts the exception.",
  }), /cannot be approved/);
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) console.error("Some geographic-pricing tests FAILED.");
else console.log("All geographic-pricing tests passed.");
