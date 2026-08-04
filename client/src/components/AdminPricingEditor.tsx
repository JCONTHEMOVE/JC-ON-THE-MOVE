import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Save, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, Truck, Zap, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Pricing {
  ratePerMoverHour: number;
  truckAdd: number;
  driveRate: number;
  shortJobFull: number;
  shortJobRate: number;
  jc222Price: number;
  jc272Price: number;
  jc222Miles: number;
  jc222Minutes: number;
  jc222WeightLimit: number;
  heavyItemFlat: number;
  minHours: Record<number, number>;
  // Truck flat rates
  truckSmallFlat: number;
  truckLargeFlat: number;
  trailerFlat: number;
  // Service rates
  windowCleaningPerPane: number;
  trashValetBaseMonthly: number;
  paintingHourlyRate: number;
  flooringPerSqFt: number;
  snowRemovalHourlyRate: number;
  handymanHourlyRate: number;
  lawnCareHourlyRate: number;
  // JCMOVES token economy
  earnRatePerDollar: number;
  bookingRequestBonus: number;
  completionFlatBonus: number;
  referralBonus: number;
  // Specialty items
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

const DEFAULTS = {
  rate_per_mover_hour: "87.5",
  drive_rate: "40",
  short_job_full: "300",
  min_hours_1: "5",
  min_hours_2: "4",
  min_hours_3: "3",
  min_hours_4: "2",
  min_hours_5: "2",
  truck_small_flat: "300",
  truck_large_flat: "600",
  trailer_flat: "175",
  truck_add: "60",
  jc222_price: "272",
  jc272_price: "272",
  jc222_miles: "10",
  jc222_minutes: "82",
  jc222_weight_limit: "200",
  heavy_item_flat: "350",
  window_cleaning_per_pane: "5",
  trash_valet_base_monthly: "30",
  painting_hourly_rate: "85",
  flooring_per_sq_ft: "3",
  snow_removal_hourly_rate: "85",
  handyman_hourly_rate: "85",
  lawn_care_hourly_rate: "60",
  specialty_piano: "400",
  specialty_hot_tub: "600",
  specialty_safe: "400",
  specialty_pool_table: "400",
  weight_light_max: "200",
  weight_heavy_min: "400",
  stairs_per_flight: "25",
  long_carry_flat: "50",
  elevator_flat: "30",
  tight_access_flat: "50",
  local_miles_max: "10",
  regional_miles_max: "50",
  regional_surcharge_per_mile: "1",
  long_distance_rate_per_mile: "4",
  long_distance_min_miles: "100",
  fuel_surcharge_flat: "0",
  fuel_surcharge_min_miles: "30",
};

const REWARD_DEFAULTS = {
  earn_rate_per_dollar: "15",
  customer_quote_accepted: "250",
  customer_quote_completed: "1500",
  referral_job_bonus: "1000",
};

function getHourDiscount(hours: number): number {
  if (hours >= 7) return 20;
  if (hours >= 5) return 15;
  if (hours >= 3) return 10;
  return 0;
}

function Section({ icon, title, color, children, defaultOpen = true }: {
  icon: JSX.Element | string;
  title: string;
  color: string;
  children: JSX.Element | JSX.Element[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-700/40 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <span className={`text-xs font-semibold ${color}`}>{title}</span>
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && (
        <div className="px-3 py-3 space-y-3 bg-slate-900/40">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: JSX.Element }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

export function AdminPricingEditor({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(alwaysOpen);
  const [resetting, setResetting] = useState(false);

  const { data: pricing } = useQuery<Pricing>({ queryKey: ["/api/pricing"] });

  const [draft, setDraft] = useState<typeof DEFAULTS>(DEFAULTS);
  const [rewardDraft, setRewardDraft] = useState<typeof REWARD_DEFAULTS>(REWARD_DEFAULTS);

  useEffect(() => {
    if (!pricing) return;
    setDraft({
      rate_per_mover_hour: String(pricing.ratePerMoverHour ?? 87.5),
      drive_rate:          String(pricing.driveRate          ?? 40),
      short_job_full:      String(pricing.shortJobFull       ?? 300),
      min_hours_1:         String(pricing.minHours?.[1]      ?? 5),
      min_hours_2:         String(pricing.minHours?.[2]      ?? 4),
      min_hours_3:         String(pricing.minHours?.[3]      ?? 3),
      min_hours_4:         String(pricing.minHours?.[4]      ?? 2),
      min_hours_5:         String(pricing.minHours?.[5]      ?? 2),
      truck_small_flat:    String(pricing.truckSmallFlat     ?? 300),
      truck_large_flat:    String(pricing.truckLargeFlat     ?? 600),
      trailer_flat:        String(pricing.trailerFlat        ?? 175),
      truck_add:           String(pricing.truckAdd           ?? 60),
      jc222_price:         String(pricing.jc222Price         ?? 272),
      jc272_price:         String(pricing.jc272Price         ?? 272),
      jc222_miles:         String(pricing.jc222Miles         ?? 10),
      jc222_minutes:       String(pricing.jc222Minutes       ?? 82),
      jc222_weight_limit:  String(pricing.jc222WeightLimit   ?? 200),
      heavy_item_flat:     String(pricing.heavyItemFlat      ?? 350),
      window_cleaning_per_pane: String(pricing.windowCleaningPerPane ?? 5),
      trash_valet_base_monthly: String(pricing.trashValetBaseMonthly ?? 30),
      painting_hourly_rate:     String(pricing.paintingHourlyRate    ?? 85),
      flooring_per_sq_ft:       String(pricing.flooringPerSqFt       ?? 3),
      snow_removal_hourly_rate:  String(pricing.snowRemovalHourlyRate ?? 85),
      handyman_hourly_rate:      String(pricing.handymanHourlyRate    ?? 85),
      lawn_care_hourly_rate:     String(pricing.lawnCareHourlyRate    ?? 60),
      specialty_piano:      String(pricing.specialtyPiano      ?? 200),
      specialty_hot_tub:    String(pricing.specialtyHotTub     ?? 250),
      specialty_safe:       String(pricing.specialtySafe       ?? 175),
      specialty_pool_table: String(pricing.specialtyPoolTable  ?? 200),
      weight_light_max:  String(pricing.weightLightMax  ?? 200),
      weight_heavy_min:  String(pricing.weightHeavyMin  ?? 400),
      stairs_per_flight:   String(pricing.stairsPerFlight   ?? 25),
      long_carry_flat:     String(pricing.longCarryFlat     ?? 50),
      elevator_flat:       String(pricing.elevatorFlat      ?? 30),
      tight_access_flat:   String(pricing.tightAccessFlat   ?? 50),
      local_miles_max:             String(pricing.localMilesMax             ?? 10),
      regional_miles_max:          String(pricing.regionalMilesMax          ?? 50),
      regional_surcharge_per_mile: String(pricing.regionalSurchargePerMile  ?? 1),
      long_distance_rate_per_mile: String(pricing.longDistanceRatePerMile   ?? 5),
      long_distance_min_miles:     String(pricing.longDistanceMinMiles      ?? 100),
      fuel_surcharge_flat:      String(pricing.fuelSurchargeFlat     ?? 0),
      fuel_surcharge_min_miles: String(pricing.fuelSurchargeMinMiles ?? 30),
    });
  }, [pricing]);

  useEffect(() => {
    if (!pricing) return;
    setRewardDraft({
      earn_rate_per_dollar:     String(pricing.earnRatePerDollar   ?? 15),
      customer_quote_accepted:  String(pricing.bookingRequestBonus ?? 250),
      customer_quote_completed: String(pricing.completionFlatBonus ?? 1500),
      referral_job_bonus:       String(pricing.referralBonus       ?? 1000),
    });
  }, [pricing]);

  const set = (k: keyof typeof DEFAULTS, v: string) =>
    setDraft(d => ({ ...d, [k]: v }));

  const setReward = (k: keyof typeof REWARD_DEFAULTS, v: string) =>
    setRewardDraft(d => ({ ...d, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: async (values: typeof DEFAULTS) => {
      const entries = Object.entries(values).filter(([, v]) => {
        const n = parseFloat(v);
        return !isNaN(n) && isFinite(n);
      });
      await Promise.all(
        entries.map(([key, value]) =>
          apiRequest("PATCH", `/api/admin/pricing/${key}`, { value: parseFloat(value) })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing"] });
      toast({ title: "Pricing updated", description: "Changes are live on the booking page." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rewardSaveMutation = useMutation({
    mutationFn: async (values: typeof REWARD_DEFAULTS) => {
      const entries = Object.entries(values).filter(([, v]) => {
        const n = parseFloat(v);
        return !isNaN(n) && isFinite(n) && n >= 0;
      });
      await Promise.all(
        entries.map(([key, value]) =>
          apiRequest("PUT", `/api/admin/reward-settings/${key}`, { tokenAmount: parseFloat(value), isActive: true })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reward-settings"] });
      toast({ title: "Token economy updated", description: "JCMOVES rates are live." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleReset() {
    if (!confirm("Reset ALL pricing to factory defaults?\n\nRate: $85/mover·hr · Small Truck: $300 flat · Large Truck: $600 flat · Drive: $40 · Min job: $300 · JC272: $272\n\nThis overwrites your current settings.")) return;
    setResetting(true);
    try {
      await saveMutation.mutateAsync(DEFAULTS);
      setDraft({ ...DEFAULTS });
      toast({ title: "Pricing reset to defaults" });
    } finally {
      setResetting(false);
    }
  }

  const rate  = parseFloat(draft.rate_per_mover_hour || "85");
  const floor = parseFloat(draft.short_job_full || "300");
  const jc222 = parseFloat(draft.jc222_price || "272");
  const jc272 = parseFloat(draft.jc272_price || "272");

  const SAMPLE_PKGS = [
    { movers: 2, hours: 2 },
    { movers: 2, hours: 3 },
    { movers: 3, hours: 3 },
    { movers: 4, hours: 4 },
  ];

  const inp = "bg-slate-900 border-slate-700 text-white h-8 text-sm";

  return (
    <div className="rounded-xl bg-slate-800/60 border border-amber-500/30 p-4">
      {!alwaysOpen && (
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-amber-400" />
            <span className="font-bold text-amber-300 text-sm">Edit Pricing</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      )}

      {(open || alwaysOpen) && (
        <div className={`space-y-3 ${!alwaysOpen ? "mt-4" : ""}`}>

          {/* ── Moving & Labor ── */}
          <Section icon={<Settings className="h-3.5 w-3.5" />} title="Moving & Labor" color="text-blue-300">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Rate per mover/hr ($)" hint="$87.50 = $175/hr for 2 movers">
                <Input type="number" value={draft.rate_per_mover_hour}
                  onChange={e => set("rate_per_mover_hour", e.target.value)} className={inp} />
              </Field>
              <Field label="Drive rate/mover/hr ($)" hint="Default $40">
                <Input type="number" value={draft.drive_rate}
                  onChange={e => set("drive_rate", e.target.value)} className={inp} />
              </Field>
              <Field label="Min job price / floor ($)" hint="Default $300">
                <Input type="number" value={draft.short_job_full}
                  onChange={e => set("short_job_full", e.target.value)} className={inp} />
              </Field>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Minimum Hours by Crew Size</p>
              <div className="grid grid-cols-5 gap-2">
                {([1, 2, 3, 4, 5] as const).map(n => {
                  const key = `min_hours_${n}` as keyof typeof DEFAULTS;
                  return (
                    <div key={n} className="text-center">
                      <label className="text-[10px] text-slate-500 block mb-1">{n} Mv{n > 1 ? "s" : ""}</label>
                      <Input type="number" value={draft[key]}
                        onChange={e => set(key, e.target.value)}
                        className="bg-slate-900 border-slate-700 text-white h-8 text-sm text-center" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Package price preview */}
            <div className="bg-slate-900/60 rounded-lg p-2.5 text-xs">
              <p className="font-semibold text-slate-300 mb-1.5">Package price preview</p>
              <div className="space-y-1">
                {SAMPLE_PKGS.map(({ movers, hours }) => {
                  const base = movers * hours * rate;
                  const floored = base < floor ? floor : base;
                  const disc = getHourDiscount(hours);
                  const final = disc > 0 ? Math.round(floored * (1 - disc / 100)) : floored;
                  return (
                    <div key={`${movers}-${hours}`} className="flex justify-between text-slate-400">
                      <span>{movers} Movers × {hours} hrs{disc > 0 ? ` (${disc}% off)` : ""}</span>
                      <span className="text-white font-medium">${final}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ── Truck Options ── */}
          <Section icon={<Truck className="h-3.5 w-3.5" />} title="Truck Options (Flat Rates)" color="text-cyan-300">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Small Truck flat rate ($)" hint="15 ft — default $500">
                <Input type="number" value={draft.truck_small_flat}
                  onChange={e => set("truck_small_flat", e.target.value)} className={inp} />
              </Field>
              <Field label="Large Truck flat rate ($)" hint="26 ft — default $600">
                <Input type="number" value={draft.truck_large_flat}
                  onChange={e => set("truck_large_flat", e.target.value)} className={inp} />
              </Field>
              <Field label="Trailer flat rate ($)" hint="Default $175">
                <Input type="number" value={draft.trailer_flat}
                  onChange={e => set("trailer_flat", e.target.value)} className={inp} />
              </Field>
            </div>
            <p className="text-[10px] text-slate-600">Flat fees added when customer selects a truck — not hourly</p>
          </Section>

          {/* ── Promo Packages ── */}
          <Section icon={<span className="text-xs font-bold">%</span>} title="Promo Packages" color="text-amber-300">
            <div className="grid grid-cols-2 gap-2">
              <Field label="JC272 promo price ($)" hint="≤10 mi — default $272">
                <Input type="number" value={draft.jc222_price}
                  onChange={e => set("jc222_price", e.target.value)} className={inp} />
              </Field>
              <Field label="JC272 promo price ($)" hint=">10 mi — default $272">
                <Input type="number" value={draft.jc272_price}
                  onChange={e => set("jc272_price", e.target.value)} className={inp} />
              </Field>
              <Field label="Heavy item floor ($)" hint="3 movers · 2 hr min — $350">
                <Input type="number" value={draft.heavy_item_flat}
                  onChange={e => set("heavy_item_flat", e.target.value)} className={inp} />
              </Field>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Promo Screening Thresholds</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Distance split (mi)" hint="JC272 cutoff">
                  <Input type="number" value={draft.jc222_miles}
                    onChange={e => set("jc222_miles", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-8 text-sm text-center" />
                </Field>
                <Field label="Duration cap (min)" hint="Max total time">
                  <Input type="number" value={draft.jc222_minutes}
                    onChange={e => set("jc222_minutes", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-8 text-sm text-center" />
                </Field>
                <Field label="Weight limit (lbs)" hint="Light-item max">
                  <Input type="number" value={draft.jc222_weight_limit}
                    onChange={e => set("jc222_weight_limit", e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white h-8 text-sm text-center" />
                </Field>
              </div>
            </div>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div className="flex justify-between"><span>JC272 (≤{draft.jc222_miles} mi)</span><span className="text-amber-400 font-medium">${jc222}</span></div>
              <div className="flex justify-between"><span>Outside {draft.jc222_miles} mi</span><span className="text-amber-400 font-medium">${jc272}</span></div>
            </div>
          </Section>

          {/* ── Service Rates ── */}
          <Section icon={<Wrench className="h-3.5 w-3.5" />} title="Service Rates" color="text-green-300" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Window Cleaning (per pane)" hint="Default $5/pane">
                <Input type="number" value={draft.window_cleaning_per_pane}
                  onChange={e => set("window_cleaning_per_pane", e.target.value)} className={inp} />
              </Field>
              <Field label="Trash Valet (base/month)" hint="Default $30/mo">
                <Input type="number" value={draft.trash_valet_base_monthly}
                  onChange={e => set("trash_valet_base_monthly", e.target.value)} className={inp} />
              </Field>
              <Field label="Painting (hourly rate)" hint="Default $85/hr">
                <Input type="number" value={draft.painting_hourly_rate}
                  onChange={e => set("painting_hourly_rate", e.target.value)} className={inp} />
              </Field>
              <Field label="Flooring (per sq ft)" hint="Default $3/sq ft">
                <Input type="number" value={draft.flooring_per_sq_ft}
                  onChange={e => set("flooring_per_sq_ft", e.target.value)} className={inp} />
              </Field>
              <Field label="Snow Removal (hourly)" hint="Default $85/hr">
                <Input type="number" value={draft.snow_removal_hourly_rate}
                  onChange={e => set("snow_removal_hourly_rate", e.target.value)} className={inp} />
              </Field>
              <Field label="Handyman (hourly)" hint="Default $85/hr">
                <Input type="number" value={draft.handyman_hourly_rate}
                  onChange={e => set("handyman_hourly_rate", e.target.value)} className={inp} />
              </Field>
              <Field label="Lawn Care (hourly)" hint="Default $60/hr">
                <Input type="number" value={draft.lawn_care_hourly_rate}
                  onChange={e => set("lawn_care_hourly_rate", e.target.value)} className={inp} />
              </Field>
            </div>
          </Section>

          {/* ── JCMOVES Token Economy ── */}
          <Section icon={<Zap className="h-3.5 w-3.5" />} title="JCMOVES Token Economy" color="text-amber-400" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Earn rate (tokens per $1)" hint="Default 15">
                <Input type="number" value={rewardDraft.earn_rate_per_dollar}
                  onChange={e => setReward("earn_rate_per_dollar", e.target.value)} className={inp} />
              </Field>
              <Field label="Booking request bonus" hint="Tokens on job submit — default 250">
                <Input type="number" value={rewardDraft.customer_quote_accepted}
                  onChange={e => setReward("customer_quote_accepted", e.target.value)} className={inp} />
              </Field>
              <Field label="Job completion flat bonus" hint="Tokens on job complete — default 1500">
                <Input type="number" value={rewardDraft.customer_quote_completed}
                  onChange={e => setReward("customer_quote_completed", e.target.value)} className={inp} />
              </Field>
              <Field label="Referral first-job bonus" hint="Awarded to referrer — default 1000">
                <Input type="number" value={rewardDraft.referral_job_bonus}
                  onChange={e => setReward("referral_job_bonus", e.target.value)} className={inp} />
              </Field>
            </div>
            <div className="text-xs text-slate-500 bg-slate-900/60 rounded p-2 space-y-0.5">
              <p className="text-slate-400 font-semibold mb-1">Preview (on a $300 job)</p>
              <div className="flex justify-between"><span>Booking bonus</span><span className="text-amber-400">+{parseInt(rewardDraft.customer_quote_accepted || "0").toLocaleString()} JCMOVES</span></div>
              <div className="flex justify-between"><span>Earn on spend ($300 × {rewardDraft.earn_rate_per_dollar})</span><span className="text-amber-400">+{(300 * parseFloat(rewardDraft.earn_rate_per_dollar || "0")).toLocaleString()} JCMOVES</span></div>
              <div className="flex justify-between"><span>Completion bonus</span><span className="text-amber-400">+{parseInt(rewardDraft.customer_quote_completed || "0").toLocaleString()} JCMOVES</span></div>
            </div>
            <Button
              onClick={() => rewardSaveMutation.mutate(rewardDraft)}
              disabled={rewardSaveMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm h-8"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {rewardSaveMutation.isPending ? "Saving…" : "Save Token Economy"}
            </Button>
          </Section>

          {/* ── Advanced / Difficulty & Surcharges ── */}
          <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Advanced — Difficulty & Surcharges" color="text-orange-300" defaultOpen={false}>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Specialty Item Flat Surcharges ($)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Piano / Upright (≤500 lbs)" hint="Default $400">
                  <Input type="number" value={draft.specialty_piano}
                    onChange={e => set("specialty_piano", e.target.value)} className={inp} />
                </Field>
                <Field label="Hot Tub (500+ lbs)" hint="Default $600">
                  <Input type="number" value={draft.specialty_hot_tub}
                    onChange={e => set("specialty_hot_tub", e.target.value)} className={inp} />
                </Field>
                <Field label="Heavy Safe (≤500 lbs)" hint="Default $400">
                  <Input type="number" value={draft.specialty_safe}
                    onChange={e => set("specialty_safe", e.target.value)} className={inp} />
                </Field>
                <Field label="Pool Table (≤500 lbs)" hint="Default $400">
                  <Input type="number" value={draft.specialty_pool_table}
                    onChange={e => set("specialty_pool_table", e.target.value)} className={inp} />
                </Field>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">≤500 lbs = $400 standard · 500+ lbs (Grand Piano/Hot Tub) = $600 oversized · 40% crew discount applies when added to a crew order</p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Weight Tiers</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Light max (lbs)" hint={`< ${draft.weight_light_max} lbs = light`}>
                  <Input type="number" value={draft.weight_light_max}
                    onChange={e => set("weight_light_max", e.target.value)} className={inp} />
                </Field>
                <Field label="Heavy min (lbs)" hint={`≥ ${draft.weight_heavy_min} lbs = 3-mover min`}>
                  <Input type="number" value={draft.weight_heavy_min}
                    onChange={e => set("weight_heavy_min", e.target.value)} className={inp} />
                </Field>
              </div>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Access / Difficulty Add-On Rates ($)</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stairs (per flight)">
                  <Input type="number" value={draft.stairs_per_flight}
                    onChange={e => set("stairs_per_flight", e.target.value)} className={inp} />
                </Field>
                <Field label="Long Carry (>75 ft)">
                  <Input type="number" value={draft.long_carry_flat}
                    onChange={e => set("long_carry_flat", e.target.value)} className={inp} />
                </Field>
                <Field label="Elevator">
                  <Input type="number" value={draft.elevator_flat}
                    onChange={e => set("elevator_flat", e.target.value)} className={inp} />
                </Field>
                <Field label="Tight Access">
                  <Input type="number" value={draft.tight_access_flat}
                    onChange={e => set("tight_access_flat", e.target.value)} className={inp} />
                </Field>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">Stairs on a truck job bumps crew minimum +1 automatically</p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Distance Tier Thresholds & Rates</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Local max (mi)">
                  <Input type="number" value={draft.local_miles_max}
                    onChange={e => set("local_miles_max", e.target.value)} className={inp} />
                </Field>
                <Field label="Regional max (mi)">
                  <Input type="number" value={draft.regional_miles_max}
                    onChange={e => set("regional_miles_max", e.target.value)} className={inp} />
                </Field>
                <Field label="Regional surcharge ($/mi)">
                  <Input type="number" value={draft.regional_surcharge_per_mile}
                    onChange={e => set("regional_surcharge_per_mile", e.target.value)} className={inp} />
                </Field>
                <Field label="Long distance rate ($/mi)">
                  <Input type="number" value={draft.long_distance_rate_per_mile}
                    onChange={e => set("long_distance_rate_per_mile", e.target.value)} className={inp} />
                </Field>
                <Field label="Long distance min miles (billed)" hint="">
                  <Input type="number" value={draft.long_distance_min_miles}
                    onChange={e => set("long_distance_min_miles", e.target.value)} className={inp} />
                </Field>
              </div>
              <p className="text-[10px] text-slate-600 mt-1">
                Local ≤ {draft.local_miles_max} mi · Regional {draft.local_miles_max}–{draft.regional_miles_max} mi · Long Distance &gt; {draft.regional_miles_max} mi
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-400 mb-1.5 font-semibold">Fuel Surcharge</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Flat surcharge ($ — 0 = off)">
                  <Input type="number" value={draft.fuel_surcharge_flat}
                    onChange={e => set("fuel_surcharge_flat", e.target.value)} className={inp} />
                </Field>
                <Field label="Trigger distance (mi)">
                  <Input type="number" value={draft.fuel_surcharge_min_miles}
                    onChange={e => set("fuel_surcharge_min_miles", e.target.value)} className={inp} />
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Actions ── */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => saveMutation.mutate(draft)}
              disabled={saveMutation.isPending || resetting}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saveMutation.isPending ? "Saving…" : "Save All Pricing"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saveMutation.isPending || resetting}
              className="text-slate-400 border-slate-700 hover:text-red-400 hover:border-red-500/50 px-3"
              title="Reset pricing config to defaults (does not reset token economy)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            Defaults: $85/mover/hr · $300 small truck · $600 large truck · $40 drive · $300 min · $272 JC272
          </p>
        </div>
      )}
    </div>
  );
}
