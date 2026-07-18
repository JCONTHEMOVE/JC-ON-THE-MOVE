import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Users, Clock, DollarSign, Truck, Package2, Zap, AlertTriangle,
  CheckCircle2, Star, ShoppingCart, ChevronDown, ChevronUp,
  Wrench, Sofa, Navigation, Info, UserRound, Minus, Plus, MapPin, CalendarDays, Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { calculateLaborBooking, type LaborWorkScope } from "@shared/laborBooking";

interface Pricing {
  ratePerMoverHour: number;
  truckAdd: number;
  shortJobRate: number;
  shortJobFull: number;
  jc222Price: number;
  jc272Price: number;
  jc222Miles: number;
  jc222Minutes: number;
  jc222WeightLimit: number;
  heavyItemFlat: number;
  driveRate: number;
  driveSpeedMph: number;
  junkSmallLow: number;
  junkSmallHigh: number;
  junkLargeLow: number;
  junkLargeHigh: number;
  customItems: { id: string; name: string; value: number }[];
  junkAddons: { id: string; name: string; value: number }[];
  // Specialty item canonical rates
  specialtyPiano: number;
  specialtyHotTub: number;
  specialtySafe: number;
  specialtyPoolTable: number;
  // Weight tiers
  weightLightMax: number;
  weightHeavyMin: number;
  // Access / difficulty add-on rates
  stairsPerFlight: number;
  longCarryFlat: number;
  elevatorFlat: number;
  tightAccessFlat: number;
  // Distance tier thresholds and rates
  localMilesMax: number;
  regionalMilesMax: number;
  regionalSurchargePerMile: number;
  longDistanceRatePerMile: number;
  longDistanceMinMiles: number;
  // Fuel surcharge
  fuelSurchargeFlat: number;
  fuelSurchargeMinMiles: number;
}

interface Lead {
  serviceType: string;
  status?: string;
  fromAddress?: string;
  confirmedFromAddress?: string;
  toAddress?: string;
  confirmedToAddress?: string;
  moveDate?: string;
  confirmedDate?: string;
  phone?: string;
  truckConfig?: string;
  basePrice?: string;
  totalPrice?: string;
  crewSize?: number;
  confirmedHours?: number;
  quoteNotes?: string;
  hasHotTub?: boolean;
  hotTubFee?: string;
  hasHeavySafe?: boolean;
  heavySafeFee?: string;
  hasPoolTable?: boolean;
  poolTableFee?: string;
  hasPiano?: boolean;
  pianoFee?: string;
}

interface OrderPackage {
  id: string;
  movers: number;
  hours: number;
  label: string;
  tag?: string;
  isPromo?: boolean;
  promoKey?: string;
  durationMinutes?: number;
  isHeavyItem?: boolean;
  heavyTier?: "light" | "heavy";
  isJc222?: boolean;
}

interface AddonOption {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  qtyOptions: number[];
  category?: string;
  openPrice?: boolean;
}

interface LineItem {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface OrderSummary {
  laborTotal: number;
  addonsTotal: number;
  grandTotal: number;
  crewSize: number;
  confirmedHours: number;
  lineItems: LineItem[];
  packageLabel: string;
  tokenEstimate: number;
  crewBumpReason?: string;
}

// Hour-based discount tiers
const HOUR_TIERS = [
  { minHours: 7, pct: 20 },
  { minHours: 5, pct: 15 },
  { minHours: 3, pct: 10 },
];

function getHourDiscount(hours: number): number {
  return HOUR_TIERS.find(t => hours >= t.minHours)?.pct ?? 0;
}

interface JobOrderBuilderProps {
  lead: Lead;
  leadId?: string;
  disabled?: boolean;
  onApply: (summary: {
    basePrice: string;
    totalPrice: string;
    crewSize: number;
    quoteNotes: string;
    confirmedHours: number;
    hasHotTub: boolean;
    hotTubFee: string;
    hasHeavySafe: boolean;
    heavySafeFee: string;
    hasPoolTable: boolean;
    poolTableFee: string;
    hasPiano: boolean;
    pianoFee: string;
    totalSpecialItemsFee: string;
    lineItems: LineItem[];
    zoneSnapshot?: Record<string, unknown>;
  }) => void;
}

const MOVING_PACKAGES: OrderPackage[] = [
  { id: "moving_jc222", movers: 2, hours: 2, label: "JC222 — Local (≤10 mi)", tag: "Promo", isPromo: true, promoKey: "jc222", durationMinutes: 82 },
  { id: "moving_jc272", movers: 2, hours: 2, label: "JC272 — Outside 10 mi",  tag: "Promo", isPromo: true, promoKey: "jc272", durationMinutes: 82 },
  { id: "moving_heavy_light", movers: 3, hours: 2, label: "Heavy Item (≤500 lbs)", tag: "Specialty", isHeavyItem: true, heavyTier: "light" as const },
  { id: "moving_heavy_oversized", movers: 3, hours: 2, label: "Oversized Item (500+ lbs)", tag: "Specialty", isHeavyItem: true, heavyTier: "heavy" as const },
  { id: "moving_2m_2h", movers: 2, hours: 2, label: "2 Movers × 2 hrs",  tag: "Quick Job"      },
  { id: "moving_2m_3h", movers: 2, hours: 3, label: "2 Movers × 3 hrs",  tag: "10% Off"        },
  { id: "moving_3m_3h", movers: 3, hours: 3, label: "3 Movers × 3 hrs",  tag: "Most Popular"   },
  { id: "moving_2m_4h", movers: 2, hours: 4, label: "2 Movers × 4 hrs"                         },
  { id: "moving_3m_4h", movers: 3, hours: 4, label: "3 Movers × 4 hrs"                         },
  { id: "moving_4m_3h", movers: 4, hours: 3, label: "4 Movers × 3 hrs",  tag: "10% Off"        },
  { id: "moving_4m_4h", movers: 4, hours: 4, label: "4 Movers × 4 hrs",  tag: "Heavy Move"     },
  { id: "moving_2m_5h", movers: 2, hours: 5, label: "2 Movers × 5 hrs",  tag: "15% Off"        },
  { id: "moving_3m_5h", movers: 3, hours: 5, label: "3 Movers × 5 hrs",  tag: "15% Off"        },
  { id: "moving_2m_7h", movers: 2, hours: 7, label: "2 Movers × 7 hrs",  tag: "20% Off · Best" },
  { id: "moving_3m_7h", movers: 3, hours: 7, label: "3 Movers × 7 hrs",  tag: "20% Off"        },
];

const MOVING_ADDONS: AddonOption[] = [
  { id: "mattress_bag",    name: "Mattress Bag(s)",                description: "Protect mattresses during transport",             unitPrice: 20, category: "supplies", qtyOptions: [1, 2, 3, 4] },
  { id: "wardrobe_boxes",  name: "Wardrobe Boxes",                 description: "Keep clothes on hangers during move",             unitPrice: 25, category: "supplies", qtyOptions: [1, 2, 3, 4] },
  { id: "packing_supplies",name: "Packing Tape & Supplies",        description: "Tape, wrap, and moving blankets",                 unitPrice: 40, category: "supplies", qtyOptions: [1] },
  { id: "long_carry",      name: "Long Carry (>75 ft)",            description: "Extra charge when distance exceeds 75 ft",        unitPrice: 50, category: "access",   qtyOptions: [1] },
  { id: "stairs",          name: "Stairs / Flights",               description: "+$25 per additional floor above ground",          unitPrice: 25, category: "access",   qtyOptions: [1, 2, 3, 4] },
  { id: "elevator",        name: "Elevator Fee",                   description: "Building elevator usage/waiting time",            unitPrice: 30, category: "access",   qtyOptions: [1] },
  { id: "tight_access",   name: "Tight Access / Narrow Stairwell", description: "Flat surcharge for difficult access situations",  unitPrice: 50, category: "access",   qtyOptions: [1] },
  { id: "assembly",        name: "Furniture Assembly/Disassembly", description: "First 2 items included; beds, desks, and large furniture", unitPrice: 75, category: "labor", qtyOptions: [1] },
  { id: "appliance_connect",name: "Appliance Connection",          description: "Washer, dryer, fridge water line hookup",         unitPrice: 50, category: "labor",    qtyOptions: [1] },
];

const MOVING_SPECIAL_ITEMS = [
  { id: "hot_tub",    name: "Hot Tub (500+ lbs)",              description: "Specialty rigging required — oversized surcharge",          baseFee: 600, key: "hasHotTub"    as const, feeKey: "hotTubFee"    as const, pricingKey: "specialtyHotTub"    as const, crewMin: 3 },
  { id: "piano",      name: "Piano (≤500 lbs)",                description: "Upright piano move — standard heavy item surcharge",        baseFee: 400, key: "hasPiano"     as const, feeKey: "pianoFee"     as const, pricingKey: "specialtyPiano"     as const, crewMin: 3 },
  { id: "heavy_safe", name: "Heavy Safe (300+ lbs, ≤500 lbs)",description: "Gun safe or floor safe — standard heavy item surcharge",     baseFee: 400, key: "hasHeavySafe" as const, feeKey: "heavySafeFee" as const, pricingKey: "specialtySafe"      as const, crewMin: 3 },
  { id: "pool_table", name: "Pool Table (≤500 lbs)",           description: "Disassemble, move, and reassemble — standard surcharge",     baseFee: 400, key: "hasPoolTable" as const, feeKey: "poolTableFee" as const, pricingKey: "specialtyPoolTable" as const, crewMin: 2 },
];

const JUNK_PACKAGES = [
  { id: "junk_single_item", label: "Single Item",     desc: "1–2 large items · up to $300 for pickup truck load", low: 100, high: 200,  tag: "Quick" },
  { id: "junk_quarter",     label: "¼ Truck Load",    desc: "Small cleanout",                                     low: 300, high: 500 },
  { id: "junk_half",        label: "½ Truck Load",    desc: "One room / garage cleanout",                         low: 500, high: 800,  tag: "Popular" },
  { id: "junk_full",        label: "Full Truck Load", desc: "Large enclosed trailer · 1 driver + 2 helpers",      low: 1000, high: 0,   tag: "Best Value" },
];

const JUNK_ADDONS = [
  { id: "appliance_recycle", name: "Appliance Recycling Fee",     description: "Proper disposal of fridges, ACs, TVs",         unitPrice: 75,  openPrice: false, qtyOptions: [1, 2, 3] },
  { id: "hazmat",            name: "Hazardous Surcharge",         description: "Paint, batteries, chemicals — quoted on site",  unitPrice: 300, openPrice: true,  qtyOptions: [1] },
  { id: "extra_labor",       name: "Extra Labor Hour",            description: "$70/hr per mover · applies when job has stairs", unitPrice: 70,  openPrice: false, qtyOptions: [1, 2] },
  { id: "dumpster_bag",      name: "Cleanout Dumpster Bag",       description: "Handles up to 2,000 lbs",                      unitPrice: 400, openPrice: false, qtyOptions: [1, 2] },
  { id: "teardown",          name: "Light Demolition / Teardown", description: "Starting price · haul away billed separately",  unitPrice: 500, openPrice: true,  qtyOptions: [1] },
];

const EARN_RATE = 15; // JCMOVES per $1

function PackageCard({ pkg, selected, pricing, onSelect }: {
  pkg: typeof MOVING_PACKAGES[0];
  selected: boolean;
  pricing: Pricing;
  onSelect: () => void;
}) {
  const isPromo = (pkg as any).isPromo === true;
  const isHeavyItem = (pkg as any).isHeavyItem === true;
  const heavyTier = (pkg as any).heavyTier as "light" | "heavy" | undefined;

  let displayPrice: number;
  let savings = 0;
  let floored = 0;

  if (isPromo) {
    displayPrice = (pkg as any).promoKey === "jc272" ? pricing.jc272Price : pricing.jc222Price;
  } else if (isHeavyItem) {
    displayPrice = heavyTier === "heavy" ? 600 : 400;
  } else {
    const base = pkg.movers * pkg.hours * pricing.ratePerMoverHour;
    floored = base < pricing.shortJobFull ? pricing.shortJobFull : base;
    const discountPct = getHourDiscount(pkg.hours);
    displayPrice = discountPct > 0 ? Math.round(floored * (1 - discountPct / 100)) : floored;
    savings = floored - displayPrice;
  }

  const discountPct = (!isPromo && !isHeavyItem) ? getHourDiscount(pkg.hours) : 0;
  const durationMinutes = (pkg as any).durationMinutes as number | undefined;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3 transition-all",
        selected
          ? isPromo
            ? "border-amber-500 bg-amber-950/30 ring-1 ring-amber-500/40"
            : isHeavyItem
            ? "border-orange-500 bg-orange-950/30 ring-1 ring-orange-500/40"
            : "border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/40"
          : isPromo
          ? "border-amber-500/40 bg-amber-950/10 hover:border-amber-500/60"
          : isHeavyItem
          ? "border-orange-500/30 bg-orange-950/10 hover:border-orange-500/50"
          : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-white">{pkg.label}</span>
            {discountPct > 0 && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 border bg-green-600/20 text-green-400 border-green-500/30">
                {discountPct}% Off
              </Badge>
            )}
            {isPromo && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 border bg-amber-600/30 text-amber-300 border-amber-500/40">
                Promo
              </Badge>
            )}
            {isHeavyItem && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 border bg-orange-600/30 text-orange-300 border-orange-500/40">
                Specialty
              </Badge>
            )}
            {!discountPct && !isPromo && !isHeavyItem && pkg.tag && (
              <Badge className={cn(
                "text-[10px] px-1.5 py-0 h-4 border",
                pkg.tag === "Most Popular" ? "bg-teal-600/30 text-teal-300 border-teal-500/40" :
                "bg-slate-700/50 text-slate-400 border-slate-600/40"
              )}>
                {pkg.tag}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{pkg.movers} movers</span>
            {durationMinutes ? (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />1 hr 22 min</span>
            ) : (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pkg.hours} hrs{isHeavyItem ? " min" : ""}</span>
            )}
          </div>
          {savings > 0 && (
            <p className="text-[11px] text-green-400/80 mt-0.5">Save ${savings}</p>
          )}
          {isPromo && (
            <p className="text-[11px] text-amber-400/80 mt-0.5">Flat rate · no formula · screening required</p>
          )}
          {isHeavyItem && (
            <p className="text-[11px] text-orange-400/80 mt-0.5">3 movers · 2 hr minimum · flat floor</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {savings > 0 && (
            <p className="text-slate-500 line-through text-xs">${floored}</p>
          )}
          <p className={cn("font-bold text-base", isPromo ? "text-amber-400" : isHeavyItem ? "text-orange-400" : "text-emerald-400")}>
            ${displayPrice.toLocaleString()}
          </p>
        </div>
      </div>
      {selected && (
        <div className="mt-2 flex justify-end">
          <CheckCircle2 className="h-4 w-4 text-blue-400" />
        </div>
      )}
    </button>
  );
}

function JunkPackageCard({ pkg, selected, onSelect }: {
  pkg: typeof JUNK_PACKAGES[0];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border-2 p-3 transition-all",
        selected
          ? "border-blue-500 bg-blue-950/40 ring-1 ring-blue-500/40"
          : "border-slate-700/50 bg-slate-800/40 hover:border-slate-600"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{pkg.label}</span>
            {pkg.tag && (
              <Badge className="text-[10px] px-1.5 py-0 h-4 bg-teal-600/30 text-teal-300 border border-teal-500/40">
                {pkg.tag}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{pkg.desc}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-slate-500">
            {pkg.high > 0 ? `$${pkg.low.toLocaleString()}–$${pkg.high.toLocaleString()}` : `$${pkg.low.toLocaleString()}+`}
          </p>
        </div>
      </div>
      {selected && <div className="mt-2 flex justify-end"><CheckCircle2 className="h-4 w-4 text-blue-400" /></div>}
    </button>
  );
}

type ZoneQuotePreview = {
  matched: boolean;
  moveDate?: string | null;
  dayName?: string | null;
  dayOfWeek?: number | null;
  quote: {
    labor: number;
    booking?: { billableHours: number; laborTotal: number; zoneMultiplier: number; longBookingDiscountPct: number } | null;
    travel: number;
    subtotal: number;
    zone: { id: number; code: string; name: string } | null;
    rate: { hourlyRate: number; minimumHours: number; discountAfterHours: number | null; discountedHourlyRate: number | null } | null;
  };
};

function zipFromAddress(address: string | undefined): string | null {
  return address?.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? null;
}

function MovingQuoteBuilder({ lead, disabled, onApply }: JobOrderBuilderProps) {
  const { data: pricing, isLoading: pricingLoading } = useQuery<Pricing>({ queryKey: ["/api/pricing"] });
  const [selectedCrew, setSelectedCrew] = useState(() => Math.min(4, Math.max(2, lead.crewSize || 2)));
  const [hours, setHours] = useState(() => Math.max(1, lead.confirmedHours || 1));
  const [workScope, setWorkScope] = useState<LaborWorkScope>("load_unload");
  const [truckIncluded, setTruckIncluded] = useState(() => lead.truckConfig === "company_truck" || lead.truckConfig === "customer_truck");
  const [travelMiles, setTravelMiles] = useState("");
  const [showExtras, setShowExtras] = useState(false);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [specialItems, setSpecialItems] = useState({
    hasHotTub: !!lead.hasHotTub,
    hasPiano: !!lead.hasPiano,
    hasHeavySafe: !!lead.hasHeavySafe,
    hasPoolTable: !!lead.hasPoolTable,
  });

  const moveDate = lead.confirmedDate || lead.moveDate || "";
  const pickupAddress = lead.confirmedFromAddress || lead.fromAddress || "";
  const zip = useMemo(() => zipFromAddress(pickupAddress), [pickupAddress]);
  const specialtyCrewMinimum = MOVING_SPECIAL_ITEMS.reduce((minimum, item) =>
    specialItems[item.key] ? Math.max(minimum, item.crewMin) : minimum,
  2);
  const effectiveCrew = Math.max(selectedCrew, specialtyCrewMinimum);
  const hasOversizedItems = specialItems.hasHotTub || specialItems.hasPiano || specialItems.hasHeavySafe;

  const zoneQuote = useQuery<ZoneQuotePreview>({
    queryKey: ["/api/marketplace/quote-preview", zip, moveDate, effectiveCrew, hours, workScope, hasOversizedItems, travelMiles],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/marketplace/quote-preview", {
        zip,
        moveDate,
        serviceCode: "load_unload",
        crewSize: effectiveCrew,
        hours,
        workScope,
        oversized: hasOversizedItems,
        distanceMiles: Number(travelMiles || 0),
      });
      return response.json();
    },
    enabled: !!zip && !!moveDate,
    staleTime: 0,
  });

  const summary = useMemo(() => {
    if (!pricing) return null;
    const fallbackBooking = calculateLaborBooking({
      crewSize: effectiveCrew,
      hours,
      workScope,
      oversized: hasOversizedItems,
    });
    const fallbackLabor = fallbackBooking.laborTotal;
    const fallbackTravel = travelMiles
      ? Math.round((Number(travelMiles) / Math.max(pricing.driveSpeedMph, 1)) * pricing.driveRate)
      : 0;
    const zonePricing = zoneQuote.data?.matched ? zoneQuote.data.quote : null;
    const laborTotal = zonePricing ? Number(zonePricing.labor) : fallbackLabor;
    const travelTotal = zonePricing ? Number(zonePricing.travel) : fallbackTravel;
    const lineItems: LineItem[] = [{
      id: "moving_labor",
      name: `Moving labor - ${effectiveCrew} movers x ${hours} hrs${zonePricing ? ` (${zonePricing.zone?.name || "zone rate"})` : ""}`,
      qty: 1,
      unitPrice: laborTotal,
      total: laborTotal,
      category: "labor",
    }];

    if (travelTotal > 0) {
      lineItems.push({ id: "travel", name: "Travel", qty: 1, unitPrice: travelTotal, total: travelTotal, category: "travel" });
    }

    if (truckIncluded) {
      const truckTotal = pricing.truckAdd * hours;
      lineItems.push({ id: "truck", name: "Truck included", qty: hours, unitPrice: pricing.truckAdd, total: truckTotal, category: "truck" });
    }

    for (const addon of MOVING_ADDONS) {
      const qty = addonQty[addon.id] || 0;
      if (!qty) continue;
      const unitPrice = addon.id === "stairs" ? pricing.stairsPerFlight
        : addon.id === "long_carry" ? pricing.longCarryFlat
        : addon.id === "elevator" ? pricing.elevatorFlat
        : addon.id === "tight_access" ? pricing.tightAccessFlat
        : addon.unitPrice;
      lineItems.push({ id: addon.id, name: addon.name, qty, unitPrice, total: unitPrice * qty, category: addon.category || "addon" });
    }

    for (const item of MOVING_SPECIAL_ITEMS) {
      if (!specialItems[item.key]) continue;
      const unitPrice = pricing[item.pricingKey] || item.baseFee;
      lineItems.push({ id: item.id, name: `${item.name} surcharge`, qty: 1, unitPrice, total: unitPrice, category: "specialty" });
    }

    const basePrice = lineItems.filter((item) => item.category !== "specialty").reduce((total, item) => total + item.total, 0);
    const grandTotal = lineItems.reduce((total, item) => total + item.total, 0);
    const specialFee = grandTotal - basePrice;
    return { basePrice, grandTotal, specialFee, laborTotal, lineItems, zonePricing, fallbackBooking };
  }, [addonQty, effectiveCrew, hasOversizedItems, hours, pricing, specialItems, travelMiles, truckIncluded, workScope, zoneQuote.data]);

  if (pricingLoading) {
    return <Card className="border-slate-700/50 bg-slate-900/60"><CardContent className="py-8 text-center text-sm text-slate-400">Loading quote settings...</CardContent></Card>;
  }
  if (!pricing || !summary) return null;

  const selectedSpecialFee = (key: keyof typeof specialItems, pricingKey: keyof Pricing, fallback: number) =>
    specialItems[key] ? Number(pricing[pricingKey] || fallback) : 0;
  const zoneStatus = zoneQuote.isFetching
    ? "Checking zone rate..."
    : summary.zonePricing
      ? `${summary.zonePricing.zone?.name || "Matched zone"} - ${zoneQuote.data?.dayName || "scheduled day"}`
      : moveDate
        ? "Global moving rate"
        : "Set a move date to use the zone rate";

  return (
    <Card className="border-blue-500/30 bg-slate-900/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white"><ShoppingCart className="h-5 w-5 text-blue-400" />Build Moving Quote</CardTitle>
        <CardDescription>Choose the crew, set the hours, and save the live total.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <section className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 text-slate-300"><Users className="h-4 w-4 text-blue-400" /><span className="truncate">{lead.fromAddress || "Pickup address not set"}</span></div>
          <div className="flex min-w-0 items-center gap-2 text-slate-300"><CalendarDays className="h-4 w-4 text-blue-400" /><span className="truncate">{moveDate || "Move date not set"}</span></div>
          {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-blue-300 hover:text-blue-200"><Phone className="h-4 w-4" />{lead.phone}</a>}
          <div className="flex min-w-0 items-center gap-2 text-slate-400"><MapPin className="h-4 w-4" /><span className="truncate">{zoneStatus}</span></div>
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Crew</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[2, 3, 4].map((crew) => (
              <button
                key={crew}
                type="button"
                aria-pressed={selectedCrew === crew}
                onClick={() => setSelectedCrew(crew)}
                className={cn(
                  "min-h-20 border px-2 py-3 text-center transition-colors",
                  selectedCrew === crew ? "border-blue-400 bg-blue-500/15 text-white" : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500",
                )}
              >
                <span className="flex justify-center gap-0.5 text-blue-300">{Array.from({ length: crew }, (_, index) => <UserRound key={index} className="h-4 w-4" />)}</span>
                <span className="mt-2 block text-xs font-semibold">{crew} movers</span>
              </button>
            ))}
          </div>
          {effectiveCrew > selectedCrew && <p className="mt-2 text-xs text-amber-300">Specialty items require {effectiveCrew} movers for this quote.</p>}
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Work scope</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ["load_only", "Load only"],
              ["unload_only", "Unload only"],
              ["load_unload", "Load + unload"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={workScope === value} onClick={() => setWorkScope(value)} className={cn("rounded-md border px-2 py-2 text-xs font-medium", workScope === value ? "border-blue-400 bg-blue-500/15 text-white" : "border-slate-700 bg-slate-950/50 text-slate-300 hover:border-slate-500")}>
                {label}
              </button>
            ))}
          </div>
          {workScope === "load_unload" && <p className="mt-2 text-xs text-amber-200">Two work phases: the booked labor hours are doubled automatically.</p>}
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hours</Label>
          <div className="mt-2 flex items-center gap-3">
            <Button type="button" size="icon" variant="outline" onClick={() => setHours((value) => Math.max(1, value - 1))} disabled={hours <= 1}><Minus className="h-4 w-4" /></Button>
            <div className="w-20 text-center"><p className="text-2xl font-bold text-white">{hours}</p><p className="text-xs text-slate-400">hours</p></div>
            <Button type="button" size="icon" variant="outline" onClick={() => setHours((value) => value + 1)}><Plus className="h-4 w-4" /></Button>
            <p className="text-xs text-slate-500">1-hour quick booking</p>
          </div>
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300"><Checkbox checked={truckIncluded} onCheckedChange={(value) => setTruckIncluded(!!value)} />Truck included</label>
            <span className="text-xs text-slate-500">${pricing.truckAdd}/hr</span>
          </div>
          <div className="mt-3">
            <Label className="text-xs text-slate-400">One-way miles outside the zone</Label>
            <Input type="number" min="0" step="1" value={travelMiles} onChange={(event) => setTravelMiles(event.target.value)} placeholder="0" className="mt-1 bg-slate-950 border-slate-700 text-white" />
          </div>
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <Button type="button" variant="ghost" className="h-auto w-full justify-between px-0 text-sm text-slate-300 hover:bg-transparent" onClick={() => setShowExtras((value) => !value)}>
            Optional adjustments {showExtras ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {showExtras && (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {MOVING_ADDONS.map((addon) => {
                  const selected = !!addonQty[addon.id];
                  return <label key={addon.id} className="flex items-start gap-2 text-sm text-slate-300"><Checkbox checked={selected} onCheckedChange={(value) => setAddonQty((current) => ({ ...current, [addon.id]: value ? 1 : 0 }))} /><span>{addon.name} <span className="text-emerald-400">+${addon.unitPrice}</span></span></label>;
                })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {MOVING_SPECIAL_ITEMS.map((item) => <label key={item.id} className="flex items-start gap-2 text-sm text-slate-300"><Checkbox checked={specialItems[item.key]} onCheckedChange={(value) => setSpecialItems((current) => ({ ...current, [item.key]: !!value }))} /><span>{item.name} <span className="text-amber-300">+${pricing[item.pricingKey] || item.baseFee}</span></span></label>)}
              </div>
            </div>
          )}
        </section>

        <section className="border-t border-slate-700/60 pt-4">
          <div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">Quote total</p><p className="mt-1 text-xs text-slate-400">{effectiveCrew} movers x {zoneQuote.data?.quote.booking?.billableHours ?? summary.fallbackBooking.billableHours} labor hrs{summary.zonePricing ? ` - ${zoneQuote.data?.dayName}` : summary.fallbackBooking.discountedHours ? ` - ${summary.fallbackBooking.longBookingDiscountPct}% after 4 hrs` : ""}</p></div><p className="text-3xl font-bold text-emerald-400">${summary.grandTotal.toFixed(2)}</p></div>
          <div className="mt-3 space-y-1 text-xs text-slate-400">{summary.lineItems.map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{item.name}{item.qty > 1 ? ` x ${item.qty}` : ""}</span><span className="shrink-0">${item.total.toFixed(2)}</span></div>)}</div>
        </section>

        <Button
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-500"
          disabled={disabled}
          onClick={() => onApply({
            basePrice: summary.basePrice.toFixed(2),
            totalPrice: summary.grandTotal.toFixed(2),
            crewSize: effectiveCrew,
            confirmedHours: zoneQuote.data?.quote.booking?.billableHours ?? summary.fallbackBooking.billableHours,
            quoteNotes: `Moving labor: ${effectiveCrew} movers x ${zoneQuote.data?.quote.booking?.billableHours ?? summary.fallbackBooking.billableHours} billable hours (${workScope.replace("_", " + ")}). ${summary.zonePricing ? `${summary.zonePricing.zone?.name || "Zone"} multiplier and travel applied.` : "Standard labor menu applied."}`,
            hasHotTub: specialItems.hasHotTub,
            hotTubFee: selectedSpecialFee("hasHotTub", "specialtyHotTub", 600).toFixed(2),
            hasHeavySafe: specialItems.hasHeavySafe,
            heavySafeFee: selectedSpecialFee("hasHeavySafe", "specialtySafe", 400).toFixed(2),
            hasPoolTable: specialItems.hasPoolTable,
            poolTableFee: selectedSpecialFee("hasPoolTable", "specialtyPoolTable", 400).toFixed(2),
            hasPiano: specialItems.hasPiano,
            pianoFee: selectedSpecialFee("hasPiano", "specialtyPiano", 400).toFixed(2),
            totalSpecialItemsFee: summary.specialFee.toFixed(2),
            lineItems: summary.lineItems,
            zoneSnapshot: {
              source: summary.zonePricing ? "marketplace_zone_pricing" : "global_fallback",
              serviceCode: "load_unload",
              moveDate: moveDate || null,
              dayOfWeek: zoneQuote.data?.dayOfWeek ?? null,
              preview: zoneQuote.data ?? null,
            },
          })}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />Apply quote
        </Button>
      </CardContent>
    </Card>
  );
}

export function JobOrderBuilder(props: JobOrderBuilderProps) {
  const isMoving = !["junk", "junk_removal"].includes(props.lead.serviceType?.toLowerCase() ?? "");
  return isMoving ? <MovingQuoteBuilder {...props} /> : <LegacyJobOrderBuilder {...props} />;
}

function LegacyJobOrderBuilder({ lead, leadId, disabled, onApply }: JobOrderBuilderProps) {
  const isMoving = !["junk", "junk_removal"].includes(lead.serviceType?.toLowerCase() ?? "");
  const isJunk = !isMoving;

  const { data: pricing, isLoading: pricingLoading } = useQuery<Pricing>({
    queryKey: ["/api/pricing"],
  });

  const { data: catalogDefs } = useQuery<{
    movingPackages: typeof MOVING_PACKAGES;
    junkPackages: typeof JUNK_PACKAGES;
    movingAddons: typeof MOVING_ADDONS;
    junkAddons: typeof JUNK_ADDONS;
    specialItems: typeof MOVING_SPECIAL_ITEMS;
  }>({ queryKey: ["/api/pricing/catalog-definitions"] });

  const movingPackages = catalogDefs?.movingPackages ?? MOVING_PACKAGES;
  const junkPackages = catalogDefs?.junkPackages ?? JUNK_PACKAGES;
  const movingAddons = catalogDefs?.movingAddons ?? MOVING_ADDONS;
  const junkAddons = catalogDefs?.junkAddons ?? JUNK_ADDONS;
  const specialItemsDefs = catalogDefs?.specialItems ?? MOVING_SPECIAL_ITEMS;

  const [selectedPkg, setSelectedPkg] = useState<number | null>(null);
  const [selectedJunkPkg, setSelectedJunkPkg] = useState<number | null>(null);
  const [junkCustomPrice, setJunkCustomPrice] = useState("");

  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [specialItems, setSpecialItems] = useState<Record<string, boolean>>({
    hasHotTub: lead.hasHotTub ?? false,
    hasPiano: lead.hasPiano ?? false,
    hasHeavySafe: lead.hasHeavySafe ?? false,
    hasPoolTable: lead.hasPoolTable ?? false,
  });
  const [specialFees, setSpecialFees] = useState<Record<string, number>>({
    hotTubFee: parseFloat(lead.hotTubFee ?? "0") || 250,
    pianoFee: parseFloat(lead.pianoFee ?? "0") || 200,
    heavySafeFee: parseFloat(lead.heavySafeFee ?? "0") || 175,
    poolTableFee: parseFloat(lead.poolTableFee ?? "0") || 200,
  });

  const [promoScreening, setPromoScreening] = useState({ weightOk: false, timeOk: false });

  // Crew override: null = auto, otherwise staff-overridden minimum
  const [crewOverride, setCrewOverride] = useState<number | null>(null);
  const [crewOverrideConfirmed, setCrewOverrideConfirmed] = useState(false);

  const [driveMiles, setDriveMiles] = useState<string>("");
  const [driveAutoCalc, setDriveAutoCalc] = useState(false);
  const [truckIncluded, setTruckIncluded] = useState(false);

  const [quoteNotes, setQuoteNotes] = useState(lead.quoteNotes ?? "");
  const [showAddons, setShowAddons] = useState(true);

  const pickupAddr = lead.confirmedFromAddress || lead.fromAddress;
  const dropoffAddr = lead.confirmedToAddress || lead.toAddress;

  // Sync special fees from pricing config when pricing loads
  useEffect(() => {
    if (!pricing) return;
    setSpecialFees(prev => ({
      hotTubFee:    parseFloat(lead.hotTubFee    ?? "0") || pricing.specialtyHotTub    || prev.hotTubFee,
      pianoFee:     parseFloat(lead.pianoFee     ?? "0") || pricing.specialtyPiano     || prev.pianoFee,
      heavySafeFee: parseFloat(lead.heavySafeFee ?? "0") || pricing.specialtySafe      || prev.heavySafeFee,
      poolTableFee: parseFloat(lead.poolTableFee ?? "0") || pricing.specialtyPoolTable || prev.poolTableFee,
    }));
  }, [pricing]);

  useEffect(() => {
    if (!pickupAddr || driveMiles) return;
    const params = new URLSearchParams({ pickup: pickupAddr });
    if (dropoffAddr) params.set("dropoff", dropoffAddr);
    fetch(`/api/utility/estimate-drive-miles?${params}`)
      .then(r => r.json())
      .then((data: { miles?: number; route?: string }) => {
        if (data.miles && data.miles > 0) {
          setDriveMiles(String(data.miles));
          setDriveAutoCalc(true);
        }
      })
      .catch(() => {});
  }, [pickupAddr, dropoffAddr]);

  useEffect(() => {
    if (pricing && !selectedPkg && !selectedJunkPkg) {
      if (isMoving && lead.crewSize && lead.basePrice) {
        const hours = Math.round(parseFloat(lead.basePrice) / (pricing.ratePerMoverHour * (lead.crewSize ?? 2)));
        const idx = movingPackages.findIndex(p => p.movers === lead.crewSize && p.hours === hours);
        if (idx >= 0) setSelectedPkg(idx);
      }
    }
  }, [pricing, lead.crewSize, lead.basePrice, isMoving, movingPackages]);

  // Compute crew auto-minimum based on specialty items and stairs (truck jobs)
  const autoCrewMinimum = useMemo(() => {
    if (!pricing) return { min: 2, reason: null as string | null };
    const reasons: string[] = [];
    let min = 2;

    if (specialItems.hasPiano) { min = Math.max(min, 3); reasons.push("Piano requires 3-mover minimum"); }
    if (specialItems.hasHotTub) { min = Math.max(min, 3); reasons.push("Hot Tub requires 3-mover minimum"); }
    if (specialItems.hasHeavySafe) { min = Math.max(min, 3); reasons.push("Heavy Safe requires 3-mover minimum"); }

    const stairsQty = addonQty["stairs"] ?? 0;
    if (truckIncluded && stairsQty > 0) {
      min = Math.max(min, 3);
      reasons.push("Stairs on truck job bumps crew +1 (min 3)");
    }

    return { min, reason: reasons.length > 0 ? reasons.join("; ") : null };
  }, [specialItems, addonQty, truckIncluded, pricing]);

  // Determine effective crew for selected package (respects override with confirmation)
  const effectiveCrewMin = crewOverrideConfirmed && crewOverride !== null
    ? crewOverride
    : autoCrewMinimum.min;

  const driveLineItem = useMemo((): LineItem[] => {
    const miles = parseFloat(driveMiles);
    if (!miles || miles <= 0 || !pricing) return [];
    const items: LineItem[] = [];
    const crewSize = selectedPkg !== null ? Math.max(movingPackages[selectedPkg]?.movers ?? 2, effectiveCrewMin) : effectiveCrewMin;

    // Distance tier classification
    const isRegional = miles > pricing.localMilesMax && miles <= pricing.regionalMilesMax;
    const isLongDistance = miles > pricing.regionalMilesMax;

    if (isLongDistance) {
      // Long distance: per-mile flat rate, 100-mile minimum
      const billedMiles = Math.max(Math.ceil(miles), pricing.longDistanceMinMiles);
      const fee = Math.round(billedMiles * pricing.longDistanceRatePerMile);
      items.push({
        id: "long_distance_travel",
        name: `Long Distance — ${billedMiles} mi billed @ $${pricing.longDistanceRatePerMile}/mi`,
        qty: 1,
        unitPrice: fee,
        total: fee,
        category: "drive",
      });
    } else {
      // Local / regional: drive time rate
      const driveRate = pricing.driveRate || 40;
      const roundTripMiles = miles * 2;
      const driveHours = Math.ceil(roundTripMiles / (pricing.driveSpeedMph || 45) * 2) / 2;
      const fee = Math.round(driveHours * crewSize * driveRate);
      const tierLabel = isRegional ? "Regional Drive Time" : "Drive Time";
      items.push({
        id: "drive_time",
        name: `${tierLabel} — ${miles} mi × 2 ÷ ${pricing.driveSpeedMph || 45}mph × ${crewSize} movers @ $${driveRate}/hr`,
        qty: 1,
        unitPrice: fee,
        total: fee,
        category: "drive",
      });

      if (isRegional && pricing.regionalSurchargePerMile > 0) {
        const regionalFee = Math.round(miles * pricing.regionalSurchargePerMile);
        items.push({
          id: "regional_surcharge",
          name: `Regional travel surcharge — ${miles} mi @ $${pricing.regionalSurchargePerMile}/mi`,
          qty: 1,
          unitPrice: regionalFee,
          total: regionalFee,
          category: "drive",
        });
      }
    }

    // Fuel surcharge
    if (pricing.fuelSurchargeFlat > 0 && miles >= pricing.fuelSurchargeMinMiles) {
      items.push({
        id: "fuel_surcharge",
        name: `Fuel surcharge — ${miles} mi trip`,
        qty: 1,
        unitPrice: pricing.fuelSurchargeFlat,
        total: pricing.fuelSurchargeFlat,
        category: "drive",
      });
    }

    return items;
  }, [driveMiles, pricing, selectedPkg, effectiveCrewMin, movingPackages]);

  const truckLineItem = useMemo((): LineItem | null => {
    if (!truckIncluded || !pricing || selectedPkg === null) return null;
    const pkg = movingPackages[selectedPkg];
    if (!pkg) return null;
    const hours = pkg.hours;
    const fee = Math.round(pricing.truckAdd * hours);
    return {
      id: "drive_truck",
      name: `Truck — ${hours} hrs @ $${pricing.truckAdd}/hr`,
      qty: 1,
      unitPrice: fee,
      total: fee,
      category: "truck",
    };
  }, [truckIncluded, pricing, selectedPkg, movingPackages]);

  // Build add-on line items with pricing-config-driven unit prices
  const addonLineItems = useMemo((): LineItem[] => {
    if (!pricing) return [];
    const items: LineItem[] = [];
    const activeAddons = isMoving ? movingAddons : junkAddons;

    activeAddons.forEach(addon => {
      const qty = addonQty[addon.id] ?? 0;
      if (qty <= 0) return;

      // Override unit price from pricing config for access add-ons
      let unitPrice = addon.unitPrice;
      if (addon.id === "stairs")       unitPrice = pricing.stairsPerFlight   ?? unitPrice;
      if (addon.id === "long_carry")   unitPrice = pricing.longCarryFlat     ?? unitPrice;
      if (addon.id === "elevator")     unitPrice = pricing.elevatorFlat      ?? unitPrice;
      if (addon.id === "tight_access") unitPrice = pricing.tightAccessFlat   ?? unitPrice;

      // Build descriptive name for access add-ons
      let name = addon.name;
      if (addon.id === "stairs" && qty > 1) name = `Stairs · ${qty} flights`;
      if (addon.id === "stairs" && qty === 1) name = `Stairs · 1 flight`;

      items.push({
        id: addon.id,
        name,
        qty,
        unitPrice,
        total: unitPrice * qty,
        category: "category" in addon ? addon.category ?? "addon" : "addon",
      });
    });

    return items;
  }, [addonQty, pricing, isMoving, movingAddons, junkAddons]);

  const summary = useMemo((): OrderSummary | null => {
    if (!pricing) return null;

    const lineItems: LineItem[] = [];

    if (isMoving) {
      if (selectedPkg === null) return null;
      const pkg = movingPackages[selectedPkg];

      // Enforce crew minimum
      const effectiveMovers = Math.max(pkg.movers, effectiveCrewMin);
      const crewBumpReason = effectiveMovers > pkg.movers ? autoCrewMinimum.reason ?? undefined : undefined;

      let laborTotal: number;
      let laborLabel: string;

      if (pkg.isPromo || pkg.isJc222) {
        const promoPrice = pkg.promoKey === "jc272" ? pricing.jc272Price : pricing.jc222Price;
        laborTotal = promoPrice;
        laborLabel = `${pkg.label} — Flat Rate Promo`;
      } else if (pkg.isHeavyItem) {
        const heavyTierLabel = (pkg as any).heavyTier === "heavy" ? "Oversized (500+ lbs)" : "Heavy (≤500 lbs)";
        const baseHeavyPrice = (pkg as any).heavyTier === "heavy" ? 600 : 400;
        laborTotal = baseHeavyPrice;
        laborLabel = `Specialty Item — ${heavyTierLabel} · 3 Movers × 2 hrs minimum`;
      } else {
        const base = effectiveMovers * pkg.hours * pricing.ratePerMoverHour;
        const floored = base < pricing.shortJobFull ? pricing.shortJobFull : base;
        const discountPct = getHourDiscount(pkg.hours);
        laborTotal = discountPct > 0 ? Math.round(floored * (1 - discountPct / 100)) : floored;
        laborLabel = discountPct > 0
          ? `Labor — ${effectiveMovers} Movers × ${pkg.hours} hrs (${discountPct}% off)`
          : `Labor — ${effectiveMovers} Movers × ${pkg.hours} hrs @ $${pricing.ratePerMoverHour}/mover/hr`;
      }

      lineItems.push({
        id: pkg.id,
        name: laborLabel,
        qty: 1,
        unitPrice: laborTotal,
        total: laborTotal,
        category: "labor",
      });

      if (truckLineItem) lineItems.push(truckLineItem);
      driveLineItem.forEach(li => lineItems.push(li));

      addonLineItems.forEach(li => lineItems.push(li));

      // Apply 40% crew-on-site discount when specialty items are added to an already-booked/active crew job.
      // Crew discount only applies when the lead is already confirmed (booked/available/in_progress)
      // AND the selected package is a regular crew package (not standalone heavy item).
      const CREW_ACTIVE_STATUSES = ["booked", "available", "in_progress"];
      const leadIsAlreadyBooked = CREW_ACTIVE_STATUSES.includes(lead?.status ?? "");
      const isRegularCrewPkg = !pkg.isHeavyItem;
      const applyCrewDiscount = leadIsAlreadyBooked && isRegularCrewPkg;
      specialItemsDefs.forEach(item => {
        if (specialItems[item.key]) {
          const baseFee =
            specialFees[item.feeKey] ??
            (pricing[item.pricingKey as keyof Pricing] as number | undefined) ??
            item.baseFee;
          const fee = applyCrewDiscount ? Math.round(baseFee * 0.6) : baseFee;
          const crewNote = item.crewMin >= 3 ? " · 3-mover min" : item.crewMin === 2 ? " · 2-mover min" : "";
          const discountNote = applyCrewDiscount ? " (40% crew discount)" : "";
          lineItems.push({
            id: item.id,
            name: `${item.name} surcharge${crewNote}${discountNote}`,
            qty: 1,
            unitPrice: fee,
            total: fee,
            category: "specialty",
          });
        }
      });

      const grandTotal = lineItems.reduce((s, i) => s + i.total, 0);
      const addonsTotal = grandTotal - laborTotal;

      return {
        laborTotal,
        addonsTotal,
        grandTotal,
        crewSize: effectiveMovers,
        confirmedHours: pkg.hours,
        lineItems,
        packageLabel: pkg.label,
        tokenEstimate: Math.round(grandTotal * EARN_RATE),
        crewBumpReason,
      };
    }

    if (isJunk) {
      let laborTotal = 0;
      let packageLabel = "Junk Removal";
      if (selectedJunkPkg !== null) {
        const pkg = junkPackages[selectedJunkPkg];
        laborTotal = parseFloat(junkCustomPrice) || Math.round((pkg.low + pkg.high) / 2);
        packageLabel = pkg.label;
        lineItems.push({
          id: pkg.id,
          name: `Junk Removal — ${pkg.label}`,
          qty: 1,
          unitPrice: laborTotal,
          total: laborTotal,
          category: "labor",
        });
      } else if (junkCustomPrice) {
        laborTotal = parseFloat(junkCustomPrice) || 0;
        lineItems.push({
          id: "junk_custom",
          name: "Junk Removal — Custom",
          qty: 1,
          unitPrice: laborTotal,
          total: laborTotal,
          category: "labor",
        });
      } else {
        return null;
      }

      driveLineItem.forEach(li => lineItems.push(li));

      addonLineItems.forEach(li => lineItems.push(li));

      const grandTotal = lineItems.reduce((s, i) => s + i.total, 0);
      const addonsTotal = grandTotal - laborTotal;

      return {
        laborTotal,
        addonsTotal,
        grandTotal,
        crewSize: 2,
        confirmedHours: 2,
        lineItems,
        packageLabel,
        tokenEstimate: Math.round(grandTotal * EARN_RATE),
      };
    }

    return null;
  }, [pricing, selectedPkg, selectedJunkPkg, addonQty, specialItems, specialFees, junkCustomPrice,
      isMoving, isJunk, driveLineItem, truckLineItem, addonLineItems, movingPackages, junkPackages,
      specialItemsDefs, effectiveCrewMin, autoCrewMinimum]);

  const handleApply = async () => {
    if (!summary) return;

    // Compute specialty item fees with the same 40% crew discount logic used in summary line items.
    // Discount only applies for already-booked/active leads with a regular crew package.
    const activePkg = selectedPkg !== null ? movingPackages[selectedPkg] : null;
    const CREW_ACTIVE_STATUSES_APPLY = ["booked", "available", "in_progress"];
    const leadIsAlreadyBookedApply = CREW_ACTIVE_STATUSES_APPLY.includes(lead?.status ?? "");
    const applyCrewDiscountApply = leadIsAlreadyBookedApply && !activePkg?.isHeavyItem;

    const specialItemsFee = specialItemsDefs.reduce((acc, item) => {
      if (!specialItems[item.key]) return acc;
      const baseFee = specialFees[item.feeKey] ?? item.baseFee;
      const discountedFee = applyCrewDiscountApply ? Math.round(baseFee * 0.6) : baseFee;
      return acc + discountedFee;
    }, 0);

    // Per-item fees with discount applied for storage
    const hotTubBaseApply = specialFees.hotTubFee ?? MOVING_SPECIAL_ITEMS.find(i => i.id === "hot_tub")!.baseFee;
    const pianoBaseApply = specialFees.pianoFee ?? MOVING_SPECIAL_ITEMS.find(i => i.id === "piano")!.baseFee;
    const heavySafeBaseApply = specialFees.heavySafeFee ?? MOVING_SPECIAL_ITEMS.find(i => i.id === "heavy_safe")!.baseFee;
    const poolTableBaseApply = specialFees.poolTableFee ?? MOVING_SPECIAL_ITEMS.find(i => i.id === "pool_table")!.baseFee;

    const applyDiscount = (fee: number) => applyCrewDiscountApply ? Math.round(fee * 0.6) : fee;

    const orderNotes = [
      quoteNotes,
      "",
      "=== ORDER SUMMARY ===",
      ...summary.lineItems.map(li => `• ${li.name} × ${li.qty} = $${li.total.toFixed(2)}`),
      `TOTAL: $${summary.grandTotal.toFixed(2)}`,
      `Token Reward Est.: ${summary.tokenEstimate.toLocaleString()} JCMOVES`,
    ].filter(Boolean).join("\n");

    onApply({
      basePrice: summary.laborTotal.toFixed(2),
      totalPrice: summary.grandTotal.toFixed(2),
      crewSize: summary.crewSize,
      confirmedHours: summary.confirmedHours,
      quoteNotes: orderNotes,
      hasHotTub: specialItems.hasHotTub ?? false,
      hotTubFee: applyDiscount(hotTubBaseApply).toFixed(2),
      hasHeavySafe: specialItems.hasHeavySafe ?? false,
      heavySafeFee: applyDiscount(heavySafeBaseApply).toFixed(2),
      hasPoolTable: specialItems.hasPoolTable ?? false,
      poolTableFee: applyDiscount(poolTableBaseApply).toFixed(2),
      hasPiano: specialItems.hasPiano ?? false,
      pianoFee: applyDiscount(pianoBaseApply).toFixed(2),
      totalSpecialItemsFee: specialItemsFee.toFixed(2),
      lineItems: summary.lineItems,
    });

    // Immediately create a Square Order (non-blocking, best-effort)
    if (leadId) {
      try {
        await fetch(`/api/square/create-order/${leadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineItems: summary.lineItems }),
          credentials: "include",
        });
      } catch (_) {
        // Non-fatal: order totals already saved to lead locally
      }
    }
  };

  if (pricingLoading) {
    return (
      <Card className="border-slate-700/50 bg-slate-900/60">
        <CardContent className="pt-6 text-center text-slate-400 text-sm py-8">
          Loading pricing data…
        </CardContent>
      </Card>
    );
  }

  if (!pricing) return null;

  const activeAddons = isMoving ? movingAddons : junkAddons;

  // Detect crew bump situation
  const selectedPkgMovers = selectedPkg !== null ? movingPackages[selectedPkg]?.movers ?? 2 : 2;
  const hasCrwBump = isMoving && autoCrewMinimum.min > selectedPkgMovers && selectedPkg !== null;

  return (
    <Card className="border-blue-500/30 bg-gradient-to-br from-slate-900/80 to-slate-800/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-white">
          <ShoppingCart className="h-5 w-5 text-blue-400" />
          Build Your Order
        </CardTitle>
        <CardDescription>
          {isMoving ? "Select a crew package and add any services" : "Choose a load size and add-ons"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Step 1: Package Selection ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" /> Step 1: Choose Package
          </p>

          {isMoving && (
            <>
              {/* Hour-based discount tiers */}
              <div className="mb-3 flex gap-1.5">
                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                  <p className="text-green-400 font-black text-xs">10% Off</p>
                  <p className="text-slate-500 text-[10px]">3+ hrs</p>
                </div>
                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                  <p className="text-green-400 font-black text-xs">15% Off</p>
                  <p className="text-slate-500 text-[10px]">5+ hrs</p>
                </div>
                <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-center">
                  <p className="text-green-400 font-black text-xs">20% Off</p>
                  <p className="text-slate-500 text-[10px]">7+ hrs</p>
                </div>
              </div>
              <div className="space-y-2">
                {movingPackages.map((pkg, i) => (
                  <PackageCard
                    key={i}
                    pkg={pkg}
                    selected={selectedPkg === i}
                    pricing={pricing}
                    onSelect={() => {
                      setSelectedPkg(i);
                      setCrewOverride(null);
                      setCrewOverrideConfirmed(false);
                      if (!(pkg as any).isPromo) {
                        setPromoScreening({ weightOk: false, timeOk: false });
                      }
                    }}
                  />
                ))}
              </div>

              {/* Promo Screening Checklist */}
              {selectedPkg !== null && (movingPackages[selectedPkg] as any)?.isPromo && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Promo Screening — Staff Must Confirm
                  </p>
                  <div className="space-y-2">
                    <div
                      className="flex items-start gap-2.5 cursor-pointer"
                      onClick={() => setPromoScreening(s => ({ ...s, weightOk: !s.weightOk }))}
                    >
                      <Checkbox
                        checked={promoScreening.weightOk}
                        onCheckedChange={v => setPromoScreening(s => ({ ...s, weightOk: !!v }))}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <span className="text-sm text-slate-200">
                        Item is under <span className="font-bold text-amber-300">{pricing.jc222WeightLimit} lbs</span> — light item confirmed
                      </span>
                    </div>
                    <div
                      className="flex items-start gap-2.5 cursor-pointer"
                      onClick={() => setPromoScreening(s => ({ ...s, timeOk: !s.timeOk }))}
                    >
                      <Checkbox
                        checked={promoScreening.timeOk}
                        onCheckedChange={v => setPromoScreening(s => ({ ...s, timeOk: !!v }))}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <span className="text-sm text-slate-200">
                        Total time (drive there + drive back + work) fits in <span className="font-bold text-amber-300">{pricing.jc222Minutes} min</span>
                      </span>
                    </div>
                  </div>
                  {(!promoScreening.weightOk || !promoScreening.timeOk) && (
                    <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-2.5 mt-1">
                      <p className="text-xs text-red-300 font-semibold flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" /> Promo not yet qualified
                      </p>
                      <p className="text-[11px] text-slate-400 mb-2">
                        Both boxes must be checked for the promo price to apply. If the job doesn't qualify, select one of these alternatives:
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <button
                          className="text-left text-xs bg-slate-800/60 border border-slate-600/50 rounded-lg px-2.5 py-1.5 text-slate-300 hover:border-slate-500"
                          onClick={() => {
                            const stdIdx = movingPackages.findIndex(p => p.id === "moving_2m_2h");
                            if (stdIdx >= 0) { setSelectedPkg(stdIdx); setPromoScreening({ weightOk: false, timeOk: false }); }
                          }}
                        >
                          Switch to standard 2 movers × 2 hrs (${Math.max(2 * 2 * pricing.ratePerMoverHour, pricing.shortJobFull)})
                        </button>
                        <button
                          className="text-left text-xs bg-orange-950/30 border border-orange-500/30 rounded-lg px-2.5 py-1.5 text-orange-300 hover:border-orange-500/50"
                          onClick={() => {
                            const heavyIdx = movingPackages.findIndex(p => (p as any).isHeavyItem);
                            if (heavyIdx >= 0) { setSelectedPkg(heavyIdx); setPromoScreening({ weightOk: false, timeOk: false }); }
                          }}
                        >
                          Switch to Heavy Item flat rate — 3 movers, 2 hrs min, ${pricing.heavyItemFlat}+
                        </button>
                      </div>
                    </div>
                  )}
                  {promoScreening.weightOk && promoScreening.timeOk && (
                    <div className="rounded-lg border border-green-500/40 bg-green-950/20 p-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                      <p className="text-xs text-green-300 font-semibold">Promo qualified — flat rate applies</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-600 mt-2 text-center">
                Prices calculated at ${pricing.ratePerMoverHour}/mover·hr · ${pricing.shortJobFull} min job floor
              </p>
            </>
          )}

          {isJunk && (
            <div className="space-y-2">
              {junkPackages.map((pkg, i) => (
                <JunkPackageCard
                  key={i}
                  pkg={pkg}
                  selected={selectedJunkPkg === i}
                  onSelect={() => { setSelectedJunkPkg(i); setJunkCustomPrice(""); }}
                />
              ))}
              <div className="mt-2">
                <Label className="text-xs text-slate-400">Or enter custom price</Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    type="number"
                    step="5"
                    min="0"
                    placeholder="e.g. 350"
                    className="pl-9 bg-slate-800 border-slate-600 text-white"
                    value={junkCustomPrice}
                    onChange={(e) => { setJunkCustomPrice(e.target.value); setSelectedJunkPkg(null); }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Crew Auto-Minimum Notice ── */}
        {isMoving && hasCrwBump && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">Crew minimum bumped to {autoCrewMinimum.min} movers</p>
                <p className="text-xs text-amber-400/70 mt-0.5">{autoCrewMinimum.reason}</p>
              </div>
            </div>
            {!crewOverrideConfirmed ? (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/40 h-7 px-3"
                  onClick={() => {
                    if (confirm(`Override crew minimum from ${autoCrewMinimum.min} to ${selectedPkgMovers}? This overrides the safety minimum for specialty/heavy items. This will be noted.\n\nContinue with ${selectedPkgMovers} movers?`)) {
                      setCrewOverride(selectedPkgMovers);
                      setCrewOverrideConfirmed(true);
                    }
                  }}
                >
                  Override to {selectedPkgMovers} movers
                </Button>
                <span className="text-[10px] text-slate-500 self-center">Quote will use {autoCrewMinimum.min} movers</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-400">Override active — using {crewOverride} movers</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-slate-500 h-6 px-2 ml-auto hover:text-amber-400"
                  onClick={() => { setCrewOverride(null); setCrewOverrideConfirmed(false); }}
                >
                  Undo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Truck Toggle (moving only) ── */}
        {isMoving && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 px-3 py-2.5">
            <Checkbox
              id="truck-included"
              checked={truckIncluded}
              onCheckedChange={(v) => setTruckIncluded(!!v)}
              className="border-slate-600 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
            />
            <label htmlFor="truck-included" className="flex-1 text-sm text-slate-300 cursor-pointer select-none flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-400" />
              Truck included
              {truckLineItem && (
                <span className="ml-auto text-emerald-400 font-bold text-sm">+${truckLineItem.total}</span>
              )}
            </label>
            {pricing && (
              <span className="text-[10px] text-slate-500">${pricing.truckAdd}/hr</span>
            )}
          </div>
        )}

        <Separator className="bg-slate-700/50" />

        {/* ── Drive Time ── */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Navigation className="h-3.5 w-3.5 text-blue-400" /> Drive Time (optional)
            {driveAutoCalc && driveMiles && (
              <span className="ml-1 text-[10px] bg-blue-950/60 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded">
                auto-estimated
              </span>
            )}
          </p>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="One-way miles from Ironwood, MI"
                className="bg-slate-800 border-slate-600 text-white pr-12"
                value={driveMiles}
                onChange={e => { setDriveMiles(e.target.value); setDriveAutoCalc(false); }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">mi</span>
            </div>
            {driveLineItem.length > 0 && (
              <div className="flex-shrink-0 text-right">
                <p className="text-emerald-400 font-bold text-sm">${driveLineItem.reduce((s, li) => s + li.total, 0)}</p>
                <p className="text-slate-500 text-[10px]">travel fee</p>
              </div>
            )}
          </div>
          {/* Distance tier label */}
          {driveMiles && parseFloat(driveMiles) > 0 && (
            <p className="text-[11px] mt-1">
              {parseFloat(driveMiles) <= pricing.localMilesMax ? (
                <span className="text-green-400/70">Local rate (≤{pricing.localMilesMax} mi) — no surcharge</span>
              ) : parseFloat(driveMiles) <= pricing.regionalMilesMax ? (
                <span className="text-amber-400/70">Regional ({pricing.localMilesMax}–{pricing.regionalMilesMax} mi) — surcharge applies</span>
              ) : (
                <span className="text-red-400/70">Long Distance ({'>'}  {pricing.regionalMilesMax} mi) — per-mile rate, {pricing.longDistanceMinMiles}-mi minimum billing</span>
              )}
            </p>
          )}
          {!driveMiles && pickupAddr && (
            <p className="text-[11px] text-slate-600 mt-1">Estimating from: {pickupAddr}</p>
          )}
        </div>

        <Separator className="bg-slate-700/50" />

        {/* ── Step 2: Add-Ons ── */}
        <div>
          <button
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5"
            onClick={() => setShowAddons(!showAddons)}
          >
            <span className="flex items-center gap-1.5">
              <Package2 className="h-3.5 w-3.5" /> Step 2: Add Services & Supplies
            </span>
            {showAddons ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAddons && (
            <div className="space-y-2">
              {activeAddons.map(addon => {
                const qty = addonQty[addon.id] ?? 0;
                const checked = qty > 0;

                // Get pricing-config-driven unit price for display
                let displayPrice = addon.unitPrice;
                if (addon.id === "stairs")       displayPrice = pricing.stairsPerFlight   ?? displayPrice;
                if (addon.id === "long_carry")   displayPrice = pricing.longCarryFlat     ?? displayPrice;
                if (addon.id === "elevator")     displayPrice = pricing.elevatorFlat      ?? displayPrice;
                if (addon.id === "tight_access") displayPrice = pricing.tightAccessFlat   ?? displayPrice;

                return (
                  <div
                    key={addon.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      checked
                        ? "border-blue-500/40 bg-blue-950/20"
                        : "border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/60"
                    )}
                    onClick={() => setAddonQty(prev => ({ ...prev, [addon.id]: checked ? 0 : 1 }))}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => setAddonQty(prev => ({ ...prev, [addon.id]: v ? 1 : 0 }))}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm font-medium", checked ? "text-white" : "text-slate-300")}>
                          {addon.name}
                        </span>
                        <span className="text-emerald-400 text-sm font-semibold flex-shrink-0">
                          +${displayPrice}{'openPrice' in addon && addon.openPrice ? "+" : ""}{addon.qtyOptions.length > 1 && qty > 0 ? ` × ${qty}` : ""}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{addon.description}</p>
                    </div>
                    {checked && addon.qtyOptions.length > 1 && (
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="w-6 h-6 rounded bg-slate-700 text-white text-xs hover:bg-slate-600"
                          onClick={() => setAddonQty(prev => ({ ...prev, [addon.id]: Math.max(1, (prev[addon.id] ?? 1) - 1) }))}
                        >-</button>
                        <span className="text-sm text-white w-4 text-center">{qty}</span>
                        <button
                          className="w-6 h-6 rounded bg-slate-700 text-white text-xs hover:bg-slate-600"
                          onClick={() => setAddonQty(prev => ({ ...prev, [addon.id]: Math.min(addon.qtyOptions[addon.qtyOptions.length - 1], (prev[addon.id] ?? 1) + 1) }))}
                        >+</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Step 3: Special/Heavy Items (Moving only) ── */}
        {isMoving && (
          <>
            <Separator className="bg-slate-700/50" />
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Specialty / Heavy Items
              </p>
              <div className="space-y-2">
                {specialItemsDefs.map(item => {
                  const checked = specialItems[item.key] ?? false;
                  // Use canonical pricing from config
                  const canonicalFee = pricing[(item as any).pricingKey as keyof Pricing] as number ?? item.baseFee;
                  const crewNote = (item as any).crewMin >= 3
                    ? "· enforces 3-mover minimum"
                    : (item as any).crewMin === 2
                    ? "· 2-mover minimum"
                    : "";
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                        checked
                          ? "border-amber-500/40 bg-amber-950/20"
                          : "border-slate-700/40 bg-slate-800/30 hover:bg-slate-800/60"
                      )}
                      onClick={() => setSpecialItems(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setSpecialItems(prev => ({ ...prev, [item.key]: !!v }))}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("text-sm font-medium", checked ? "text-white" : "text-slate-300")}>
                            {item.name}
                          </span>
                          <span className="text-amber-400 text-sm font-semibold flex-shrink-0">
                            +${specialFees[item.feeKey] ?? canonicalFee}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.description} {crewNote && <span className="text-amber-500/70">{crewNote}</span>}</p>
                      </div>
                      {checked && (
                        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                          <Input
                            type="number"
                            min="0"
                            step="25"
                            className="w-20 h-7 text-xs bg-slate-700 border-slate-600 text-white"
                            value={specialFees[item.feeKey] ?? canonicalFee}
                            onChange={(e) => setSpecialFees(prev => ({ ...prev, [item.feeKey]: parseFloat(e.target.value) || 0 }))}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Separator className="bg-slate-700/50" />

        {/* ── Quote Notes ── */}
        <div>
          <Label className="text-xs text-slate-400 uppercase tracking-wide">Quote Notes</Label>
          <Textarea
            rows={3}
            placeholder="Add job-specific notes, arrival instructions, access codes, etc."
            className="mt-1.5 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm resize-none"
            value={quoteNotes}
            onChange={(e) => setQuoteNotes(e.target.value)}
          />
        </div>

        {/* ── Running Total ── */}
        {summary && (
          <div className="rounded-xl border border-slate-600/50 bg-slate-800/50 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-700/50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Order Summary</span>
              <Badge className="bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[10px]">
                {summary.lineItems.length} item{summary.lineItems.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {summary.crewBumpReason && (
              <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-500/20 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-[11px] text-amber-400">{summary.crewBumpReason} — crew adjusted to {summary.crewSize}</span>
              </div>
            )}
            <div className="px-4 py-3 space-y-1.5">
              {summary.lineItems.map(li => (
                <div key={li.id} className="flex justify-between text-sm">
                  <span className="text-slate-300">
                    {li.name}{li.qty > 1 && ` × ${li.qty}`}
                  </span>
                  <span className="text-slate-200 font-medium">${li.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-600/50 space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Labor subtotal</span>
                <span>${summary.laborTotal.toFixed(2)}</span>
              </div>
              {summary.addonsTotal > 0 && (
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Add-ons & surcharges</span>
                  <span>+${summary.addonsTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-600/50">
                <span className="text-white">Total</span>
                <span className="text-emerald-400">${summary.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-amber-400/80 mt-1">
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" />Customer earns</span>
                <span>~{summary.tokenEstimate.toLocaleString()} JCMOVES</span>
              </div>
            </div>
          </div>
        )}

        {!summary && (
          <div className="p-4 rounded-xl border border-dashed border-slate-600/50 text-center text-slate-500 text-sm">
            Select a package above to see your order total
          </div>
        )}

        <Button
          onClick={handleApply}
          disabled={!summary || disabled}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          size="lg"
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Apply Order to Job
        </Button>
      </CardContent>
    </Card>
  );
}
