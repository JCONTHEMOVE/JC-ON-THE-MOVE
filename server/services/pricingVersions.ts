import { pool } from "../db";
import {
  CANONICAL_PRICING_2026_08,
  CANONICAL_PRICING_2026_08_1,
  applyGeographicQuotePolicy,
  calculateRateCardLine,
  canonicalPricingSnapshotSchema,
  type CanonicalPricingSnapshot,
} from "@shared/canonicalPricing";
import { resolveQuoteRouteEvidence } from "./quoteGeography";

type Actor = { userId?: string | null; email?: string | null };

type VersionRow = {
  id: string;
  code: string;
  status: "draft" | "active" | "archived";
  currency: string;
  effective_at: Date | string | null;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: Date | string;
  published_at: Date | string | null;
};

type RuleRow = { rule_key: string; payload: unknown };

let infrastructurePromise: Promise<void> | null = null;
let seedPromise: Promise<void> | null = null;
let activeCache: { expiresAt: number; value: ActivePricingSnapshot } | null = null;
let fallbackWarningAt = 0;

export type ActivePricingSnapshot = {
  versionId: string | null;
  source: "database" | "fallback";
  snapshot: CanonicalPricingSnapshot;
};

function ruleEntries(snapshot: CanonicalPricingSnapshot) {
  const rules: Array<{ key: string; serviceCode: string | null; payload: unknown }> = [
    { key: "metadata", serviceCode: null, payload: { marketPosition: snapshot.marketPosition, policies: snapshot.policies } },
    { key: "labor", serviceCode: "labor", payload: snapshot.labor },
    { key: "equipment", serviceCode: "moving", payload: snapshot.equipment },
    { key: "travel", serviceCode: null, payload: snapshot.travel },
    ...Object.entries(snapshot.services).map(([serviceCode, payload]) => ({
      key: `services.${serviceCode}`,
      serviceCode,
      payload,
    })),
    { key: "offers", serviceCode: null, payload: snapshot.offers },
    { key: "rewards", serviceCode: null, payload: snapshot.rewards },
  ];
  if (snapshot.marketplaceRateCard) {
    rules.push({ key: "marketplace_rate_card", serviceCode: "moving", payload: snapshot.marketplaceRateCard });
  }
  if (snapshot.geographicPolicy) {
    rules.push({ key: "geographic_policy", serviceCode: null, payload: snapshot.geographicPolicy });
  }
  return rules;
}

function snapshotFromRows(version: VersionRow, rows: RuleRow[]): CanonicalPricingSnapshot {
  const byKey = new Map(rows.map((row) => [row.rule_key, row.payload]));
  const metadata = (byKey.get("metadata") || {}) as Record<string, unknown>;
  const services: Record<string, unknown> = {};
  for (const [key, value] of byKey) {
    if (key.startsWith("services.")) services[key.slice("services.".length)] = value;
  }
  return canonicalPricingSnapshotSchema.parse({
    version: version.code,
    currency: version.currency,
    effectiveAt: version.effective_at
      ? new Date(version.effective_at).toISOString()
      : new Date(version.created_at).toISOString(),
    marketPosition: metadata.marketPosition,
    labor: byKey.get("labor"),
    equipment: byKey.get("equipment"),
    travel: byKey.get("travel"),
    services,
    offers: byKey.get("offers"),
    rewards: byKey.get("rewards"),
    policies: metadata.policies,
    marketplaceRateCard: byKey.get("marketplace_rate_card"),
    geographicPolicy: byKey.get("geographic_policy"),
  });
}

export function invalidatePricingCache() {
  activeCache = null;
}

export async function ensurePricingVersionInfrastructure(): Promise<void> {
  if (infrastructurePromise) return infrastructurePromise;
  infrastructurePromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pricing_versions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        code text NOT NULL UNIQUE,
        status text NOT NULL DEFAULT 'draft',
        currency text NOT NULL DEFAULT 'USD',
        effective_at timestamp,
        notes text,
        created_by_user_id varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        published_at timestamp
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_versions_status
        ON pricing_versions(status, created_at);

      CREATE TABLE IF NOT EXISTS pricing_rules (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        pricing_version_id varchar NOT NULL REFERENCES pricing_versions(id) ON DELETE CASCADE,
        rule_key text NOT NULL,
        service_code text,
        payload jsonb NOT NULL,
        discount_eligible boolean NOT NULL DEFAULT true,
        is_pass_through boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        UNIQUE(pricing_version_id, rule_key)
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_service ON pricing_rules(service_code);

      CREATE TABLE IF NOT EXISTS pricing_publication_audit (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        pricing_version_id varchar NOT NULL REFERENCES pricing_versions(id),
        action text NOT NULL,
        previous_version_code text,
        actor_user_id varchar,
        actor_email text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_publication_audit_created
        ON pricing_publication_audit(created_at);

      CREATE TABLE IF NOT EXISTS pricing_shadow_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        pricing_version_id varchar NOT NULL REFERENCES pricing_versions(id) ON DELETE CASCADE,
        pricing_version_code text NOT NULL,
        sample_size integer NOT NULL DEFAULT 0,
        summary jsonb NOT NULL DEFAULT '{}'::jsonb,
        comparisons jsonb NOT NULL DEFAULT '[]'::jsonb,
        actor_user_id varchar,
        actor_email text,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_pricing_shadow_runs_version
        ON pricing_shadow_runs(pricing_version_id, created_at DESC);

      ALTER TABLE bookings
        ADD COLUMN IF NOT EXISTS pricing_version_id varchar REFERENCES pricing_versions(id),
        ADD COLUMN IF NOT EXISTS pricing_version_code text,
        ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;
      CREATE INDEX IF NOT EXISTS idx_bookings_pricing_version
        ON bookings(pricing_version_id);
    `);
  })().catch((error) => {
    infrastructurePromise = null;
    throw error;
  });
  return infrastructurePromise;
}

async function insertRules(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> },
  versionId: string,
  snapshot: CanonicalPricingSnapshot,
) {
  for (const rule of ruleEntries(snapshot)) {
    await client.query(
      `INSERT INTO pricing_rules
        (pricing_version_id, rule_key, service_code, payload, discount_eligible, is_pass_through)
       VALUES ($1, $2, $3, $4::jsonb, $5, false)`,
      [
        versionId,
        rule.key,
        rule.serviceCode,
        JSON.stringify(rule.payload),
        !["metadata", "rewards"].includes(rule.key),
      ],
    );
  }
}

async function ensureGeographicDraft(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> },
) {
  const existing = await client.query(
    `SELECT id FROM pricing_versions WHERE code = $1`,
    [CANONICAL_PRICING_2026_08_1.version],
  );
  if (existing.rows.length > 0) return;
  const inserted = await client.query(
    `INSERT INTO pricing_versions
      (code, status, currency, effective_at, notes)
     VALUES ($1, 'draft', $2, $3::timestamptz, $4)
     RETURNING id`,
    [
      CANONICAL_PRICING_2026_08_1.version,
      CANONICAL_PRICING_2026_08_1.currency,
      CANONICAL_PRICING_2026_08_1.effectiveAt,
      "Geographic bubble, weekend premium, extended-travel approval, and attached marketplace rate card.",
    ],
  );
  const versionId = String(inserted.rows[0].id);
  await insertRules(client, versionId, CANONICAL_PRICING_2026_08_1);
  await client.query(
    `INSERT INTO pricing_publication_audit
      (pricing_version_id, action, previous_version_code, metadata)
     VALUES ($1, 'seed', $2, $3::jsonb)`,
    [versionId, CANONICAL_PRICING_2026_08.version, JSON.stringify({ automatic: true, requiresOwnerPublication: true })],
  );
}

export async function ensureCanonicalPricingVersionsSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    await ensurePricingVersionInfrastructure();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT id FROM pricing_versions WHERE code = $1 FOR UPDATE`,
        [CANONICAL_PRICING_2026_08.version],
      );
      if (existing.rows.length > 0) {
        await ensureGeographicDraft(client);
        await client.query("COMMIT");
        return;
      }

      const [spinConfig, catalog] = await Promise.all([
        client.query(`SELECT setting_key, setting_value FROM spin_config WHERE setting_key LIKE 'pricing_%' ORDER BY setting_key`),
        client.query(`SELECT code, default_price, suggested_min, suggested_max FROM service_catalog ORDER BY code`),
      ]);
      const legacyInsert = await client.query(
        `INSERT INTO pricing_versions (code, status, currency, effective_at, notes)
         VALUES ('2026.07-live', 'archived', 'USD', NOW(), $1)
         ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        ["Automatic rollback snapshot captured before canonical premium pricing 2026.08."],
      );
      const legacyId = String(legacyInsert.rows[0].id);
      await client.query(
        `INSERT INTO pricing_rules (pricing_version_id, rule_key, payload, discount_eligible)
         VALUES ($1, 'legacy_snapshot', $2::jsonb, false)
         ON CONFLICT (pricing_version_id, rule_key) DO NOTHING`,
        [legacyId, JSON.stringify({ spinConfig: spinConfig.rows, serviceCatalog: catalog.rows })],
      );

      const previous = await client.query(`SELECT code FROM pricing_versions WHERE status = 'active' LIMIT 1`);
      await client.query(`UPDATE pricing_versions SET status = 'archived' WHERE status = 'active'`);
      const inserted = await client.query(
        `INSERT INTO pricing_versions
          (code, status, currency, effective_at, notes, published_at)
         VALUES ($1, 'active', $2, $3::timestamptz, $4, NOW())
         RETURNING id`,
        [
          CANONICAL_PRICING_2026_08.version,
          CANONICAL_PRICING_2026_08.currency,
          CANONICAL_PRICING_2026_08.effectiveAt,
          "Approved premium pricing and offer cleanup.",
        ],
      );
      const versionId = String(inserted.rows[0].id);
      await insertRules(client, versionId, CANONICAL_PRICING_2026_08);
      await client.query(
        `INSERT INTO pricing_publication_audit
          (pricing_version_id, action, previous_version_code, metadata)
         VALUES ($1, 'seed', $2, $3::jsonb)`,
        [versionId, previous.rows[0]?.code ?? "2026.07-live", JSON.stringify({ automatic: true })],
      );
      await ensureGeographicDraft(client);
      await client.query("COMMIT");
      invalidatePricingCache();
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch { /* transaction already closed */ }
      throw error;
    } finally {
      client.release();
    }
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}

async function loadVersion(code?: string): Promise<ActivePricingSnapshot | null> {
  await ensurePricingVersionInfrastructure();
  const versionResult = code
    ? await pool.query<VersionRow>(`SELECT * FROM pricing_versions WHERE code = $1 LIMIT 1`, [code])
    : await pool.query<VersionRow>(`SELECT * FROM pricing_versions WHERE status = 'active' ORDER BY published_at DESC NULLS LAST LIMIT 1`);
  const version = versionResult.rows[0];
  if (!version) return null;
  const rules = await pool.query<RuleRow>(
    `SELECT rule_key, payload FROM pricing_rules WHERE pricing_version_id = $1 ORDER BY rule_key`,
    [version.id],
  );
  try {
    return { versionId: version.id, source: "database", snapshot: snapshotFromRows(version, rules.rows) };
  } catch (error) {
    console.error(`[pricingVersions] invalid pricing version ${version.code}:`, error);
    return null;
  }
}

export async function getActivePricingSnapshot(): Promise<ActivePricingSnapshot> {
  if (activeCache && activeCache.expiresAt > Date.now()) return activeCache.value;
  try {
    await ensureCanonicalPricingVersionsSeeded();
    const loaded = await loadVersion();
    if (loaded) {
      activeCache = { expiresAt: Date.now() + 30_000, value: loaded };
      return loaded;
    }
  } catch (error) {
    const now = Date.now();
    if (now - fallbackWarningAt > 60_000) {
      fallbackWarningAt = now;
      console.error("[pricingVersions] FALLBACK_PRICING_USED", error);
    }
  }
  return { versionId: null, source: "fallback", snapshot: CANONICAL_PRICING_2026_08 };
}

export async function getPricingSnapshotByCode(code: string): Promise<ActivePricingSnapshot | null> {
  await ensureCanonicalPricingVersionsSeeded();
  return loadVersion(code);
}

export async function listPricingVersions() {
  await ensureCanonicalPricingVersionsSeeded();
  const result = await pool.query(`
    SELECT v.*,
           COUNT(r.id)::int AS rule_count
    FROM pricing_versions v
    LEFT JOIN pricing_rules r ON r.pricing_version_id = v.id
    GROUP BY v.id
    ORDER BY v.created_at DESC
  `);
  return result.rows;
}

function shadowServiceCode(serviceType: unknown): "load_unload" | "pack_unpack" | "cleaning" | null {
  const service = String(serviceType || "").toLowerCase();
  if (service.includes("clean")) return "cleaning";
  if (service.includes("pack")) return "pack_unpack";
  if (/move|moving|residential|commercial|labor|load|unload|u-?box/.test(service)) return "load_unload";
  return null;
}

function shadowMoney(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(Math.max(0, parsed) * 100) / 100 : 0;
}

export async function shadowComparePricingVersion(code: string, requestedLimit: number, actor: Actor) {
  await ensureCanonicalPricingVersionsSeeded();
  const target = await loadVersion(code);
  if (!target?.versionId) throw new Error(`Pricing version ${code} was not found`);
  const limit = Math.max(1, Math.min(50, Math.round(requestedLimit || 20)));
  const { rows } = await pool.query<{
    id: string;
    service_type: string;
    crew_size: number | null;
    confirmed_hours: string | number | null;
    from_address: string | null;
    to_address: string | null;
    confirmed_from_address: string | null;
    confirmed_to_address: string | null;
    confirmed_date: string | null;
    move_date: string | null;
    base_price: string | null;
    total_price: string | null;
    total_special_items_fee: string | null;
    bundle_discount_amount: string | null;
    created_at: Date | string;
  }>(`
    SELECT id, service_type, crew_size, confirmed_hours,
           from_address, to_address, confirmed_from_address, confirmed_to_address,
           confirmed_date, move_date, base_price, total_price,
           total_special_items_fee, bundle_discount_amount, created_at
      FROM leads
     WHERE COALESCE(total_price, base_price) IS NOT NULL
       AND archived_at IS NULL
     ORDER BY COALESCE(last_quote_updated_at, created_at) DESC
     LIMIT $1
  `, [limit]);

  const comparisons: Array<Record<string, unknown>> = [];
  for (const lead of rows) {
    const serviceCode = shadowServiceCode(lead.service_type);
    const rate = serviceCode ? calculateRateCardLine({
      serviceCode,
      crewSize: Math.max(1, Math.round(Number(lead.crew_size) || 2)),
      hours: Math.max(1, Number(lead.confirmed_hours) || 2),
      snapshot: target.snapshot,
    }) : null;
    const legacyBase = shadowMoney(lead.base_price || lead.total_price);
    const targetBase = shadowMoney((rate?.subtotal ?? legacyBase) + shadowMoney(lead.total_special_items_fee));
    const routeEvidence = await resolveQuoteRouteEvidence({
      addresses: [
        lead.confirmed_from_address || lead.from_address || "",
        lead.confirmed_to_address || lead.to_address || "",
      ],
      snapshot: target.snapshot,
    });
    const policy = applyGeographicQuotePolicy({
      baseSubtotal: targetBase,
      automaticDiscountTotal: shadowMoney(lead.bundle_discount_amount),
      serviceDate: lead.confirmed_date || lead.move_date,
      stopCoordinates: routeEvidence.stopCoordinates,
      routeVerified: routeEvidence.verified,
      oneWayMiles: routeEvidence.oneWayMiles,
      oneWayMinutes: routeEvidence.oneWayMinutes,
      snapshot: target.snapshot,
    });
    const existingTotal = shadowMoney(lead.total_price || lead.base_price);
    const targetTotal = policy?.finalPreTaxTotal ?? targetBase;
    comparisons.push({
      leadId: lead.id,
      serviceType: lead.service_type,
      createdAt: lead.created_at,
      existingTotal,
      targetTotal,
      difference: shadowMoney(Math.abs(targetTotal - existingTotal)) * (targetTotal < existingTotal ? -1 : 1),
      percentDifference: existingTotal > 0 ? Math.round(((targetTotal - existingTotal) / existingTotal) * 10_000) / 100 : null,
      targetBase,
      rateCardLine: rate,
      pricingAdjustments: policy?.pricingAdjustments || null,
      travelEligibility: policy?.travelEligibility || null,
      routeEvidence,
    });
  }

  const differences = comparisons.map((item) => Number(item.difference) || 0);
  const summary = {
    sampleSize: comparisons.length,
    increases: differences.filter((value) => value > 0).length,
    decreases: differences.filter((value) => value < 0).length,
    unchanged: differences.filter((value) => value === 0).length,
    unverifiedRoutes: comparisons.filter((item) => (item.travelEligibility as any)?.status === "unverified").length,
    averageDifference: differences.length
      ? Math.round((differences.reduce((sum, value) => sum + value, 0) / differences.length) * 100) / 100
      : 0,
    averageAbsoluteDifference: differences.length
      ? Math.round((differences.reduce((sum, value) => sum + Math.abs(value), 0) / differences.length) * 100) / 100
      : 0,
  };
  const inserted = await pool.query(`
    INSERT INTO pricing_shadow_runs
      (pricing_version_id, pricing_version_code, sample_size, summary, comparisons, actor_user_id, actor_email)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
    RETURNING id, created_at
  `, [
    target.versionId,
    target.snapshot.version,
    comparisons.length,
    JSON.stringify(summary),
    JSON.stringify(comparisons),
    actor.userId ?? null,
    actor.email ?? null,
  ]);
  return {
    runId: inserted.rows[0]?.id,
    createdAt: inserted.rows[0]?.created_at,
    pricingVersion: target.snapshot.version,
    summary,
    comparisons,
  };
}

export async function createPricingVersion(
  snapshotInput: unknown,
  notes: string | null,
  actor: Actor,
) {
  await ensureCanonicalPricingVersionsSeeded();
  const snapshot = canonicalPricingSnapshotSchema.parse(snapshotInput);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO pricing_versions
        (code, status, currency, effective_at, notes, created_by_user_id)
       VALUES ($1, 'draft', $2, $3::timestamptz, $4, $5)
       RETURNING *`,
      [snapshot.version, snapshot.currency, snapshot.effectiveAt, notes, actor.userId ?? null],
    );
    await insertRules(client, String(inserted.rows[0].id), snapshot);
    await client.query("COMMIT");
    return inserted.rows[0];
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction already closed */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function activatePricingVersion(code: string, actor: Actor) {
  await ensureCanonicalPricingVersionsSeeded();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const targetResult = await client.query<VersionRow>(
      `SELECT * FROM pricing_versions WHERE code = $1 FOR UPDATE`,
      [code],
    );
    const target = targetResult.rows[0];
    if (!target) throw new Error(`Pricing version ${code} was not found`);
    if (target.status === "draft") {
      const shadow = await client.query(
        `SELECT id FROM pricing_shadow_runs WHERE pricing_version_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [target.id],
      );
      if (shadow.rows.length === 0) {
        throw new Error(`Run a recent-quote shadow comparison for pricing version ${code} before publication`);
      }
    }
    const validation = await client.query<RuleRow>(
      `SELECT rule_key, payload FROM pricing_rules WHERE pricing_version_id = $1`,
      [target.id],
    );
    snapshotFromRows(target, validation.rows);
    const active = await client.query<VersionRow>(
      `SELECT * FROM pricing_versions WHERE status = 'active' FOR UPDATE`,
    );
    const previous = active.rows[0];
    if (previous?.id === target.id) {
      await client.query("COMMIT");
      return target;
    }
    await client.query(`UPDATE pricing_versions SET status = 'archived' WHERE status = 'active'`);
    const published = await client.query(
      `UPDATE pricing_versions
       SET status = 'active', published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [target.id],
    );
    await client.query(
      `INSERT INTO pricing_publication_audit
        (pricing_version_id, action, previous_version_code, actor_user_id, actor_email, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        target.id,
        target.status === "draft" ? "publish" : "rollback",
        previous?.code ?? null,
        actor.userId ?? null,
        actor.email ?? null,
        JSON.stringify({ activatedCode: code }),
      ],
    );
    await client.query("COMMIT");
    invalidatePricingCache();
    return published.rows[0];
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction already closed */ }
    throw error;
  } finally {
    client.release();
  }
}
