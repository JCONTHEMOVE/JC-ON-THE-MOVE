import {
  MARKETPLACE_ACTION_TASKS,
  MARKETPLACE_SMART_BOOKING_STEPS,
  getMarketplaceRequestShape,
  getMarketplaceShapeForServiceCode,
  getMarketplaceSourceFlowsForContext,
  type MarketplaceActionPhase,
  type MarketplaceActionRail,
  type MarketplaceRequestShapeId,
  type MarketplaceSmartBookingStep,
  type MarketplaceSmartBookingStepId,
} from "./marketplaceShapes";
import { calculateLaborBooking, recommendLaborBooking } from "./laborBooking";

export type SmartBookingAnswers = Record<string, unknown>;

export type SmartBookingPatch = {
  answers: SmartBookingAnswers;
  inferred: Record<string, unknown>;
};

export type SmartBookingTextInference = {
  serviceType?: string;
  fromZip?: string;
  moveDate?: string;
  loadType?: string;
  truckSituation?: string;
  truckSize?: string;
  jobSize?: string;
  homeSize?: string;
  selectedMovingRecCrew?: string;
  selectedMovingRecHours?: string;
  selectedMovingRecLabel?: string;
  selectedMovingRec?: string;
  selectedMovingRecNotes?: string;
  selectedMovingRecTotalMin?: string;
  selectedMovingRecTotalMax?: string;
  notes?: string;
};

export type SmartMovingPackage = {
  id: string;
  label: string;
  crew: number;
  hours: number;
  localMin: number;
  localMax: number;
  outsideMin: number;
  outsideMax: number;
  notes: string;
};

export type SmartBookingGuidanceStepStatus = "complete" | "missing" | "optional";

export type SmartBookingGuidanceStep = MarketplaceSmartBookingStep & {
  status: SmartBookingGuidanceStepStatus;
  matchedSignals: string[];
  missingSignals: string[];
};

export type SmartBookingNextActionStage = "start" | "progress" | "finish";

export type SmartBookingNextAction = {
  stage: SmartBookingNextActionStage;
  label: string;
  prompt: string;
  answerOptions: string[];
  sourcePatterns: string;
  captures: string[];
  missingLabels: string[];
  proofTarget: string;
  customerNext: string;
  workerSignal: string;
  companyControl: string;
};

export type SmartBookingRecommendedTask = {
  id: string;
  rail: MarketplaceActionRail;
  side: "customer" | "worker" | "company";
  title: string;
  action: string;
  proof: string;
  bonusJcMoves: number;
  companyGuardrail: string;
  sourceMatches: string[];
};

export type SmartBookingGuidance = {
  shapeId: MarketplaceRequestShapeId;
  shapeLabel: string;
  nextStep: SmartBookingGuidanceStep | null;
  nextAction: SmartBookingNextAction;
  recommendedTasks: SmartBookingRecommendedTask[];
  steps: SmartBookingGuidanceStep[];
  completedRequired: number;
  totalRequired: number;
  missingSignals: string[];
  fastPathReady: boolean;
  customerNext: string;
  workerSignal: string;
  companyControl: string;
};

function canonicalSmartMovingPackage(
  id: string,
  crew: number,
  hours: number,
  notes: string,
): SmartMovingPackage {
  const total = calculateLaborBooking({ crewSize: crew, hours }).laborTotal;
  return {
    id,
    label: `${crew} movers / ${numberText(hours)} hours`,
    crew,
    hours,
    localMin: total,
    localMax: total,
    outsideMin: total,
    outsideMax: total,
    notes,
  };
}

export const SMART_MOVING_PACKAGES: SmartMovingPackage[] = [
  canonicalSmartMovingPackage("moving_2m_2h", 2, 2, "Small load, unload, apartment, or quick truck help."),
  canonicalSmartMovingPackage("moving_2m_3h", 2, 3, "Common local moving-help package."),
  canonicalSmartMovingPackage("moving_3m_2h", 3, 2, "Fast unload/load path when speed matters more than total hours."),
  canonicalSmartMovingPackage("moving_3m_3h", 3, 3, "Medium move or heavier access path."),
  canonicalSmartMovingPackage("moving_4m_4h", 4, 4, "Large move, heavy access, or full-house quote-review path."),
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lower(value: unknown): string {
  return text(value).toLowerCase();
}

function includesAny(value: unknown, needles: string[]): boolean {
  const raw = lower(value);
  return needles.some((needle) => raw.includes(needle));
}

function firstNumber(value: unknown): number | null {
  const match = text(value).match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : Number(text(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function numberText(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
}

function inferZip(raw: string): string | undefined {
  return raw.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
}

function isLocalZip(zip: unknown): boolean {
  const normalized = text(zip).slice(0, 5);
  return ["49938", "54534", "54525", "54550"].includes(normalized);
}

function inferDateHint(raw: string): string | undefined {
  const explicit = raw.match(/\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/)?.[0];
  if (explicit) return explicit;

  const relative = raw.match(/\b(today|tomorrow|this weekend|next weekend|weekend|next week|asap|soon)\b/i)?.[0];
  if (relative) return relative;

  return raw.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)?.[0];
}

function inferLoadType(raw: string): string | undefined {
  if (/\b(load\s*(?:and|\+|\/)\s*unload|unload\s*(?:and|\+|\/)\s*load|both)\b/i.test(raw)) {
    return "Both - load AND unload";
  }
  if (/\b(unload|unloading|empty truck|emptying)\b/i.test(raw)) return "Unload only";
  if (/\b(load|loading|pack truck|packing truck)\b/i.test(raw)) return "Load only";
  if (/\b(deliver|delivery|drop\s*off|pickup|pick\s*up)\b/i.test(raw)) return "Delivery / transport";
  return undefined;
}

function inferTruckSituation(raw: string): string | undefined {
  if (/\b(jc truck|your truck|you supply|company truck|need truck|bring truck)\b/i.test(raw)) {
    return "JC ON THE MOVE provides truck";
  }
  if (/\b(customer truck|my truck|own truck|rental|u-?haul|budget truck|penske|pods?|u-?box)\b/i.test(raw)) {
    return "Customer provides truck or no truck needed";
  }
  return undefined;
}

function inferTruckSize(raw: string): string | undefined {
  if (/\bu-?box\b/i.test(raw)) return "U-Box / storage container";
  if (/\bpod\b|\bpods\b/i.test(raw)) return "PODS / storage container";
  const match = raw.match(/\b(10|12|15|16|17|20|22|24|26)\s*(?:'|ft|foot|feet|footer)?\b/i);
  if (!match) return undefined;
  return `${match[1]}' truck`;
}

function inferHomeSize(raw: string): string | undefined {
  if (/\b(studio|efficiency)\b/i.test(raw)) return "Studio or 1-bed";
  if (/\b1\s*(?:bed|bedroom|br)\b/i.test(raw)) return "Studio or 1-bed";
  if (/\b2\s*(?:bed|bedroom|br)\b/i.test(raw) || /\b3\s*(?:bed|bedroom|br)\b/i.test(raw)) return "2-3 bed";
  if (/\b4\s*\+?\s*(?:bed|bedroom|br)|full house|whole house|large house\b/i.test(raw)) return "4+ bed";
  if (/\b(single item|one item|1 item|couple items|few items|1-2 items?)\b/i.test(raw)) return "1-2 items";
  return undefined;
}

function inferCrewHours(raw: string): Pick<SmartBookingTextInference, "selectedMovingRecCrew" | "selectedMovingRecHours" | "selectedMovingRecLabel"> {
  const crewMatch =
    raw.match(/\b([1-4])\s*(?:movers?|helpers?|crew|person|people|guys|man|men|m)\b/i)
    || raw.match(/\b([1-4])\s*(?:x|×|\/|\+)\s*[1-9](?:\.\d+)?\s*(?:hours?|hrs?|hr|h)\b/i);
  const hoursMatch =
    raw.match(/\b([1-9](?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i)
    || raw.match(/\b[1-4]\s*(?:x|×|\/|\+)\s*([1-9](?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/i);
  const crew = crewMatch ? Number(crewMatch[1]) : null;
  const hours = hoursMatch ? Number(hoursMatch[1]) : null;
  const result: Pick<SmartBookingTextInference, "selectedMovingRecCrew" | "selectedMovingRecHours" | "selectedMovingRecLabel"> = {};

  if (crew && crew >= 1 && crew <= 4) result.selectedMovingRecCrew = String(crew);
  if (hours && hours > 0) result.selectedMovingRecHours = numberText(hours);
  if (result.selectedMovingRecCrew && result.selectedMovingRecHours) {
    result.selectedMovingRecLabel = `${result.selectedMovingRecCrew} movers / ${result.selectedMovingRecHours} hours`;
  }
  return result;
}

export function getSmartMovingPackage(crew: unknown, hours: unknown): SmartMovingPackage {
  const normalizedCrew = Math.max(1, Math.min(4, Math.round(toNumber(crew) || 2)));
  const normalizedHours = Math.max(1, Math.round((toNumber(hours) || 3) * 2) / 2);
  const exact = SMART_MOVING_PACKAGES.find((pkg) => pkg.crew === normalizedCrew && pkg.hours === normalizedHours);
  if (exact) return exact;

  const laborBase = calculateLaborBooking({ crewSize: normalizedCrew, hours: normalizedHours }).laborTotal;
  const safeHours = String(normalizedHours).replace(".", "p");
  return {
    id: `moving_${normalizedCrew}m_${safeHours}h`,
    label: `${normalizedCrew} movers / ${numberText(normalizedHours)} hours`,
    crew: normalizedCrew,
    hours: normalizedHours,
    localMin: laborBase,
    localMax: laborBase,
    outsideMin: laborBase,
    outsideMax: laborBase,
    notes: "Custom smart moving-help package.",
  };
}

function applyPackageDetails(
  target: SmartBookingAnswers | SmartBookingTextInference,
  inferred: Record<string, unknown> | SmartBookingTextInference,
  packageSource: SmartMovingPackage,
  zip?: unknown,
) {
  const local = isLocalZip(zip);
  const min = local ? packageSource.localMin : packageSource.outsideMin;
  const max = local ? packageSource.localMax : packageSource.outsideMax;
  const rangeLabel = local ? "local estimate range" : "outside-area estimate range";

  if (!target.selectedMovingRec) {
    target.selectedMovingRec = packageSource.id;
    inferred.selectedMovingRec = packageSource.id;
  }
  if (!target.selectedMovingRecLabel) {
    target.selectedMovingRecLabel = packageSource.label;
    inferred.selectedMovingRecLabel = packageSource.label;
  }
  if (!target.selectedMovingRecNotes) {
    target.selectedMovingRecNotes = `${packageSource.notes} ${rangeLabel}. Staff confirms final price.`;
    inferred.selectedMovingRecNotes = target.selectedMovingRecNotes;
  }
  if (!target.selectedMovingRecTotalMin) {
    target.selectedMovingRecTotalMin = String(min);
    inferred.selectedMovingRecTotalMin = target.selectedMovingRecTotalMin;
  }
  if (!target.selectedMovingRecTotalMax) {
    target.selectedMovingRecTotalMax = String(max);
    inferred.selectedMovingRecTotalMax = target.selectedMovingRecTotalMax;
  }
}

export function inferSmartBookingText(value: unknown): SmartBookingTextInference {
  const raw = text(value);
  if (!raw) return {};

  const inferred: SmartBookingTextInference = {};
  const serviceType = inferServiceTypeFromSingleAnswer(raw);
  if (serviceType) inferred.serviceType = serviceType;

  const zip = inferZip(raw);
  if (zip) inferred.fromZip = zip;

  const date = inferDateHint(raw);
  if (date) inferred.moveDate = date;

  const loadType = inferLoadType(raw);
  if (loadType) inferred.loadType = loadType;

  const truckSituation = inferTruckSituation(raw);
  if (truckSituation) inferred.truckSituation = truckSituation;

  const truckSize = inferTruckSize(raw);
  if (truckSize) inferred.truckSize = truckSize;

  const homeSize = inferHomeSize(raw);
  if (homeSize) {
    inferred.homeSize = homeSize;
    inferred.jobSize = homeSize;
  }

  Object.assign(inferred, inferCrewHours(raw));
  if (inferred.selectedMovingRecCrew && inferred.selectedMovingRecHours) {
    applyPackageDetails(
      inferred,
      inferred,
      getSmartMovingPackage(inferred.selectedMovingRecCrew, inferred.selectedMovingRecHours),
      inferred.fromZip,
    );
  }
  inferred.notes = raw;
  return inferred;
}

function applyMissing(answers: SmartBookingAnswers, inferred: Record<string, unknown>, key: keyof SmartBookingTextInference, value: unknown) {
  if (value == null || value === "") return;
  if (answers[key] == null || answers[key] === "") {
    answers[key] = value;
    inferred[key] = value;
  }
}

export function inferServiceTypeFromSingleAnswer(value: unknown): string | null {
  const raw = lower(value);
  if (!raw) return null;
  if (includesAny(raw, ["junk", "haul away", "remove trash", "cleanout"])) return "Junk Removal";
  if (includesAny(raw, ["trash valet", "weekly trash", "curbside"])) return "Trash Valet";
  if (includesAny(raw, ["window"])) return "Window Cleaning";
  if (includesAny(raw, ["paint"])) return "Painting";
  if (includesAny(raw, ["floor"])) return "Flooring";
  if (includesAny(raw, ["roof"])) return "Roofing";
  if (includesAny(raw, ["handyman", "repair", "fix"])) return "Handyman";
  if (includesAny(raw, ["snow", "plow", "shovel"])) return "Snow Removal";
  if (includesAny(raw, ["lawn", "mow", "yard"])) return "Lawn Care";
  if (includesAny(raw, ["cleaning", "maid", "move out clean", "move-in clean"])) return "Move-In/Out Cleaning";
  if (includesAny(raw, ["demo", "demolition", "tear out"])) return "Light Demolition";
  if (includesAny(raw, ["jump", "battery"])) return "Jump Start";
  if (includesAny(raw, ["move", "moving", "load", "unload", "uhaul", "u-haul", "truck"])) return "Moving";
  return null;
}

export function isMovingAnswer(answers: SmartBookingAnswers): boolean {
  return lower(answers.serviceType).includes("moving");
}

export function isTinyMovingJob(answers: SmartBookingAnswers): boolean {
  return includesAny(answers.jobSize, ["1-2", "1 - 2", "single", "couple small"]);
}

export function estimateMovingCrewHours(answers: SmartBookingAnswers): { crew: number; hours: number; reason: string } {
  const size = lower(answers.jobSize || answers.homeSize || answers.selectedMovingRecLabel);
  const truck = lower(answers.truckSize);
  const specialItems = Array.isArray(answers.specialItems) ? answers.specialItems.map(String).join(" ").toLowerCase() : "";
  const specialty = includesAny(specialItems, ["piano", "pool table", "safe", "hot tub", "heavy"]);

  if (specialty) return { crew: 3, hours: 2, reason: "specialty/heavy item default" };
  if (/\b(10|12|15|16|17|20|22|24|26)\b/.test(truck)) {
    const plan = recommendLaborBooking({ truckSize: truck });
    return { crew: plan.crewSize, hours: plan.hours, reason: plan.reason };
  }
  if (size.includes("4") || size.includes("full house")) {
    return { crew: 4, hours: 4, reason: "large move default" };
  }
  if (size.includes("3 bedroom")) return { crew: 3, hours: 3, reason: "3 bedroom default" };
  if (size.includes("2 bedroom")) return { crew: 2, hours: 3, reason: "2 bedroom default" };
  if (size.includes("studio") || size.includes("1 bedroom") || size.includes("1-bedroom")) {
    return { crew: 2, hours: 2, reason: "studio/1 bedroom default" };
  }
  if (isTinyMovingJob(answers)) return { crew: 2, hours: 1, reason: "tiny job default" };
  return { crew: 2, hours: 3, reason: "standard moving default" };
}

export function applySmartBookingAnswer(
  previousAnswers: SmartBookingAnswers,
  stepId: string,
  value: unknown,
): SmartBookingPatch {
  const answers: SmartBookingAnswers = { ...previousAnswers, [stepId]: value };
  const inferred: Record<string, unknown> = {};
  const textInference = inferSmartBookingText(value);

  applyMissing(answers, inferred, "serviceType", textInference.serviceType);
  applyMissing(answers, inferred, "fromZip", textInference.fromZip);
  applyMissing(answers, inferred, "moveDate", textInference.moveDate);
  applyMissing(answers, inferred, "loadType", textInference.loadType);
  applyMissing(answers, inferred, "truckSituation", textInference.truckSituation);
  applyMissing(answers, inferred, "truckSize", textInference.truckSize);
  applyMissing(answers, inferred, "jobSize", textInference.jobSize);
  applyMissing(answers, inferred, "homeSize", textInference.homeSize);
  applyMissing(answers, inferred, "selectedMovingRecCrew", textInference.selectedMovingRecCrew);
  applyMissing(answers, inferred, "selectedMovingRecHours", textInference.selectedMovingRecHours);
  applyMissing(answers, inferred, "selectedMovingRecLabel", textInference.selectedMovingRecLabel);
  applyMissing(answers, inferred, "selectedMovingRec", textInference.selectedMovingRec);
  applyMissing(answers, inferred, "selectedMovingRecNotes", textInference.selectedMovingRecNotes);
  applyMissing(answers, inferred, "selectedMovingRecTotalMin", textInference.selectedMovingRecTotalMin);
  applyMissing(answers, inferred, "selectedMovingRecTotalMax", textInference.selectedMovingRecTotalMax);

  if (stepId === "serviceType") {
    const serviceType = inferServiceTypeFromSingleAnswer(value);
    if (serviceType) {
      answers.serviceType = serviceType;
      inferred.serviceType = serviceType;
    }
  }

  if (stepId === "serviceAddress") {
    answers.fromZip = answers.fromZip || value;
    inferred.fromZip = answers.fromZip;
  }

  if (isMovingAnswer(answers)) {
    if (stepId === "jobSize" && isTinyMovingJob(answers)) {
      answers.loadType = answers.loadType || "Both - load AND unload";
      answers.truckSituation = answers.truckSituation || "Customer provides truck or no truck needed";
      answers.homeSize = answers.homeSize || value;
      inferred.loadType = answers.loadType;
      inferred.truckSituation = answers.truckSituation;
      inferred.homeSize = answers.homeSize;
    }

    if (stepId === "jobSize" && !answers.homeSize) {
      answers.homeSize = value;
      inferred.homeSize = value;
    }

    if (stepId === "homeSize" && !answers.jobSize) {
      answers.jobSize = value;
      inferred.jobSize = value;
    }

    if (stepId === "truckSituation" && includesAny(value, ["own truck", "rental", "customer"])) {
      answers.truckSize = answers.truckSize || "Customer truck";
      inferred.truckSize = answers.truckSize;
    }

    const crewPlan = estimateMovingCrewHours(answers);
    if (!answers.selectedMovingRecCrew) {
      answers.selectedMovingRecCrew = String(crewPlan.crew);
      inferred.selectedMovingRecCrew = answers.selectedMovingRecCrew;
    }
    if (!answers.selectedMovingRecHours) {
      answers.selectedMovingRecHours = String(crewPlan.hours);
      inferred.selectedMovingRecHours = answers.selectedMovingRecHours;
    }
    if (!answers.selectedMovingRecLabel && answers.selectedMovingRecCrew && answers.selectedMovingRecHours) {
      answers.selectedMovingRecLabel = `${answers.selectedMovingRecCrew} movers / ${answers.selectedMovingRecHours} hours`;
      inferred.selectedMovingRecLabel = answers.selectedMovingRecLabel;
    }
    if (answers.selectedMovingRecCrew && answers.selectedMovingRecHours) {
      applyPackageDetails(
        answers,
        inferred,
        getSmartMovingPackage(answers.selectedMovingRecCrew, answers.selectedMovingRecHours),
        answers.fromZip,
      );
    }
    inferred.smartSizingReason = crewPlan.reason;
  }

  const possibleHours = firstNumber(value);
  if (stepId.toLowerCase().includes("duration") && possibleHours && !answers.selectedMovingRecHours) {
    answers.selectedMovingRecHours = String(possibleHours);
    inferred.selectedMovingRecHours = answers.selectedMovingRecHours;
  }

  return { answers, inferred };
}

export function shouldSkipSmartBookingStep(stepId: string, answers: SmartBookingAnswers): boolean {
  if (!isMovingAnswer(answers)) return false;
  if (stepId === "homeSize" && answers.jobSize) return true;
  if (stepId === "propertyType" && isTinyMovingJob(answers)) return true;
  if (stepId === "loadType" && isTinyMovingJob(answers)) return true;
  if ((stepId === "originFloor" || stepId === "destFloor") && isTinyMovingJob(answers)) return true;
  if (stepId === "truckSituation" && isTinyMovingJob(answers)) return true;
  if (stepId === "truckSize" && (isTinyMovingJob(answers) || includesAny(answers.truckSituation, ["own truck", "rental", "customer"]))) {
    return true;
  }
  return false;
}

const requiredSignalsByShape: Record<MarketplaceRequestShapeId, Record<MarketplaceSmartBookingStepId, string[]>> = {
  fast_quote: {
    where_when: ["location_or_zip"],
    job_shape: ["service_type"],
    truck_context: [],
    smart_package: [],
    detail_capture: [],
    contact_recovery: ["contact_method"],
  },
  moving_help: {
    where_when: ["location_or_zip", "date_or_window"],
    job_shape: ["service_type", "load_type"],
    truck_context: ["truck_context"],
    smart_package: ["crew_package"],
    detail_capture: [],
    contact_recovery: ["contact_method"],
  },
  delivery_reuse: {
    where_when: ["location_or_zip", "date_or_window"],
    job_shape: ["service_type"],
    truck_context: ["pickup_or_dropoff"],
    smart_package: [],
    detail_capture: ["item_detail"],
    contact_recovery: ["contact_method"],
  },
  repeat_loop: {
    where_when: ["location_or_zip", "date_or_window"],
    job_shape: ["service_type"],
    truck_context: [],
    smart_package: [],
    detail_capture: ["item_detail"],
    contact_recovery: ["contact_method"],
  },
};

function hasAnyAnswer(answers: SmartBookingAnswers, keys: string[]): boolean {
  return keys.some((key) => {
    const value = answers[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "boolean") return value;
    return text(value).length > 0;
  });
}

function signalIsPresent(signal: string, answers: SmartBookingAnswers): boolean {
  switch (signal) {
    case "location_or_zip":
      return hasAnyAnswer(answers, ["fromZip", "customerZip", "zip", "serviceAddress", "fromAddress", "address"]);
    case "date_or_window":
      return hasAnyAnswer(answers, ["moveDate", "estimatedDate", "requestedDate", "arrivalWindow", "timeWindow"]);
    case "service_type":
      return hasAnyAnswer(answers, ["serviceType", "serviceCode", "marketplaceShapeId", "jobShape"]);
    case "load_type":
      return hasAnyAnswer(answers, ["loadType", "movingPath"]);
    case "truck_context":
      return hasAnyAnswer(answers, ["truckSituation", "truckProvider", "truckSize", "containerCount", "boxCount", "accessNotes", "parkingDistance"]);
    case "crew_package":
      return hasAnyAnswer(answers, ["selectedMovingRec", "selectedMovingRecLabel", "selectedPackage", "packageId"])
        || (hasAnyAnswer(answers, ["selectedMovingRecCrew", "crewSize"]) && hasAnyAnswer(answers, ["selectedMovingRecHours", "confirmedHours", "laborHours"]));
    case "pickup_or_dropoff":
      return hasAnyAnswer(answers, ["pickupAddress", "dropoffAddress", "fromAddress", "toAddress", "serviceAddress"]);
    case "item_detail":
      return hasAnyAnswer(answers, ["photos", "submittedPhotos", "items", "inventory", "furniture", "specialItems", "oversizedItemCount", "notes"]);
    case "contact_method":
      return hasAnyAnswer(answers, ["phone", "customerPhone", "email", "customerEmail", "fullName", "customerName", "firstName"]);
    default:
      return false;
  }
}

function friendlySignalLabel(signal: string): string {
  const labels: Record<string, string> = {
    location_or_zip: "ZIP or address",
    date_or_window: "date or window",
    service_type: "service type",
    load_type: "load/unload choice",
    truck_context: "truck, container, or access",
    crew_package: "crew and hours",
    pickup_or_dropoff: "pickup/drop-off",
    item_detail: "photos or item details",
    contact_method: "name, phone, or email",
  };
  return labels[signal] || signal.replace(/_/g, " ");
}

function guidanceShapeId(answers: SmartBookingAnswers, serviceLabel?: string): MarketplaceRequestShapeId {
  const shapeId = text(answers.marketplaceShapeId || answers.jobShapeId) as MarketplaceRequestShapeId;
  if (["fast_quote", "moving_help", "delivery_reuse", "repeat_loop"].includes(shapeId)) return shapeId;
  return getMarketplaceShapeForServiceCode(text(answers.serviceCode || answers.serviceType || serviceLabel)).id;
}

function buildSmartBookingNextAction({
  shapeLabel,
  nextStep,
  missingRequired,
  fastPathReady,
}: {
  shapeLabel: string;
  nextStep: SmartBookingGuidanceStep | null;
  missingRequired: SmartBookingGuidanceStep[];
  fastPathReady: boolean;
}): SmartBookingNextAction {
  if (!nextStep) {
    return {
      stage: "finish",
      label: "Ready to close",
      prompt: "Confirm the quote, payment path, completion proof, review, and JCMOVES closeout.",
      answerOptions: ["Confirm quote", "Send payment link", "Complete job", "Ask for review"],
      sourcePatterns: "Square, Two Men and a Truck, Google/Yelp reviews, JCMOVES",
      captures: ["quote", "payment", "completion proof", "review", "reward ledger"],
      missingLabels: [],
      proofTarget: "The lead has quote/payment/completion evidence tied to one card.",
      customerNext: "Confirm service and payment path.",
      workerSignal: "Close the job with proof and any issue notes.",
      companyControl: "Verify payment, payout, rewards, and review loop before closing.",
    };
  }

  const missingSignals = nextStep.missingSignals.length > 0
    ? nextStep.missingSignals
    : missingRequired.flatMap((step) => step.missingSignals);
  const missingLabels = Array.from(new Set(missingSignals.map(friendlySignalLabel)));
  const optionalReady = fastPathReady && nextStep.status === "optional";
  const stage: SmartBookingNextActionStage = !fastPathReady ? "start" : optionalReady ? "progress" : "start";
  const label = !fastPathReady
    ? "Ask this next"
    : optionalReady
      ? "Ready - optional detail"
      : "Next answer";
  const prompt = optionalReady
    ? `${shapeLabel} is ready for quote review. Optional: ${nextStep.prompt}`
    : nextStep.prompt;

  return {
    stage,
    label,
    prompt,
    answerOptions: nextStep.quickOptions.slice(0, 6),
    sourcePatterns: nextStep.sourcePatterns,
    captures: nextStep.captures,
    missingLabels,
    proofTarget: nextStep.captures.length > 0
      ? `Capture ${nextStep.captures.slice(0, 4).join(", ")}${nextStep.captures.length > 4 ? ", ..." : ""}.`
      : "Keep the lead card moving without adding form clutter.",
    customerNext: optionalReady ? "Add photos/details if useful, or continue to quote review." : nextStep.customerPromise,
    workerSignal: nextStep.workerSignal,
    companyControl: nextStep.companyControl,
  };
}

const railPriorityByPhase: Record<MarketplaceActionPhase, MarketplaceActionRail[]> = {
  start: ["customer", "bronze", "silver", "gold", "platinum"],
  progress: ["silver", "gold", "platinum", "customer", "bronze"],
  finish: ["bronze", "gold", "platinum", "customer", "silver"],
};

function recommendedTasksForNextAction({
  shapeId,
  nextAction,
}: {
  shapeId: MarketplaceRequestShapeId;
  nextAction: SmartBookingNextAction;
}): SmartBookingRecommendedTask[] {
  const phase = nextAction.stage;
  const flows = getMarketplaceSourceFlowsForContext({
    source: nextAction.sourcePatterns,
    shapeId,
    limit: 4,
  });
  const flowIds = new Set(flows.map((flow) => flow.id));
  const railPriority = railPriorityByPhase[phase];

  return MARKETPLACE_ACTION_TASKS
    .filter((task) => task.phase === phase && task.shapeIds.includes(shapeId))
    .map((task) => {
      const sourceMatches = task.flowIds.filter((flowId) => flowIds.has(flowId));
      return {
        id: task.id,
        rail: task.rail,
        side: task.side,
        title: task.title,
        action: task.action,
        proof: task.proof,
        bonusJcMoves: task.bonusJcMoves,
        companyGuardrail: task.companyGuardrail,
        sourceMatches,
      } satisfies SmartBookingRecommendedTask;
    })
    .sort((a, b) => {
      if (a.sourceMatches.length !== b.sourceMatches.length) return b.sourceMatches.length - a.sourceMatches.length;
      const aRail = railPriority.indexOf(a.rail);
      const bRail = railPriority.indexOf(b.rail);
      if (aRail !== bRail) return aRail - bRail;
      return b.bonusJcMoves - a.bonusJcMoves;
    })
    .slice(0, 4);
}

export function getSmartBookingGuidance(
  answers: SmartBookingAnswers,
  serviceLabel?: string,
): SmartBookingGuidance {
  const resolvedShapeId = guidanceShapeId(answers, serviceLabel);
  const shape = getMarketplaceRequestShape(resolvedShapeId) || getMarketplaceShapeForServiceCode(resolvedShapeId);
  const requiredSignals = requiredSignalsByShape[shape.id];
  const steps = MARKETPLACE_SMART_BOOKING_STEPS
    .filter((step) => step.shapeIds.includes(shape.id))
    .sort((a, b) => a.order - b.order)
    .map((step): SmartBookingGuidanceStep => {
      const required = requiredSignals[step.id] || [];
      const matchedSignals = required.filter((signal) => signalIsPresent(signal, answers));
      const missingSignals = required.filter((signal) => !signalIsPresent(signal, answers));
      return {
        ...step,
        status: required.length === 0 ? "optional" : missingSignals.length === 0 ? "complete" : "missing",
        matchedSignals,
        missingSignals,
      };
    });
  const requiredSteps = steps.filter((step) => step.status !== "optional");
  const missingRequired = requiredSteps.filter((step) => step.status === "missing");
  const nextStep = missingRequired[0] || steps.find((step) => step.status === "optional") || null;
  const fastPathReady = missingRequired.length === 0;
  const nextAction = buildSmartBookingNextAction({
    shapeLabel: shape.shape,
    nextStep,
    missingRequired,
    fastPathReady,
  });
  const recommendedTasks = recommendedTasksForNextAction({
    shapeId: shape.id,
    nextAction,
  });

  return {
    shapeId: shape.id,
    shapeLabel: shape.shape,
    nextStep,
    nextAction,
    recommendedTasks,
    steps,
    completedRequired: requiredSteps.length - missingRequired.length,
    totalRequired: requiredSteps.length,
    missingSignals: missingRequired.flatMap((step) => step.missingSignals),
    fastPathReady,
    customerNext: nextAction.customerNext,
    workerSignal: nextAction.workerSignal || shape.worker,
    companyControl: nextAction.companyControl || shape.company,
  };
}
