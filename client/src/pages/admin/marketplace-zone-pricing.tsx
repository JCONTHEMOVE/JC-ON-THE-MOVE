import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, ClipboardList, Map, Save, Settings2 } from "lucide-react";
import {
  getMarketplaceRequestShape,
  MARKETPLACE_REQUEST_SHAPES,
  MARKETPLACE_ZONE_SERVICE_OPTIONS,
} from "@shared/marketplaceShapes";
import MarketplaceZoneMapBuilder from "@/components/MarketplaceZoneMapBuilder";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  marketplaceEstimateLabel,
  marketplacePreviewBillableHours,
  marketplacePreviewCrewSize,
  marketplacePreviewZoneName,
  type MarketplaceQuotePreview,
} from "@/lib/marketplaceQuotePreview";

type ZoneRate = {
  id: string;
  zoneId: string;
  serviceCode: string;
  serviceLabel: string;
  crewSize: number;
  dayOfWeek: number;
  hourlyRate: string | number;
  minimumHours: string | number;
  discountAfterHours: string | number | null;
  discountedHourlyRate: string | number | null;
  active: boolean;
};

type PricingZone = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  priority: number;
  travelBaseFee: string | number;
  travelPerMile: string | number;
  laborMultiplier: string | number;
  estimatePaddingPct: string | number;
  polygon?: [number, number][];
  rates: ZoneRate[];
};

type ZonesResponse = {
  zones: PricingZone[];
};

const RATE_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "$0.00";
}

function numberValue(value: string | number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function percentValue(value: string | number | null | undefined) {
  const n = numberValue(value);
  const percent = n <= 1 ? n * 100 : n;
  return `${percent.toFixed(percent % 1 === 0 ? 0 : 1)}%`;
}

export default function MarketplaceZonePricingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState({
    zip: "49938",
    serviceCode: "load_unload",
    crewSize: "2",
    hours: "2",
    distanceMiles: "0",
    moveDate: new Date().toISOString().slice(0, 10),
  });
  const [rateDrafts, setRateDrafts] = useState<Record<string, Partial<ZoneRate>>>({});
  const [zoneMultiplierDrafts, setZoneMultiplierDrafts] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  const zonesQuery = useQuery<ZonesResponse>({
    queryKey: ["/api/admin/marketplace/pricing-zones"],
  });

  const zones = zonesQuery.data?.zones ?? [];
  const activeZone = zones[0] ?? null;
  const selectedService = useMemo(
    () => MARKETPLACE_ZONE_SERVICE_OPTIONS.find((s) => s.code === preview.serviceCode) ?? MARKETPLACE_ZONE_SERVICE_OPTIONS[0],
    [preview.serviceCode],
  );
  const selectedShape = selectedService ? getMarketplaceRequestShape(selectedService.shapeId) : undefined;
  const pricingShapes = MARKETPLACE_REQUEST_SHAPES.filter((shape) => shape.pricingServices.length > 0);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/marketplace/quote-preview", {
        zip: preview.zip,
        serviceCode: preview.serviceCode,
        crewSize: Number(preview.crewSize),
        hours: Number(preview.hours),
        distanceMiles: Number(preview.distanceMiles || 0),
        moveDate: preview.moveDate,
      });
      return res.json() as Promise<MarketplaceQuotePreview>;
    },
  });
  const previewData = previewMutation.data;
  const previewCrewSize = previewData ? marketplacePreviewCrewSize(previewData, Number(preview.crewSize)) : 0;
  const previewBillableHours = previewData ? marketplacePreviewBillableHours(previewData, Number(preview.hours)) : 0;

  const zoneMutation = useMutation({
    mutationFn: async ({ zone, laborMultiplier }: { zone: PricingZone; laborMultiplier: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/marketplace/pricing-zones/${zone.id}`, {
        ...zone,
        laborMultiplier,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pricing-zones"] });
      toast({ title: "Zone labor multiplier saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save zone multiplier", description: err.message, variant: "destructive" });
    },
  });

  const rateMutation = useMutation({
    mutationFn: async (rate: ZoneRate) => {
      const draft = rateDrafts[rate.id] ?? {};
      const res = await apiRequest("POST", "/api/admin/marketplace/zone-rates", {
        zoneId: rate.zoneId,
        serviceCode: draft.serviceCode ?? rate.serviceCode,
        serviceLabel: draft.serviceLabel ?? rate.serviceLabel,
        crewSize: Number(draft.crewSize ?? rate.crewSize),
        dayOfWeek: rate.dayOfWeek,
        hourlyRate: Number(draft.hourlyRate ?? rate.hourlyRate),
        minimumHours: Number(draft.minimumHours ?? rate.minimumHours),
        discountAfterHours:
          draft.discountAfterHours === null || draft.discountAfterHours === ""
            ? null
            : Number(draft.discountAfterHours ?? rate.discountAfterHours ?? 0),
        discountedHourlyRate:
          draft.discountedHourlyRate === null || draft.discountedHourlyRate === ""
            ? null
            : Number(draft.discountedHourlyRate ?? rate.discountedHourlyRate ?? 0),
        active: draft.active ?? rate.active,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pricing-zones"] });
      toast({ title: "Zone rate saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save rate", description: err.message, variant: "destructive" });
    },
  });

  const copyDayMutation = useMutation({
    mutationFn: async (zoneId: string) => {
      const res = await apiRequest("POST", "/api/admin/marketplace/zone-rates/copy-day", {
        zoneId: Number(zoneId),
        sourceDayOfWeek: selectedDay,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pricing-zones"] });
      toast({ title: `Copied ${RATE_DAYS[selectedDay]} rates to all days` });
    },
    onError: (err: Error) => {
      toast({ title: "Could not copy daily rates", description: err.message, variant: "destructive" });
    },
  });

  function draftValue(rate: ZoneRate, key: keyof ZoneRate) {
    return String((rateDrafts[rate.id]?.[key] as string | number | boolean | null | undefined) ?? rate[key] ?? "");
  }

  function updateRateDraft(rate: ZoneRate, patch: Partial<ZoneRate>) {
    setRateDrafts((current) => ({ ...current, [rate.id]: { ...current[rate.id], ...patch } }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-300" />
          <h2 className="text-lg font-black text-white">Pricing Shapes</h2>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Keep pricing simple: pick the job shape, set the zone rate, then the lead card carries the quote snapshot.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {pricingShapes.map((shape) => (
            <div key={shape.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-white">{shape.shape}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{shape.references}</p>
                </div>
                <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-200">
                  zone priced
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
                <p><span className="font-bold text-blue-200">Customer:</span> {shape.customer}</p>
                <p><span className="font-bold text-emerald-200">Worker:</span> {shape.worker}</p>
                <p><span className="font-bold text-orange-200">Company:</span> {shape.company}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <MarketplaceZoneMapBuilder
        zones={zones}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pricing-zones"] })}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Map className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-white">Zone Rates</h2>
              <p className="text-sm text-slate-400">
                Polygon zones choose the lowest matching estimate. Use the map builder above for base/radius zones, then tune rates below.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Rate day">
            {RATE_DAYS.map((day, dayIndex) => (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={selectedDay === dayIndex ? "default" : "outline"}
                onClick={() => setSelectedDay(dayIndex)}
                className={selectedDay === dayIndex ? "bg-blue-600 hover:bg-blue-500" : "border-slate-700 text-slate-300 hover:bg-slate-800"}
              >
                {day.slice(0, 3)}
              </Button>
            ))}
          </div>

          {zonesQuery.isLoading ? (
            <p className="mt-6 text-sm text-slate-400">Loading zone pricing...</p>
          ) : zones.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">No zones yet. The server seeds Ironwood Local when pricing initializes.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {zones.map((zone) => (
                <div key={zone.id} className="rounded-lg border border-slate-700 bg-slate-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-white">{zone.name}</p>
                      <p className="text-xs text-slate-500">
                        {zone.code} - labor {numberValue(zone.laborMultiplier || 1).toFixed(2)}× - travel {money(zone.travelBaseFee)} + {money(zone.travelPerMile)}/mi - padding {percentValue(zone.estimatePaddingPct)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${zone.active ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-700 text-slate-300"}`}>
                      {zone.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-2 border-b border-slate-800 px-4 py-3">
                    <div className="w-44">
                      <Label className="text-[11px] text-slate-500">Labor multiplier</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={zoneMultiplierDrafts[zone.id] ?? String(zone.laborMultiplier ?? 1)}
                        onChange={(event) => setZoneMultiplierDrafts((current) => ({ ...current, [zone.id]: event.target.value }))}
                        className="mt-1 h-8 border-slate-700 bg-slate-950 text-sm text-white"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={zoneMutation.isPending}
                      onClick={() => zoneMutation.mutate({ zone, laborMultiplier: Number(zoneMultiplierDrafts[zone.id] ?? zone.laborMultiplier ?? 1) })}
                      className="h-8 border-cyan-400/35 text-cyan-200 hover:bg-cyan-500/10"
                    >
                      Save multiplier
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
                    <p className="text-xs font-medium text-slate-300">{RATE_DAYS[selectedDay]} rates</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyDayMutation.mutate(zone.id)}
                      disabled={copyDayMutation.isPending}
                      className="h-7 border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Copy to all days
                    </Button>
                  </div>
                  <div className="divide-y divide-slate-800">
                    {zone.rates.filter((rate) => rate.dayOfWeek === selectedDay).map((rate) => (
                      <div key={rate.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.2fr_90px_110px_110px_110px_110px_auto] md:items-end">
                        <div>
                          <Label className="text-[11px] text-slate-500">Service</Label>
                          <Input
                            value={draftValue(rate, "serviceLabel")}
                            onChange={(e) => updateRateDraft(rate, { serviceLabel: e.target.value })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-500">Crew</Label>
                          <Input
                            type="number"
                            min="1"
                            value={draftValue(rate, "crewSize")}
                            onChange={(e) => updateRateDraft(rate, { crewSize: Number(e.target.value) })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-500">Hourly</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={draftValue(rate, "hourlyRate")}
                            onChange={(e) => updateRateDraft(rate, { hourlyRate: e.target.value })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-500">Min Hrs</Label>
                          <Input
                            type="number"
                            min="1"
                            step="0.5"
                            value={draftValue(rate, "minimumHours")}
                            onChange={(e) => updateRateDraft(rate, { minimumHours: e.target.value })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-500">Discount At</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={draftValue(rate, "discountAfterHours")}
                            onChange={(e) => updateRateDraft(rate, { discountAfterHours: e.target.value })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-500">Discount Rate</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={draftValue(rate, "discountedHourlyRate")}
                            onChange={(e) => updateRateDraft(rate, { discountedHourlyRate: e.target.value })}
                            className="mt-1 bg-slate-950 border-slate-700 text-white"
                          />
                        </div>
                        <Button
                          type="button"
                          onClick={() => rateMutation.mutate(rate)}
                          disabled={rateMutation.isPending}
                          className="bg-blue-600 hover:bg-blue-500"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="rounded-xl border border-slate-700/60 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-amber-300" />
            <h2 className="text-lg font-black text-white">Quote Preview</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Test what a customer sees before staff confirms the final quote.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <Label className="text-xs text-slate-400">ZIP code</Label>
              <Input value={preview.zip} onChange={(e) => setPreview((p) => ({ ...p, zip: e.target.value }))} className="mt-1 bg-slate-950 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Move date</Label>
              <Input type="date" value={preview.moveDate} onChange={(e) => setPreview((p) => ({ ...p, moveDate: e.target.value }))} className="mt-1 bg-slate-950 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Service</Label>
              <select
                value={preview.serviceCode}
                onChange={(e) => {
                  const service = MARKETPLACE_ZONE_SERVICE_OPTIONS.find((option) => option.code === e.target.value);
                  setPreview((p) => ({
                    ...p,
                    serviceCode: e.target.value,
                    crewSize: String(service?.defaultCrewSize ?? p.crewSize),
                    hours: String(service?.defaultHours ?? p.hours),
                  }));
                }}
                className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                {MARKETPLACE_ZONE_SERVICE_OPTIONS.map((service) => (
                  <option key={service.code} value={service.code}>{service.label}</option>
                ))}
              </select>
              {selectedService && (
                <p className="mt-1 text-xs text-slate-500">
                  Default: {selectedService.defaultCrewSize} crew, {selectedService.defaultHours} hours.
                </p>
              )}
            </div>
            {selectedShape && selectedService && (
              <div className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-3 text-xs leading-5 text-slate-200">
                <p className="font-black text-blue-200">{selectedShape.shape}</p>
                <p className="mt-1"><span className="font-bold">Ask:</span> {selectedService.customerPrompt}</p>
                <p><span className="font-bold">Crew:</span> {selectedService.workerReality}</p>
                <p><span className="font-bold">Ops:</span> {selectedService.companyReality}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400">Crew size</Label>
                <Input type="number" min="1" value={preview.crewSize} onChange={(e) => setPreview((p) => ({ ...p, crewSize: e.target.value }))} className="mt-1 bg-slate-950 border-slate-700 text-white" />
              </div>
              <div>
                <Label className="text-xs text-slate-400">Hours</Label>
                <Input type="number" min="2" step="1" value={preview.hours} onChange={(e) => setPreview((p) => ({ ...p, hours: e.target.value }))} className="mt-1 bg-slate-950 border-slate-700 text-white" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-400">Travel miles outside zone</Label>
              <Input type="number" min="0" value={preview.distanceMiles} onChange={(e) => setPreview((p) => ({ ...p, distanceMiles: e.target.value }))} className="mt-1 bg-slate-950 border-slate-700 text-white" />
            </div>
            <Button
              type="button"
              className="w-full bg-orange-600 hover:bg-orange-500"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? "Previewing..." : "Preview Estimate"}
            </Button>
          </div>

          {previewData && (
            <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                {marketplacePreviewZoneName(previewData)}
              </p>
              <p className="mt-1 text-3xl font-black text-white">{marketplaceEstimateLabel(previewData)}</p>
              <div className="mt-3 space-y-1 text-xs text-emerald-100/80">
                <p>{selectedService.label} - {previewCrewSize} crew - {previewBillableHours} billable hours</p>
                <p>Labor {money(previewData.quote.labor)} - travel {money(previewData.quote.travel)}</p>
              </div>
            </div>
          )}

          {previewMutation.error && (
            <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
              {(previewMutation.error as Error).message}
            </div>
          )}

          {activeZone && (
            <div className="mt-5 rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-400">
              <p className="flex items-center gap-2 font-bold text-slate-200">
                <Settings2 className="h-4 w-4" />
                Current working zone
              </p>
              <p className="mt-1">{activeZone.name} is seeded as the local Ironwood-style zone. Polygon drawing and additional city zones can now attach to this same rate model.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
