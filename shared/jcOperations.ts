export const JC_OPERATIONS_TIME_ZONE = "America/Chicago";

export type CapacityStatus = "open" | "limited" | "ask_jc";
export type SizingBasis = "square_footage" | "truck";
export type TruckSize = "pickup_van_10" | "15_ft" | "20_ft" | "26_ft";

export type DurationEstimate = {
  basis: SizingBasis;
  recommendedCrewSize: 2 | 3 | 4;
  selectedCrewSize: 2 | 3 | 4;
  minimumHours: number;
  maximumHours: number;
  planningHours: number;
  manualReview: boolean;
  label: string;
};

type EstimateRow = {
  maxSqFt: number;
  values: Record<2 | 3 | 4, [number, number] | null>;
};

const HOME_ROWS: EstimateRow[] = [
  { maxSqFt: 799, values: { 2: [2, 2], 3: [2, 2], 4: null } },
  { maxSqFt: 999, values: { 2: [2, 2], 3: [2, 2], 4: null } },
  { maxSqFt: 1499, values: { 2: [3, 3], 3: [2, 3], 4: [2, 2] } },
  { maxSqFt: 2000, values: { 2: [4, 4], 3: [3, 4], 4: [2, 3] } },
  { maxSqFt: 2999, values: { 2: [6, 6], 3: [4, 5], 4: [3, 4] } },
  { maxSqFt: 4000, values: { 2: [6, 8], 3: [5, 6], 4: [4, 5] } },
  { maxSqFt: Number.POSITIVE_INFINITY, values: { 2: [10, 12], 3: [8, 10], 4: [6, 8] } },
];

const TRUCK_ROWS: Record<TruckSize, { crew: 2 | 3 | 4; range: [number, number]; label: string }> = {
  pickup_van_10: { crew: 2, range: [2, 2.5], label: "8 ft pickup, 9 ft cargo van, or 10 ft box truck" },
  "15_ft": { crew: 2, range: [2.5, 2.5], label: "15 ft box truck" },
  "20_ft": { crew: 3, range: [3, 3], label: "20 ft box truck" },
  "26_ft": { crew: 4, range: [3.5, 4], label: "26 ft box truck" },
};

function halfHourCeil(value: number) {
  return Math.ceil(Math.max(0, value) * 2) / 2;
}

function recommendedCrewForSquareFeet(squareFeet: number): 2 | 3 | 4 {
  if (squareFeet < 1500) return 2;
  if (squareFeet < 3000) return 3;
  return 4;
}

export function estimateJobDuration(input: {
  sizingBasis: SizingBasis;
  squareFootage?: number | null;
  truckSize?: TruckSize | null;
  selectedCrewSize?: 2 | 3 | 4 | null;
}): DurationEstimate {
  let recommendedCrewSize: 2 | 3 | 4;
  let sourceCrewSize: 2 | 3 | 4;
  let sourceRange: [number, number];
  let label: string;
  let manualReview = false;

  if (input.sizingBasis === "truck") {
    const row = TRUCK_ROWS[input.truckSize || "pickup_van_10"];
    recommendedCrewSize = row.crew;
    sourceCrewSize = row.crew;
    sourceRange = row.range;
    label = row.label;
  } else {
    const squareFeet = Math.max(1, Math.round(Number(input.squareFootage) || 0));
    const row = HOME_ROWS.find((candidate) => squareFeet <= candidate.maxSqFt) || HOME_ROWS[HOME_ROWS.length - 1];
    recommendedCrewSize = recommendedCrewForSquareFeet(squareFeet);
    const tableCrew = input.selectedCrewSize || recommendedCrewSize;
    sourceCrewSize = tableCrew;
    sourceRange = row.values[tableCrew] || row.values[recommendedCrewSize] || [12, 12];
    label = `${squareFeet.toLocaleString()} sq. ft. home`;
    manualReview = squareFeet > 4000;
  }

  const selectedCrewSize = input.selectedCrewSize || recommendedCrewSize;
  const crewHourMinimum = sourceCrewSize * sourceRange[0];
  const crewHourMaximum = sourceCrewSize * sourceRange[1];
  const minimumHours = halfHourCeil(crewHourMinimum / selectedCrewSize);
  const maximumHours = halfHourCeil(crewHourMaximum / selectedCrewSize);
  return {
    basis: input.sizingBasis,
    recommendedCrewSize,
    selectedCrewSize,
    minimumHours,
    maximumHours,
    planningHours: maximumHours,
    manualReview: manualReview || (input.sizingBasis === "square_footage" && selectedCrewSize === 4 && Number(input.squareFootage) < 1000),
    label,
  };
}

export type LocalCrewPackageQuote = {
  eligible: boolean;
  packageCode: "two_movers_three_hours" | "three_movers_two_hours" | null;
  includedHours: number;
  packagePrice: number;
  overtimeAmount: number;
  travelAmount: number;
  serviceSubtotal: number;
  manualReviewReasons: string[];
};

export function quoteLocalCrewPackage(input: {
  serviceCode: string;
  crewSize: number;
  plannedHours: number;
  oneWayRoadMiles?: number | null;
  oneWayRoadMinutes?: number | null;
  oversized?: boolean;
  unsafe?: boolean;
}): LocalCrewPackageQuote {
  const serviceCode = input.serviceCode === "junk" ? "junk_removal" : input.serviceCode;
  const oneWayMiles = Number(input.oneWayRoadMiles);
  const reasons: string[] = [];
  if (!["moving", "labor", "load_unload", "junk_removal"].includes(serviceCode)) reasons.push("Service is not eligible for the local crew package.");
  if (![2, 3].includes(input.crewSize)) reasons.push("The package supports a two- or three-person crew.");
  if (!Number.isFinite(oneWayMiles)) reasons.push("The routed one-way distance must be verified.");
  if (Number.isFinite(oneWayMiles) && oneWayMiles > 30) reasons.push("The service address is outside the 30-mile package radius.");
  if (input.oversized) reasons.push("Oversized or specialty items require a manual quote.");
  if (input.unsafe) reasons.push("Unsafe access or work conditions require a manual review.");

  const packageCode = input.crewSize === 2
    ? "two_movers_three_hours"
    : input.crewSize === 3 ? "three_movers_two_hours" : null;
  const includedHours = input.crewSize === 2 ? 3 : input.crewSize === 3 ? 2 : 0;
  const extraHours = halfHourCeil(Math.max(0, Number(input.plannedHours) - includedHours));
  const overtimeAmount = Math.round(extraHours * input.crewSize * 92.5 * 100) / 100;

  let travelAmount = 0;
  if (Number.isFinite(oneWayMiles) && oneWayMiles > 15 && oneWayMiles <= 30) {
    const oneWayMinutes = Math.max(0, Number(input.oneWayRoadMinutes) || 0);
    const beyondIncludedFraction = Math.min(1, Math.max(0, (oneWayMiles - 15) / oneWayMiles));
    const billableRoundTripHours = halfHourCeil((oneWayMinutes * 2 * beyondIncludedFraction) / 60);
    travelAmount = Math.round(billableRoundTripHours * 100 * 100) / 100;
  }

  return {
    eligible: reasons.length === 0,
    packageCode,
    includedHours,
    packagePrice: 555,
    overtimeAmount,
    travelAmount,
    serviceSubtotal: Math.max(400, Math.round((555 + overtimeAmount + travelAmount) * 100) / 100),
    manualReviewReasons: reasons,
  };
}

export function applyServiceFloor(input: {
  serviceCode: string;
  laborOrServiceSubtotal: number;
  discountAmount?: number;
  passThroughAmount?: number;
}) {
  const normalized = input.serviceCode === "junk" ? "junk_removal" : input.serviceCode;
  const floor = ["moving", "labor", "load_unload", "junk_removal"].includes(normalized) ? 400 : 0;
  const beforeDiscount = Math.max(floor, Math.max(0, Number(input.laborOrServiceSubtotal) || 0));
  const discountAmount = Math.min(beforeDiscount, Math.max(0, Number(input.discountAmount) || 0));
  const passThroughAmount = Math.max(0, Number(input.passThroughAmount) || 0);
  return {
    floor,
    beforeDiscount,
    discountAmount,
    passThroughAmount,
    total: Math.round((beforeDiscount - discountAmount + passThroughAmount) * 100) / 100,
  };
}

export function exactHourlyStarts() {
  return Array.from({ length: 10 }, (_, index) => {
    const hour = index + 8;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}
