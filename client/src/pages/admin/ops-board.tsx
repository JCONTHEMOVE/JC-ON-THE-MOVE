import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Search,
  Sparkles,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import MarketplaceShapeBadge from "@/components/MarketplaceShapeBadge";

type Lead = {
  id: string;
  orderNumber?: number | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  serviceType: string;
  fromAddress?: string | null;
  toAddress?: string | null;
  moveDate?: string | null;
  confirmedDate?: string | null;
  arrivalWindow?: string | null;
  crewSize?: number | null;
  crewMembers?: string[] | null;
  confirmedHours?: number | null;
  status: string;
  source?: string | null;
  totalPrice?: string | number | null;
  basePrice?: string | number | null;
  details?: string | null;
  quoteNotes?: string | null;
  selectedPackageId?: string | null;
  dispatchNotes?: string | null;
  orderLineItems?: unknown[] | null;
  quoteSnapshot?: unknown;
  truckConfig?: string | null;
  archivedAt?: string | null;
  createdAt?: string | null;
};

type PackageOption = {
  id: string;
  name: string;
  range: string;
  base: number;
  crewSize: number;
  jobHours: number;
  laborHours: string;
  description: string;
};

const PACKAGES: PackageOption[] = [
  {
    id: "pkg_1_local_load_delivery",
    name: "Package 1",
    range: "$200-300",
    base: 250,
    crewSize: 2,
    jobHours: 2,
    laborHours: "2 movers / 2 hr minimum",
    description: "Loading, unloading, or single item delivery local to Ironwood.",
  },
  {
    id: "pkg_2_load_unload_big",
    name: "Package 2",
    range: "$375 intro",
    base: 375,
    crewSize: 3,
    jobHours: 2,
    laborHours: "3 movers / 2 hr minimum",
    description: "Small-to-medium junk intro, loading/unloading, or larger local job.",
  },
  {
    id: "pkg_3_two_movers_day",
    name: "Package 3",
    range: "$1,100",
    base: 1100,
    crewSize: 2,
    jobHours: 7,
    laborHours: "14 labor hrs",
    description: "Two movers for the day.",
  },
  {
    id: "pkg_4_four_movers_day",
    name: "Package 4",
    range: "$1,900",
    base: 1900,
    crewSize: 4,
    jobHours: 7,
    laborHours: "28 labor hrs",
    description: "Four movers for the day.",
  },
];

const EXTRA_HOUR_PER_MOVER_RATE = 50;

const SERVICE_LABELS: Record<string, string> = {
  moving: "Moving",
  residential: "Residential Move",
  commercial: "Commercial Move",
  labor: "Labor",
  delivery: "Delivery",
  junk: "Junk Removal",
  junk_removal: "Junk Removal",
  cleaning: "Cleaning",
  handyman: "Handyman",
  window_cleaning: "Window Cleaning",
  lawn_care: "Lawn Care",
  snow_removal: "Snow Removal",
};

const SERVICE_ICON: Record<string, string> = {
  moving: "MV",
  residential: "MV",
  commercial: "CO",
  labor: "LB",
  delivery: "DL",
  junk: "JK",
  junk_removal: "JK",
  cleaning: "CL",
  handyman: "HM",
  window_cleaning: "WN",
  lawn_care: "LC",
  snow_removal: "SN",
};

const QUOTE_STACK_STATUSES = new Set(["new", "contacted", "quote_requested", "quoted", "chatbot_pending"]);
const ASSIGNED_STATUSES = new Set(["available", "confirmed", "accepted", "in_progress", "completed"]);

function formatMoney(value?: string | number | null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "Quote needed";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatMoneyExact(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoneyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value || "").replace(/,/g, "").trim();
  if (!text) return 0;
  const matches = text.match(/\d+(?:\.\d{1,2})?/g);
  if (!matches?.length) return 0;
  const values = matches.map(Number).filter(Number.isFinite);
  if (!values.length) return 0;
  if (values.length >= 2 && /(?:-|\u2013|\u2014|\bto\b)/i.test(text)) {
    return Math.round(((values[0] + values[1]) / 2) * 100) / 100;
  }
  return Math.round(values[0] * 100) / 100;
}

function moneyInput(value: number) {
  return value.toFixed(2);
}

function formatQuantity(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatOrder(lead: Lead) {
  return lead.orderNumber ? `JC-${lead.orderNumber}` : "No order";
}

function dateOnly(value?: string | null) {
  if (!value) return "";
  return value.includes("T") ? value.slice(0, 10) : value;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(value?: string | null) {
  const key = dateOnly(value);
  if (!key) return "Choose date";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthDays(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function cityFrom(address?: string | null) {
  if (!address) return "No address";
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
}

function customerName(lead: Lead) {
  return `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Customer";
}

function formatPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === "1") return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value || "No phone";
}

function shortAddress(value?: string | null) {
  if (!value) return "Address needed";
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ") || value;
}

function statusLabel(value?: string | null) {
  return String(value || "new").replaceAll("_", " ");
}

function leadTextBlob(lead: Lead) {
  return [
    lead.source,
    lead.serviceType,
    lead.details,
    lead.quoteNotes,
    lead.fromAddress,
    lead.toAddress,
  ].filter(Boolean).join(" ").toLowerCase();
}

function looksLikeTextLead(lead: Lead) {
  const text = leadTextBlob(lead);
  return /text|sms|message|messenger|quick_request|quick request|callback requested/.test(text);
}

function looksLikeReclinerMove(lead: Lead) {
  return /recliner|chair|single item|one item/.test(leadTextBlob(lead));
}

function extractZip(value?: string | null) {
  return String(value || "").match(/\b\d{5}(?:-\d{4})?\b/)?.[0] || "";
}

function defaultEtaPrep(lead: Lead, fastPath = false) {
  const zip = extractZip(lead.fromAddress) || extractZip(lead.toAddress);
  const item = looksLikeReclinerMove(lead) ? "recliner/chair path" : "item path";
  return [
    fastPath ? "Text lead fast path: booked from customer text." : "ETA prep:",
    "Text customer when crew is assigned and again before arrival.",
    zip ? `ZIP ${zip}.` : "",
    `Confirm pickup/drop-off, parking, stairs/elevator, and ${item}.`,
  ].filter(Boolean).join(" ");
}

function appendUniqueLine(base: string, line: string) {
  const cleanBase = base.trim();
  if (!cleanBase) return line;
  return cleanBase.includes(line) ? cleanBase : `${cleanBase}\n${line}`;
}

function isAssigned(lead: Lead) {
  return ASSIGNED_STATUSES.has(lead.status) || !!dateOnly(lead.confirmedDate) || (lead.crewMembers?.length || 0) > 0;
}

function isCompletedJob(lead: Lead) {
  return String(lead.status || "").toLowerCase() === "completed";
}

function TradingJobCard({ lead, compact = false, onOpen }: { lead: Lead; compact?: boolean; onOpen: (lead: Lead) => void }) {
  const crewCount = lead.crewMembers?.length || 0;
  const needed = lead.crewSize || 2;
  const service = SERVICE_LABELS[lead.serviceType] || lead.serviceType;
  const date = lead.confirmedDate || lead.moveDate || null;
  const completed = isCompletedJob(lead);
  const route = lead.toAddress ? `${cityFrom(lead.fromAddress)} to ${cityFrom(lead.toAddress)}` : cityFrom(lead.fromAddress);

  return (
    <button
      onClick={() => onOpen(lead)}
      className={`group w-full text-left rounded-[8px] border shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        completed
          ? "border-emerald-700/50 bg-emerald-950/20 hover:border-emerald-400/70 hover:bg-emerald-950/35"
          : "border-slate-700 bg-slate-900 hover:border-blue-400/70 hover:bg-slate-800/90"
      } ${
        compact ? "p-2" : "p-3 sm:p-4"
      }`}
    >
      {compact ? (
        <div className="flex items-center gap-2">
          <div className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-[6px] text-xs font-black ring-1 ${
            completed ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" : "bg-slate-800 text-blue-100 ring-slate-600"
          }`}>
            {completed ? <CheckCircle2 className="h-4 w-4" /> : SERVICE_ICON[lead.serviceType] || "JOB"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-black text-white">{customerName(lead)}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="truncate text-[10px] text-slate-400">{service} - {formatMoney(lead.totalPrice || lead.basePrice)}</span>
              <MarketplaceShapeBadge serviceCode={lead.serviceType} serviceLabel={service} className="text-[8px]" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-[8px] text-sm font-black ring-1 ${
              completed ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/40" : "bg-blue-500/15 text-blue-100 ring-blue-400/30"
            }`}>
              {completed ? <CheckCircle2 className="h-6 w-6" /> : SERVICE_ICON[lead.serviceType] || "JOB"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{formatOrder(lead)}</span>
                <Badge className={completed ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" : "border-orange-400/30 bg-orange-500/15 text-orange-200"}>
                  {completed ? "Completed" : statusLabel(lead.status)}
                </Badge>
              </div>
              <div className="mt-1 truncate text-lg font-black text-white">{customerName(lead)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-blue-300" />
                  {formatPhone(lead.phone)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-blue-300" />
                  {service}
                </span>
                <MarketplaceShapeBadge serviceCode={lead.serviceType} serviceLabel={service} />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-[8px] border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</div>
              <div className="mt-1 font-black text-slate-100">{displayDate(date)}</div>
            </div>
            <div className="rounded-[8px] border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Price</div>
              <div className="mt-1 font-black text-emerald-300">{formatMoney(lead.totalPrice || lead.basePrice)}</div>
            </div>
            <div className="rounded-[8px] border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Crew</div>
              <div className={crewCount >= needed ? "mt-1 font-black text-green-300" : "mt-1 font-black text-yellow-300"}>
                {crewCount}/{needed} movers
              </div>
            </div>
            <div className="rounded-[8px] border border-slate-800 bg-slate-950/80 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Window</div>
              <div className="mt-1 truncate font-black text-slate-100">{lead.arrivalWindow || "Set time"}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2 rounded-[8px] border border-slate-800 bg-slate-950/60 px-3 py-2 text-slate-200">
              <MapPin className="h-4 w-4 flex-shrink-0 text-blue-300" />
              <span className="truncate">{route}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="min-w-0 rounded-[8px] border border-slate-800 bg-slate-950/60 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">From</div>
                <div className="mt-0.5 truncate text-slate-200">{shortAddress(lead.fromAddress)}</div>
              </div>
              <div className="min-w-0 rounded-[8px] border border-slate-800 bg-slate-950/60 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">To</div>
                <div className="mt-0.5 truncate text-slate-200">{shortAddress(lead.toAddress)}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-[8px] border border-blue-400/25 bg-blue-500/10 px-3 py-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-200/70">Next tap</div>
              <div className="truncate text-sm font-black text-white">{isAssigned(lead) ? "Open job controls" : "Build quote"}</div>
            </div>
            <div className="flex h-11 min-w-28 items-center justify-center rounded-[8px] bg-blue-600 px-4 text-sm font-black text-white transition group-hover:bg-blue-500">
              Open
            </div>
          </div>
        </>
      )}
    </button>
  );
}

function Stepper({ value, onChange, min = 0, max = 999, step = 1 }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  const nextValue = (direction: 1 | -1) => {
    const raw = value + direction * step;
    const clamped = Math.min(max, Math.max(min, raw));
    return Math.round(clamped * 100) / 100;
  };

  return (
    <div className="flex items-center rounded-[8px] border border-slate-700 bg-slate-950">
      <button className="h-9 w-9 text-slate-300 hover:text-white" onClick={() => onChange(nextValue(-1))}>-</button>
      <div className="w-12 text-center text-sm font-bold text-white">{formatQuantity(value)}</div>
      <button className="h-9 w-9 text-slate-300 hover:text-white" onClick={() => onChange(nextValue(1))}>+</button>
    </div>
  );
}

function FastQuoteDrawer({ lead, employees, open, onClose }: { lead: Lead | null; employees: User[]; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [selectedPackageId, setSelectedPackageId] = useState(PACKAGES[0].id);
  const [date, setDate] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState("Morning");
  const [crewSize, setCrewSize] = useState(2);
  const [crewMembers, setCrewMembers] = useState<string[]>([]);
  const [travelMiles, setTravelMiles] = useState(0);
  const [truck, setTruck] = useState<"none" | "15ft" | "26ft">("none");
  const [truckMiles, setTruckMiles] = useState(0);
  const [extraHours, setExtraHours] = useState(0);
  const [priceInput, setPriceInput] = useState(moneyInput(PACKAGES[0].base));
  const [etaPrep, setEtaPrep] = useState("");
  const [blankets, setBlankets] = useState(false);
  const [shrinkwrap, setShrinkwrap] = useState(false);
  const [notes, setNotes] = useState("");
  const [, setLocation] = useLocation();

  const selectedPackage = PACKAGES.find((pkg) => pkg.id === selectedPackageId) || PACKAGES[0];
  const cleanBasePrice = parseMoneyInput(priceInput) || selectedPackage.base;
  const truckBase = truck === "15ft" ? 500 : truck === "26ft" ? 1000 : 0;
  const truckOverageMiles = truck === "none" ? 0 : Math.max(0, truckMiles - 50);
  const truckOverage = truckOverageMiles * 5;
  const travel = travelMiles * 5;
  const extraHoursCharge = extraHours * crewSize * EXTRA_HOUR_PER_MOVER_RATE;
  const confirmedHours = selectedPackage.jobHours + extraHours;
  const confirmedHoursForStorage = Math.max(1, Math.ceil(confirmedHours));
  const suppliesCharge = (blankets ? 99 : 0) + (shrinkwrap ? 99 : 0);
  const addons = extraHoursCharge + suppliesCharge;
  const total = cleanBasePrice + truckBase + truckOverage + travel + addons;
  const textLead = lead ? looksLikeTextLead(lead) : false;
  const reclinerLead = lead ? looksLikeReclinerMove(lead) : false;
  const showTextFastPath = Boolean(lead && (textLead || reclinerLead));

  type ConvertOptions = { fastTextPath?: boolean };

  function buildConversionPayload(options: ConvertOptions = {}) {
    if (!lead) throw new Error("No lead selected");
    const fastTextPath = Boolean(options.fastTextPath);
    const effectiveDate = date || (fastTextPath ? localDateKey() : "");
    if (!effectiveDate) throw new Error("Choose a date first");

    const effectiveArrivalWindow = fastTextPath
      ? (arrivalWindow || "ASAP / text ETA")
      : arrivalWindow;
    const effectiveEtaPrep = etaPrep.trim() || defaultEtaPrep(lead, fastTextPath);
    const fastNote = fastTextPath
      ? "Text lead booked in one pass from the small-job admin intake."
      : "";
    const noteDraft = fastNote ? appendUniqueLine(notes, fastNote) : notes;
    const truckLabel = truck === "none" ? "No rental truck" : truck === "15ft" ? "15 ft rental truck" : "26 ft rental truck";
    const quoteNotes = [
      `${selectedPackage.name}: ${selectedPackage.description}`,
      `Clean price: package ${formatMoneyExact(cleanBasePrice)}; customer total ${formatMoneyExact(total)}.`,
      `Truck: ${truckLabel}`,
      truck !== "none" ? `Truck mileage: ${truckMiles} miles; ${truckOverageMiles} miles over included 50 at $5/mile.` : "",
      travelMiles ? `Mover travel: ${travelMiles} miles at $5/mile = ${formatMoneyExact(travel)}.` : "",
      `Booked duration: ${formatQuantity(selectedPackage.jobHours)} clock hr package with ${crewSize} mover${crewSize === 1 ? "" : "s"}.`,
      extraHours
        ? `Extra hours: ${formatQuantity(extraHours)} hr beyond package x ${crewSize} mover${crewSize === 1 ? "" : "s"} x $${EXTRA_HOUR_PER_MOVER_RATE}/mover-hr = ${formatMoneyExact(extraHoursCharge)}.`
        : "",
      confirmedHoursForStorage !== confirmedHours
        ? `Crew calendar rounds booked duration up to ${confirmedHoursForStorage} hr for payout/scheduling.`
        : "",
      blankets ? "We supply moving blankets: $99." : "",
      shrinkwrap ? "We supply shrinkwrap: $99." : "",
      effectiveEtaPrep,
      noteDraft.trim(),
    ].filter(Boolean).join("\n");

    const lineItems = [
      {
        id: selectedPackage.id,
        name: selectedPackage.name,
        qty: 1,
        unitPrice: cleanBasePrice,
        total: cleanBasePrice,
        category: "small_job_package",
      },
      truckBase + truckOverage > 0 ? {
        id: "truck",
        name: truckLabel,
        qty: 1,
        unitPrice: truckBase + truckOverage,
        total: truckBase + truckOverage,
        category: "truck",
      } : null,
      travel > 0 ? {
        id: "mover_travel",
        name: "Mover travel",
        qty: travelMiles,
        unitPrice: 5,
        total: travel,
        category: "travel",
      } : null,
      extraHoursCharge > 0 ? {
        id: "additional_clock_time",
        name: "Extra hours",
        qty: extraHours * crewSize,
        unitPrice: EXTRA_HOUR_PER_MOVER_RATE,
        total: extraHoursCharge,
        category: "labor",
      } : null,
      blankets ? { id: "blankets", name: "Moving blankets", qty: 1, unitPrice: 99, total: 99, category: "supplies" } : null,
      shrinkwrap ? { id: "shrinkwrap", name: "Shrinkwrap", qty: 1, unitPrice: 99, total: 99, category: "supplies" } : null,
    ].filter(Boolean);

    return {
      basePrice: cleanBasePrice,
      totalPrice: total,
      selectedPackageId: selectedPackage.id,
      orderLineItems: lineItems,
      confirmedDate: effectiveDate,
      arrivalWindow: effectiveArrivalWindow,
      crewSize,
      confirmedHours: confirmedHoursForStorage,
      crewMembers,
      confirmedFromAddress: lead.fromAddress || "",
      confirmedToAddress: lead.toAddress || "",
      dispatchNotes: effectiveEtaPrep,
      quoteNotes,
      sourceAction: fastTextPath ? "text_lead_fast_path" : "ops_fast_quote",
      quoteSnapshot: {
        adminSmallJobIntake: {
          source: fastTextPath ? "text_lead_fast_path" : "ops_fast_quote",
          selectedPackageId: selectedPackage.id,
          selectedPackageLabel: selectedPackage.name,
          price: {
            basePrice: cleanBasePrice,
            totalPrice: total,
          },
          addOns: {
            truck: truckLabel,
            truckMiles,
            truckOverageMiles,
            travelMiles,
            extraClockHours: extraHours,
            blankets,
            shrinkwrap,
          },
          etaPrep: effectiveEtaPrep,
          textLead,
          reclinerLead,
        },
      },
    };
  }

  const convertMutation = useMutation({
    mutationFn: async (options: ConvertOptions = {}) => {
      if (!lead) throw new Error("No lead selected");
      const response = await apiRequest("POST", `/api/leads/${lead.id}/convert-to-job`, buildConversionPayload(options));
      return response.json();
    },
    onSuccess: (_updated, options) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/available"] });
      toast({
        title: options?.fastTextPath ? "Text lead booked" : "Job quoted",
        description: `${formatOrder(lead!)} is now on the assigned board.`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Quote failed", description: error.message, variant: "destructive" });
    },
  });

  function toggleCrew(id: string) {
    setCrewMembers((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function resetFromLead(nextLead: Lead | null) {
    if (!nextLead) return;
    const pkg = PACKAGES.find((item) => item.id === nextLead.selectedPackageId) || PACKAGES[0];
    setSelectedPackageId(pkg.id);
    setDate(dateOnly(nextLead.confirmedDate || nextLead.moveDate));
    setCrewSize(nextLead.crewSize || pkg.crewSize);
    setExtraHours(Math.max(0, Math.ceil(Number(nextLead.confirmedHours || pkg.jobHours)) - pkg.jobHours));
    setCrewMembers(Array.isArray(nextLead.crewMembers) ? nextLead.crewMembers : []);
    setArrivalWindow(nextLead.arrivalWindow || "Morning");
    setPriceInput(moneyInput(parseMoneyInput(nextLead.totalPrice || nextLead.basePrice) || pkg.base));
    setEtaPrep(nextLead.dispatchNotes || defaultEtaPrep(nextLead));
    setNotes(nextLead.quoteNotes || "");
    setTravelMiles(0);
    setTruck("none");
    setTruckMiles(0);
    setBlankets(false);
    setShrinkwrap(false);
  }

  useEffect(() => {
    if (open) resetFromLead(lead);
  }, [lead?.id, open]);

  return (
    <Sheet open={open} onOpenChange={(value) => {
      if (!value) onClose();
    }}>
      <SheetContent side="right" className="w-full overflow-y-auto border-slate-800 bg-slate-950 text-white sm:max-w-xl">
        <SheetHeader className="border-b border-slate-800 pb-4">
          <SheetTitle className="text-white">Fast Quote</SheetTitle>
          <div className="text-sm text-slate-400">
            {lead ? `${formatOrder(lead)} - ${lead.firstName} ${lead.lastName}` : "Select a lead"}
          </div>
        </SheetHeader>

        {lead && (
          <div className="space-y-5 py-5">
            {showTextFastPath && (
              <div className="rounded-[8px] border border-emerald-400/30 bg-emerald-500/10 p-3">
                <div className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-white">Text lead fast path</div>
                    <p className="mt-1 text-xs text-emerald-100/80">
                      Books this as a today small job with clean price fields, ETA prep, and preserved text notes.
                    </p>
                    {reclinerLead && (
                      <div className="mt-2 inline-flex rounded-[6px] border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                        Recliner/chair move detected
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Button
                    onClick={() => convertMutation.mutate({ fastTextPath: true })}
                    disabled={convertMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {convertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Book Today
                  </Button>
                  <Button
                    variant="outline"
                    className="border-emerald-400/30 text-emerald-100"
                    onClick={() => {
                      const pkg = PACKAGES[0];
                      setSelectedPackageId(pkg.id);
                      setCrewSize(pkg.crewSize);
                      setDate(localDateKey());
                      setArrivalWindow("ASAP / text ETA");
                      setExtraHours(0);
                      setTruck("none");
                      setTruckMiles(0);
                      setTravelMiles(0);
                      setPriceInput(moneyInput(pkg.base));
                      setEtaPrep(defaultEtaPrep(lead, true));
                    }}
                  >
                    Prep Fields
                  </Button>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-500">Base Package</Label>
              <div className="mt-2 grid gap-2">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => {
                      setSelectedPackageId(pkg.id);
                      setCrewSize(pkg.crewSize);
                      setPriceInput(moneyInput(pkg.base));
                    }}
                    className={`rounded-[8px] border p-3 text-left transition ${
                      selectedPackageId === pkg.id ? "border-blue-400 bg-blue-500/15" : "border-slate-700 bg-slate-900 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-white">{pkg.name}</div>
                      <div className="text-sm font-bold text-blue-200">{pkg.range}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{pkg.laborHours} - {pkg.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Small-Job Price</Label>
                <Input
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onBlur={() => setPriceInput(moneyInput(cleanBasePrice))}
                  inputMode="decimal"
                  placeholder="250.00"
                  className="mt-2 border-slate-700 bg-slate-900 text-white"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Paste-friendly: $200-300 cleans to the midpoint; saved as decimal pricing.
                </p>
              </div>
              <div className="rounded-[8px] border border-slate-800 bg-slate-900 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Clean Total</div>
                <div className="mt-1 text-xl font-black text-emerald-300">{formatMoneyExact(total)}</div>
                <div className="mt-1 text-[11px] text-slate-500">Includes add-ons below.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Window</Label>
                <Select value={arrivalWindow} onValueChange={setArrivalWindow}>
                  <SelectTrigger className="mt-2 border-slate-700 bg-slate-900 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Afternoon">Afternoon</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="ASAP / text ETA">ASAP / text ETA</SelectItem>
                    <SelectItem value="Customer callback needed">Customer callback needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Mover Count</Label>
                <div className="mt-2"><Stepper value={crewSize} min={1} max={8} onChange={setCrewSize} /></div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Extra Hours</Label>
                <div className="mt-2"><Stepper value={extraHours} min={0} max={8} step={1} onChange={setExtraHours} /></div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatQuantity(selectedPackage.jobHours)} hr package + {formatQuantity(extraHours)} hr added = {confirmedHoursForStorage} hr booked; {formatMoneyExact(extraHoursCharge)} add-on.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-500">Crew</Label>
              <div className="mt-2 grid max-h-40 gap-2 overflow-y-auto rounded-[8px] border border-slate-800 bg-slate-900 p-2">
                {employees.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-slate-500">No employees loaded</div>
                ) : employees.map((employee) => (
                  <label key={employee.id} className="flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
                    <Checkbox checked={crewMembers.includes(employee.id)} onCheckedChange={() => toggleCrew(employee.id)} />
                    <span>{employee.firstName || "Crew"} {employee.lastName || ""}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Label className="text-xs uppercase tracking-wider text-slate-500">Truck</Label>
                <Select value={truck} onValueChange={(value) => setTruck(value as "none" | "15ft" | "26ft")}>
                  <SelectTrigger className="mt-2 border-slate-700 bg-slate-900 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No truck</SelectItem>
                    <SelectItem value="15ft">15 ft - $500</SelectItem>
                    <SelectItem value="26ft">26 ft - $1000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Truck Miles</Label>
                <Input type="number" min={0} value={truckMiles} onChange={(e) => setTruckMiles(Number(e.target.value || 0))} className="mt-2 border-slate-700 bg-slate-900 text-white" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-slate-500">Travel Miles</Label>
                <Input type="number" min={0} value={travelMiles} onChange={(e) => setTravelMiles(Number(e.target.value || 0))} className="mt-2 border-slate-700 bg-slate-900 text-white" />
              </div>
            </div>

            <div className="grid gap-2 rounded-[8px] border border-slate-800 bg-slate-900 p-3">
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <Checkbox checked={blankets} onCheckedChange={(value) => setBlankets(Boolean(value))} />
                We supply blankets - $99
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <Checkbox checked={shrinkwrap} onCheckedChange={(value) => setShrinkwrap(Boolean(value))} />
                We supply shrinkwrap - $99
              </label>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-slate-500">Job Description / Quote Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 min-h-24 border-slate-700 bg-slate-900 text-white" />
            </div>

            <div>
              <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                ETA Prep / Dispatch Notes
              </Label>
              <Textarea
                value={etaPrep}
                onChange={(e) => setEtaPrep(e.target.value)}
                className="mt-2 min-h-20 border-slate-700 bg-slate-900 text-white"
              />
            </div>

            <div className="rounded-[8px] border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-300">Package</span><span className="font-semibold text-white">{formatMoneyExact(cleanBasePrice)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Truck</span><span className="font-semibold text-white">{formatMoneyExact(truckBase + truckOverage)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Mover travel</span><span className="font-semibold text-white">{formatMoneyExact(travel)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Extra hours</span><span className="font-semibold text-white">{formatMoneyExact(extraHoursCharge)}</span></div>
                <div className="flex justify-between"><span className="text-slate-300">Supplies</span><span className="font-semibold text-white">{formatMoneyExact(suppliesCharge)}</span></div>
                <div className="mt-2 flex justify-between border-t border-emerald-400/20 pt-3 text-lg">
                  <span className="font-black text-white">Quote Total</span>
                  <span className="font-black text-emerald-300">{formatMoneyExact(total)}</span>
                </div>
                <div className="text-xs text-emerald-200/70">
                  Truck includes 50 miles, then $5/mile. Extra hours are billed at $50 per mover-hour.
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => convertMutation.mutate({})} disabled={convertMutation.isPending} className="bg-blue-600 hover:bg-blue-500">
                {convertMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Quote & Assign
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => setLocation(`/lead/${lead.id}`)}>
                Open Full Lead
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function OpsBoardPage() {
  const [search, setSearch] = useState("");
  const [service, setService] = useState("all");
  const [view, setView] = useState<"stack" | "month">("stack");
  const [month, setMonth] = useState(() => new Date());
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const { data: employees = [] } = useQuery<User[]>({
    queryKey: ["/api/employees"],
  });

  const activeLeads = useMemo(() => leads.filter((lead) => !lead.archivedAt && lead.status !== "cancelled"), [leads]);
  const serviceOptions = useMemo(() => Array.from(new Set(activeLeads.map((lead) => lead.serviceType).filter(Boolean))).sort(), [activeLeads]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeLeads.filter((lead) => {
      if (service !== "all" && lead.serviceType !== service) return false;
      if (!term) return true;
      return [
        lead.firstName,
        lead.lastName,
        lead.phone,
        lead.email,
        lead.fromAddress,
        formatOrder(lead),
        lead.details,
      ].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [activeLeads, search, service]);

  const quoteStack = filtered.filter((lead) => QUOTE_STACK_STATUSES.has(lead.status) && !isAssigned(lead));
  const assignedJobs = filtered.filter(isAssigned);
  const needsCrew = assignedJobs.filter((lead) => (lead.crewMembers?.length || 0) < (lead.crewSize || 2));
  const monthDays = getMonthDays(month);
  const currentMonthKey = monthKey(month);
  const jobsByDate = assignedJobs.reduce<Record<string, Lead[]>>((acc, lead) => {
    const key = dateOnly(lead.confirmedDate || lead.moveDate);
    if (!key) return acc;
    acc[key] ||= [];
    acc[key].push(lead);
    return acc;
  }, {});

  function openDrawer(lead: Lead) {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }

  function shiftMonth(delta: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            Ops Quote Board
          </div>
          <h1 className="mt-3 text-3xl font-black text-white">Quote Stack & Assigned Jobs</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Turn quote requests into clean job cards, adjust packages in under a minute, and keep the month view honest.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-[420px]">
          <div className="rounded-[8px] border border-orange-500/25 bg-orange-500/10 p-3 text-center">
            <div className="text-2xl font-black text-orange-200">{quoteStack.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-orange-200/70">Need Quote</div>
          </div>
          <div className="rounded-[8px] border border-blue-500/25 bg-blue-500/10 p-3 text-center">
            <div className="text-2xl font-black text-blue-200">{assignedJobs.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-blue-200/70">Assigned</div>
          </div>
          <div className="rounded-[8px] border border-yellow-500/25 bg-yellow-500/10 p-3 text-center">
            <div className="text-2xl font-black text-yellow-200">{needsCrew.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-yellow-200/70">Need Crew</div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 rounded-[8px] border border-slate-800 bg-slate-900/70 p-3 md:grid-cols-[1fr_180px_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, phone, order, city, notes"
            className="pl-9 border-slate-700 bg-slate-950 text-white"
          />
        </div>
        <Select value={service} onValueChange={setService}>
          <SelectTrigger className="border-slate-700 bg-slate-950 text-white">
            <Filter className="mr-2 h-4 w-4 text-slate-500" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All services</SelectItem>
            {serviceOptions.map((option) => (
              <SelectItem key={option} value={option}>{SERVICE_LABELS[option] || option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 rounded-[8px] border border-slate-700 bg-slate-950 p-1">
          <button
            onClick={() => setView("stack")}
            className={`rounded-[6px] px-3 py-2 text-sm font-semibold ${view === "stack" ? "bg-blue-600 text-white" : "text-slate-400"}`}
          >
            Stack
          </button>
          <button
            onClick={() => setView("month")}
            className={`rounded-[6px] px-3 py-2 text-sm font-semibold ${view === "month" ? "bg-blue-600 text-white" : "text-slate-400"}`}
          >
            Month
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-[360px] place-items-center text-slate-400">
          <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-300" />
          Loading jobs
        </div>
      ) : view === "stack" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <Archive className="h-5 w-5 text-orange-300" />
                Quote Stack
              </h2>
              <Badge className="border-orange-400/30 bg-orange-500/15 text-orange-200">{quoteStack.length}</Badge>
            </div>
            <div className="grid gap-3">
              {quoteStack.length === 0 ? (
                <div className="rounded-[8px] border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500">No quote requests in this filter.</div>
              ) : quoteStack.map((lead) => (
                <TradingJobCard key={lead.id} lead={lead} onOpen={openDrawer} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-white">
                <CalendarDays className="h-5 w-5 text-blue-300" />
                Assigned Jobs
              </h2>
              <Badge className="border-blue-400/30 bg-blue-500/15 text-blue-200">{assignedJobs.length}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {assignedJobs.length === 0 ? (
                <div className="rounded-[8px] border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">No assigned jobs in this filter.</div>
              ) : assignedJobs.map((lead) => (
                <TradingJobCard key={lead.id} lead={lead} onOpen={openDrawer} />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-[8px] border border-slate-800 bg-slate-900/70 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-white">
                {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <p className="text-sm text-slate-500">Assigned jobs by confirmed date</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="border-slate-700 text-slate-200" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" className="border-slate-700 text-slate-200" onClick={() => setMonth(new Date())}>Today</Button>
              <Button variant="outline" size="icon" className="border-slate-700 text-slate-200" onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[8px] border border-slate-800 bg-slate-800">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-slate-950 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {day}
              </div>
            ))}
            {monthDays.map((day) => {
              const key = dateOnly(day.toISOString());
              const dayJobs = jobsByDate[key] || [];
              const activeDayJobs = dayJobs.filter((lead) => !isCompletedJob(lead));
              const completedDayJobs = dayJobs.filter(isCompletedJob);
              const muted = monthKey(day) !== currentMonthKey;
              const today = key === dateOnly(new Date().toISOString());
              return (
                <div key={key} className={`min-h-32 bg-slate-950 p-2 ${muted ? "opacity-45" : ""} ${today ? "ring-1 ring-inset ring-blue-400" : ""}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-xs font-bold ${today ? "text-blue-200" : "text-slate-400"}`}>{day.getDate()}</span>
                    {dayJobs.length > 0 && (
                      <span className={`rounded-full px-1.5 text-[10px] ${
                        activeDayJobs.length > 0 ? "bg-blue-500/20 text-blue-200" : "bg-emerald-500/20 text-emerald-200"
                      }`}>
                        {activeDayJobs.length > 0 ? activeDayJobs.length : completedDayJobs.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {activeDayJobs.slice(0, 2).map((lead) => (
                      <TradingJobCard key={lead.id} lead={lead} compact onOpen={openDrawer} />
                    ))}
                    {activeDayJobs.length > 2 && (
                      <div className="rounded-[6px] bg-slate-900 px-2 py-1 text-center text-[10px] text-slate-400">+{activeDayJobs.length - 2} active</div>
                    )}
                    {completedDayJobs.slice(0, activeDayJobs.length > 0 ? 1 : 3).map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => openDrawer(lead)}
                        className="flex w-full items-center gap-1.5 rounded-[6px] border border-emerald-700/30 bg-emerald-950/25 px-2 py-1 text-left text-[10px] text-emerald-200 hover:border-emerald-500/60"
                      >
                        <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{SERVICE_LABELS[lead.serviceType] || lead.serviceType}</span>
                        <MarketplaceShapeBadge serviceCode={lead.serviceType} serviceLabel={SERVICE_LABELS[lead.serviceType]} className="ml-auto text-[8px]" />
                      </button>
                    ))}
                    {completedDayJobs.length > (activeDayJobs.length > 0 ? 1 : 3) && (
                      <div className="rounded-[6px] bg-emerald-950/20 px-2 py-1 text-center text-[10px] text-emerald-300">+{completedDayJobs.length - (activeDayJobs.length > 0 ? 1 : 3)} completed</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {[
          { icon: Package, label: "Package Rules", value: "4 base packages" },
          { icon: Truck, label: "Truck Rate", value: "$500 / $1000 + $5/mi" },
          { icon: MapPin, label: "Mover Travel", value: "$5 per mile" },
          { icon: DollarSign, label: "Extra Hours", value: "$50/mover-hr + $99 supplies" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-[8px] border border-slate-800 bg-slate-900/70 p-3">
            <item.icon className="h-5 w-5 text-blue-300" />
            <div>
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-sm font-bold text-white">{item.value}</div>
            </div>
          </div>
        ))}
      </div>

      <FastQuoteDrawer
        lead={selectedLead}
        employees={employees}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLead(null);
        }}
      />
    </div>
  );
}
