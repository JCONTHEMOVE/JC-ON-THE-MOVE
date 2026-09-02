import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShopSwitcher } from "@/components/shop-switcher";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AdminPricingEditor } from "@/components/AdminPricingEditor";
import {
  IRONWOOD_DAILY_DISCOUNT,
  ROUTE_DAY_DISCOUNT,
  ROUTE_DAY_SCHEDULE,
  ROUTE_DAY_SERVICE_TAGS,
  SERVICE_ADDRESS_DISCOUNT_NOTE,
  ROUTE_DAY_PROMO_PACKAGES,
  routeDayLandingHref,
} from "@shared/routeDays";
import {
  Truck, Users, Clock, DollarSign, CheckCircle, Star,
  ChevronRight, ArrowLeft, Phone, Zap, Shield, Award,
  Package, Layers, Wrench, Sparkles, Calculator, ChevronDown, ChevronUp,
  Settings, Save, Plus, Trash2, Pencil, X, Check,
  Bitcoin, CalendarCheck, AlertCircle, ChevronsUp,
} from "lucide-react";

// ─── Static data ──────────────────────────────────────────────────────────────

const CREW_META: Record<number, { best: string; fits: string[]; popular?: boolean }> = {
  1: { best: "Small apartment / single items", fits: ["Studio / Single room", "Furniture only", "Appliance moves"] },
  2: { best: "1–2 Bedroom apartments", fits: ["1–2 BR apartments", "Furniture rearranging", "U-Haul load / unload"] },
  3: { best: "2–3 Bedroom homes", fits: ["2–3 BR homes", "Medium-sized moves", "Full house packs"], popular: true },
  4: { best: "3–4 Bedroom homes", fits: ["3–4 BR homes", "Large furniture", "Tight timelines"] },
  5: { best: "Large estates / commercial", fits: ["4+ BR homes", "Office moves", "Same-day large moves"] },
};

interface ServiceAddon {
  id: string;
  label: string;
  price: number;
  unit: string;
}

const REVIEWS = [
  { name: "Sarah M.", rating: 5, text: "Fast, careful, and professional. They wrapped every piece of furniture and got us moved in under 3 hours!", location: "Ironwood, MI" },
  { name: "James R.", rating: 5, text: "Best moving crew I've ever hired. On time, hard working, and the price was exactly what they quoted.", location: "Hurley, WI" },
  { name: "Linda K.", rating: 5, text: "Used JC ON THE MOVE twice now. They never disappoint. Highly recommend the 3-mover crew.", location: "Bessemer, MI" },
  { name: "Marcus T.", rating: 5, text: "Moved a full 3BR house in 4 hours. Worth every penny. Will use them again for sure.", location: "Ashland, WI" },
];

const HOME_TYPES = [
  { label: "Studio / 1BR",  crew: 2 },
  { label: "2 Bedroom",     crew: 3 },
  { label: "3 Bedroom",     crew: 3 },
  { label: "4 Bedroom",     crew: 4 },
  { label: "5+ Bedroom",    crew: 5 },
  { label: "Office Move",   crew: 4 },
];

// ─── Job time rubric ──────────────────────────────────────────────────────────
const JOB_TIME: Record<string, { base: number; stairs: number; label: string }> = {
  small:  { base: 1, stairs: 1, label: "Small Truck (box / cargo van)" },
  medium: { base: 2, stairs: 1, label: "Medium Truck (16–20 ft)" },
  large:  { base: 3, stairs: 1, label: "Large Truck (24–26 ft)" },
};

// Minimum crew recommended per truck size
const TRUCK_MIN_CREW: Record<string, number> = { small: 1, medium: 2, large: 3 };

// ─── Default pricing (fallback before API loads) ──────────────────────────────
const DEFAULT_PRICING = {
  ratePerMoverHour: 60,
  truckAdd: 60,
  minHours: { 1: 5, 2: 4, 3: 3, 4: 2, 5: 2 } as Record<number, number>,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricingConfig {
  ratePerMoverHour: number;
  truckAdd: number;
  minHours: Record<number, number>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ServicesPage() {
  const { hasAdminAccess } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [serviceType, setServiceType]   = useState<"labor" | "truck">("labor");
  const [selectedCrew, setSelectedCrew] = useState<number | null>(null);
  const [addOns, setAddOns]             = useState<Record<string, boolean>>({});
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Job time estimator
  const [truckSize, setTruckSize]         = useState<"small" | "medium" | "large" | null>(null);
  const [serviceMode, setServiceMode]     = useState<"load" | "unload" | "both">("both");
  const [loadStairs, setLoadStairs]       = useState(false);
  const [unloadStairs, setUnloadStairs]   = useState(false);

  // Admin add-on editing state
  const [addonEditId, setAddonEditId]   = useState<string | null>(null);
  const [addonDraft, setAddonDraft]     = useState<Partial<ServiceAddon>>({});
  const [newLabel, setNewLabel]         = useState("");
  const [newPrice, setNewPrice]         = useState("");
  const [newUnit, setNewUnit]           = useState("flat");
  const [showAddForm, setShowAddForm]   = useState(false);

  const toggleAddOn = (id: string) =>
    setAddOns(prev => ({ ...prev, [id]: !prev[id] }));

  const { data: pricing = DEFAULT_PRICING } = useQuery<PricingConfig>({
    queryKey: ["/api/pricing"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: serviceAddons = [] } = useQuery<ServiceAddon[]>({
    queryKey: ["/api/pricing/addons"],
    staleTime: 1000 * 60 * 5,
  });

  const saveAddonsMutation = useMutation({
    mutationFn: async (items: ServiceAddon[]) => {
      const res = await apiRequest("PUT", "/api/admin/pricing/addons", { items });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/addons"] });
      toast({ title: "✅ Add-ons saved!" });
      setAddonEditId(null);
      setShowAddForm(false);
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  function saveAddon(id: string) {
    const updated = serviceAddons.map(a =>
      a.id === id ? { ...a, ...addonDraft, price: Number(addonDraft.price ?? a.price) } : a
    );
    saveAddonsMutation.mutate(updated);
  }

  function deleteAddon(id: string) {
    const updated = serviceAddons.filter(a => a.id !== id);
    saveAddonsMutation.mutate(updated);
    setAddOns(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function addAddon() {
    const label = newLabel.trim();
    const price = parseFloat(newPrice);
    if (!label || isNaN(price)) return;
    const updated = [...serviceAddons, { id: Date.now().toString(), label, price, unit: newUnit }];
    saveAddonsMutation.mutate(updated);
    setNewLabel(""); setNewPrice(""); setNewUnit("flat");
  }

  const hourlyRate = useMemo(() => {
    if (!selectedCrew) return 0;
    const base = selectedCrew * pricing.ratePerMoverHour;
    return base + (serviceType === "truck" ? pricing.truckAdd : 0);
  }, [selectedCrew, serviceType, pricing]);

  const minHours = useMemo(() => {
    if (!selectedCrew) return 2;
    return serviceType === "truck"
      ? Math.max((pricing.minHours[selectedCrew] ?? 2), 3)
      : (pricing.minHours[selectedCrew] ?? 2);
  }, [selectedCrew, serviceType, pricing]);

  const addOnTotal = useMemo(
    () => serviceAddons.filter(a => addOns[a.id]).reduce((s, a) => s + a.price, 0),
    [addOns, serviceAddons]
  );

  const estLow  = selectedCrew ? hourlyRate * minHours + addOnTotal : 0;
  const estHigh = selectedCrew ? hourlyRate * (minHours + 2) + addOnTotal : 0;

  const bookUrl = selectedCrew
    ? `/book?mode=builder&service=moving&step=configure&crew=${selectedCrew}&type=${serviceType}`
    : `/book?mode=builder&service=moving`;

  // ── Job time & crew recommendation ──────────────────────────────────────
  const estimatedJobHours = useMemo(() => {
    if (!truckSize) return null;
    const { base, stairs } = JOB_TIME[truckSize];
    let hrs = 0;
    if (serviceMode === "load" || serviceMode === "both")
      hrs += base + (loadStairs ? stairs : 0);
    if (serviceMode === "unload" || serviceMode === "both")
      hrs += base + (unloadStairs ? stairs : 0);
    return hrs;
  }, [truckSize, serviceMode, loadStairs, unloadStairs]);

  const recommendedCrew = useMemo(() => {
    if (!truckSize) return null;
    let base = TRUCK_MIN_CREW[truckSize];
    const stairCount = (loadStairs ? 1 : 0) + (unloadStairs ? 1 : 0);
    base += stairCount;
    return Math.min(base, 5) as number;
  }, [truckSize, loadStairs, unloadStairs]);

  // Travel waiver: if estimated job hours ≥ minimum booking hours, waive travel
  const travelWaived = useMemo(() => {
    if (!estimatedJobHours || !selectedCrew) return false;
    return estimatedJobHours >= minHours;
  }, [estimatedJobHours, selectedCrew, minHours]);

  // ── Book Now handler ─────────────────────────────────────────────────────
  function handleBookNow() {
    if (!selectedCrew) return;
    toast({
      title: "Crew details added",
      description: "Continue in booking so we can confirm timing, address, photos, truck needs, and final price.",
    });
    navigate(bookUrl);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white pb-28">
      <ShopSwitcher />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-slate-950 to-orange-900/20 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 pt-8 pb-12 relative">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white mb-6 -ml-1">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
            </Button>
          </Link>

          <div className="text-center mb-8">
            <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-4 text-xs font-semibold px-3 py-1">
              Licensed - Insured - 5-Star Rated
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-3 leading-tight">
              Book Your <span className="text-blue-400">Moving Crew</span>
            </h1>
            <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
              Pick your crew size, choose your services, and get an instant price estimate - no hidden fees.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-base shadow-lg shadow-orange-500/25 border-0"
                onClick={() => document.getElementById('crew-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Users className="h-5 w-5 mr-2" /> Choose Your Crew
              </Button>
              <Link href="/moving-estimator">
                <Button size="lg" variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white font-bold text-base">
                  <Calculator className="h-5 w-5 mr-2" /> Use Cost Calculator
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-slate-400">
              {[
                { icon: Shield, text: "Licensed & Insured" },
                { icon: Clock,  text: "On-Time Guarantee" },
                { icon: Star,   text: "5-Star Avg Rating" },
                { icon: Zap,    text: "Same-Day Available" },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-blue-400" /> {text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 space-y-10">

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Route-day scheduling</p>
              <h2 className="mt-2 text-2xl font-black text-white">Preferred town days, flexible crew availability.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                We try to stack work by area to reduce repeat drive time: moving, junk removal, handyman, light demo, flooring, painting, roofing, and more. If a route day has no requested jobs, we can accept other jobs. Customers in any nearby area can still request a quote and we will check the schedule.
              </p>
              <p className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100">
                {ROUTE_DAY_DISCOUNT} {IRONWOOD_DAILY_DISCOUNT} {SERVICE_ADDRESS_DISCOUNT_NOTE}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm text-slate-200 md:min-w-[190px]">
              <p className="font-black text-white">Crew capacity</p>
              <p className="mt-1 text-slate-300">2 crews</p>
              <p className="text-slate-300">Up to 6 movers</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ROUTE_DAY_SCHEDULE.map((route) => (
              <button
                key={route.key}
                type="button"
                onClick={() => navigate(routeDayLandingHref(route))}
                className="rounded-xl border border-white/10 bg-slate-950/50 p-3 text-left transition hover:border-emerald-400/60 hover:bg-emerald-500/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-300">{route.day}</p>
                    <p className="text-lg font-black text-white">{route.city}</p>
                  </div>
                  <CalendarCheck className="h-5 w-5 text-emerald-300" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{route.note}</p>
                <p className="mt-2 text-xs font-black text-emerald-300">
                  View {route.label} packages, promo code, and tracking flow
                </p>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {ROUTE_DAY_PROMO_PACKAGES.map((promoPackage) => (
              <div key={promoPackage.title} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-blue-300">{promoPackage.title}</p>
                <p className="mt-2 text-lg font-black text-white">{promoPackage.crew} / {promoPackage.hours}</p>
                <p className="mt-1 text-sm font-black text-emerald-300">{promoPackage.priceRange}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{promoPackage.bestFor}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ROUTE_DAY_SERVICE_TAGS.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-slate-950/40 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── HOME TYPE RECOMMENDER ─────────────────────────────────────── */}
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 p-5">
          <button
            onClick={() => setShowSuggestion(!showSuggestion)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="font-bold text-white">Not sure what crew size you need?</span>
            </div>
            {showSuggestion ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {showSuggestion && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HOME_TYPES.map(({ label, crew }) => (
                <button
                  key={label}
                  onClick={() => { setSelectedCrew(crew); setShowSuggestion(false); document.getElementById('crew-section')?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="flex flex-col items-center p-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-blue-500/60 hover:bg-slate-800 transition-all group"
                >
                  <span className="text-sm font-semibold text-white group-hover:text-blue-300">{label}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{crew} Movers</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── LABOR vs TRUCK TOGGLE ─────────────────────────────────────── */}
        <div id="crew-section">
          <h2 className="text-2xl font-black text-white mb-4">Choose Service Type</h2>
          <div className="flex gap-3 mb-6">
            {[
              { val: "labor" as const, label: "Labor Only", desc: "You provide the truck", icon: Users },
              { val: "truck" as const, label: "Truck + Labor", desc: "We bring everything", icon: Truck },
            ].map(({ val, label, desc, icon: Icon }) => (
              <button
                key={val}
                onClick={() => setServiceType(val)}
                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  serviceType === val
                    ? "border-blue-500 bg-blue-500/15 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                }`}
              >
                <div className={`p-2 rounded-lg ${serviceType === val ? "bg-blue-500/25 text-blue-400" : "bg-slate-700 text-slate-400"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className={`font-bold text-sm ${serviceType === val ? "text-blue-300" : "text-white"}`}>{label}</p>
                  <p className="text-xs text-slate-500">{desc}</p>
                </div>
                {serviceType === val && <div className="ml-auto w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
              </button>
            ))}
          </div>

          {/* ── CREW CARDS ─────────────────────────────────────────────── */}
          <h2 className="text-2xl font-black text-white mb-4">Select Your Crew</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5].map((count) => {
              const meta = CREW_META[count];
              const baseRate = count * pricing.ratePerMoverHour;
              const rate = baseRate + (serviceType === "truck" ? pricing.truckAdd : 0);
              const crewMinHours = serviceType === "truck"
                ? Math.max((pricing.minHours[count] ?? 2), 3)
                : (pricing.minHours[count] ?? 2);
              const isSelected = selectedCrew === count;

              return (
                <div
                  key={count}
                  onClick={() => setSelectedCrew(isSelected ? null : count)}
                  className={`relative rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? "border-blue-500 bg-gradient-to-b from-blue-900/40 to-slate-900 shadow-[0_0_30px_rgba(59,130,246,0.25)] scale-[1.01]"
                      : "border-slate-700 bg-slate-800/60 hover:border-slate-500 hover:scale-[1.01]"
                  }`}
                >
                  {meta.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-yellow-400 to-orange-500" />
                  )}
                  {meta.popular && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-orange-500 text-white border-0 text-[10px] font-bold px-2 py-0.5 shadow-lg">
                        MOST POPULAR
                      </Badge>
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black border-2 ${
                          isSelected ? "bg-blue-500 border-blue-400 text-white" : "bg-slate-700 border-slate-600 text-slate-300"
                        }`}>
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    <h3 className="text-xl font-black text-white mb-1">
                      {count} Mover{count > 1 ? "s" : ""}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">{meta.best}</p>

                    <ul className="space-y-1 mb-5">
                      {meta.fits.map(f => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-slate-300">
                          <CheckCircle className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className={`rounded-xl p-3 mb-4 ${isSelected ? "bg-blue-500/20 border border-blue-500/30" : "bg-slate-900/60 border border-slate-700"}`}>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-black ${isSelected ? "text-blue-300" : "text-white"}`}>${rate}</span>
                        <span className="text-slate-400 text-sm">/hr</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{crewMinHours}-hr minimum · {serviceType === "truck" ? "truck + labor" : "labor only"}</p>
                      <p className="text-xs text-slate-400 mt-1 font-medium">
                        Est. min: <span className={isSelected ? "text-blue-300 font-bold" : "text-white font-bold"}>${rate * crewMinHours}</span>
                      </p>
                    </div>

                    <Button
                      className={`w-full font-bold text-sm border-0 ${
                        isSelected
                          ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                          : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                      }`}
                      size="sm"
                    >
                      {isSelected ? "✓ Selected" : "Select This Crew"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Admin pricing editor — only visible to admins */}
          {hasAdminAccess && <AdminPricingEditor />}
        </div>

        {/* ── ADD-ONS ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-black text-white">Add-On Services</h2>
            {hasAdminAccess && (
              <button
                onClick={() => setShowAddForm(f => !f)}
                className="flex items-center gap-1.5 text-xs text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-1.5 hover:bg-amber-500/20 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add New
              </button>
            )}
          </div>
          <p className="text-slate-400 text-sm mb-4">Optional upgrades to protect your belongings and save time</p>

          {/* Admin: new add-on form */}
          {hasAdminAccess && showAddForm && (
            <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide">New Add-On</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Label (e.g. Appliance Move)"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-sm"
                />
                <Input
                  placeholder="Price ($)"
                  type="number"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-sm"
                />
                <Input
                  placeholder="Unit (e.g. flat, / room, each)"
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addAddon} disabled={saveAddonsMutation.isPending} className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs">
                  <Check className="h-3.5 w-3.5 mr-1" /> Save Add-On
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)} className="text-slate-400 text-xs">
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {serviceAddons.map(({ id, label, price, unit }) => {
              const active = !!addOns[id];
              const isEditing = addonEditId === id;
              return (
                <div key={id} className={`rounded-xl border-2 transition-all ${
                  active ? "border-orange-500 bg-orange-500/10" : "border-slate-700 bg-slate-800/50"
                }`}>
                  {isEditing && hasAdminAccess ? (
                    <div className="p-3 space-y-2">
                      <Input
                        value={addonDraft.label ?? label}
                        onChange={e => setAddonDraft(d => ({ ...d, label: e.target.value }))}
                        className="bg-slate-900 border-slate-700 text-white text-sm h-8"
                        placeholder="Label"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={addonDraft.price ?? price}
                          onChange={e => setAddonDraft(d => ({ ...d, price: parseFloat(e.target.value) || 0 }))}
                          className="bg-slate-900 border-slate-700 text-white text-sm h-8"
                          placeholder="Price"
                        />
                        <Input
                          value={addonDraft.unit ?? unit}
                          onChange={e => setAddonDraft(d => ({ ...d, unit: e.target.value }))}
                          className="bg-slate-900 border-slate-700 text-white text-sm h-8"
                          placeholder="Unit"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveAddon(id)} disabled={saveAddonsMutation.isPending} className="bg-green-600 hover:bg-green-500 text-white text-xs h-7 px-3">
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAddonEditId(null); setAddonDraft({}); }} className="text-slate-400 text-xs h-7 px-3">
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteAddon(id)} className="text-red-400 hover:text-red-300 text-xs h-7 px-3 ml-auto">
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleAddOn(id)}
                      className="flex items-center gap-3 p-4 w-full text-left"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${active ? "bg-orange-500/20 text-orange-400" : "bg-slate-700 text-slate-400"}`}>
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? "text-orange-300" : "text-white"}`}>{label}</p>
                        <p className="text-xs text-slate-500">${price} {unit}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        active ? "bg-orange-500 border-orange-500" : "border-slate-600"
                      }`}>
                        {active && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </button>
                  )}
                  {/* Admin edit/delete controls (shown only when NOT in edit mode) */}
                  {hasAdminAccess && !isEditing && (
                    <div className="flex gap-1 px-2 pb-2">
                      <button
                        onClick={() => { setAddonEditId(id); setAddonDraft({ label, price, unit }); }}
                        className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-300 transition-colors px-2 py-0.5 rounded"
                      >
                        <Pencil className="h-2.5 w-2.5" /> Edit
                      </button>
                      <button
                        onClick={() => deleteAddon(id)}
                        className="flex items-center gap-1 text-[10px] text-red-400/70 hover:text-red-300 transition-colors px-2 py-0.5 rounded"
                      >
                        <Trash2 className="h-2.5 w-2.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── JOB TIME ESTIMATOR ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Estimate Your Job Time</h3>
            <span className="text-[11px] text-slate-500 ml-1">optional · helps us recommend the right crew</span>
          </div>

          {/* Service mode */}
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">What do you need help with?</p>
            <div className="flex gap-2">
              {(["load","unload","both"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setServiceMode(m)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    serviceMode === m
                      ? "border-blue-500 bg-blue-500/20 text-blue-300"
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {m === "both" ? "Load & Unload" : m === "load" ? "Load Only" : "Unload Only"}
                </button>
              ))}
            </div>
          </div>

          {/* Truck size */}
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">Truck size</p>
            <div className="grid grid-cols-3 gap-2">
              {(["small","medium","large"] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => setTruckSize(sz)}
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    truckSize === sz
                      ? "border-orange-500 bg-orange-500/20 text-orange-300"
                      : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <Truck className="h-4 w-4 mx-auto mb-1 opacity-70" />
                  <span className="capitalize">{sz}</span>
                  <p className="text-[9px] font-normal text-slate-500 mt-0.5 leading-tight">
                    {sz === "small" ? "Van / box" : sz === "medium" ? "16–20 ft" : "24–26 ft"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Stairs toggles */}
          <div className="flex gap-3">
            {[
              { label: "Loading location has stairs", val: loadStairs, set: setLoadStairs, show: serviceMode !== "unload" },
              { label: "Unloading location has stairs", val: unloadStairs, set: setUnloadStairs, show: serviceMode !== "load" },
            ].filter(s => s.show).map(({ label, val, set }) => (
              <button
                key={label}
                onClick={() => set(!val)}
                className={`flex-1 flex items-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                  val
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600"
                }`}
              >
                <ChevronsUp className="h-3.5 w-3.5 shrink-0" />
                {label}
                {val && <Check className="h-3 w-3 ml-auto text-purple-400" />}
              </button>
            ))}
          </div>

          {/* Results */}
          {truckSize && estimatedJobHours !== null && (
            <div className="bg-slate-900/60 rounded-xl border border-slate-700 p-4 space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Estimated job time</span>
                <span className="text-white font-black text-base">~{estimatedJobHours} hrs</span>
              </div>

              {recommendedCrew && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Recommended crew</span>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-300 font-bold">{recommendedCrew} movers</span>
                    {recommendedCrew !== selectedCrew && (
                      <button
                        onClick={() => setSelectedCrew(recommendedCrew)}
                        className="text-[10px] bg-blue-500/20 border border-blue-500/40 text-blue-300 px-2 py-0.5 rounded-full hover:bg-blue-500/30 transition-colors"
                      >
                        Switch ↗
                      </button>
                    )}
                  </div>
                </div>
              )}

              {travelWaived ? (
                <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-2.5 text-xs text-green-300">
                  <CheckCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-400" />
                  <span>
                    <span className="font-bold">Travel fee may be waived</span> — your job fits within the minimum booking window.
                    If any travel charge applies, you'll receive JCMOVES tokens as in-house reimbursement.
                  </span>
                </div>
              ) : estimatedJobHours !== null && selectedCrew && estimatedJobHours < minHours ? (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-xs text-amber-300">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>Travel charge applies · {minHours - estimatedJobHours} hr gap between job time and minimum booking</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ── PLACEHOLDER when no crew selected ─────────────────────────── */}
        {!selectedCrew && (
          <div className="rounded-2xl border-2 border-dashed border-slate-700 p-8 text-center">
            <Users className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-semibold">Select a crew above to see your instant estimate</p>
            <p className="text-slate-600 text-sm mt-1">Choose 1–5 movers to unlock pricing</p>
          </div>
        )}

        {/* ── LIVE ESTIMATE — fixed solid bottom sheet ───────────────────── */}
        {selectedCrew && (
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.8)]">
            {/* solid opaque container */}
            <div className="bg-slate-950 border-t-2 border-blue-500 w-full max-w-2xl mx-auto px-5 pt-4 pb-6 rounded-t-2xl">

              {/* header row */}
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-blue-400 shrink-0" />
                <h3 className="text-lg font-black text-white">Your Estimate</h3>
                <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs ml-2">LIVE PREVIEW</Badge>
                <button
                  onClick={() => setSelectedCrew(null)}
                  className="ml-auto p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  aria-label="Close estimate"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* crew details grid */}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-0.5">Crew</p>
                  <p className="text-white font-bold">{selectedCrew} Mover{selectedCrew > 1 ? "s" : ""}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-0.5">Service</p>
                  <p className="text-white font-bold">{serviceType === "truck" ? "Truck + Labor" : "Labor Only"}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-0.5">Rate</p>
                  <p className="text-white font-bold">${hourlyRate}/hr</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-slate-400 text-xs mb-0.5">Minimum</p>
                  <p className="text-white font-bold">{minHours} hours</p>
                </div>
              </div>

              {addOnTotal > 0 && (
                <div className="bg-orange-950 border border-orange-500/40 rounded-lg p-3 mb-4">
                  <p className="text-xs text-orange-400 font-semibold mb-1">Add-ons selected</p>
                  {serviceAddons.filter(a => addOns[a.id]).map(a => (
                    <div key={a.id} className="flex justify-between text-xs text-slate-300">
                      <span>{a.label}</span><span>+${a.price}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* total */}
              <div className="border-t border-slate-700 pt-4 mb-4">
                <p className="text-slate-400 text-sm mb-1">Estimated Total Range</p>
                <p className="text-3xl font-black text-white">
                  ${estLow.toLocaleString()} – <span className="text-blue-300">${estHigh.toLocaleString()}</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Based on {minHours}–{minHours + 2} hrs · Final price depends on actual time</p>
              </div>

              {/* ── Booking Preview ─────────────────────────────────────── */}
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-4 space-y-2">
                <p className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                  <CalendarCheck className="h-3.5 w-3.5 text-blue-400" />
                  What happens next
                </p>
                {[
                  "Choose service date, address, and job details.",
                  "Add photos, videos, notes, or an album link.",
                  "JC ON THE MOVE confirms crew, truck needs, timing, and price.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* ── Action Buttons ──────────────────────────────────────── */}
              <div className="space-y-2.5">
                <Button
                  onClick={handleBookNow}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black text-base h-13 shadow-lg shadow-green-500/25 border-0 flex items-center justify-between px-5"
                >
                  <span className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5" />
                    Continue To Booking
                  </span>
                  <span className="text-xs font-medium opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                    Crew details included
                  </span>
                </Button>
                <Link href={bookUrl}>
                  <Button
                    variant="outline"
                    className="w-full border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white font-bold h-11"
                  >
                    Request Quote — Free, No Commitment
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </Link>
              </div>

              <p className="text-center text-xs text-slate-500 mt-3">
                Booking starts the request. A coordinator confirms crew, address, timing, truck needs, and final price before the job is locked in.
              </p>
            </div>
          </div>
        )}

        {/* ── HALF DAY PACKAGE PROMO ────────────────────────────────────── */}
        <div className="rounded-2xl border border-orange-500/40 bg-gradient-to-br from-orange-950/40 via-slate-900 to-amber-950/20 p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl">
            BEST VALUE
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-orange-400" />
            <h3 className="text-base font-black text-white">Half Day Special Package</h3>
          </div>
          <p className="text-slate-300 text-sm mb-3">
            5 movers - 3 hours - travel included - perfect for large homes or tight deadlines.
          </p>
          <div className="flex items-end gap-3 mb-4">
            <div>
              <p className="text-xs text-slate-500 line-through">$1,200</p>
              <p className="text-3xl font-black text-orange-400">$1,020</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Bitcoin className="h-3 w-3 text-orange-400" />
                with Bitcoin payment - <span className="text-orange-400 font-bold">15% off</span>
              </p>
            </div>
            <div className="ml-auto text-right">
              <div className="inline-flex flex-col gap-1 text-[11px]">
                <span className="bg-green-500/20 text-green-300 border border-green-500/30 rounded-full px-2 py-0.5">Book Now -5%</span>
                <span className="bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-full px-2 py-0.5">Crypto -5%</span>
              </div>
            </div>
          </div>
          <Link href="/promo/half-day">
            <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 font-black border-0 shadow-lg shadow-orange-500/20">
              View Package &amp; Book <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {/* ── OTHER SERVICES ────────────────────────────────────────────── */}
        <div>
          <h2 className="text-2xl font-black text-white mb-4">Other Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: "/book?mode=quick&service=junk_removal", label: "Junk Removal", color: "from-orange-600 to-orange-800", emoji: "JR" },
              { href: "/snow-removal",               label: "Snow Removal",       color: "from-cyan-700 to-blue-800",       emoji: "SN" },
              { href: "/book?mode=quick&service=cleaning", label: "Move-In Cleaning", color: "from-green-700 to-green-900", emoji: "CL" },
              { href: "/book?mode=quick&service=handyman", label: "Handyman", color: "from-amber-700 to-amber-900", emoji: "HM" },
              { href: "/book?mode=quick&service=demolition", label: "Light Demo", color: "from-red-700 to-red-900", emoji: "LD" },
              { href: "/book?mode=quick&service=flooring", label: "Flooring", color: "from-stone-700 to-stone-900", emoji: "FL" },
            ].map(({ href, label, color, emoji }) => (
              <Link key={href} href={href}>
                <div className={`bg-gradient-to-br ${color} rounded-xl p-4 text-center cursor-pointer hover:scale-[1.03] transition-all border border-white/10`}>
                  <div className="text-2xl mb-1">{emoji}</div>
                  <p className="text-white font-bold text-sm">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── SOCIAL PROOF ──────────────────────────────────────────────── */}
        <div>
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <h2 className="text-2xl font-black text-white mb-1">Trusted Across Michigan & Wisconsin</h2>
            <p className="text-slate-400 text-sm">Hundreds of happy moves and counting</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REVIEWS.map((r, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(r.rating)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-slate-200 text-sm leading-relaxed mb-3">"{r.text}"</p>
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold text-sm">{r.name}</p>
                  <p className="text-slate-500 text-xs">{r.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAST CTA BOTTOM ───────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/60 to-slate-900 border border-blue-500/30 p-8 text-center">
          <h2 className="text-2xl font-black text-white mb-2">Ready to Move?</h2>
          <p className="text-slate-400 mb-6">Book your crew in under 2 minutes. We'll confirm within the hour.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/book?mode=builder&service=moving">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black border-0 shadow-lg shadow-orange-500/25">
                Book Now - Free Quote <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </Link>
            <a href="tel:+19062859312">
              <Button size="lg" variant="outline" className="border-slate-600 text-white hover:bg-slate-800 font-bold">
                <Phone className="h-4 w-4 mr-2" /> (906) 285-9312
              </Button>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
