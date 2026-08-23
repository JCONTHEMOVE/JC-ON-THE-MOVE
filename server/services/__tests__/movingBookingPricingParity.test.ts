import assert from "node:assert/strict";
import {
  CANONICAL_PRICING_2026_08,
  CANONICAL_PRICING_2026_08_1,
  CANONICAL_PRICING_2026_08_3,
  applyGeographicQuotePolicy,
  calculateRateCardLine,
} from "../../../shared/canonicalPricing";
import { calculateLaborBooking } from "../../../shared/laborBooking";
import { getSmartMovingPackage } from "../../../shared/smartBookingEngine";
import { computeBookingQuote } from "../bookingPricing";

console.log("moving booking pricing parity");

const labor = calculateLaborBooking({
  crewSize: 3,
  hours: 6,
  zoneMultiplier: 1.25,
});

assert.deepEqual(
  {
    crewSize: labor.crewSize,
    billableHours: labor.billableHours,
    rate: labor.regularHourlyRate / labor.crewSize,
    laborSubtotal: labor.laborSubtotal,
    discountPct: labor.longBookingDiscountPct,
    discountAmount: labor.discountAmount,
    laborBeforeZone: labor.laborBeforeZone,
    zoneAdjustment: labor.zoneAdjustment,
    final: labor.laborTotal,
  },
  {
    crewSize: 3,
    billableHours: 6,
    rate: 95,
    laborSubtotal: 1710,
    discountPct: 10,
    discountAmount: 171,
    laborBeforeZone: 1539,
    zoneAdjustment: 384.75,
    final: 1923.75,
  },
);

const smartPackage = getSmartMovingPackage(3, 6);
assert.equal(smartPackage.localMin, labor.laborBeforeZone);
assert.equal(smartPackage.localMax, labor.laborBeforeZone);

// Match the route's order of operations: the canonical labor line is quoted,
// automatic bundle discounts are selected, and only then is the geographic
// policy applied to the subtotal before subtracting that discount.
const serverQuote = computeBookingQuote([
  {
    serviceCode: "moving",
    label: "Moving",
    quantity: 1,
    unitPrice: labor.laborBeforeZone,
    priceMode: "quote",
    laborMeta: {
      crewSize: labor.crewSize,
      laborHours: labor.billableHours,
      totalLaborHours: labor.crewSize * labor.billableHours,
      ratePerHour: CANONICAL_PRICING_2026_08.labor.workerHourlyRate,
    },
  },
  {
    serviceCode: "junk_reset",
    label: "Junk reset",
    quantity: 1,
    unitPrice: 125,
  },
], {
  bundleDefinitions: [{
    code: "move_junk_reset",
    name: "Move + Junk Reset",
    serviceCombo: ["moving", "junk_reset"],
    discountType: "percent",
    discountValue: 10,
    maxDiscount: 50,
    isActive: true,
  }],
});

assert.equal(serverQuote.items[0].crewSize, 3);
assert.equal(serverQuote.items[0].laborHours, 6);
assert.equal(serverQuote.items[0].ratePerHour, 95);
assert.equal(serverQuote.subtotal, 1664);
assert.equal(serverQuote.discountTotal, 50);
assert.equal(serverQuote.finalTotal, 1614);

const geographicSnapshot = {
  ...CANONICAL_PRICING_2026_08_1,
  geographicPolicy: {
    ...CANONICAL_PRICING_2026_08_1.geographicPolicy!,
    outsideBubbleMultiplier: 1.25,
  },
};

const geographic = applyGeographicQuotePolicy({
  baseSubtotal: serverQuote.subtotal,
  automaticDiscountTotal: serverQuote.discountTotal,
  serviceDate: "2026-08-24",
  stopCoordinates: [{ lat: 44.9778, lng: -93.265 }],
  routeVerified: true,
  oneWayMiles: 100,
  oneWayMinutes: 120,
  snapshot: geographicSnapshot,
});

assert.ok(geographic);
assert.equal(geographic.pricingAdjustments.geographicMultiplier, 1.25);
assert.equal(geographic.pricingAdjustments.weekendMultiplier, 1);
assert.equal(geographic.adjustedSubtotal, 2080);
assert.equal(geographic.automaticDiscountTotal, 50);
assert.equal(geographic.finalPreTaxTotal, 2030);

// Farther-client parity: crew/hour selection is resolved once from the
// MovingHelper Special card, then bundles/discounts and geography consume
// that exact line without re-pricing or stacking a weekend/zone multiplier.
const specialLine = calculateRateCardLine({
  serviceCode: "load_unload",
  crewSize: 2,
  hours: 5,
  snapshot: CANONICAL_PRICING_2026_08_3,
})!;
assert.equal(specialLine.subtotal, 1000);
assert.equal(specialLine.effectiveWorkerHourlyRate, 100);

const specialQuote = computeBookingQuote([
  {
    serviceCode: "moving",
    label: "Moving",
    quantity: 1,
    unitPrice: specialLine.subtotal,
    priceMode: "quote",
    laborMeta: {
      crewSize: specialLine.crewSize,
      laborHours: specialLine.billableHours,
      totalLaborHours: specialLine.crewSize * specialLine.billableHours,
      ratePerHour: specialLine.effectiveWorkerHourlyRate,
    },
  },
  {
    serviceCode: "junk_reset",
    label: "Junk reset",
    quantity: 1,
    unitPrice: 125,
  },
], {
  bundleDefinitions: [{
    code: "move_junk_reset",
    name: "Move + Junk Reset",
    serviceCombo: ["moving", "junk_reset"],
    discountType: "percent",
    discountValue: 10,
    maxDiscount: 50,
    isActive: true,
  }],
});
assert.equal(specialQuote.items[0].lineSubtotal, 1000);
assert.equal(specialQuote.items[0].crewSize, 2);
assert.equal(specialQuote.items[0].laborHours, 5);
assert.equal(specialQuote.items[0].ratePerHour, 100);
assert.equal(specialQuote.subtotal, 1125);
assert.equal(specialQuote.discountTotal, 50);
assert.equal(specialQuote.finalTotal, 1075);

const specialGeographic = applyGeographicQuotePolicy({
  baseSubtotal: specialQuote.subtotal,
  automaticDiscountTotal: specialQuote.discountTotal,
  serviceDate: "2026-08-22",
  stopCoordinates: [{ lat: 44.9778, lng: -93.265 }],
  routeVerified: true,
  oneWayMiles: 100,
  oneWayMinutes: 120,
  snapshot: CANONICAL_PRICING_2026_08_3,
})!;
assert.equal(specialGeographic.pricingAdjustments.geographicMultiplier, 1);
assert.equal(specialGeographic.pricingAdjustments.weekendMultiplier, 1);
assert.equal(specialGeographic.adjustedSubtotal, 1125);
assert.equal(specialGeographic.finalPreTaxTotal, specialQuote.finalTotal);

console.log("moving booking pricing parity passed");
