/**
 * The public moving-labor menu.  Keep this calculation framework-agnostic so
 * a customer request, staff quote, and marketplace-zone preview cannot drift.
 */

export type LaborWorkScope = "load_only" | "unload_only" | "load_unload";

export type LaborBookingInput = {
  crewSize?: number | null;
  hours?: number | null;
  workScope?: LaborWorkScope | string | null;
  oversized?: boolean;
  zoneMultiplier?: number | null;
  longBookingDiscountPct?: number | null;
  longBookingDiscountAfterHours?: number | null;
};

export type LaborBookingQuote = {
  crewSize: number;
  requestedHours: number;
  billableHours: number;
  workScope: LaborWorkScope;
  oversized: boolean;
  zoneMultiplier: number;
  regularHourlyRate: number;
  discountedHourlyRate: number;
  regularHours: number;
  discountedHours: number;
  longBookingDiscountPct: number;
  laborBeforeZone: number;
  laborTotal: number;
};

export const TWO_MOVER_HOURLY_RATE = 175;
export const BASE_MOVER_HOURLY_RATE = TWO_MOVER_HOURLY_RATE / 2;
export const ADDITIONAL_MOVER_HOURLY_RATE = BASE_MOVER_HOURLY_RATE * 0.85;
export const DEFAULT_LONG_BOOKING_DISCOUNT_PCT = 10;
export const DEFAULT_LONG_BOOKING_DISCOUNT_AFTER_HOURS = 4;

function numberFrom(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeLaborWorkScope(value: unknown): LaborWorkScope {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("both") || raw.includes("load_unload") || raw.includes("load + unload") || raw.includes("load and unload")) {
    return "load_unload";
  }
  if (raw.includes("unload")) return "unload_only";
  return "load_only";
}

export function calculateLaborBooking(input: LaborBookingInput = {}): LaborBookingQuote {
  const oversized = Boolean(input.oversized);
  const requestedCrew = Math.round(numberFrom(input.crewSize, 2));
  const requestedHours = Math.max(1, numberFrom(input.hours, oversized ? 2 : 1));
  const crewSize = Math.max(2, oversized ? 3 : 2, Math.min(4, requestedCrew || 2));
  const baseHours = Math.max(oversized ? 2 : 1, requestedHours);
  const workScope = normalizeLaborWorkScope(input.workScope);
  const billableHours = workScope === "load_unload" ? baseHours * 2 : baseHours;
  const zoneMultiplier = Math.max(0, numberFrom(input.zoneMultiplier, 1) || 1);
  const threshold = Math.max(0, numberFrom(input.longBookingDiscountAfterHours, DEFAULT_LONG_BOOKING_DISCOUNT_AFTER_HOURS));
  const longBookingDiscountPct = Math.max(0, Math.min(100, numberFrom(input.longBookingDiscountPct, DEFAULT_LONG_BOOKING_DISCOUNT_PCT)));
  const regularHourlyRate = TWO_MOVER_HOURLY_RATE + Math.max(0, crewSize - 2) * ADDITIONAL_MOVER_HOURLY_RATE;
  const discountedHourlyRate = regularHourlyRate * (1 - longBookingDiscountPct / 100);
  const regularHours = Math.min(billableHours, threshold);
  const discountedHours = Math.max(0, billableHours - threshold);
  const laborBeforeZone = money(regularHours * regularHourlyRate + discountedHours * discountedHourlyRate);

  return {
    crewSize,
    requestedHours: baseHours,
    billableHours,
    workScope,
    oversized,
    zoneMultiplier,
    regularHourlyRate: money(regularHourlyRate),
    discountedHourlyRate: money(discountedHourlyRate),
    regularHours,
    discountedHours,
    longBookingDiscountPct,
    laborBeforeZone,
    laborTotal: money(laborBeforeZone * zoneMultiplier),
  };
}

export function recommendLaborBooking(input: {
  truckSize?: string | null;
  oversized?: boolean;
} = {}) {
  if (input.oversized) return { crewSize: 3, hours: 2, reason: "Oversized item minimum" };
  const truckFeet = Number(String(input.truckSize || "").match(/\b(10|12|15|16|17|20|22|24|26)\b/)?.[1] || 0);
  if (truckFeet >= 24) return { crewSize: 4, hours: 4, reason: "24–26 ft truck" };
  if (truckFeet >= 20) return { crewSize: 3, hours: 3, reason: "20–22 ft truck" };
  if (truckFeet >= 15) return { crewSize: 2, hours: 3, reason: "15–17 ft truck" };
  return { crewSize: 2, hours: 2, reason: "10–12 ft truck or small move" };
}
