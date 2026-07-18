import { pool } from "../db";
import { calculateLaborBooking, type LaborWorkScope } from "@shared/laborBooking";

export type LngLat = [number, number];

export interface MarketplacePricingZone {
  id: number;
  code: string;
  name: string;
  polygon: LngLat[];
  active: boolean;
  priority: number;
  travelBaseFee: number;
  travelPerMile: number;
  laborMultiplier: number;
  estimatePaddingPct: number;
}

export interface MarketplaceZoneRate {
  id: number;
  zoneId: number;
  serviceCode: string;
  serviceLabel: string;
  crewSize: number;
  /** Sunday = 0 through Saturday = 6, matching Date#getDay(). */
  dayOfWeek: number;
  hourlyRate: number;
  minimumHours: number;
  discountAfterHours: number | null;
  discountedHourlyRate: number | null;
  active: boolean;
}

let initialized = false;

export const MARKETPLACE_RATE_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

const IRONWOOD_POLYGON: LngLat[] = [
  [-90.38, 46.32],
  [-89.93, 46.32],
  [-89.93, 46.62],
  [-90.38, 46.62],
];

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parsePolygon(value: unknown): LngLat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => Array.isArray(point) && point.length >= 2
      ? [Number(point[0]), Number(point[1])] as LngLat
      : null)
    .filter((point): point is LngLat => !!point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function rowToZone(row: any): MarketplacePricingZone {
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    polygon: parsePolygon(row.polygon),
    active: row.active !== false,
    priority: Number(row.priority ?? 100),
    travelBaseFee: Number(row.travel_base_fee ?? 0),
    travelPerMile: Number(row.travel_per_mile ?? 0),
    laborMultiplier: Number(row.labor_multiplier ?? 1),
    estimatePaddingPct: Number(row.estimate_padding_pct ?? 0.12),
  };
}

function rowToRate(row: any): MarketplaceZoneRate {
  return {
    id: Number(row.id),
    zoneId: Number(row.zone_id),
    serviceCode: row.service_code,
    serviceLabel: row.service_label,
    crewSize: Number(row.crew_size),
    dayOfWeek: Number(row.day_of_week ?? 0),
    hourlyRate: Number(row.hourly_rate),
    minimumHours: Number(row.minimum_hours),
    discountAfterHours: row.discount_after_hours == null ? null : Number(row.discount_after_hours),
    discountedHourlyRate: row.discounted_hourly_rate == null ? null : Number(row.discounted_hourly_rate),
    active: row.active !== false,
  };
}

export async function ensureMarketplaceZonePricing() {
  if (initialized) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_pricing_zones (
      id SERIAL PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name TEXT NOT NULL,
      polygon JSONB NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      priority INTEGER NOT NULL DEFAULT 100,
      travel_base_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
      travel_per_mile NUMERIC(10,2) NOT NULL DEFAULT 0,
      estimate_padding_pct NUMERIC(6,4) NOT NULL DEFAULT 0.1200,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE marketplace_pricing_zones ADD COLUMN IF NOT EXISTS labor_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.000`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketplace_zone_rates (
      id SERIAL PRIMARY KEY,
      zone_id INTEGER NOT NULL REFERENCES marketplace_pricing_zones(id) ON DELETE CASCADE,
      service_code TEXT NOT NULL,
      service_label TEXT NOT NULL,
      crew_size INTEGER NOT NULL,
      day_of_week SMALLINT NOT NULL DEFAULT 0 CHECK (day_of_week BETWEEN 0 AND 6),
      hourly_rate NUMERIC(10,2) NOT NULL,
      minimum_hours NUMERIC(5,2) NOT NULL DEFAULT 2,
      discount_after_hours NUMERIC(5,2),
      discounted_hourly_rate NUMERIC(10,2),
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(zone_id, service_code, crew_size, day_of_week)
    )
  `);

  // Existing installations used one row for all days. Preserve every rate,
  // then expand it to a seven-day schedule before new daily pricing is used.
  await pool.query(`ALTER TABLE marketplace_zone_rates ADD COLUMN IF NOT EXISTS day_of_week SMALLINT`);
  await pool.query(`UPDATE marketplace_zone_rates SET day_of_week = 0 WHERE day_of_week IS NULL`);
  await pool.query(`ALTER TABLE marketplace_zone_rates ALTER COLUMN day_of_week SET DEFAULT 0`);
  await pool.query(`ALTER TABLE marketplace_zone_rates ALTER COLUMN day_of_week SET NOT NULL`);
  await pool.query(`ALTER TABLE marketplace_zone_rates DROP CONSTRAINT IF EXISTS marketplace_zone_rates_zone_id_service_code_crew_size_key`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS marketplace_zone_rates_day_unique
    ON marketplace_zone_rates (zone_id, service_code, crew_size, day_of_week)
  `);
  await pool.query(`
    INSERT INTO marketplace_zone_rates
      (zone_id, service_code, service_label, crew_size, day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate, active)
    SELECT zone_id, service_code, service_label, crew_size, days.day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate, active
    FROM marketplace_zone_rates
    CROSS JOIN generate_series(1, 6) AS days(day_of_week)
    WHERE marketplace_zone_rates.day_of_week = 0
    ON CONFLICT (zone_id, service_code, crew_size, day_of_week) DO NOTHING
  `);

  const { rows } = await pool.query<{ id: number }>(`
    INSERT INTO marketplace_pricing_zones
      (code, name, polygon, active, priority, travel_base_fee, travel_per_mile, estimate_padding_pct)
    VALUES
      ('IRONWOOD_LOCAL', 'Ironwood Local', $1::jsonb, true, 10, 0, 0, 0.1000)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      polygon = COALESCE(marketplace_pricing_zones.polygon, EXCLUDED.polygon)
    RETURNING id
  `, [JSON.stringify(IRONWOOD_POLYGON)]);
  const zoneId = rows[0]?.id;
  if (zoneId) {
    const defaults = [
      ["load_unload", "Load/Unload", 1, 150, 2, 5, 125],
      ["load_unload", "Load/Unload", 2, 135, 2, 3, 125],
      ["load_unload", "Load/Unload", 3, 170, 2, 3, 155],
      ["load_unload", "Load/Unload", 4, 300, 2, 3, 270],
      ["pack_unpack", "Pack/Unpack", 2, 200, 2, 4, 160],
      ["delivery", "Delivery", 2, 200, 2, 3, 175],
      ["ubox", "U-Box Load/Unload", 2, 225, 2, 3, 200],
    ] as const;
    for (const dayOfWeek of MARKETPLACE_RATE_DAYS.keys()) {
      for (const r of defaults) {
        await pool.query(`
          INSERT INTO marketplace_zone_rates
            (zone_id, service_code, service_label, crew_size, day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (zone_id, service_code, crew_size, day_of_week) DO NOTHING
        `, [zoneId, ...r.slice(0, 3), dayOfWeek, ...r.slice(3)]);
      }
    }
    await pool.query(`
      UPDATE marketplace_zone_rates
      SET hourly_rate = 135, discounted_hourly_rate = 125
      WHERE zone_id = $1 AND service_code = 'load_unload' AND crew_size = 2
        AND hourly_rate = 200 AND discounted_hourly_rate = 175
    `, [zoneId]);
    await pool.query(`
      UPDATE marketplace_zone_rates
      SET hourly_rate = 170, discounted_hourly_rate = 155
      WHERE zone_id = $1 AND service_code = 'load_unload' AND crew_size = 3
        AND hourly_rate = 250 AND discounted_hourly_rate = 225
    `, [zoneId]);
  }
  initialized = true;
}

export function pointInPolygon(lng: number, lat: number, polygon: LngLat[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersects = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export async function listPricingZones() {
  await ensureMarketplaceZonePricing();
  const zoneRows = await pool.query(`SELECT * FROM marketplace_pricing_zones ORDER BY active DESC, priority ASC, id ASC`);
  const rateRows = await pool.query(`SELECT * FROM marketplace_zone_rates ORDER BY zone_id, day_of_week, service_code, crew_size`);
  const ratesByZone = new Map<number, MarketplaceZoneRate[]>();
  for (const row of rateRows.rows) {
    const rate = rowToRate(row);
    ratesByZone.set(rate.zoneId, [...(ratesByZone.get(rate.zoneId) || []), rate]);
  }
  return zoneRows.rows.map((row) => {
    const zone = rowToZone(row);
    return { ...zone, rates: ratesByZone.get(zone.id) || [] };
  });
}

export async function upsertPricingZone(input: Partial<MarketplacePricingZone> & { id?: number }) {
  await ensureMarketplaceZonePricing();
  const polygon = parsePolygon(input.polygon);
  if (!input.name || !input.code) throw new Error("code and name are required");
  if (polygon.length < 3) throw new Error("polygon must include at least 3 [lng,lat] points");
  if (input.id) {
    const { rows } = await pool.query(`
      UPDATE marketplace_pricing_zones
      SET code=$2, name=$3, polygon=$4::jsonb, active=$5, priority=$6,
          travel_base_fee=$7, travel_per_mile=$8, labor_multiplier=$9, estimate_padding_pct=$10, updated_at=NOW()
      WHERE id=$1
      RETURNING *
    `, [
      input.id,
      String(input.code).trim().toUpperCase(),
      String(input.name).trim(),
      JSON.stringify(polygon),
      input.active !== false,
      toNumber(input.priority, 100),
      toNumber(input.travelBaseFee, 0),
      toNumber(input.travelPerMile, 0),
      Math.max(0, toNumber(input.laborMultiplier, 1)),
      toNumber(input.estimatePaddingPct, 0.12),
    ]);
    if (!rows[0]) throw new Error("zone not found");
    return rowToZone(rows[0]);
  }
  const { rows } = await pool.query(`
    INSERT INTO marketplace_pricing_zones
      (code, name, polygon, active, priority, travel_base_fee, travel_per_mile, labor_multiplier, estimate_padding_pct)
    VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `, [
    String(input.code).trim().toUpperCase(),
    String(input.name).trim(),
    JSON.stringify(polygon),
    input.active !== false,
    toNumber(input.priority, 100),
    toNumber(input.travelBaseFee, 0),
    toNumber(input.travelPerMile, 0),
    Math.max(0, toNumber(input.laborMultiplier, 1)),
    toNumber(input.estimatePaddingPct, 0.12),
  ]);
  return rowToZone(rows[0]);
}

export async function deletePricingZone(id: number) {
  await ensureMarketplaceZonePricing();
  const result = await pool.query(`DELETE FROM marketplace_pricing_zones WHERE id=$1`, [id]);
  return (result.rowCount || 0) > 0;
}

export async function upsertZoneRate(input: Partial<MarketplaceZoneRate>) {
  await ensureMarketplaceZonePricing();
  if (!input.zoneId || !input.serviceCode || !input.serviceLabel || !input.crewSize) {
    throw new Error("zoneId, serviceCode, serviceLabel, and crewSize are required");
  }
  const { rows } = await pool.query(`
    INSERT INTO marketplace_zone_rates
      (zone_id, service_code, service_label, crew_size, day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (zone_id, service_code, crew_size, day_of_week) DO UPDATE SET
      service_label=EXCLUDED.service_label,
      hourly_rate=EXCLUDED.hourly_rate,
      minimum_hours=EXCLUDED.minimum_hours,
      discount_after_hours=EXCLUDED.discount_after_hours,
      discounted_hourly_rate=EXCLUDED.discounted_hourly_rate,
      active=EXCLUDED.active
    RETURNING *
  `, [
    input.zoneId,
    input.serviceCode,
    input.serviceLabel,
    input.crewSize,
    Math.max(0, Math.min(6, Math.round(toNumber(input.dayOfWeek, 0)))),
    toNumber(input.hourlyRate, 0),
    Math.max(2, toNumber(input.minimumHours, 2)),
    input.discountAfterHours == null ? null : toNumber(input.discountAfterHours),
    input.discountedHourlyRate == null ? null : toNumber(input.discountedHourlyRate),
    input.active !== false,
  ]);
  return rowToRate(rows[0]);
}

export async function copyZoneRatesToAllDays(zoneId: number, sourceDayOfWeek: number) {
  await ensureMarketplaceZonePricing();
  const sourceDay = Math.max(0, Math.min(6, Math.round(sourceDayOfWeek)));
  const { rows } = await pool.query(`
    INSERT INTO marketplace_zone_rates
      (zone_id, service_code, service_label, crew_size, day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate, active)
    SELECT zone_id, service_code, service_label, crew_size, days.day_of_week, hourly_rate, minimum_hours, discount_after_hours, discounted_hourly_rate, active
    FROM marketplace_zone_rates
    CROSS JOIN generate_series(0, 6) AS days(day_of_week)
    WHERE zone_id = $1 AND day_of_week = $2
    ON CONFLICT (zone_id, service_code, crew_size, day_of_week) DO UPDATE SET
      service_label = EXCLUDED.service_label,
      hourly_rate = EXCLUDED.hourly_rate,
      minimum_hours = EXCLUDED.minimum_hours,
      discount_after_hours = EXCLUDED.discount_after_hours,
      discounted_hourly_rate = EXCLUDED.discounted_hourly_rate,
      active = EXCLUDED.active
    RETURNING *
  `, [zoneId, sourceDay]);
  return rows.map(rowToRate);
}

async function coordsFromZip(zip: string): Promise<{ lat: number; lng: number } | null> {
  const clean = zip.trim();
  if (clean === "49938") return { lat: 46.4547, lng: -90.1710 };
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const data = await res.json() as { places?: Array<{ latitude: string; longitude: string }> };
    const place = data.places?.[0];
    if (!place) return null;
    return { lat: Number(place.latitude), lng: Number(place.longitude) };
  } catch {
    return null;
  }
}

function calculateHourly(rate: MarketplaceZoneRate, requestedHours: number) {
  const billableHours = Math.max(requestedHours, 2, rate.minimumHours);
  const threshold = rate.discountAfterHours;
  const discounted = rate.discountedHourlyRate;
  if (threshold != null && discounted != null && billableHours > threshold) {
    return threshold * rate.hourlyRate + (billableHours - threshold) * discounted;
  }
  return billableHours * rate.hourlyRate;
}

export async function previewZoneQuote(input: {
  lat?: number;
  lng?: number;
  zip?: string;
  serviceCode?: string;
  crewSize?: number;
  hours?: number;
  distanceMiles?: number;
  moveDate?: string;
  workScope?: LaborWorkScope | string;
  oversized?: boolean;
}) {
  await ensureMarketplaceZonePricing();
  let lat = input.lat;
  let lng = input.lng;
  if ((lat == null || lng == null) && input.zip) {
    const coords = await coordsFromZip(input.zip);
    lat = coords?.lat;
    lng = coords?.lng;
  }
  const serviceCode = input.serviceCode || "load_unload";
  const crewSize = Math.max(1, Math.round(toNumber(input.crewSize, 2)));
  const hours = Math.max(1, toNumber(input.hours, 1));
  const distanceMiles = Math.max(0, toNumber(input.distanceMiles, 0));
  const moveDate = typeof input.moveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.moveDate)
    ? input.moveDate
    : null;
  const dayOfWeek = moveDate ? new Date(`${moveDate}T12:00:00Z`).getUTCDay() : null;
  const zones = await listPricingZones();
  const matched = lat != null && lng != null
    ? zones.filter((zone) => zone.active && pointInPolygon(lng!, lat!, zone.polygon))
    : [];
  const candidates = matched.flatMap((zone) => {
    const rate = zone.rates.find((r) =>
      r.active && r.serviceCode === serviceCode && r.crewSize === crewSize && r.dayOfWeek === dayOfWeek,
    ) || null;
    if (!rate && serviceCode !== "load_unload") return [];
    const zoneDiscountPct = rate?.discountedHourlyRate != null && rate.hourlyRate > 0
      ? Math.max(0, Math.min(100, (1 - rate.discountedHourlyRate / rate.hourlyRate) * 100))
      : undefined;
    const booking = serviceCode === "load_unload"
      ? calculateLaborBooking({
          crewSize,
          hours,
          workScope: input.workScope,
          oversized: input.oversized,
          zoneMultiplier: zone.laborMultiplier,
          longBookingDiscountPct: zoneDiscountPct,
          longBookingDiscountAfterHours: rate?.discountAfterHours ?? 4,
        })
      : null;
    const labor = booking ? booking.laborTotal : calculateHourly(rate!, hours);
    const travel = zone.travelBaseFee + zone.travelPerMile * distanceMiles;
    const subtotal = labor + travel;
    const padding = Math.max(0, zone.estimatePaddingPct);
    return [{
      zone,
      rate,
      booking,
      labor,
      travel,
      subtotal,
      minEstimate: Math.round(subtotal * (1 - padding)),
      maxEstimate: Math.round(subtotal * (1 + padding)),
    }];
  }).sort((a, b) => a.minEstimate - b.minEstimate);

  if (candidates[0]) {
    return {
      matched: true,
      quote: candidates[0],
      candidates,
      moveDate,
      dayOfWeek,
      dayName: dayOfWeek == null ? null : MARKETPLACE_RATE_DAYS[dayOfWeek],
      coordinates: lat != null && lng != null ? { lat, lng } : null,
    };
  }
  const booking = serviceCode === "load_unload"
    ? calculateLaborBooking({ crewSize, hours, workScope: input.workScope, oversized: input.oversized })
    : null;
  const fallbackSubtotal = booking ? booking.laborTotal : crewSize * Math.max(hours, 2) * 100;
  return {
    matched: false,
    coordinates: lat != null && lng != null ? { lat, lng } : null,
    moveDate,
    dayOfWeek,
    dayName: dayOfWeek == null ? null : MARKETPLACE_RATE_DAYS[dayOfWeek],
    quote: {
      zone: null,
      rate: null,
      booking,
      labor: fallbackSubtotal,
      travel: distanceMiles * 2,
      subtotal: fallbackSubtotal + distanceMiles * 2,
      minEstimate: Math.round((fallbackSubtotal + distanceMiles * 2) * 0.85),
      maxEstimate: Math.round((fallbackSubtotal + distanceMiles * 2) * 1.15),
    },
    candidates: [],
  };
}
