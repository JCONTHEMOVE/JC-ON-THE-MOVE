import crypto from "crypto";
import {
  NORTHWOODS_FOCUS_LABELS,
  NORTHWOODS_TIME_ZONE,
  type NorthwoodsFocus,
} from "@shared/northwoodsMarketing";
import { pool } from "../db";
import { getAppUrl } from "../appUrl";
import { createMarketingCreative } from "./marketingCreativeGenerator";
import { ensureNorthwoodsSchema } from "./northwoodsSchema";
import { appendNorthwoodsCampaignFacts, validateNorthwoodsCampaignSafety } from "./northwoodsCampaignPolicy";
import { getMarketingBotCampaign } from "./marketingBot";
import {
  MARKETING_META_PILOT_CHANNEL,
  MARKETING_META_PILOT_REP_SLUG,
} from "./marketingMetaPilotPolicy";

let scheduler: NodeJS.Timeout | null = null;

function localParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: NORTHWOODS_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function territoryFor(slug: string) {
  return ({
    ironwood: "ironwood_hurley",
    houghton: "houghton",
    "eagle-river": "eagle_river",
    "iron-river": "iron_river",
    "iron-mountain": "up_northwoods",
    wausau: "up_northwoods",
  } as Record<string, string>)[slug] || "up_northwoods";
}

function serviceFor(focus: NorthwoodsFocus) {
  if (focus === "packing") return "packing";
  if (["piano", "safe", "piano_safe"].includes(focus)) return "heavy_item";
  return "moving";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function buildCopy(input: { city: string; stateCode: string; focus: NorthwoodsFocus; serviceDate: string; destinationUrl: string }) {
  const focusLabel = NORTHWOODS_FOCUS_LABELS[input.focus];
  const market = `${input.city}, ${input.stateCode}`;
  const opening = dateLabel(input.serviceDate);
  const headline = `${focusLabel} in ${input.city}`.slice(0, 100);
  const base = `Need ${focusLabel.toLowerCase()} around ${market}? Northwoods Moving and Junk Removing has a confirmed crew opening on ${opening}. Reserve the crew size, hours, and services you need through Moving Help powered by U-Haul.`;
  return {
    headline,
    facebookCaption: appendNorthwoodsCampaignFacts({ text: base, destinationUrl: input.destinationUrl, marketLabel: market }).slice(0, 2000),
    instagramCaption: appendNorthwoodsCampaignFacts({ text: `${base}\n\n#NorthwoodsMoving #MovingHelp #${input.city.replace(/\s/g, "")}`, destinationUrl: input.destinationUrl, marketLabel: market }).slice(0, 2000),
    googleBusinessSummary: appendNorthwoodsCampaignFacts({ text: base, destinationUrl: input.destinationUrl, marketLabel: market }).replaceAll("\n\n", " ").slice(0, 1500),
    shortCaption: appendNorthwoodsCampaignFacts({ text: `${focusLabel} around ${market} with a confirmed opening on ${opening}.`, destinationUrl: input.destinationUrl, marketLabel: market }).replaceAll("\n\n", " ").slice(0, 500),
  };
}

async function eligibleMarkets(days: number) {
  await ensureNorthwoodsSchema();
  return (await pool.query<any>(`
    SELECT m.*,a.service_date::text,a.services,a.open_slots,a.status AS availability_status,
           c.verification_status,c.ads_enabled,
           COALESCE((
             SELECT COUNT(*)::int FROM northwoods_scan_listings sl
             JOIN northwoods_scan_runs sr ON sr.id=sl.run_id
             WHERE sl.market_id=m.id AND sr.status='approved' AND sr.reviewed_at >= NOW()-INTERVAL '7 days'
               AND sl.listed_for_target_date=true
           ),0) AS fresh_provider_count,
           COALESCE((SELECT COUNT(*)::int FROM marketing_bot_campaigns mb
             WHERE mb.northwoods_market_id=m.id AND mb.created_at>=NOW()-INTERVAL '14 days' AND mb.status<>'skipped'),0) AS recent_campaigns
    FROM northwoods_markets m
    JOIN service_area_capabilities c ON c.code=m.service_area_code
    JOIN LATERAL (
      SELECT * FROM northwoods_market_availability na
      WHERE na.market_id=m.id AND na.confirmed_at IS NOT NULL
        AND na.status IN ('open','limited') AND na.open_slots>0
        AND na.service_date BETWEEN CURRENT_DATE AND CURRENT_DATE+$1::int
      ORDER BY na.service_date,na.open_slots DESC LIMIT 1
    ) a ON true
    WHERE m.active=true AND c.ads_enabled=true
  `, [days])).rows;
}

function selectFocus(row: any, forced?: NorthwoodsFocus) {
  const available = (row.services || []) as NorthwoodsFocus[];
  if (forced && forced !== "auto") {
    const compatible = forced === "piano_safe" ? available.some((item) => item === "piano" || item === "safe") : available.includes(forced);
    if (!compatible) throw new Error(`${NORTHWOODS_FOCUS_LABELS[forced]} is not confirmed for this availability window`);
    return forced;
  }
  return (["u_box", "loading", "unloading", "packing", "piano", "safe"] as NorthwoodsFocus[]).find((focus) => available.includes(focus)) || "loading";
}

export async function generateNorthwoodsCampaign(input: {
  actorUserId?: string | null;
  marketId?: string;
  focus?: NorthwoodsFocus;
  source?: "daily" | "manual";
  now?: Date;
} = {}) {
  const source = input.source || "manual";
  const local = localParts(input.now);
  let candidates = await eligibleMarkets(source === "daily" ? 7 : 14);
  if (input.marketId) candidates = candidates.filter((row) => row.id === input.marketId);
  candidates = candidates.filter((row) => Number(row.recent_campaigns || 0) === 0 || source === "manual");
  candidates.sort((a, b) => String(a.service_date).localeCompare(String(b.service_date))
    || Number(a.fresh_provider_count || 0) - Number(b.fresh_provider_count || 0)
    || Number(b.open_slots || 0) - Number(a.open_slots || 0)
    || Number(b.priority || 0) - Number(a.priority || 0));
  const market = candidates[0];
  if (!market) throw new Error("No advertising-enabled market has confirmed capacity in the selected window");
  const focus = selectFocus(market, input.focus);
  const id = crypto.randomUUID();
  const runKey = source === "daily" ? `northwoods:daily:${local.date}` : `northwoods:manual:${id}`;
  const code = `NW-${local.date}-${market.slug}-${focus}-${id.slice(0, 8)}`.replace(/[^a-z0-9-]/gi, "-").toUpperCase().slice(0, 120);
  const canonicalUrl = `${getAppUrl()}/uhaul/${market.slug}`;
  const copy = buildCopy({ city: market.city, stateCode: market.state_code, focus, serviceDate: market.service_date, destinationUrl: canonicalUrl });
  const safety = validateNorthwoodsCampaignSafety({ ...copy, destinationUrl: canonicalUrl });
  if (!safety.passed) throw new Error(`Northwoods safety checks failed: ${safety.checks.filter((check) => !check.ok).map((check) => check.label).join(", ")}`);

  const existing = await pool.query("SELECT id FROM marketing_bot_campaigns WHERE run_key=$1 LIMIT 1", [runKey]);
  if (existing.rows[0]) return getMarketingBotCampaign(existing.rows[0].id);

  const creative = await createMarketingCreative({
    campaignId: id,
    revision: 1,
    area: `${market.city}, ${market.state_code}`,
    focus: NORTHWOODS_FOCUS_LABELS[focus],
    promoCode: "BOOK ON MOVING HELP",
    offerLine: "CHECK LIVE PRICE & AVAILABILITY",
    secondaryLine: "NORTHWOODS MOVING",
    brandName: "NORTHWOODS MOVING",
    siteLabel: "BOOK THROUGH MOVING HELP",
    source: { kind: "approved_photo", approvedPhotoKey: "crew-ramp" },
  });
  const facts = { brand: "northwoods_moving", providerId: market.provider_id, northwoodsMarketSlug: market.slug, serviceDate: market.service_date, focus, visualDirection: `Northwoods ${focus} campaign` };
  const signals = { openSlots: market.open_slots, services: market.services, providerCount: market.fresh_provider_count, availabilityConfirmed: true };
  try {
    await pool.query(`
      INSERT INTO marketing_bot_campaigns
        (id,run_key,campaign_code,local_date,source,service,territory,status,score,rationale,headline,
         facebook_caption,instagram_caption,google_business_summary,short_caption,cta,campaign_url,
         feed_image_url,og_image_url,facts,signals,safety,ai_model,ai_fallback,created_by_user_id,
         brand,northwoods_market_id,northwoods_focus)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending_approval',$8,$9,$10,$11,$12,$13,$14,'BOOK',$15,$16,$17,
              $18::jsonb,$19::jsonb,$20::jsonb,'deterministic-northwoods-v1',true,$21,'northwoods_moving',$22,$23)
    `, [id, runKey, code, local.date, source, serviceFor(focus), territoryFor(market.slug),
      100 + Number(market.open_slots || 0) * 10 - Number(market.fresh_provider_count || 0),
      `Confirmed ${market.service_date} opening; ${market.open_slots} open slot(s); ${market.fresh_provider_count} recently reviewed providers.`,
      copy.headline, copy.facebookCaption, copy.instagramCaption, copy.googleBusinessSummary, copy.shortCaption,
      canonicalUrl, creative.feedImageUrl, creative.ogImageUrl, JSON.stringify(facts), JSON.stringify(signals), JSON.stringify(safety),
      input.actorUserId || null, market.id, focus]);
    await pool.query(`
      INSERT INTO marketing_webhook_campaigns
        (id,campaign_name,title,message,area,focus,audience,image_url,cta_url,cta_label,source,actor_id,payload)
      VALUES ($1,$2,$3,$4,$5,$6,$5,$7,$8,'View live price','northwoods_marketing_bot',$9,$10::jsonb)
    `, [id, code, copy.headline, copy.facebookCaption, `${market.city}, ${market.state_code}`, NORTHWOODS_FOCUS_LABELS[focus],
      creative.feedImageUrl, canonicalUrl, input.actorUserId || null,
      JSON.stringify({ northwoods: true, marketId: market.id, focus, creativeRevision: 1, creative, creativeHistory: [creative] })]);
    const pilotRep = (await pool.query<{
      id: string;
      slug: string;
    }>(`
      SELECT id, slug
      FROM marketing_reps
      WHERE LOWER(slug)=$1 AND is_active=TRUE
      LIMIT 1
    `, [MARKETING_META_PILOT_REP_SLUG])).rows[0];
    if (!pilotRep) throw new Error("The active Matt marketing representative profile is required for the Northwoods Facebook pilot");
    const variantCode = `${code}-${MARKETING_META_PILOT_REP_SLUG.toUpperCase()}-${MARKETING_META_PILOT_CHANNEL.toUpperCase()}`.slice(0, 150);
    const destination = `${canonicalUrl}?variant=${encodeURIComponent(variantCode)}&focus=${encodeURIComponent(focus)}`;
    const caption = copy.facebookCaption.replaceAll(canonicalUrl, destination);
    await pool.query(`
      INSERT INTO marketing_bot_variants
        (id,campaign_id,variant_code,channel,rep_id,rep_slug,promo_code,is_company,caption,destination_url,image_url)
      VALUES ($1,$2,$3,$4,$5,$6,NULL,FALSE,$7,$8,$9)
    `, [crypto.randomUUID(), id, variantCode, MARKETING_META_PILOT_CHANNEL, pilotRep.id, pilotRep.slug, caption, destination, creative.feedImageUrl]);
    return getMarketingBotCampaign(id);
  } catch (error) {
    await pool.query("DELETE FROM marketing_bot_campaigns WHERE id=$1", [id]).catch(() => undefined);
    await pool.query("DELETE FROM marketing_webhook_campaigns WHERE id=$1", [id]).catch(() => undefined);
    throw error;
  }
}

async function schedulerTick() {
  const local = localParts();
  if (local.hour === 6 && local.minute >= 30) {
    await generateNorthwoodsCampaign({ source: "daily" }).catch((error) => console.error("[northwoods-campaign] daily proposal skipped:", error instanceof Error ? error.message : error));
  }
}

export function startNorthwoodsCampaignScheduler() {
  if (scheduler || process.env.NORTHWOODS_MARKETING_SCHEDULER_ENABLED !== "true") return;
  scheduler = setInterval(() => void schedulerTick(), 5 * 60_000);
  scheduler.unref?.();
  setTimeout(() => void schedulerTick(), 20_000).unref?.();
  console.log("[northwoods-campaign] daily proposal scheduler active; approval remains required");
}
