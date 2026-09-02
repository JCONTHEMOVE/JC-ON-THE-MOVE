import { pool } from "../db";
import { ensureMarketingBotSchema } from "./marketingBot";
import { ensureRegionalAutomationSchema } from "./regionalAutomationMigration";
import { ensureBookingCatalogSeeded } from "./bookingCatalogSeed";
import { ensurePricingVersionInfrastructure } from "./pricingVersions";
import { NORTHWOODS_PROVIDER_ID } from "@shared/northwoodsMarketing";

let northwoodsSchemaReady: Promise<void> | null = null;

function providerUrl(cityPath: string) {
  return `https://www.uhaul.com/MovingHelp/${cityPath}/1/Northwoods-Moving-And-Junk-Removing/?id=${NORTHWOODS_PROVIDER_ID}`;
}

function resultsUrl(cityPath: string) {
  return `https://www.uhaul.com/MovingHelp/${cityPath}/1/Results/`;
}

export function ensureNorthwoodsSchema(): Promise<void> {
  if (!northwoodsSchemaReady) {
    northwoodsSchemaReady = ensureBookingCatalogSeeded().then(() => Promise.all([
      ensureMarketingBotSchema(),
      ensureRegionalAutomationSchema(),
      ensurePricingVersionInfrastructure(),
    ])).then(runMigration).catch((error) => {
      northwoodsSchemaReady = null;
      throw error;
    });
  }
  return northwoodsSchemaReady;
}

async function runMigration(): Promise<void> {
  await pool.query(`
    INSERT INTO service_area_capabilities
      (code, name, state_code, locality, pricing_zone_code, verification_status, auto_book_enabled, ads_enabled, notes)
    VALUES
      ('IRON_MOUNTAIN_REGION', 'Iron Mountain regional service', 'MI', 'Iron Mountain', 'EXTENDED_SERVICE', 'pending', false, false,
       'Northwoods Moving marketplace detected; verify crew, operating capability, and dispatch zone before advertising or dispatch.'),
      ('WAUSAU_REGION', 'Wausau regional service', 'WI', 'Wausau', 'EXTENDED_SERVICE', 'pending', false, false,
       'Northwoods Moving marketplace detected; verify crew, operating capability, and dispatch zone before advertising or dispatch.')
    ON CONFLICT (code) DO NOTHING;

    CREATE TABLE IF NOT EXISTS northwoods_markets (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      slug TEXT NOT NULL UNIQUE,
      city TEXT NOT NULL,
      state_code TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      profile_url TEXT NOT NULL,
      results_url TEXT NOT NULL,
      service_area_code TEXT NOT NULL REFERENCES service_area_capabilities(code),
      services TEXT[] NOT NULL DEFAULT ARRAY['loading','unloading','u_box','packing','piano','safe']::text[],
      service_booking_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
      priority INTEGER NOT NULL DEFAULT 50,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS northwoods_market_availability (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      market_id VARCHAR NOT NULL REFERENCES northwoods_markets(id) ON DELETE CASCADE,
      service_date DATE NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      services TEXT[] NOT NULL,
      planned_crew_size INTEGER NOT NULL DEFAULT 2,
      open_slots INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'closed',
      source TEXT NOT NULL DEFAULT 'manual',
      notes TEXT,
      confirmed_by_user_id VARCHAR REFERENCES users(id),
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(market_id, service_date)
    );
    CREATE INDEX IF NOT EXISTS idx_northwoods_availability_date
      ON northwoods_market_availability(service_date, status);

    CREATE TABLE IF NOT EXISTS northwoods_scan_runs (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      target_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      market_ids TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
      requested_by_user_id VARCHAR REFERENCES users(id),
      parser_version TEXT NOT NULL,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      reviewed_by_user_id VARCHAR REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_northwoods_scan_runs_status
      ON northwoods_scan_runs(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS northwoods_scan_listings (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id VARCHAR NOT NULL REFERENCES northwoods_scan_runs(id) ON DELETE CASCADE,
      market_id VARCHAR NOT NULL REFERENCES northwoods_markets(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      profile_url TEXT,
      is_northwoods BOOLEAN NOT NULL DEFAULT false,
      listing_rank INTEGER,
      two_hour_rate_cents INTEGER,
      additional_hour_rate_cents INTEGER,
      piano_fee_cents INTEGER,
      safe_fee_cents INTEGER,
      rating NUMERIC(3,2),
      review_count INTEGER,
      completed_jobs INTEGER,
      services TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
      listed_for_target_date BOOLEAN NOT NULL DEFAULT false,
      source_url TEXT NOT NULL,
      content_checksum TEXT NOT NULL,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(run_id, market_id, provider_id)
    );
    CREATE INDEX IF NOT EXISTS idx_northwoods_scan_market
      ON northwoods_scan_listings(market_id, captured_at DESC);

    CREATE TABLE IF NOT EXISTS northwoods_inbound_messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      gmail_message_id TEXT NOT NULL UNIQUE,
      gmail_thread_id TEXT,
      sender TEXT,
      subject TEXT,
      received_at TIMESTAMPTZ,
      content_hash TEXT NOT NULL,
      parse_status TEXT NOT NULL,
      parse_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      parsed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      external_order_id TEXT,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_northwoods_messages_order
      ON northwoods_inbound_messages(external_order_id, received_at DESC);

    CREATE TABLE IF NOT EXISTS northwoods_reservations (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      external_order_id TEXT NOT NULL UNIQUE,
      latest_message_id VARCHAR REFERENCES northwoods_inbound_messages(id),
      status TEXT NOT NULL DEFAULT 'new',
      customer_first_name TEXT,
      customer_last_name TEXT,
      customer_email TEXT,
      customer_phone TEXT,
      service_date DATE,
      start_time TEXT,
      duration_hours NUMERIC(5,2),
      crew_size INTEGER,
      from_address TEXT,
      to_address TEXT,
      market_id VARCHAR REFERENCES northwoods_markets(id),
      focus TEXT,
      quoted_amount_cents INTEGER,
      notes TEXT,
      pending_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      linked_lead_id VARCHAR UNIQUE REFERENCES leads(id),
      confirmed_by_user_id VARCHAR REFERENCES users(id),
      confirmed_at TIMESTAMPTZ,
      ignored_by_user_id VARCHAR REFERENCES users(id),
      ignored_at TIMESTAMPTZ,
      last_received_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_northwoods_reservations_status
      ON northwoods_reservations(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS northwoods_audit_events (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id VARCHAR REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE marketing_bot_campaigns
      ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'jc_on_the_move',
      ADD COLUMN IF NOT EXISTS northwoods_market_id VARCHAR REFERENCES northwoods_markets(id),
      ADD COLUMN IF NOT EXISTS northwoods_focus TEXT;

    CREATE TABLE IF NOT EXISTS booking_slot_holds (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id VARCHAR NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      lead_id VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      service_date DATE NOT NULL,
      start_at TIMESTAMPTZ NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      crew_size INTEGER NOT NULL CHECK (crew_size > 0),
      status TEXT NOT NULL DEFAULT 'pending_review',
      expires_at TIMESTAMPTZ,
      review_required BOOLEAN NOT NULL DEFAULT false,
      zone_code TEXT,
      quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      admin_notes TEXT,
      reviewed_by_user_id VARCHAR REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE booking_service_items
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;
  `);

  const markets = [
    ["ironwood", "Ironwood", "MI", "49938", "Ironwood-MI-49938", "IRONWOOD_50_MILE", 100],
    ["iron-mountain", "Iron Mountain", "MI", "49801", "Iron-Mountain-MI-49801", "IRON_MOUNTAIN_REGION", 75],
    ["eagle-river", "Eagle River", "WI", "54521", "Eagle-River-WI-54521", "EAGLE_RIVER_REGION", 90],
    ["iron-river", "Iron River", "MI", "49935", "Iron-River-MI-49935", "IRON_RIVER_WEDNESDAY", 85],
    ["houghton", "Houghton", "MI", "49931", "Houghton-MI-49931", "HOUGHTON_TUESDAY", 80],
    ["wausau", "Wausau", "WI", "54402", "Wausau-WI-54402", "WAUSAU_REGION", 60],
  ] as const;

  for (const [slug, city, state, postalCode, cityPath, serviceAreaCode, priority] of markets) {
    await pool.query(`
      INSERT INTO northwoods_markets
        (slug, city, state_code, postal_code, provider_id, profile_url, results_url, service_area_code, priority)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (slug) DO UPDATE SET
        provider_id=EXCLUDED.provider_id,
        updated_at=NOW()
    `, [slug, city, state, postalCode, NORTHWOODS_PROVIDER_ID, providerUrl(cityPath), resultsUrl(cityPath), serviceAreaCode, priority]);
  }
}

export async function auditNorthwoods(input: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await ensureNorthwoodsSchema();
  await pool.query(`
    INSERT INTO northwoods_audit_events(actor_user_id, action, target_type, target_id, metadata)
    VALUES ($1,$2,$3,$4,$5::jsonb)
  `, [input.actorUserId || null, input.action, input.targetType, input.targetId || null, JSON.stringify(input.metadata || {})]);
}
