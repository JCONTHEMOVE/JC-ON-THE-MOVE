import crypto from "node:crypto";
import { pool } from "../db";
import {
  CANONICAL_PRICING_2026_08,
  catalogPriceSummary,
  type CanonicalPricingSnapshot,
} from "@shared/canonicalPricing";
import type { CommerceItem, CommercePromotion, CommerceVariation } from "@shared/commerceCatalog";

type SeedVariation = Omit<CommerceVariation, "id" | "itemCode" | "metadata"> & { metadata?: Record<string, unknown> };
type SeedItem = Omit<CommerceItem, "id" | "variations" | "squareStatus" | "updatedAt" | "metadata"> & {
  metadata?: Record<string, unknown>;
  variations?: SeedVariation[];
};

const p = CANONICAL_PRICING_2026_08;

const MANAGED_OVERLAP_NAMES = [
  "2 Movers Hourly",
  "Small Delivery",
  "Medium Delivery",
  "2 Movers Plus Truck",
  "Large Delivery",
  "$2 / MI EXTRA",
  "$125 / HR EXTRA",
  "4 Movers Available Hourly",
  "3 Packing Helpers",
  "3 Movers Pack And Move",
  "Packing Materials",
  "Junk Removal Dump Fees",
  "Haul Away Fee",
  "Labor For Removal",
];

export const COMMERCE_MANAGED_OVERLAP_NAMES = new Set(MANAGED_OVERLAP_NAMES.map(normalizeName));

export function normalizeName(value: string | null | undefined): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function laborVariations(prefix: string): SeedVariation[] {
  return [1, 2, 3, 4].map((workers, index) => ({
    code: `${prefix}_${workers}_worker_hour`,
    name: `${workers} worker${workers === 1 ? "" : "s"} — hourly`,
    description: `$${p.labor.workerHourlyRate} per worker-hour; job minimums and long-job discounts are calculated by JC.`,
    pricingMode: "hourly",
    unit: "crew hour",
    price: workers * p.labor.workerHourlyRate,
    discountEligible: true,
    publicVisible: true,
    active: true,
    sortOrder: index + 1,
    metadata: { workers, ratePerWorkerHour: p.labor.workerHourlyRate },
  }));
}

const DETAIL_SEEDS: SeedItem[] = [
  {
    code: "moving_labor",
    name: "Moving Labor",
    description: "Professional moving crew for loading, transport support, unloading, and in-home moves.",
    category: "moving",
    itemType: "service",
    pricingMode: "hourly",
    purchaseMode: "quote",
    unit: "crew hour",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 10,
    sourceServiceCode: "moving",
    variations: laborVariations("moving"),
  },
  {
    code: "packing_labor",
    name: "Packing and Unpacking Labor",
    description: "Packing, unpacking, labeling, staging, and room-by-room setup help.",
    category: "packing",
    itemType: "service",
    pricingMode: "hourly",
    purchaseMode: "quote",
    unit: "crew hour",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 20,
    sourceServiceCode: "labor",
    variations: [
      ...laborVariations("packing"),
      {
        code: "packing_assistance_hour",
        name: "Packing assistance",
        description: "Additional packing assistance billed hourly.",
        pricingMode: "hourly",
        unit: "hour",
        price: 75,
        discountEligible: true,
        publicVisible: true,
        active: true,
        sortOrder: 10,
      },
    ],
  },
  {
    code: "load_unload_labor",
    name: "Loading and Unloading Labor",
    description: "Labor-only help for rental trucks, trailers, storage units, and containers.",
    category: "moving",
    itemType: "service",
    pricingMode: "hourly",
    purchaseMode: "quote",
    unit: "crew hour",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 30,
    sourceServiceCode: "labor",
    variations: laborVariations("load_unload"),
  },
  {
    code: "moving_equipment",
    name: "Moving Trucks and Trailer",
    description: "JC equipment added to a staffed move. Availability is confirmed before payment.",
    category: "moving",
    itemType: "fee",
    pricingMode: "fixed",
    purchaseMode: "quote",
    unit: "job",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 40,
    sourceServiceCode: "moving",
    variations: [
      { code: "truck_15ft", name: "15-foot truck", description: null, pricingMode: "fixed", unit: "job", price: p.equipment.truck15Ft, discountEligible: true, publicVisible: true, active: true, sortOrder: 1 },
      { code: "truck_26ft", name: "26-foot truck", description: null, pricingMode: "fixed", unit: "job", price: p.equipment.truck26Ft, discountEligible: true, publicVisible: true, active: true, sortOrder: 2 },
      { code: "moving_trailer", name: "Moving trailer", description: null, pricingMode: "fixed", unit: "job", price: p.equipment.trailer, discountEligible: true, publicVisible: true, active: true, sortOrder: 3 },
    ],
  },
  {
    code: "travel_charges",
    name: "Travel and Mileage",
    description: "Itemized travel charges calculated from the verified customer address and route.",
    category: "travel",
    itemType: "fee",
    pricingMode: "variable",
    purchaseMode: "quote",
    unit: "route",
    price: null,
    discountEligible: false,
    publicVisible: true,
    advertisingEnabled: false,
    active: true,
    sortOrder: 50,
    sourceServiceCode: "moving",
    variations: [
      { code: "regional_travel_crew_hour", name: "Regional travel crew-hour", description: null, pricingMode: "hourly", unit: "crew hour", price: p.travel.regionalCrewHourlyRate, discountEligible: false, publicVisible: true, active: true, sortOrder: 1 },
      { code: "long_distance_loaded_mile", name: "Long-distance loaded mile", description: `100-mile minimum applies.`, pricingMode: "per_unit", unit: "loaded mile", price: p.travel.longDistanceRatePerLoadedMile, discountEligible: false, publicVisible: true, active: true, sortOrder: 2 },
    ],
  },
  {
    code: "moving_addons",
    name: "Moving Add-ons",
    description: "Common handling, carry, protection, and assembly charges.",
    category: "moving",
    itemType: "fee",
    pricingMode: "fixed",
    purchaseMode: "quote",
    unit: "job",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: false,
    active: true,
    sortOrder: 60,
    sourceServiceCode: "moving",
    variations: [
      { code: "mattress_bag", name: "Mattress bag", description: null, pricingMode: "per_unit", unit: "each", price: 25, discountEligible: false, publicVisible: true, active: true, sortOrder: 1 },
      { code: "shrink_wrap_room", name: "Shrink wrap protection", description: null, pricingMode: "per_unit", unit: "room", price: 35, discountEligible: false, publicVisible: true, active: true, sortOrder: 2 },
      { code: "heavy_stair_carry", name: "Heavy stair carry", description: null, pricingMode: "fixed", unit: "job", price: 125, discountEligible: true, publicVisible: true, active: true, sortOrder: 3 },
      { code: "long_carry", name: "Long carry", description: "Carry distance beyond the standard service distance.", pricingMode: "fixed", unit: "job", price: 75, discountEligible: true, publicVisible: true, active: true, sortOrder: 4 },
      { code: "assembly_move_addon", name: "Furniture assembly/disassembly", description: null, pricingMode: "fixed", unit: "job", price: 60, discountEligible: true, publicVisible: true, active: true, sortOrder: 5 },
    ],
  },
  {
    code: "specialty_handling",
    name: "Specialty Item Handling",
    description: "Special handling charges; access conditions and item details are confirmed before approval.",
    category: "moving",
    itemType: "service",
    pricingMode: "fixed",
    purchaseMode: "quote",
    unit: "item",
    price: null,
    discountEligible: true,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 70,
    sourceServiceCode: "moving",
    variations: [
      { code: "specialty_piano", name: "Piano handling", description: null, pricingMode: "fixed", unit: "item", price: 400, discountEligible: true, publicVisible: true, active: true, sortOrder: 1 },
      { code: "specialty_hot_tub", name: "Hot tub handling", description: null, pricingMode: "fixed", unit: "item", price: 600, discountEligible: true, publicVisible: true, active: true, sortOrder: 2 },
      { code: "specialty_safe", name: "Safe handling", description: null, pricingMode: "fixed", unit: "item", price: 400, discountEligible: true, publicVisible: true, active: true, sortOrder: 3 },
      { code: "specialty_pool_table", name: "Pool table handling", description: null, pricingMode: "fixed", unit: "item", price: 400, discountEligible: true, publicVisible: true, active: true, sortOrder: 4 },
    ],
  },
  {
    code: "packing_supplies",
    name: "Moving Boxes and Packing Supplies",
    description: "Individual supplies and ready-to-go packing kits. Individual items without an owner-approved price remain unavailable online.",
    category: "supplies",
    itemType: "supply",
    pricingMode: "per_unit",
    purchaseMode: "direct",
    unit: "each",
    price: null,
    discountEligible: false,
    publicVisible: true,
    advertisingEnabled: true,
    active: true,
    sortOrder: 80,
    sourceServiceCode: null,
    variations: [
      { code: "box_small", name: "Small moving box", description: null, pricingMode: "per_unit", unit: "each", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 1 },
      { code: "box_medium", name: "Medium moving box", description: null, pricingMode: "per_unit", unit: "each", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 2 },
      { code: "box_large", name: "Large moving box", description: null, pricingMode: "per_unit", unit: "each", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 3 },
      { code: "box_dish_pack", name: "Dish-pack box", description: null, pricingMode: "per_unit", unit: "each", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 4 },
      { code: "box_wardrobe", name: "Wardrobe box", description: null, pricingMode: "per_unit", unit: "each", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 5 },
      { code: "supply_mattress_bag", name: "Mattress bag", description: null, pricingMode: "per_unit", unit: "each", price: 25, discountEligible: false, publicVisible: true, active: true, sortOrder: 6 },
      { code: "supply_tape", name: "Packing tape", description: null, pricingMode: "per_unit", unit: "roll", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 7 },
      { code: "supply_stretch_wrap", name: "Stretch wrap", description: null, pricingMode: "per_unit", unit: "roll", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 8 },
      { code: "supply_bubble_wrap", name: "Bubble wrap", description: null, pricingMode: "per_unit", unit: "roll", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 9 },
      { code: "supply_packing_paper", name: "Packing paper", description: null, pricingMode: "per_unit", unit: "bundle", price: null, discountEligible: false, publicVisible: false, active: true, sortOrder: 10 },
      { code: "packing_kit_small", name: "Small-home packing kit", description: "Ready-to-go small packing materials package.", pricingMode: "fixed", unit: "kit", price: 350, discountEligible: false, publicVisible: true, active: true, sortOrder: 20 },
      { code: "packing_kit_medium", name: "Medium-home packing kit", description: "Ready-to-go medium packing materials package.", pricingMode: "fixed", unit: "kit", price: 600, discountEligible: false, publicVisible: true, active: true, sortOrder: 21 },
    ],
  },
];

let infrastructurePromise: Promise<void> | null = null;

export async function ensureCommerceCatalogInfrastructure(): Promise<void> {
  if (infrastructurePromise) return infrastructurePromise;
  infrastructurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS commerce_catalog_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        category text NOT NULL,
        item_type text NOT NULL,
        pricing_mode text NOT NULL,
        purchase_mode text NOT NULL DEFAULT 'quote',
        unit text NOT NULL DEFAULT 'job',
        price numeric(12,2),
        discount_eligible boolean NOT NULL DEFAULT true,
        public_visible boolean NOT NULL DEFAULT false,
        advertising_enabled boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 100,
        source_service_code text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by_user_id varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_commerce_catalog_items_public ON commerce_catalog_items(active, public_visible, sort_order);

      CREATE TABLE IF NOT EXISTS commerce_catalog_variations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id varchar NOT NULL REFERENCES commerce_catalog_items(id) ON DELETE CASCADE,
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        pricing_mode text NOT NULL,
        unit text NOT NULL DEFAULT 'each',
        price numeric(12,2),
        discount_eligible boolean NOT NULL DEFAULT true,
        public_visible boolean NOT NULL DEFAULT false,
        active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 100,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by_user_id varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_commerce_catalog_variations_item ON commerce_catalog_variations(item_id, active, sort_order);

      CREATE TABLE IF NOT EXISTS commerce_promotions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        name text NOT NULL,
        description text,
        discount_type text NOT NULL,
        value numeric(12,2) NOT NULL,
        maximum_amount numeric(12,2),
        eligible_item_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
        eligible_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
        starts_at timestamp,
        ends_at timestamp,
        combinable boolean NOT NULL DEFAULT true,
        priority integer NOT NULL DEFAULT 100,
        active boolean NOT NULL DEFAULT false,
        square_discount_id text,
        updated_by_user_id varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS commerce_square_mappings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        local_type text NOT NULL,
        local_code text NOT NULL,
        square_object_id text NOT NULL,
        square_parent_id text,
        square_version text,
        payload_hash text,
        sync_status text NOT NULL DEFAULT 'synced',
        last_error text,
        last_synced_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(local_type, local_code),
        UNIQUE(square_object_id)
      );

      CREATE TABLE IF NOT EXISTS commerce_catalog_publications (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        revision integer NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'draft',
        snapshot jsonb NOT NULL,
        square_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
        snapshot_hash text NOT NULL,
        idempotency_key text NOT NULL UNIQUE,
        created_by_user_id varchar,
        approved_by_user_id varchar,
        error_message text,
        created_at timestamp NOT NULL DEFAULT now(),
        previewed_at timestamp,
        published_at timestamp,
        activated_at timestamp
      );
      CREATE INDEX IF NOT EXISTS idx_commerce_catalog_publications_active ON commerce_catalog_publications(status, activated_at DESC);

      CREATE TABLE IF NOT EXISTS commerce_checkout_intents (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        idempotency_key text NOT NULL UNIQUE,
        access_token_hash text NOT NULL,
        catalog_revision integer NOT NULL,
        offer_code text NOT NULL,
        variation_code text,
        quantity integer NOT NULL DEFAULT 1,
        customer_email text NOT NULL,
        customer_name text NOT NULL,
        customer_phone text,
        service_address text,
        service_date text,
        scope_notes text,
        payment_choice text NOT NULL,
        subtotal numeric(12,2) NOT NULL,
        discount_total numeric(12,2) NOT NULL DEFAULT 0,
        order_total numeric(12,2) NOT NULL,
        amount_due numeric(12,2) NOT NULL,
        pricing_snapshot jsonb NOT NULL,
        terms_version text NOT NULL,
        terms_hash text NOT NULL,
        terms_accepted_at timestamp NOT NULL DEFAULT now(),
        status text NOT NULL DEFAULT 'pending_invoice',
        square_invoice_id text,
        square_payment_id text,
        invoice_url text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      ALTER TABLE commerce_checkout_intents ADD COLUMN IF NOT EXISTS access_token_hash text;

      CREATE TABLE IF NOT EXISTS commerce_adjustment_requests (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        checkout_intent_id varchar REFERENCES commerce_checkout_intents(id),
        lead_id varchar,
        booking_id varchar,
        adjustment_type text NOT NULL,
        requested_service_date text,
        replacement_offer_code text,
        reason text NOT NULL,
        scheduled_start_at timestamp,
        job_total numeric(12,2) NOT NULL DEFAULT 0,
        amount_paid numeric(12,2) NOT NULL DEFAULT 0,
        policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
        terms_version text NOT NULL,
        terms_accepted_at timestamp NOT NULL DEFAULT now(),
        status text NOT NULL DEFAULT 'pending_owner_review',
        reviewed_by_user_id varchar,
        review_notes text,
        square_refund_id text,
        created_at timestamp NOT NULL DEFAULT now(),
        reviewed_at timestamp,
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_commerce_adjustments_status ON commerce_adjustment_requests(status, created_at DESC);
    `);
    await seedCommerceCatalog();
  })().catch((error) => {
    infrastructurePromise = null;
    throw error;
  });
  return infrastructurePromise;
}

async function insertSeedItem(item: SeedItem): Promise<void> {
  const result = await pool.query<{ id: string }>(`
    INSERT INTO commerce_catalog_items (
      code, name, description, category, item_type, pricing_mode, purchase_mode, unit, price,
      discount_eligible, public_visible, advertising_enabled, active, sort_order, source_service_code, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
    ON CONFLICT (code) DO NOTHING
    RETURNING id
  `, [
    item.code, item.name, item.description, item.category, item.itemType, item.pricingMode, item.purchaseMode,
    item.unit, item.price, item.discountEligible, item.publicVisible, item.advertisingEnabled, item.active,
    item.sortOrder, item.sourceServiceCode, JSON.stringify(item.metadata || {}),
  ]);
  const itemId = result.rows[0]?.id || (await pool.query<{ id: string }>(
    `SELECT id FROM commerce_catalog_items WHERE code=$1 LIMIT 1`, [item.code],
  )).rows[0]?.id;
  if (!itemId) return;
  for (const variation of item.variations || []) {
    await pool.query(`
      INSERT INTO commerce_catalog_variations (
        item_id, code, name, description, pricing_mode, unit, price, discount_eligible,
        public_visible, active, sort_order, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      ON CONFLICT (code) DO NOTHING
    `, [
      itemId, variation.code, variation.name, variation.description, variation.pricingMode, variation.unit,
      variation.price, variation.discountEligible, variation.publicVisible, variation.active, variation.sortOrder,
      JSON.stringify(variation.metadata || {}),
    ]);
  }
}

async function seedCommerceCatalog(): Promise<void> {
  for (const seed of DETAIL_SEEDS) await insertSeedItem(seed);

  try {
    const services = await pool.query<any>(`
      SELECT code, name, category, default_price_mode, default_price, discount_eligible,
             is_addon, is_active, sort_order, description, metadata
      FROM service_catalog WHERE is_active=true ORDER BY sort_order, name
    `);
    for (const service of services.rows) {
      const summary = catalogPriceSummary(service.code);
      const price = service.default_price == null ? summary?.defaultPrice ?? null : Number(service.default_price);
      const pricingMode = ["fixed", "hourly", "per_unit", "quote"].includes(service.default_price_mode)
        ? service.default_price_mode
        : price == null ? "quote" : "fixed";
      await insertSeedItem({
        code: `service_${service.code}`,
        name: service.name,
        description: service.description || null,
        category: service.category || "services",
        itemType: "service",
        pricingMode,
        purchaseMode: pricingMode === "fixed" && price != null ? "direct" : "quote",
        unit: pricingMode === "hourly" ? "hour" : pricingMode === "per_unit" ? "unit" : "job",
        price,
        discountEligible: service.discount_eligible !== false,
        publicVisible: true,
        advertisingEnabled: true,
        active: true,
        sortOrder: 200 + Number(service.sort_order || 100),
        sourceServiceCode: service.code,
        metadata: { ...(service.metadata || {}), importedFrom: "service_catalog" },
      });
    }
  } catch (error) {
    console.warn("[commerce-catalog] service catalog seed skipped:", error instanceof Error ? error.message : error);
  }

  try {
    const bundles = await pool.query<any>(`
      SELECT code, name, description, service_combo_json, discount_type, discount_value,
             max_discount, priority, is_active, merchandising_slot
      FROM bundle_definitions WHERE is_active=true ORDER BY priority, name
    `);
    for (const bundle of bundles.rows) {
      await insertSeedItem({
        code: `bundle_${bundle.code}`,
        name: bundle.name,
        description: bundle.description || null,
        category: "packages",
        itemType: "package",
        pricingMode: "quote",
        purchaseMode: "quote",
        unit: "package",
        price: null,
        discountEligible: true,
        publicVisible: true,
        advertisingEnabled: true,
        active: true,
        sortOrder: 100 + Number(bundle.priority || 100),
        sourceServiceCode: null,
        metadata: {
          importedFrom: "bundle_definitions",
          bundleCode: bundle.code,
          serviceCodes: bundle.service_combo_json || [],
          discountType: bundle.discount_type,
          discountValue: Number(bundle.discount_value),
          maximumAmount: bundle.max_discount == null ? null : Number(bundle.max_discount),
          merchandisingSlot: bundle.merchandising_slot || null,
        },
      });
    }
  } catch (error) {
    console.warn("[commerce-catalog] bundle seed skipped:", error instanceof Error ? error.message : error);
  }
}

function rowItem(row: any): CommerceItem {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    description: row.description || null,
    category: row.category,
    itemType: row.item_type,
    pricingMode: row.pricing_mode,
    purchaseMode: row.purchase_mode,
    unit: row.unit,
    price: row.price == null ? null : Number(row.price),
    discountEligible: row.discount_eligible,
    publicVisible: row.public_visible,
    advertisingEnabled: row.advertising_enabled,
    active: row.active,
    sortOrder: Number(row.sort_order),
    sourceServiceCode: row.source_service_code || null,
    metadata: row.metadata || {},
    variations: [],
    squareStatus: row.square_status || "unmapped",
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function rowVariation(row: any): CommerceVariation {
  return {
    id: String(row.id),
    code: row.code,
    itemCode: row.item_code,
    name: row.name,
    description: row.description || null,
    pricingMode: row.pricing_mode,
    unit: row.unit,
    price: row.price == null ? null : Number(row.price),
    discountEligible: row.discount_eligible,
    publicVisible: row.public_visible,
    active: row.active,
    sortOrder: Number(row.sort_order),
    metadata: row.metadata || {},
  };
}

export async function listCommerceCatalog(): Promise<CommerceItem[]> {
  await ensureCommerceCatalogInfrastructure();
  const [itemsResult, variationsResult] = await Promise.all([
    pool.query<any>(`
      SELECT i.*, COALESCE(m.sync_status, 'unmapped') AS square_status
      FROM commerce_catalog_items i
      LEFT JOIN commerce_square_mappings m ON m.local_type='item' AND m.local_code=i.code
      ORDER BY i.sort_order, i.name
    `),
    pool.query<any>(`
      SELECT v.*, i.code AS item_code
      FROM commerce_catalog_variations v
      JOIN commerce_catalog_items i ON i.id=v.item_id
      ORDER BY v.sort_order, v.name
    `),
  ]);
  const items: CommerceItem[] = (itemsResult.rows as any[]).map((row: any) => rowItem(row));
  const byCode = new Map<string, CommerceItem>(items.map((item: CommerceItem) => [item.code, item]));
  for (const row of variationsResult.rows as any[]) byCode.get(row.item_code)?.variations.push(rowVariation(row));
  return items;
}

export async function listCommercePromotions(): Promise<CommercePromotion[]> {
  await ensureCommerceCatalogInfrastructure();
  const result = await pool.query<any>(`SELECT * FROM commerce_promotions ORDER BY priority, name`);
  return (result.rows as any[]).map((row: any) => ({
    id: String(row.id), code: row.code, name: row.name, description: row.description || null,
    discountType: row.discount_type, value: Number(row.value),
    maximumAmount: row.maximum_amount == null ? null : Number(row.maximum_amount),
    eligibleItemCodes: row.eligible_item_codes || [], eligibleCategories: row.eligible_categories || [],
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    combinable: row.combinable, priority: Number(row.priority), active: row.active,
  }));
}

export async function updateCommerceItem(code: string, updates: Record<string, unknown>, actorId: string | null) {
  await ensureCommerceCatalogInfrastructure();
  const columns: Record<string, string> = {
    name: "name", description: "description", category: "category", itemType: "item_type",
    pricingMode: "pricing_mode", purchaseMode: "purchase_mode", unit: "unit", price: "price",
    discountEligible: "discount_eligible", publicVisible: "public_visible",
    advertisingEnabled: "advertising_enabled", active: "active", sortOrder: "sort_order", metadata: "metadata",
  };
  const entries = Object.entries(updates).filter(([key]) => columns[key]);
  if (!entries.length) return (await listCommerceCatalog()).find((item) => item.code === code) || null;
  const values = entries.map(([, value]) => value);
  const set = entries.map(([key], index) => `${columns[key]}=$${index + 1}${key === "metadata" ? "::jsonb" : ""}`);
  if (entries.some(([key]) => key === "metadata")) {
    const metadataIndex = entries.findIndex(([key]) => key === "metadata");
    values[metadataIndex] = JSON.stringify(values[metadataIndex] || {});
  }
  values.push(actorId, code);
  const result = await pool.query(`
    UPDATE commerce_catalog_items SET ${set.join(", ")}, updated_by_user_id=$${values.length - 1}, updated_at=now()
    WHERE code=$${values.length} RETURNING id
  `, values);
  if (!result.rowCount) return null;
  return (await listCommerceCatalog()).find((item) => item.code === code) || null;
}

export async function updateCommerceVariation(code: string, updates: Record<string, unknown>, actorId: string | null) {
  await ensureCommerceCatalogInfrastructure();
  const columns: Record<string, string> = {
    name: "name", description: "description", pricingMode: "pricing_mode", unit: "unit", price: "price",
    discountEligible: "discount_eligible", publicVisible: "public_visible", active: "active",
    sortOrder: "sort_order", metadata: "metadata",
  };
  const entries = Object.entries(updates).filter(([key]) => columns[key]);
  if (!entries.length) return null;
  const values = entries.map(([, value]) => value);
  const set = entries.map(([key], index) => `${columns[key]}=$${index + 1}${key === "metadata" ? "::jsonb" : ""}`);
  if (entries.some(([key]) => key === "metadata")) {
    const metadataIndex = entries.findIndex(([key]) => key === "metadata");
    values[metadataIndex] = JSON.stringify(values[metadataIndex] || {});
  }
  values.push(actorId, code);
  const result = await pool.query(`
    UPDATE commerce_catalog_variations SET ${set.join(", ")}, updated_by_user_id=$${values.length - 1}, updated_at=now()
    WHERE code=$${values.length} RETURNING id
  `, values);
  return result.rowCount ? (await listCommerceCatalog()).flatMap((item) => item.variations).find((v) => v.code === code) || null : null;
}

export async function saveCommercePromotion(promotion: CommercePromotion, actorId: string | null) {
  await ensureCommerceCatalogInfrastructure();
  const result = await pool.query<any>(`
    INSERT INTO commerce_promotions (
      code, name, description, discount_type, value, maximum_amount, eligible_item_codes,
      eligible_categories, starts_at, ends_at, combinable, priority, active, updated_by_user_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (code) DO UPDATE SET
      name=EXCLUDED.name, description=EXCLUDED.description, discount_type=EXCLUDED.discount_type,
      value=EXCLUDED.value, maximum_amount=EXCLUDED.maximum_amount,
      eligible_item_codes=EXCLUDED.eligible_item_codes, eligible_categories=EXCLUDED.eligible_categories,
      starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, combinable=EXCLUDED.combinable,
      priority=EXCLUDED.priority, active=EXCLUDED.active, updated_by_user_id=EXCLUDED.updated_by_user_id, updated_at=now()
    RETURNING id
  `, [
    promotion.code, promotion.name, promotion.description || null, promotion.discountType, promotion.value,
    promotion.maximumAmount || null, JSON.stringify(promotion.eligibleItemCodes), JSON.stringify(promotion.eligibleCategories),
    promotion.startsAt || null, promotion.endsAt || null, promotion.combinable, promotion.priority, promotion.active, actorId,
  ]);
  return { ...promotion, id: String(result.rows[0].id) };
}

export function catalogSnapshotHash(snapshot: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export async function buildCommerceCatalogSnapshot() {
  const [items, promotions] = await Promise.all([listCommerceCatalog(), listCommercePromotions()]);
  const snapshot = {
    schemaVersion: 1,
    pricingVersion: (p as CanonicalPricingSnapshot).version,
    items: items.filter((item) => item.active),
    promotions,
  };
  return { snapshot, hash: catalogSnapshotHash(snapshot) };
}

export async function getActiveCommercePublication() {
  await ensureCommerceCatalogInfrastructure();
  const result = await pool.query<any>(`
    SELECT * FROM commerce_catalog_publications WHERE status='active' ORDER BY activated_at DESC LIMIT 1
  `);
  return result.rows[0] || null;
}

export async function getPublicCommerceOffers(): Promise<{ revision: number | null; items: CommerceItem[] }> {
  const publication = await getActiveCommercePublication();
  if (!publication) return { revision: null, items: [] };
  const items = Array.isArray(publication.snapshot?.items) ? publication.snapshot.items as CommerceItem[] : [];
  return {
    revision: Number(publication.revision),
    items: items
      .filter((item) => item.active && item.publicVisible)
      .map((item) => ({ ...item, variations: item.variations.filter((v) => v.active && v.publicVisible && v.price != null) })),
  };
}

export async function createPublicationPreview(input: {
  actorId: string | null;
  diff: Record<string, unknown>;
  revision?: number;
}) {
  await ensureCommerceCatalogInfrastructure();
  const { snapshot, hash } = await buildCommerceCatalogSnapshot();
  const revision = input.revision || await getNextCommercePublicationRevision();
  const idempotencyKey = crypto.randomUUID();
  const result = await pool.query<any>(`
    INSERT INTO commerce_catalog_publications (
      revision, status, snapshot, square_diff, snapshot_hash, idempotency_key, created_by_user_id, previewed_at
    ) VALUES ($1,'previewed',$2::jsonb,$3::jsonb,$4,$5,$6,now()) RETURNING *
  `, [revision, JSON.stringify(snapshot), JSON.stringify(input.diff), hash, idempotencyKey, input.actorId]);
  return result.rows[0];
}

export async function getNextCommercePublicationRevision(): Promise<number> {
  await ensureCommerceCatalogInfrastructure();
  const result = await pool.query<{ revision: number }>(`
    SELECT COALESCE(MAX(revision), 0) + 1 AS revision FROM commerce_catalog_publications
  `);
  return Number(result.rows[0]?.revision || 1);
}

export async function getPublication(id: string) {
  await ensureCommerceCatalogInfrastructure();
  return (await pool.query<any>(`SELECT * FROM commerce_catalog_publications WHERE id=$1 LIMIT 1`, [id])).rows[0] || null;
}

export async function markPublicationPublishing(id: string, actorId: string | null) {
  await pool.query(`UPDATE commerce_catalog_publications SET status='publishing', approved_by_user_id=$2 WHERE id=$1`, [id, actorId]);
}

export async function activatePublication(id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE commerce_catalog_publications SET status='superseded' WHERE status='active' AND id<>$1`, [id]);
    await client.query(`UPDATE commerce_catalog_publications SET status='active', published_at=now(), activated_at=now(), error_message=NULL WHERE id=$1`, [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function failPublication(id: string, error: unknown) {
  await pool.query(`UPDATE commerce_catalog_publications SET status='failed', error_message=$2 WHERE id=$1`, [
    id, error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
  ]);
}

export async function listCommercePublications() {
  await ensureCommerceCatalogInfrastructure();
  return (await pool.query<any>(`
    SELECT id, revision, status, square_diff, snapshot_hash, error_message, created_at, previewed_at, published_at, activated_at
    FROM commerce_catalog_publications ORDER BY revision DESC LIMIT 25
  `)).rows;
}

export async function recordSquareMapping(input: {
  localType: "category" | "item" | "variation" | "promotion";
  localCode: string;
  squareObjectId: string;
  squareParentId?: string | null;
  squareVersion?: string | null;
  payloadHash?: string | null;
  syncStatus?: string;
}) {
  await pool.query(`
    INSERT INTO commerce_square_mappings (
      local_type, local_code, square_object_id, square_parent_id, square_version, payload_hash, sync_status, last_synced_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,now())
    ON CONFLICT (local_type, local_code) DO UPDATE SET
      square_object_id=EXCLUDED.square_object_id, square_parent_id=EXCLUDED.square_parent_id,
      square_version=EXCLUDED.square_version, payload_hash=EXCLUDED.payload_hash,
      sync_status=EXCLUDED.sync_status, last_error=NULL, last_synced_at=now(), updated_at=now()
  `, [input.localType, input.localCode, input.squareObjectId, input.squareParentId || null,
    input.squareVersion || null, input.payloadHash || null, input.syncStatus || "synced"]);
}

export async function listSquareMappings() {
  await ensureCommerceCatalogInfrastructure();
  return (await pool.query<any>(`SELECT * FROM commerce_square_mappings ORDER BY local_type, local_code`)).rows;
}

export async function markAllMappingsForDrift() {
  await ensureCommerceCatalogInfrastructure();
  await pool.query(`UPDATE commerce_square_mappings SET sync_status='drifted', updated_at=now() WHERE sync_status='synced'`);
}
