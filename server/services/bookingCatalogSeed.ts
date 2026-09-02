// Seed `service_catalog` and `bundle_definitions` with the platform's
// services, small-job add-ons, and the 5 featured bundles from the spec.
//
// Idempotent — uses `code` as the natural key so re-running on an existing DB
// only inserts missing rows. Existing rows are NOT mutated, so admins can
// safely tweak prices/labels in the DB without having them clobbered on the
// next deploy.

import { db, pool } from "../db";
import {
  serviceCatalog,
  bundleDefinitions,
  type InsertServiceCatalogEntry,
  type InsertBundleDefinition,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { SERVICE_LABOR_DEFAULTS } from "@shared/pricingTables";
import { CANONICAL_PRICING_2026_08, catalogPriceSummary } from "@shared/canonicalPricing";
import { ensureCanonicalPricingVersionsSeeded } from "./pricingVersions";

// Task #218 — labor metadata derived from the SERVICE_LABOR_DEFAULTS
// constant in shared/pricingTables.ts. This map is the source of truth
// the seed writes into service_catalog.{min_crew, default_labor_hours}
// so the helper can read crew/hours from the catalog row at quote time
// without having to import the constant. Adding a new service is a
// one-place change: drop a row in SERVICE_LABOR_DEFAULTS and the seed
// picks it up on the next boot.
function laborDefaultsFor(code: string): { minCrew: number; defaultLaborHours: Record<string, number> } | null {
  const def = SERVICE_LABOR_DEFAULTS[code];
  if (!def) return null;
  const dlh: Record<string, number> = { default: def.defaultHours };
  if (def.jobSize?.small)  dlh.small  = def.jobSize.small.hours;
  if (def.jobSize?.medium) dlh.medium = def.jobSize.medium.hours;
  if (def.jobSize?.large)  dlh.large  = def.jobSize.large.hours;
  // minCrew = the lowest crew across job sizes, or the default crew when
  // no per-size variants exist. Per spec (line 36) every catalog row
  // carries this so dispatch + chat card see a single number.
  const sizeCrews = [def.jobSize?.small?.crew, def.jobSize?.medium?.crew, def.jobSize?.large?.crew].filter((n): n is number => typeof n === "number");
  const minCrew = sizeCrews.length > 0 ? Math.min(...sizeCrews, def.defaultCrew) : def.defaultCrew;
  return { minCrew, defaultLaborHours: dlh };
}

// Safe DDL — idempotent CREATE TABLE IF NOT EXISTS for the new
// multi-service booking tables. We do this at boot instead of via
// `drizzle-kit push` because the existing project has many DB-only tables
// drizzle-kit doesn't know about, which makes interactive `push` runs
// unsafe (it offers to rename them into ours). Pattern mirrors
// `ensureRevenueAllocationsTable` already used in server/routes.ts.
async function ensureBookingTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_name text NOT NULL,
      customer_email text,
      customer_phone text NOT NULL,
      service_address text,
      notes text,
      subtotal numeric(10,2) NOT NULL DEFAULT 0,
      discount_total numeric(10,2) NOT NULL DEFAULT 0,
      final_total numeric(10,2) NOT NULL DEFAULT 0,
      bundle_applied_code text,
      token_estimate integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'quote',
      source text,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_phone   ON bookings(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_bookings_email   ON bookings(customer_email);
    CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

    CREATE TABLE IF NOT EXISTS booking_service_items (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id varchar NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      service_code text NOT NULL,
      service_label text NOT NULL,
      quantity numeric(10,2) NOT NULL DEFAULT 1,
      unit_price numeric(10,2) NOT NULL,
      line_subtotal numeric(10,2) NOT NULL,
      price_mode text NOT NULL DEFAULT 'fixed',
      details jsonb DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_booking_items_booking ON booking_service_items(booking_id);
    CREATE INDEX IF NOT EXISTS idx_booking_items_service ON booking_service_items(service_code);

    CREATE TABLE IF NOT EXISTS service_catalog (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      category text NOT NULL,
      default_price_mode text NOT NULL DEFAULT 'fixed',
      default_price numeric(10,2),
      suggested_min numeric(10,2),
      suggested_max numeric(10,2),
      discount_eligible boolean NOT NULL DEFAULT true,
      is_addon boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 100,
      description text,
      metadata jsonb DEFAULT '{}'::jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_service_catalog_active ON service_catalog(is_active, sort_order);

    CREATE TABLE IF NOT EXISTS bundle_definitions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      name text NOT NULL,
      description text,
      service_combo_json jsonb NOT NULL,
      discount_type text NOT NULL,
      discount_value numeric(10,2) NOT NULL,
      max_discount numeric(10,2),
      is_featured boolean NOT NULL DEFAULT false,
      merchandising_slot text,
      priority integer NOT NULL DEFAULT 100,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_bundle_def_active ON bundle_definitions(is_active, priority);
    CREATE INDEX IF NOT EXISTS idx_bundle_def_slot   ON bundle_definitions(merchandising_slot);

    -- Task #131 — bonus JCMOVES multiplier per featured bundle
    ALTER TABLE bundle_definitions
      ADD COLUMN IF NOT EXISTS bonus_multiplier numeric(4,2) NOT NULL DEFAULT 1.00;

    -- Task #218 — labor-hours backbone metadata on each catalog row.
    -- Both columns are nullable so legacy rows fall back to
    -- SERVICE_LABOR_DEFAULTS in shared/pricingTables.ts. The seed below
    -- populates them with the per-service tuples from the spec table.
    ALTER TABLE service_catalog
      ADD COLUMN IF NOT EXISTS min_crew integer,
      ADD COLUMN IF NOT EXISTS default_labor_hours jsonb;

    -- Task #131 — reward inputs snapshot on parent booking row, captured at
    -- creation so the customer's displayed estimate matches the final award
    -- even if reward_settings or bundle multipliers change before confirm.
    ALTER TABLE bookings
      ADD COLUMN IF NOT EXISTS reward_flat_bonus_snapshot integer,
      ADD COLUMN IF NOT EXISTS reward_earn_rate_snapshot numeric(10,4),
      ADD COLUMN IF NOT EXISTS reward_bonus_multiplier_snapshot numeric(4,2);

    -- Task #131 — durable audit trail for admin edits to bundle_definitions.
    CREATE TABLE IF NOT EXISTS bundle_settings_audit_log (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      bundle_code text NOT NULL,
      admin_user_id varchar,
      admin_email text,
      before jsonb NOT NULL,
      after jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_bundle_audit_code    ON bundle_settings_audit_log(bundle_code);
    CREATE INDEX IF NOT EXISTS idx_bundle_audit_created ON bundle_settings_audit_log(created_at);

    -- DEPRECATED (Task #218 round-9 rev2): crew_requirements is no longer
    -- the source of truth for moving / handyman crew + labor-hour defaults.
    -- That role moved to service_catalog.min_crew + service_catalog.default_labor_hours
    -- (read by quoteByLaborHours in shared/pricingTables.ts). This CREATE is
    -- left in place only so prod environments that already have the table do
    -- not break on existing crewRequirements queries; new envs will get the
    -- empty shell but no code path writes to or reads from it.
    CREATE TABLE IF NOT EXISTS crew_requirements (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      service_code text NOT NULL UNIQUE,
      min_crew integer NOT NULL DEFAULT 1,
      default_crew integer NOT NULL DEFAULT 2,
      requires_truck boolean NOT NULL DEFAULT false,
      capabilities text[] DEFAULT ARRAY[]::text[],
      estimated_minutes_min integer,
      estimated_minutes_max integer,
      notes text,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

const CATALOG_SEED: InsertServiceCatalogEntry[] = [
  // ── Core services (every service the platform offers today) ─────────────
  {
    code: "moving",
    name: "Moving",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "300",
    suggestedMax: "2500",
    discountEligible: true,
    isAddon: false,
    sortOrder: 10,
    description: "Local & long-distance residential moves.",
  },
  {
    code: "junk_removal",
    name: "Junk Removal",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "170",
    suggestedMax: "600",
    discountEligible: true,
    isAddon: false,
    sortOrder: 20,
    description: "Single-item pickups through full truckload hauls.",
  },
  {
    code: "lawn_care",
    name: "Lawn Care",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "45",
    suggestedMax: "250",
    discountEligible: true,
    isAddon: false,
    sortOrder: 30,
    description: "Mowing, trimming, cleanup, and full-service yard work.",
  },
  {
    code: "trash_valet",
    name: "Trash Valet",
    category: "core",
    defaultPriceMode: "fixed",
    defaultPrice: "30",
    suggestedMin: "30",
    suggestedMax: "129",
    discountEligible: true,
    isAddon: false,
    sortOrder: 40,
    description: "Curbside trash + recycling subscription.",
  },
  {
    code: "window_cleaning",
    name: "Window Cleaning",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "75",
    suggestedMax: "500",
    discountEligible: true,
    isAddon: false,
    sortOrder: 50,
    description: "Inside + outside window cleaning by pane count.",
  },
  {
    code: "snow_removal",
    name: "Snow Removal",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "50",
    suggestedMax: "400",
    discountEligible: true,
    isAddon: false,
    sortOrder: 60,
    description: "Per-event or seasonal snow removal.",
  },
  {
    code: "cleaning",
    name: "Cleaning",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "150",
    suggestedMax: "600",
    discountEligible: true,
    isAddon: false,
    sortOrder: 70,
    description: "Standard, deep, and turnover residential cleaning.",
  },
  {
    code: "handyman",
    name: "Handyman",
    category: "core",
    defaultPriceMode: "hourly",
    defaultPrice: "75",
    suggestedMin: "150",
    suggestedMax: "750",
    discountEligible: true,
    isAddon: false,
    sortOrder: 80,
    description: "Small repairs and installations by the hour.",
  },
  {
    code: "labor",
    name: "Labor (movers/helpers)",
    category: "core",
    defaultPriceMode: "hourly",
    defaultPrice: "95",
    suggestedMin: "190",
    suggestedMax: "1000",
    discountEligible: true,
    isAddon: false,
    sortOrder: 90,
    description: "General labor — load/unload, garage cleanup, etc.",
  },
  {
    code: "delivery",
    name: "Delivery",
    category: "core",
    defaultPriceMode: "fixed",
    defaultPrice: "150",
    suggestedMin: "100",
    suggestedMax: "400",
    discountEligible: true,
    isAddon: false,
    sortOrder: 100,
    description: "Local truck delivery for store pickups & furniture.",
  },
  // Task #169 — Move Cleaning, Demolition, and Roofing added so /book covers
  // every service the app advertises (was 11; now 14 incl. Move Cleaning,
  // Light Demolition, Roofing, Labor Only — Labor was already in the
  // catalog as `labor`; `move_cleaning` is a distinct code from generic
  // `cleaning` because it has its own flat-rate tier and staging workflow.
  {
    code: "move_cleaning",
    name: "Move-In/Out Cleaning",
    category: "core",
    defaultPriceMode: "fixed",
    defaultPrice: "300",
    suggestedMin: "300",
    suggestedMax: "1200",
    discountEligible: true,
    isAddon: false,
    sortOrder: 105,
    description: "Deep turnover cleaning before or after a move — per home size.",
  },
  {
    code: "demolition",
    name: "Light Demolition",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "300",
    suggestedMax: "1500",
    discountEligible: true,
    isAddon: false,
    sortOrder: 110,
    description: "Tear-out, cleanout & debris haul-off — small to medium demo.",
  },
  {
    code: "roofing",
    name: "Roofing",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "500",
    suggestedMax: "8000",
    discountEligible: true,
    isAddon: false,
    sortOrder: 120,
    description: "Shingle repairs and full replacements.",
  },
  // Task #210 — Painting & Flooring. Both ride the homepage tiles + the
  // chat-intake parser already, but were silently dropped by the booking
  // wizard's prefill (services.find(...code===) returned undefined when
  // the catalog row didn't exist). Quote-mode like roofing/demolition
  // because per-job scope (room count, sqft, prep, materials) varies too
  // wildly to publish a single rack price; the booking-chatbot already
  // collects the structured questionnaire that the crew uses to firm up
  // a number off-platform. Suggested ranges below are guardrails for
  // the "starting at" hint in the wizard, not a binding price.
  {
    code: "flooring",
    name: "Flooring",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "400",
    suggestedMax: "5000",
    discountEligible: true,
    isAddon: false,
    sortOrder: 130,
    description: "Hardwood, vinyl plank, laminate, tile — install, refinish & old-floor removal.",
  },
  {
    code: "painting",
    name: "Painting",
    category: "core",
    defaultPriceMode: "quote",
    defaultPrice: null,
    suggestedMin: "300",
    suggestedMax: "3500",
    discountEligible: true,
    isAddon: false,
    sortOrder: 140,
    description: "Interior & exterior painting — single rooms through full-house repaints, including prep & primer.",
  },
  // ── Small-job add-ons ($200–$400 ranges per spec) ───────────────────────
  {
    code: "jump_start",
    name: "Jump Start",
    category: "core",
    defaultPriceMode: "fixed",
    defaultPrice: "25",
    suggestedMin: "25",
    suggestedMax: "150",
    discountEligible: false,
    isAddon: false,
    sortOrder: 150,
    description: "Portable battery jump start service with distance-based flat rates.",
  },
  {
    code: "junk_reset",
    name: "Junk Reset",
    category: "addon",
    defaultPriceMode: "fixed",
    defaultPrice: "250",
    suggestedMin: "200",
    suggestedMax: "300",
    discountEligible: true,
    isAddon: true,
    sortOrder: 200,
    description: "Quick post-move junk pickup — get your space clean fast.",
  },
  {
    code: "assembly_finish",
    name: "Assembly Finish",
    category: "addon",
    defaultPriceMode: "fixed",
    defaultPrice: "75",
    suggestedMin: "75",
    suggestedMax: "150",
    discountEligible: true,
    isAddon: true,
    sortOrder: 210,
    description: "Move-day furniture assembly add-on — first 2 items included.",
  },
  {
    code: "deep_clean_turnover",
    name: "Deep Clean Turnover",
    category: "addon",
    defaultPriceMode: "fixed",
    defaultPrice: "350",
    suggestedMin: "250",
    suggestedMax: "400",
    discountEligible: true,
    isAddon: true,
    sortOrder: 220,
    description: "Move-in/move-out deep clean turnover package.",
  },
  {
    code: "walkway_priority",
    name: "Walkway Priority",
    category: "addon",
    defaultPriceMode: "fixed",
    defaultPrice: "200",
    suggestedMin: "200",
    suggestedMax: "300",
    discountEligible: true,
    isAddon: true,
    sortOrder: 230,
    description: "Priority walkway clearing during snow events.",
  },
  {
    code: "assembly",
    name: "Assembly (standalone)",
    category: "addon",
    defaultPriceMode: "fixed",
    defaultPrice: "75",
    suggestedMin: "75",
    suggestedMax: "150",
    discountEligible: true,
    isAddon: true,
    sortOrder: 240,
    description: "Furniture/gear assembly — first 2 items included.",
  },
];

export const BUNDLE_SEED: InsertBundleDefinition[] = [
  {
    code: "move_junk_reset",
    name: "Move + Junk Reset",
    description: "Move out, junk gone — one combined visit, 10% off.",
    serviceComboJson: ["moving", "junk_reset"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "most_popular",
    priority: 10,
  },
  {
    code: "move_assembly_finish",
    name: "Move + Assembly Finish",
    description: "Move-day + same-crew assembly, 10% off up to $50.",
    serviceComboJson: ["moving", "assembly_finish"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "best_value",
    priority: 20,
  },
  {
    code: "junk_deep_clean_turnover",
    name: "Junk + Deep Clean Turnover",
    description: "Clear it out + deep clean — perfect turnover, 10% off up to $50.",
    serviceComboJson: ["junk_removal", "deep_clean_turnover"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "most_popular",
    priority: 30,
  },
  {
    code: "labor_delivery_assembly",
    name: "Labor + Delivery + Assembly",
    description: "We pick it up, drop it off, and put it together — 10% off up to $50.",
    serviceComboJson: ["labor", "delivery", "assembly"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "best_value",
    priority: 40,
  },
  {
    code: "snow_walkway_priority",
    name: "Snow + Walkway Priority",
    description: "Driveway + walkway, priority slot during storms — 10% off.",
    serviceComboJson: ["snow_removal", "walkway_priority"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "fast_addon",
    priority: 50,
  },
  {
    code: "move_paint_refresh",
    name: "Move + Paint Refresh",
    description: "Move in + fresh paint before your stuff arrives — 10% off.",
    serviceComboJson: ["moving", "painting"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "most_popular",
    priority: 60,
  },
  {
    code: "demo_flooring_replace",
    name: "Demo + New Flooring",
    description: "Tear out the old, lay down the new — 10% off up to $50.",
    serviceComboJson: ["demolition", "flooring"],
    discountType: "percent",
    discountValue: "10",
    maxDiscount: "50",
    isFeatured: true,
    merchandisingSlot: "best_value",
    priority: 70,
  },
];

export async function ensureBookingCatalogSeeded(): Promise<void> {
  try {
    await ensureBookingTables();
  } catch (err) {
    console.error("[bookingCatalogSeed] table create failed:", (err as Error).message);
    return; // can't seed if tables don't exist
  }
  try {
    let inserted = 0;
    for (const row of CATALOG_SEED) {
      const labor = laborDefaultsFor(row.code);
      const rowWithLabor: InsertServiceCatalogEntry = labor
        ? { ...row, minCrew: labor.minCrew, defaultLaborHours: labor.defaultLaborHours }
        : row;
      const existing = await db
        .select({ id: serviceCatalog.id })
        .from(serviceCatalog)
        .where(eq(serviceCatalog.code, row.code))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(serviceCatalog).values(rowWithLabor);
        inserted++;
      }
    }
    if (inserted > 0) {
      console.log(`✅ service_catalog seeded — ${inserted} new entr${inserted === 1 ? "y" : "ies"}`);
    }
    // Task #218 — backfill labor metadata onto existing rows that pre-date
    // the schema change so a fresh boot wires every catalog row to the
    // labor-hours backbone. Idempotent: only writes when min_crew is
    // currently NULL so admin overrides are never clobbered.
    let backfilled = 0;
    for (const row of CATALOG_SEED) {
      const labor = laborDefaultsFor(row.code);
      if (!labor) continue;
      const result = await pool.query(
        `UPDATE service_catalog
            SET min_crew = $1,
                default_labor_hours = $2::jsonb
          WHERE code = $3 AND min_crew IS NULL`,
        [labor.minCrew, JSON.stringify(labor.defaultLaborHours), row.code],
      );
      if (result.rowCount && result.rowCount > 0) backfilled++;
    }
    if (backfilled > 0) {
      console.log(`✅ service_catalog labor metadata backfilled — ${backfilled} row${backfilled === 1 ? "" : "s"}`);
    }

    // `service_catalog` remains service metadata, but its legacy price
    // columns are synchronized for callers that have not moved to
    // /api/pricing/v2 yet. They are derived from the canonical version and
    // are never accepted as quote authority.
    for (const row of CATALOG_SEED) {
      const summary = catalogPriceSummary(row.code, CANONICAL_PRICING_2026_08);
      if (!summary) continue;
      await pool.query(
        `UPDATE service_catalog
            SET default_price = $1,
                suggested_min = $2,
                suggested_max = $3
          WHERE code = $4`,
        [summary.defaultPrice, summary.suggestedMin, summary.suggestedMax, row.code],
      );
    }
  } catch (err) {
    console.error("[bookingCatalogSeed] service_catalog seed failed:", (err as Error).message);
  }

  try {
    let inserted = 0;
    for (const row of BUNDLE_SEED) {
      const existing = await db
        .select({ id: bundleDefinitions.id })
        .from(bundleDefinitions)
        .where(eq(bundleDefinitions.code, row.code))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(bundleDefinitions).values(row);
        inserted++;
      }
    }
    if (inserted > 0) {
      console.log(`✅ bundle_definitions seeded — ${inserted} new bundle${inserted === 1 ? "" : "s"}`);
    }
    // Normalize legacy bundle rows so admin previews and customer copy match
    // the canonical offer even before those rows are republished.
    await pool.query(
      `UPDATE bundle_definitions
          SET discount_type = 'percent',
              discount_value = '10',
              max_discount = '50'
        WHERE is_active = true`,
    );
  } catch (err) {
    console.error("[bookingCatalogSeed] bundle_definitions seed failed:", (err as Error).message);
  }

  try {
    await ensureCanonicalPricingVersionsSeeded();
  } catch (err) {
    console.error("[bookingCatalogSeed] canonical pricing seed failed:", (err as Error).message);
  }
}
