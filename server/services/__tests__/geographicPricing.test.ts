import assert from "node:assert/strict";
import {
  CANONICAL_PRICING_2026_08_1,
  applyGeographicQuotePolicy,
  assertQuoteApprovalAllowed,
  calculateMarketplaceFlatRate,
  calculateRateCardLine,
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
