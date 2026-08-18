import { pool } from "../db";
import type { QuoteRouteEvidence } from "./quoteGeography";
import type { OperatingEligibility } from "@shared/regionalAutomation";
import { ensureRegionalAutomationSchema } from "./regionalAutomationMigration";

type CapabilityRow = {
  code: string;
  name: string;
  state_code: string;
  locality: string | null;
  pricing_zone_code: string | null;
  service_types: string[];
  truck_modes: string[];
  verification_status: string;
  auto_book_enabled: boolean;
  ads_enabled: boolean;
};

export interface OperatingEligibilityInput {
  service: string;
  truckSource: string;
  routeEvidence: QuoteRouteEvidence;
  zoneCode?: string | null;
  travelEligibility?: Record<string, unknown> | null;
  reviewRequired?: boolean;
  hasSpecialItems?: boolean;
}

function normalized(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function reason(code: string, message: string) {
  return { code, message };
}

async function listCapabilities(): Promise<CapabilityRow[]> {
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query<CapabilityRow>(
    `SELECT code, name, state_code, locality, pricing_zone_code, service_types,
            truck_modes, verification_status, auto_book_enabled, ads_enabled
       FROM service_area_capabilities`,
  );
  return rows;
}

function findCapability(input: OperatingEligibilityInput, rows: CapabilityRow[]): CapabilityRow | null {
  const firstStop = input.routeEvidence.stops[0];
  const state = normalized(firstStop?.stateCode);
  const locality = normalized(firstStop?.locality);

  if (input.zoneCode === "IRONWOOD_50_MILE") {
    const primary = rows.find((row) => row.code === "IRONWOOD_50_MILE");
    if (primary && (!state || normalized(primary.state_code) === state)) return primary;
  }

  return rows.find((row) => (
    normalized(row.state_code) === state
    && !!row.locality
    && (locality === normalized(row.locality) || locality.includes(normalized(row.locality!)))
  )) || null;
}

export async function evaluateOperatingEligibility(input: OperatingEligibilityInput): Promise<OperatingEligibility> {
  const rows = await listCapabilities();
  const stops = input.routeEvidence.stops;
  const originState = stops[0]?.stateCode?.toUpperCase() || null;
  const destinationState = stops.length > 1 ? stops[stops.length - 1]?.stateCode?.toUpperCase() || null : null;
  const capability = findCapability(input, rows);
  const reasons: OperatingEligibility["reasons"] = [];
  let decision: OperatingEligibility["decision"] = "eligible";

  const block = (code: string, message: string) => {
    decision = "blocked";
    reasons.push(reason(code, message));
  };
  const review = (code: string, message: string) => {
    if (decision !== "blocked") decision = "manual_review";
    reasons.push(reason(code, message));
  };

  const service = normalized(input.service);
  const isMoving = ["moving", "residential", "commercial"].includes(service);
  if (isMoving && stops.length < 2) {
    review("destination_required", "A verified destination address is required before a moving job can be booked automatically.");
  }
  if (isMoving && originState && destinationState && originState !== destinationState) {
    block("interstate_not_supported", "Cross-state moving is not available for online booking.");
  }
  if (!originState || (isMoving && stops.length > 1 && !destinationState)) {
    review("state_unverified", "One or more service-stop states could not be verified.");
  }
  if (!input.routeEvidence.verified) {
    review("route_unverified", input.routeEvidence.reason || "The service route could not be verified.");
  }

  const travelStatus = normalized(input.travelEligibility?.status);
  if (["out_of_range", "denied", "blocked"].includes(travelStatus)) {
    block("travel_policy_block", "This route is outside the current operating limit.");
  } else if (travelStatus === "manual_review" || input.travelEligibility?.requiresOwner === true) {
    review("travel_owner_review", "The current travel-pricing policy requires owner review.");
  }
  if (input.travelEligibility?.canApprove === false) {
    review("pricing_not_approvable", "The active pricing policy does not allow automatic approval.");
  }
  if (input.reviewRequired) review("job_complexity", "The selected difficulty requires a team review.");
  if (input.hasSpecialItems) review("special_items", "Heavy or special items require a team review.");

  if (!capability) {
    review("area_not_enabled", "This address is not in an auto-booking service area.");
  } else {
    if (!capability.service_types.map(normalized).includes(service)) {
      block("service_not_enabled", `${capability.name} is not enabled for this service.`);
    }
    if (!capability.truck_modes.map(normalized).includes(normalized(input.truckSource))) {
      block("truck_mode_not_enabled", `${capability.name} is not enabled for this truck option.`);
    }
    if (capability.verification_status !== "verified") {
      review("area_verification_pending", `${capability.name} requires operating-capability verification before automatic booking.`);
    }
    if (!capability.auto_book_enabled) {
      review("area_auto_booking_disabled", `Automatic booking is not enabled for ${capability.name}.`);
    }
  }

  if (decision === "eligible") reasons.push(reason("standard_job", "This job meets the standard automatic-booking rules."));
  return {
    decision,
    areaCode: capability?.code || null,
    reasons,
    routeVerified: input.routeEvidence.verified,
    originState,
    destinationState,
    autoBookEnabled: capability?.auto_book_enabled === true,
    adsEnabled: capability?.ads_enabled === true,
  };
}

export async function listPublicServiceAreaCapabilities() {
  const rows = await listCapabilities();
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    stateCode: row.state_code,
    locality: row.locality,
    verificationStatus: row.verification_status,
    autoBookEnabled: row.auto_book_enabled,
    adsEnabled: row.ads_enabled,
  }));
}
