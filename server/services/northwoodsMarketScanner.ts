import crypto from "crypto";
import { NORTHWOODS_PROVIDER_ID } from "@shared/northwoodsMarketing";
import { pool } from "../db";
import { auditNorthwoods, ensureNorthwoodsSchema } from "./northwoodsSchema";

export const NORTHWOODS_SCANNER_VERSION = "northwoods-public-v1";
const ALLOWED_HOSTS = new Set(["www.uhaul.com", "uhaul.com", "www.movinghelp.com", "movinghelp.com"]);

export type ParsedMarketListing = {
  providerId: string;
  providerName: string;
  profileUrl: string | null;
  isNorthwoods: boolean;
  listingRank: number | null;
  twoHourRateCents: number | null;
  additionalHourRateCents: number | null;
  pianoFeeCents: number | null;
  safeFeeCents: number | null;
  rating: number | null;
  reviewCount: number | null;
  completedJobs: number | null;
  services: string[];
  listedForTargetDate: boolean;
  sourceUrl: string;
  contentChecksum: string;
};

function assertAllowedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Only official public U-Haul or Moving Help HTTPS pages may be scanned");
  }
  return url;
}

function htmlText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?\s*>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#36;/g, "$")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cents(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Math.round(Number(match[1].replaceAll(",", "")) * 100);
  }
  return null;
}

function numberMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

function servicesFrom(text: string) {
  return [
    /Load\s*\/\s*Unload/i.test(text) ? "loading" : null,
    /Load\s*\/\s*Unload/i.test(text) ? "unloading" : null,
    /Pack\s*\/\s*Unpack/i.test(text) ? "packing" : null,
    /U[ -]?Box/i.test(text) ? "u_box" : null,
    /Piano Fee|\bPiano\b/i.test(text) ? "piano" : null,
    /Gun Safe Fee|\bSafe\b/i.test(text) ? "safe" : null,
    /Cleaning Help|Maid Services/i.test(text) ? "cleaning" : null,
  ].filter((value): value is string => Boolean(value));
}

export function parseNorthwoodsProfileHtml(html: string, sourceUrl: string, listedForTargetDate = true): ParsedMarketListing {
  const text = htmlText(html);
  const providerName = text.match(/Northwoods Moving and Junk Removing/i)?.[0] || "Northwoods Moving and Junk Removing";
  return {
    providerId: NORTHWOODS_PROVIDER_ID,
    providerName,
    profileUrl: sourceUrl,
    isNorthwoods: true,
    listingRank: null,
    twoHourRateCents: cents(text, [/Labor Rate\s*:?\s*\$\s*([\d,.]+)/i, /Price quote\s*:?\s*\$\s*([\d,.]+)/i]),
    additionalHourRateCents: cents(text, [/discounted hourly rate of\s*\$\s*([\d,.]+)/i, /after 2 hours[^$]*\$\s*([\d,.]+)/i]),
    pianoFeeCents: cents(text, [/Piano Fee[\s\S]{0,120}?\$\s*([\d,.]+)/i]),
    safeFeeCents: cents(text, [/(?:Gun )?Safe Fee[\s\S]{0,120}?\$\s*([\d,.]+)/i]),
    rating: numberMatch(text, [/Customer Rating\s*:?\s*([\d.]+)/i, /Overall Rating\s*:?\s*([\d.]+)/i]),
    reviewCount: numberMatch(text, [/(\d+)\s+reviews?/i]),
    completedJobs: numberMatch(text, [/Completed Jobs\s*:?\s*(\d+)/i]),
    services: servicesFrom(text),
    listedForTargetDate,
    sourceUrl,
    contentChecksum: crypto.createHash("sha256").update(text).digest("hex"),
  };
}

export function parseMarketResultsHtml(html: string, sourceUrl: string): ParsedMarketListing[] {
  const listings: ParsedMarketListing[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href=["']([^"']*\/MovingHelp\/[^"']*\?[^"']*\bid=([^&"']+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const providerId = decodeURIComponent(match[2]);
    if (!providerId || seen.has(providerId)) continue;
    const start = Math.max(0, (match.index || 0) - 1200);
    const end = Math.min(html.length, (match.index || 0) + match[0].length + 1800);
    const context = htmlText(html.slice(start, end));
    const anchorText = htmlText(match[3]);
    const heading = context.match(/(?:##\s*)?([A-Z][A-Za-z0-9&' .-]{3,100})(?:\n|\s+Based out of)/i)?.[1]?.trim();
    const providerName = anchorText.length >= 3 && anchorText.length <= 120 ? anchorText : heading || `Provider ${providerId}`;
    seen.add(providerId);
    listings.push({
      providerId,
      providerName,
      profileUrl: new URL(match[1], sourceUrl).toString(),
      isNorthwoods: providerId.toUpperCase() === NORTHWOODS_PROVIDER_ID || /Northwoods Moving/i.test(context),
      listingRank: listings.length + 1,
      twoHourRateCents: cents(context, [/Price quote\s*:?\s*\$\s*([\d,.]+)/i, /Your Quote Includes[\s\S]{0,300}?\$\s*([\d,.]+)/i]),
      additionalHourRateCents: cents(context, [/discounted hourly rate of\s*\$\s*([\d,.]+)/i]),
      pianoFeeCents: null,
      safeFeeCents: null,
      rating: numberMatch(context, [/Overall Rating\s*:?\s*([\d.]+)/i]),
      reviewCount: numberMatch(context, [/(\d+)\s+reviews?/i]),
      completedJobs: numberMatch(context, [/Completed Jobs\s*:?\s*(\d+)/i]),
      services: servicesFrom(context),
      listedForTargetDate: true,
      sourceUrl,
      contentChecksum: crypto.createHash("sha256").update(context).digest("hex"),
    });
  }
  return listings;
}

async function fetchOfficial(urlValue: string) {
  const url = assertAllowedUrl(urlValue);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "JCOnTheMove-NorthwoodsMarketReview/1.0 contact@jconthemove.com",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) throw new Error(`Official marketplace returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function withDate(urlValue: string, targetDate: string) {
  const url = assertAllowedUrl(urlValue);
  const [year, month, day] = targetDate.split("-");
  url.searchParams.set("date", `${Number(month)}/${Number(day)}/${year}`);
  return url.toString();
}

async function insertListing(runId: string, marketId: string, listing: ParsedMarketListing) {
  await pool.query(`
    INSERT INTO northwoods_scan_listings
      (run_id, market_id, provider_id, provider_name, profile_url, is_northwoods, listing_rank,
       two_hour_rate_cents, additional_hour_rate_cents, piano_fee_cents, safe_fee_cents,
       rating, review_count, completed_jobs, services, listed_for_target_date, source_url, content_checksum)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (run_id, market_id, provider_id) DO UPDATE SET
      provider_name=EXCLUDED.provider_name, profile_url=COALESCE(EXCLUDED.profile_url,northwoods_scan_listings.profile_url),
      is_northwoods=EXCLUDED.is_northwoods, listing_rank=COALESCE(EXCLUDED.listing_rank,northwoods_scan_listings.listing_rank),
      two_hour_rate_cents=COALESCE(EXCLUDED.two_hour_rate_cents,northwoods_scan_listings.two_hour_rate_cents),
      additional_hour_rate_cents=COALESCE(EXCLUDED.additional_hour_rate_cents,northwoods_scan_listings.additional_hour_rate_cents),
      piano_fee_cents=COALESCE(EXCLUDED.piano_fee_cents,northwoods_scan_listings.piano_fee_cents),
      safe_fee_cents=COALESCE(EXCLUDED.safe_fee_cents,northwoods_scan_listings.safe_fee_cents),
      rating=COALESCE(EXCLUDED.rating,northwoods_scan_listings.rating),
      review_count=COALESCE(EXCLUDED.review_count,northwoods_scan_listings.review_count),
      completed_jobs=COALESCE(EXCLUDED.completed_jobs,northwoods_scan_listings.completed_jobs),
      services=CASE WHEN cardinality(EXCLUDED.services)>0 THEN EXCLUDED.services ELSE northwoods_scan_listings.services END,
      listed_for_target_date=EXCLUDED.listed_for_target_date, source_url=EXCLUDED.source_url,
      content_checksum=EXCLUDED.content_checksum, captured_at=NOW()
  `, [runId, marketId, listing.providerId, listing.providerName, listing.profileUrl, listing.isNorthwoods,
      listing.listingRank, listing.twoHourRateCents, listing.additionalHourRateCents, listing.pianoFeeCents,
      listing.safeFeeCents, listing.rating, listing.reviewCount, listing.completedJobs, listing.services,
      listing.listedForTargetDate, listing.sourceUrl, listing.contentChecksum]);
}

export async function runNorthwoodsMarketScan(input: {
  marketIds?: string[];
  targetDate: string;
  actorUserId: string;
}) {
  if (process.env.NORTHWOODS_MARKET_SCAN_ENABLED !== "true") {
    throw new Error("Public market scanning is disabled. Use a manual reviewed snapshot or enable the compliance feature flag.");
  }
  await ensureNorthwoodsSchema();
  const markets = await pool.query<any>(`
    SELECT * FROM northwoods_markets
    WHERE active=true AND ($1::text[] IS NULL OR id=ANY($1::text[]))
    ORDER BY priority DESC, city
  `, [input.marketIds?.length ? input.marketIds : null]);
  if (!markets.rows.length) throw new Error("No active markets selected");
  const run = await pool.query<{ id: string }>(`
    INSERT INTO northwoods_scan_runs(target_date,status,market_ids,requested_by_user_id,parser_version)
    VALUES ($1::date,'running',$2,$3,$4) RETURNING id
  `, [input.targetDate, markets.rows.map((row) => row.id), input.actorUserId, NORTHWOODS_SCANNER_VERSION]);
  const runId = run.rows[0].id;
  try {
    for (const market of markets.rows) {
      const resultsSource = withDate(market.results_url, input.targetDate);
      const resultsHtml = await fetchOfficial(resultsSource);
      const publicListings = parseMarketResultsHtml(resultsHtml, resultsSource);
      for (const listing of publicListings) await insertListing(runId, market.id, listing);
      const profileHtml = await fetchOfficial(withDate(market.profile_url, input.targetDate));
      const profile = parseNorthwoodsProfileHtml(profileHtml, market.profile_url,
        publicListings.some((listing) => listing.isNorthwoods));
      await insertListing(runId, market.id, profile);
    }
    await pool.query("UPDATE northwoods_scan_runs SET status='pending_review',finished_at=NOW() WHERE id=$1", [runId]);
  } catch (error) {
    await pool.query("UPDATE northwoods_scan_runs SET status='failed',error_message=$2,finished_at=NOW() WHERE id=$1", [runId, error instanceof Error ? error.message : String(error)]);
    throw error;
  }
  await auditNorthwoods({ actorUserId: input.actorUserId, action: "market_scan_created", targetType: "scan_run", targetId: runId });
  return getNorthwoodsScan(runId);
}

export async function getNorthwoodsScan(id: string) {
  await ensureNorthwoodsSchema();
  const [run, listings] = await Promise.all([
    pool.query("SELECT * FROM northwoods_scan_runs WHERE id=$1 LIMIT 1", [id]),
    pool.query(`SELECT l.*,m.slug,m.city,m.state_code FROM northwoods_scan_listings l JOIN northwoods_markets m ON m.id=l.market_id WHERE l.run_id=$1 ORDER BY m.priority DESC,l.listing_rank NULLS LAST,l.provider_name`, [id]),
  ]);
  return run.rows[0] ? { ...run.rows[0], listings: listings.rows } : null;
}

export async function reviewNorthwoodsScan(id: string, decision: "approved" | "rejected", actorUserId: string) {
  await ensureNorthwoodsSchema();
  const result = await pool.query(`
    UPDATE northwoods_scan_runs SET status=$2,reviewed_by_user_id=$3,reviewed_at=NOW()
    WHERE id=$1 AND status='pending_review' RETURNING *
  `, [id, decision, actorUserId]);
  if (!result.rows[0]) throw new Error("Only a pending market scan can be reviewed");
  await auditNorthwoods({ actorUserId, action: `market_scan_${decision}`, targetType: "scan_run", targetId: id });
  return getNorthwoodsScan(id);
}

export async function createManualNorthwoodsSnapshot(input: {
  marketId: string;
  targetDate: string;
  actorUserId: string;
  twoHourRateCents: number;
  additionalHourRateCents?: number | null;
  pianoFeeCents?: number | null;
  safeFeeCents?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
}) {
  await ensureNorthwoodsSchema();
  const market = await pool.query<any>("SELECT * FROM northwoods_markets WHERE id=$1 AND active=true LIMIT 1", [input.marketId]);
  if (!market.rows[0]) throw new Error("Market not found");
  const run = await pool.query<{ id: string }>(`
    INSERT INTO northwoods_scan_runs(target_date,status,market_ids,requested_by_user_id,parser_version,finished_at)
    VALUES ($1::date,'pending_review',ARRAY[$2]::text[],$3,'manual-v1',NOW()) RETURNING id
  `, [input.targetDate, input.marketId, input.actorUserId]);
  const listing: ParsedMarketListing = {
    providerId: NORTHWOODS_PROVIDER_ID,
    providerName: "Northwoods Moving and Junk Removing",
    profileUrl: market.rows[0].profile_url,
    isNorthwoods: true,
    listingRank: null,
    twoHourRateCents: input.twoHourRateCents,
    additionalHourRateCents: input.additionalHourRateCents ?? null,
    pianoFeeCents: input.pianoFeeCents ?? null,
    safeFeeCents: input.safeFeeCents ?? null,
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
    completedJobs: null,
    services: market.rows[0].services || [],
    listedForTargetDate: true,
    sourceUrl: market.rows[0].profile_url,
    contentChecksum: crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex"),
  };
  await insertListing(run.rows[0].id, input.marketId, listing);
  await auditNorthwoods({ actorUserId: input.actorUserId, action: "manual_snapshot_created", targetType: "scan_run", targetId: run.rows[0].id });
  return getNorthwoodsScan(run.rows[0].id);
}

export { assertAllowedUrl as assertNorthwoodsOfficialUrl, htmlText as northwoodsMarketTextFromHtml };
