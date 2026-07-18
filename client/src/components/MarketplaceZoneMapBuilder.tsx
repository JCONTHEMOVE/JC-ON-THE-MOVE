import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Compass, Radar, Save } from "lucide-react";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type LngLat = [number, number];

type PricingZone = {
  id: string | number;
  code: string;
  name: string;
  active: boolean;
  polygon?: LngLat[];
};

type MarketplaceZoneMapBuilderProps = {
  zones: PricingZone[];
  onSaved: () => void;
  className?: string;
};

type Draft = {
  code: string;
  name: string;
  address: string;
  lat: string;
  lng: string;
  radiusMiles: string;
  priority: string;
  travelBaseFee: string;
  travelPerMile: string;
  laborMultiplier: string;
  estimatePaddingPct: string;
};

const quickBases = [
  { label: "Ironwood", name: "Ironwood MI", code: "IRONWOOD", lat: "46.454", lng: "-90.172", radiusMiles: "25" },
  { label: "Iron River", name: "Iron River MI", code: "IRON_RIVER", lat: "46.092", lng: "-88.642", radiusMiles: "30" },
  { label: "Wausau", name: "Wausau WI", code: "WAUSAU", lat: "44.959", lng: "-89.630", radiusMiles: "25" },
] as const;

const initialDraft: Draft = {
  code: "WAUSAU",
  name: "Wausau WI",
  address: "",
  lat: "44.959",
  lng: "-89.630",
  radiusMiles: "25",
  priority: "50",
  travelBaseFee: "0",
  travelPerMile: "0",
  laborMultiplier: "1",
  estimatePaddingPct: "0.12",
};

function cleanCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function numberOrNull(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function circlePolygon(lat: number, lng: number, radiusMiles: number, points = 40): LngLat[] {
  const latDelta = radiusMiles / 69;
  const lngDelta = radiusMiles / (69 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return Array.from({ length: points }, (_, index) => {
    const angle = (index / points) * Math.PI * 2;
    return [
      Number((lng + Math.cos(angle) * lngDelta).toFixed(6)),
      Number((lat + Math.sin(angle) * latDelta).toFixed(6)),
    ];
  });
}

function boundsFor(polygons: LngLat[][], center?: { lat: number; lng: number }) {
  const all = polygons.flat();
  if (center) all.push([center.lng, center.lat]);
  if (all.length === 0) return { minLng: -91, maxLng: -88, minLat: 45.5, maxLat: 46.8 };
  const lngs = all.map((point) => point[0]);
  const lats = all.map((point) => point[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngPad = Math.max(0.08, (maxLng - minLng) * 0.12);
  const latPad = Math.max(0.08, (maxLat - minLat) * 0.12);
  return {
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
  };
}

function project(point: LngLat, bounds: ReturnType<typeof boundsFor>) {
  const lngSpan = Math.max(0.0001, bounds.maxLng - bounds.minLng);
  const latSpan = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const x = ((point[0] - bounds.minLng) / lngSpan) * 100;
  const y = 100 - ((point[1] - bounds.minLat) / latSpan) * 100;
  return `${x.toFixed(2)},${y.toFixed(2)}`;
}

function polygonPoints(polygon: LngLat[], bounds: ReturnType<typeof boundsFor>) {
  return polygon.map((point) => project(point, bounds)).join(" ");
}

export default function MarketplaceZoneMapBuilder({
  zones,
  onSaved,
  className = "",
}: MarketplaceZoneMapBuilderProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const lat = numberOrNull(draft.lat);
  const lng = numberOrNull(draft.lng);
  const radius = Math.max(1, Number(draft.radiusMiles || 0));
  const center = lat != null && lng != null ? { lat, lng } : undefined;
  const draftPolygon = useMemo(
    () => (center ? circlePolygon(center.lat, center.lng, radius) : []),
    [center?.lat, center?.lng, radius],
  );
  const existingPolygons = useMemo(
    () => zones.map((zone) => zone.polygon || []).filter((polygon) => polygon.length >= 3),
    [zones],
  );
  const mapBounds = useMemo(
    () => boundsFor([...existingPolygons, draftPolygon].filter((polygon) => polygon.length >= 3), center),
    [center?.lat, center?.lng, draftPolygon, existingPolygons],
  );
  const centerPoint = center ? project([center.lng, center.lat], mapBounds).split(",") : null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim() || !draft.code.trim()) throw new Error("Zone name and code are required.");
      if (draftPolygon.length < 3) throw new Error("Pick a base location and radius first.");
      const res = await apiRequest("POST", "/api/admin/marketplace/pricing-zones", {
        code: cleanCode(draft.code),
        name: draft.name.trim(),
        polygon: draftPolygon,
        active: true,
        priority: Number(draft.priority || 100),
        travelBaseFee: Number(draft.travelBaseFee || 0),
        travelPerMile: Number(draft.travelPerMile || 0),
        laborMultiplier: Number(draft.laborMultiplier || 1),
        estimatePaddingPct: Number(draft.estimatePaddingPct || 0.12),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Zone saved", description: `${draft.name} is ready for rate rows.` });
      onSaved();
    },
    onError: (error: Error) => {
      toast({ title: "Could not save zone", description: error.message, variant: "destructive" });
    },
  });

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  return (
    <section className={`rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-cyan-300">
            <Radar className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em]">Zone Map Builder</p>
          </div>
          <h2 className="mt-1 text-lg font-black text-white">Ping a base, preview the service radius</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
            Start with a town or address, set a radius, then save the highlighted area as a polygon pricing zone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickBases.map((base) => (
            <button
              key={base.code}
              type="button"
              onClick={() => patch({
                name: base.name,
                code: base.code,
                lat: base.lat,
                lng: base.lng,
                radiusMiles: base.radiusMiles,
              })}
              className="rounded-full border border-cyan-400/25 bg-slate-950/60 px-3 py-1 text-[11px] font-bold text-cyan-100 hover:bg-cyan-500/15"
            >
              {base.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-slate-400">Find base location</Label>
            <AddressAutocomplete
              value={draft.address}
              onChange={(value) => patch({ address: value })}
              onSelect={(value, result) => {
                const city = result.address.city || result.address.town || result.address.village || value.split(",")[0] || "";
                const state = result.address.state || "";
                const name = [city, state].filter(Boolean).join(" ");
                patch({
                  address: value,
                  name: name || draft.name,
                  code: cleanCode(name || draft.code),
                  lat: Number(result.lat).toFixed(6),
                  lng: Number(result.lon).toFixed(6),
                });
              }}
              placeholder="Search city, town, or address"
              dark
              allowPlaceResults
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Zone code</Label>
              <Input value={draft.code} onChange={(e) => patch({ code: cleanCode(e.target.value) })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Zone name</Label>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Lat</Label>
              <Input value={draft.lat} onChange={(e) => patch({ lat: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Lng</Label>
              <Input value={draft.lng} onChange={(e) => patch({ lng: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Radius mi</Label>
              <Input type="number" min="1" value={draft.radiusMiles} onChange={(e) => patch({ radiusMiles: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-400">Base fee</Label>
              <Input type="number" min="0" value={draft.travelBaseFee} onChange={(e) => patch({ travelBaseFee: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Per mile</Label>
              <Input type="number" min="0" value={draft.travelPerMile} onChange={(e) => patch({ travelPerMile: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Labor multiplier</Label>
              <Input type="number" min="0" step="0.01" value={draft.laborMultiplier} onChange={(e) => patch({ laborMultiplier: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Padding</Label>
              <Input type="number" min="0" step="0.01" value={draft.estimatePaddingPct} onChange={(e) => patch({ estimatePaddingPct: e.target.value })} className="mt-1 border-slate-700 bg-slate-950 text-white" />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || draftPolygon.length < 3}
            className="w-full bg-cyan-600 font-bold text-white hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500"
          >
            {saveMutation.isPending ? (
              "Saving zone..."
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Radius As Zone
              </>
            )}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-black text-white">
                <Compass className="h-4 w-4 text-cyan-300" />
                Estimated map radius
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {center ? `${draft.name} - ${radius} miles` : "Pick a base location to draw the zone."}
              </p>
            </div>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase text-cyan-200">
              polygon
            </span>
          </div>

          <svg viewBox="0 0 100 100" role="img" aria-label="Pricing zone radius preview" className="h-[320px] w-full rounded-lg border border-slate-800 bg-slate-900">
            <defs>
              <pattern id="zone-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.35" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="100" fill="url(#zone-grid)" />
            {zones.map((zone) => {
              const polygon = zone.polygon || [];
              if (polygon.length < 3) return null;
              return (
                <polygon
                  key={zone.id}
                  points={polygonPoints(polygon, mapBounds)}
                  fill={zone.active ? "rgba(59,130,246,0.16)" : "rgba(100,116,139,0.12)"}
                  stroke={zone.active ? "rgba(96,165,250,0.65)" : "rgba(148,163,184,0.35)"}
                  strokeWidth="0.75"
                />
              );
            })}
            {draftPolygon.length >= 3 && (
              <polygon
                points={polygonPoints(draftPolygon, mapBounds)}
                fill="rgba(34,211,238,0.24)"
                stroke="rgba(34,211,238,0.95)"
                strokeWidth="1.1"
              />
            )}
            {center && centerPoint && (
              <>
                <circle cx={centerPoint[0]} cy={centerPoint[1]} r="1.7" fill="#f97316" />
                <text x="4" y="94" fill="#94a3b8" fontSize="3.2">
                  Base: {center.lat.toFixed(3)}, {center.lng.toFixed(3)}
                </text>
              </>
            )}
          </svg>

          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-3">
            <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
              <p className="font-bold text-slate-200">Existing</p>
              <p>{zones.length} configured</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
              <p className="font-bold text-slate-200">Draft points</p>
              <p>{draftPolygon.length || 0} polygon points</p>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/70 p-2">
              <p className="font-bold text-slate-200">Overlap rule</p>
              <p>Lowest estimate wins</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/90">
            <p className="font-black text-amber-200">Next level</p>
            <p>
              This saves a radius as a polygon. A later drawing tool can edit the exact corners for towns, highways,
              and special coverage pockets.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
