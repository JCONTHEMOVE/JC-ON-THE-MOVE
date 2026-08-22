import crypto from "crypto";
import { z } from "zod";
import type { MarketingBotDraftOutput, MarketingBotTerritory } from "@shared/marketingBot";
import { pool } from "../db";
import { getAppUrl } from "../appUrl";
import {
  MarketingProviderError,
  publishFacebookPage,
} from "./marketingChannels";
import {
  assertMarketingTerritoryAdsEnabled,
  ensureMarketingBotSchema,
} from "./marketingBot";
import {
  appendTrustedCampaignFacts,
  buildCampaignKey,
  validateCampaignSafety,
} from "./marketingBotPolicy";
import {
  assertMarketingMetaEncryptionConfigured,
  decryptMarketingMetaSecret,
  encryptMarketingMetaSecret,
} from "./marketingMetaCrypto";

const META_SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"] as const;
const OAUTH_SESSION_MINUTES = 15;
const PAGE_SELECTION_MINUTES = 60;

export class MarketingRepAccessError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "MarketingRepAccessError";
    this.status = status;
  }
}

type MarketingRep = {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  promo_code: string | null;
};

type MetaPageCandidate = {
  id: string;
  name: string;
  accessToken: string;
  tasks: string[];
};

function hashState(state: string) {
  return crypto.createHash("sha256").update(state).digest("hex");
}

function allowedPilotSlugs() {
  return new Set(
    (process.env.MARKETING_META_PILOT_REP_SLUGS || "matt")
      .split(",")
      .map((slug) => slug.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getMetaOAuthReadiness() {
  const required = [
    "META_APP_ID",
    "META_APP_SECRET",
    "META_OAUTH_REDIRECT_URI",
    "META_OAUTH_TOKEN_ENCRYPTION_KEY",
    "META_GRAPH_API_VERSION",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (!missing.includes("META_OAUTH_TOKEN_ENCRYPTION_KEY")) {
    try { assertMarketingMetaEncryptionConfigured(); } catch { missing.push("META_OAUTH_TOKEN_ENCRYPTION_KEY"); }
  }
  if (!missing.includes("META_OAUTH_REDIRECT_URI")) {
    try {
      const redirect = new URL(process.env.META_OAUTH_REDIRECT_URI!.trim());
      if (redirect.protocol !== "https:" && process.env.NODE_ENV === "production") missing.push("META_OAUTH_REDIRECT_URI");
    } catch {
      missing.push("META_OAUTH_REDIRECT_URI");
    }
  }
  return {
    ready: missing.length === 0,
    missing: [...new Set(missing)],
    pilotSlugs: [...allowedPilotSlugs()],
  };
}

function assertMetaOAuthReady() {
  const readiness = getMetaOAuthReadiness();
  if (!readiness.ready) {
    throw new MarketingRepAccessError(`Meta OAuth is not configured: ${readiness.missing.join(", ")}`, 503);
  }
}

async function audit(input: {
  actorUserId: string;
  repId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await pool.query(`
    INSERT INTO marketing_bot_audit_events
      (actor_user_id, rep_id, action, target_type, target_id, metadata)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)
  `, [
    input.actorUserId,
    input.repId || null,
    input.action,
    input.targetType || "marketing_bot",
    input.targetId || null,
    JSON.stringify(input.metadata || {}),
  ]).catch((error) => console.error("[marketing-bot] audit write failed:", error instanceof Error ? error.message : error));
}

export async function resolveAllowedMarketingRep(userId: string): Promise<MarketingRep> {
  await ensureMarketingBotSchema();
  const result = await pool.query<MarketingRep>(`
    SELECT id, user_id, slug, display_name, promo_code
    FROM marketing_reps
    WHERE user_id=$1 AND is_active=TRUE
    LIMIT 1
  `, [userId]);
  const rep = result.rows[0];
  if (!rep) throw new MarketingRepAccessError("No active marketing profile is linked to this crew account", 403);
  if (!allowedPilotSlugs().has(String(rep.slug || "").toLowerCase())) {
    throw new MarketingRepAccessError("Facebook Page publishing is currently limited to the Matt pilot", 403);
  }
  return rep;
}

async function metaJson(path: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  if (!version) throw new MarketingRepAccessError("Meta Graph API version is not configured", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) {
      throw new MarketingProviderError(
        String(body?.error?.message || body?.error_description || `Meta request failed (${response.status})`).slice(0, 500),
        response.status,
        body?.error?.code == null ? undefined : Number(body.error.code),
      );
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function exchangeOAuthCode(code: string, redirectUri: string) {
  const query = new URLSearchParams({
    client_id: process.env.META_APP_ID!.trim(),
    client_secret: process.env.META_APP_SECRET!.trim(),
    redirect_uri: redirectUri,
    code,
  });
  const shortLived = await metaJson(`/oauth/access_token?${query.toString()}`);
  if (!shortLived.access_token) throw new Error("Meta returned no user access token");

  const longLivedQuery = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.META_APP_ID!.trim(),
    client_secret: process.env.META_APP_SECRET!.trim(),
    fb_exchange_token: String(shortLived.access_token),
  });
  try {
    const longLived = await metaJson(`/oauth/access_token?${longLivedQuery.toString()}`);
    return {
      token: String(longLived.access_token || shortLived.access_token),
      expiresIn: Number(longLived.expires_in || shortLived.expires_in || 0),
    };
  } catch {
    return { token: String(shortLived.access_token), expiresIn: Number(shortLived.expires_in || 0) };
  }
}

async function currentPageSelectionSession(userId: string, repId: string) {
  const result = await pool.query(`
    SELECT * FROM marketing_meta_oauth_sessions
    WHERE user_id=$1 AND rep_id=$2 AND completed_at IS NOT NULL AND consumed_at IS NULL
      AND selection_expires_at > NOW() AND encrypted_user_token IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 1
  `, [userId, repId]);
  return result.rows[0] || null;
}

async function managedPages(encryptedUserToken: string): Promise<MetaPageCandidate[]> {
  const userToken = decryptMarketingMetaSecret(encryptedUserToken);
  const result = await metaJson("/me/accounts?fields=id,name,access_token,tasks&limit=100", {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  return (Array.isArray(result.data) ? result.data : [])
    .map((page: any) => ({
      id: String(page.id || ""),
      name: String(page.name || "Facebook Page"),
      accessToken: String(page.access_token || ""),
      tasks: Array.isArray(page.tasks) ? page.tasks.map(String) : [],
    }))
    .filter((page: MetaPageCandidate) => page.id && page.accessToken)
    .filter((page: MetaPageCandidate) => page.tasks.length === 0 || page.tasks.some((task) => ["CREATE_CONTENT", "MANAGE"].includes(task)));
}

export async function beginMetaOAuth(userId: string) {
  assertMetaOAuthReady();
  const rep = await resolveAllowedMarketingRep(userId);
  const state = crypto.randomBytes(32).toString("base64url");
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI!.trim();
  await pool.query(`
    UPDATE marketing_meta_oauth_sessions
    SET encrypted_user_token=NULL
    WHERE user_id=$1 AND rep_id=$2 AND selection_expires_at <= NOW()
  `, [userId, rep.id]);
  await pool.query(`
    INSERT INTO marketing_meta_oauth_sessions
      (id, state_hash, user_id, rep_id, redirect_uri, expires_at)
    VALUES ($1,$2,$3,$4,$5,NOW() + ($6::int * INTERVAL '1 minute'))
  `, [crypto.randomUUID(), hashState(state), userId, rep.id, redirectUri, OAUTH_SESSION_MINUTES]);
  const query = new URLSearchParams({
    client_id: process.env.META_APP_ID!.trim(),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
    auth_type: "rerequest",
  });
  await audit({ actorUserId: userId, repId: rep.id, action: "meta_oauth_started", targetType: "meta_connection" });
  return { authorizationUrl: `https://www.facebook.com/${encodeURIComponent(process.env.META_GRAPH_API_VERSION!.trim())}/dialog/oauth?${query.toString()}` };
}

export async function completeMetaOAuthCallback(userId: string, state: string, code: string) {
  assertMetaOAuthReady();
  const rep = await resolveAllowedMarketingRep(userId);
  const consumed = await pool.query(`
    UPDATE marketing_meta_oauth_sessions
    SET used_at=NOW()
    WHERE state_hash=$1 AND user_id=$2 AND rep_id=$3 AND used_at IS NULL AND expires_at > NOW()
    RETURNING *
  `, [hashState(state), userId, rep.id]);
  const session = consumed.rows[0];
  if (!session) throw new MarketingRepAccessError("This Meta connection request expired or was already used", 400);
  const exchanged = await exchangeOAuthCode(code, session.redirect_uri);
  const tokenExpiresAt = exchanged.expiresIn > 0
    ? new Date(Date.now() + exchanged.expiresIn * 1000)
    : null;
  await pool.query(`
    UPDATE marketing_meta_oauth_sessions
    SET encrypted_user_token=$2, token_expires_at=$3, completed_at=NOW(),
        selection_expires_at=NOW() + ($4::int * INTERVAL '1 minute')
    WHERE id=$1
  `, [session.id, encryptMarketingMetaSecret(exchanged.token), tokenExpiresAt, PAGE_SELECTION_MINUTES]);
  await audit({ actorUserId: userId, repId: rep.id, action: "meta_oauth_completed", targetType: "meta_connection" });
}

export async function listMetaManagedPages(userId: string) {
  assertMetaOAuthReady();
  const rep = await resolveAllowedMarketingRep(userId);
  const session = await currentPageSelectionSession(userId, rep.id);
  if (!session) throw new MarketingRepAccessError("Start or restart the Facebook Page connection", 409);
  const pages = await managedPages(session.encrypted_user_token);
  return pages.map(({ id, name }) => ({ id, name }));
}

function publicConnection(row: any) {
  if (!row) return null;
  return {
    status: row.status,
    pageId: row.page_id,
    pageName: row.page_name,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    tokenExpiresAt: row.token_expires_at,
    lastError: row.last_error || null,
  };
}

async function storedConnection(repId: string) {
  const result = await pool.query("SELECT * FROM marketing_meta_connections WHERE rep_id=$1 ORDER BY connected_at DESC LIMIT 1", [repId]);
  return result.rows[0] || null;
}

export async function selectMetaManagedPage(userId: string, pageId: string) {
  assertMetaOAuthReady();
  const rep = await resolveAllowedMarketingRep(userId);
  const session = await currentPageSelectionSession(userId, rep.id);
  if (!session) throw new MarketingRepAccessError("The Page selection expired; reconnect Facebook", 409);
  const pages = await managedPages(session.encrypted_user_token);
  const selected = pages.find((page) => page.id === pageId);
  if (!selected) throw new MarketingRepAccessError("That Facebook Page is not available to this account", 403);
  const userToken = decryptMarketingMetaSecret(session.encrypted_user_token);
  const identity = await metaJson("/me?fields=id", { headers: { Authorization: `Bearer ${userToken}` } });
  const permissions = await metaJson("/me/permissions", { headers: { Authorization: `Bearer ${userToken}` } });
  const grantedScopes = (Array.isArray(permissions.data) ? permissions.data : [])
    .filter((permission: any) => permission.status === "granted")
    .map((permission: any) => String(permission.permission));
  const missingScopes = META_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  if (missingScopes.length) {
    throw new MarketingRepAccessError("Facebook did not grant every required Page publishing permission; reconnect and approve all requested access", 403);
  }
  const connectionId = crypto.randomUUID();
  await pool.query(`
    UPDATE marketing_meta_connections
    SET status='disconnected', encrypted_page_token=NULL, updated_at=NOW()
    WHERE rep_id=$1 AND status <> 'disconnected'
  `, [rep.id]);
  const result = await pool.query(`
    INSERT INTO marketing_meta_connections
      (id, rep_id, user_id, meta_user_id, page_id, page_name, encrypted_page_token,
       granted_scopes, status, token_expires_at, connected_at, last_verified_at, last_error, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'connected',$9,NOW(),NOW(),NULL,NOW())
    RETURNING *
  `, [
    connectionId,
    rep.id,
    userId,
    String(identity.id || ""),
    selected.id,
    selected.name,
    encryptMarketingMetaSecret(selected.accessToken),
    JSON.stringify(grantedScopes),
    session.token_expires_at,
  ]);
  await pool.query(`
    UPDATE marketing_meta_oauth_sessions
    SET consumed_at=NOW(), encrypted_user_token=NULL
    WHERE id=$1
  `, [session.id]);
  await audit({ actorUserId: userId, repId: rep.id, action: "meta_page_connected", targetType: "meta_connection", targetId: result.rows[0].id, metadata: { pageId: selected.id, pageName: selected.name } });
  return publicConnection(result.rows[0]);
}

export async function disconnectMetaPage(userId: string) {
  const rep = await resolveAllowedMarketingRep(userId);
  const result = await pool.query(`
    UPDATE marketing_meta_connections
    SET status='disconnected', encrypted_page_token=NULL, last_error=NULL, updated_at=NOW()
    WHERE id=(SELECT id FROM marketing_meta_connections WHERE rep_id=$1 ORDER BY connected_at DESC LIMIT 1)
    RETURNING id, page_id, page_name
  `, [rep.id]);
  await audit({ actorUserId: userId, repId: rep.id, action: "meta_page_disconnected", targetType: "meta_connection", targetId: result.rows[0]?.id || null, metadata: { pageId: result.rows[0]?.page_id || null } });
  return { success: true };
}

export async function verifyMetaPageConnection(userId: string) {
  assertMetaOAuthReady();
  const rep = await resolveAllowedMarketingRep(userId);
  const connection = await storedConnection(rep.id);
  if (!connection?.encrypted_page_token || connection.status === "disconnected") {
    throw new MarketingRepAccessError("Connect a Facebook Page first", 409);
  }
  try {
    const token = decryptMarketingMetaSecret(connection.encrypted_page_token);
    const page = await metaJson(`/${encodeURIComponent(connection.page_id)}?fields=id,name`, { headers: { Authorization: `Bearer ${token}` } });
    const result = await pool.query(`
      UPDATE marketing_meta_connections
      SET status='connected', page_name=$2, last_verified_at=NOW(), last_error=NULL, updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [connection.id, String(page.name || connection.page_name)]);
    await audit({ actorUserId: userId, repId: rep.id, action: "meta_page_verified", targetType: "meta_connection", targetId: connection.id, metadata: { pageId: connection.page_id } });
    return publicConnection(result.rows[0]);
  } catch (error) {
    if (error instanceof MarketingProviderError && error.requiresReauthorization) {
      await pool.query(`UPDATE marketing_meta_connections SET status='reauth_required', encrypted_page_token=NULL, last_error=$2, updated_at=NOW() WHERE id=$1`, [connection.id, error.message.slice(0, 500)]);
    }
    throw error;
  }
}

async function approvedPromo(code: string | null) {
  if (!code) return true;
  const result = await pool.query(`
    SELECT 1 FROM promo_codes
    WHERE UPPER(code)=UPPER($1) AND is_active=TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (max_uses IS NULL OR uses_count < max_uses)
    LIMIT 1
  `, [code]);
  return Boolean(result.rows[0]);
}

async function repVariant(userId: string, variantId: string) {
  const rep = await resolveAllowedMarketingRep(userId);
  const result = await pool.query(`
    SELECT v.*, c.revision AS campaign_revision, c.approved_at, c.status AS campaign_status,
           c.headline, c.instagram_caption, c.google_business_summary, c.short_caption,
           c.cta, c.service, c.territory, c.rationale, c.facts, c.feed_image_url
    FROM marketing_bot_variants v
    JOIN marketing_bot_campaigns c ON c.id=v.campaign_id
    WHERE v.id=$1 AND v.rep_id=$2 AND v.is_company=FALSE AND v.channel='facebook'
    LIMIT 1
  `, [variantId, rep.id]);
  const variant = result.rows[0];
  if (!variant) throw new MarketingRepAccessError("Marketing campaign not found for this profile", 404);
  if (!variant.approved_at || variant.campaign_status === "skipped") {
    throw new MarketingRepAccessError("The owner must approve the current campaign revision first", 409);
  }
  return { rep, variant };
}

function trustedRepCaption(variant: any, rawCaption: string, promotionActive: boolean) {
  const draft: MarketingBotDraftOutput = {
    selectedCandidateId: buildCampaignKey(variant.service, variant.territory),
    headline: variant.headline,
    facebookCaption: rawCaption,
    instagramCaption: variant.instagram_caption,
    googleBusinessSummary: variant.google_business_summary,
    shortCaption: variant.short_caption,
    cta: variant.cta,
    visualDirection: variant.facts?.visualDirection || "Use the approved branded JC creative.",
    rationale: variant.rationale,
  };
  const trusted = appendTrustedCampaignFacts({
    draft,
    phone: process.env.COMPANY_PHONE?.trim() || "(906) 285-9312",
    campaignUrl: variant.destination_url,
    promoCode: variant.promo_code,
  });
  const safety = validateCampaignSafety({
    draft: trusted,
    phone: process.env.COMPANY_PHONE?.trim() || "(906) 285-9312",
    campaignUrl: variant.destination_url,
    promoCode: variant.promo_code,
    promotionActive,
    duplicate: false,
  });
  if (!safety.passed) {
    throw new MarketingRepAccessError(`Safety check failed: ${safety.checks.filter((check) => !check.ok).map((check) => check.label).join(", ")}`, 409);
  }
  return { caption: trusted.facebookCaption, safety };
}

export async function saveRepVariantCaption(userId: string, variantId: string, rawCaption: string) {
  const { rep, variant } = await repVariant(userId, variantId);
  const trusted = trustedRepCaption(variant, rawCaption, await approvedPromo(variant.promo_code));
  let saved: any = null;
  for (let attempt = 0; attempt < 2 && !saved; attempt += 1) {
    try {
      const result = await pool.query(`
        INSERT INTO marketing_bot_rep_variant_revisions
          (id, variant_id, campaign_revision, revision, caption, safety, edited_by_user_id)
        SELECT $1,$2,$3,COALESCE(MAX(revision),0)+1,$4,$5::jsonb,$6
        FROM marketing_bot_rep_variant_revisions
        WHERE variant_id=$2 AND campaign_revision=$3
        RETURNING *
      `, [crypto.randomUUID(), variant.id, variant.campaign_revision, trusted.caption, JSON.stringify(trusted.safety), userId]);
      saved = result.rows[0];
    } catch (error: any) {
      if (error?.code !== "23505" || attempt > 0) throw error;
    }
  }
  if (!saved) throw new MarketingRepAccessError("The campaign revision could not be saved", 409);
  await audit({ actorUserId: userId, repId: rep.id, action: "rep_variant_edited", targetType: "marketing_bot_variant", targetId: variant.id, metadata: { campaignRevision: variant.campaign_revision, repRevision: saved.revision } });
  return saved;
}

export async function publishRepVariant(userId: string, variantId: string, retryFailed = false) {
  assertMetaOAuthReady();
  const { rep, variant } = await repVariant(userId, variantId);
  await assertMarketingTerritoryAdsEnabled(variant.territory as MarketingBotTerritory);
  const connection = await storedConnection(rep.id);
  if (!connection?.encrypted_page_token || connection.status !== "connected") {
    throw new MarketingRepAccessError("Reconnect an active Facebook Page before publishing", 409);
  }
  const revisionResult = await pool.query(`
    SELECT * FROM marketing_bot_rep_variant_revisions
    WHERE variant_id=$1 AND campaign_revision=$2
    ORDER BY revision DESC LIMIT 1
  `, [variant.id, variant.campaign_revision]);
  const revision = revisionResult.rows[0] || null;
  const repRevision = Number(revision?.revision || 0);
  const caption = String(revision?.caption || variant.caption);
  const trusted = trustedRepCaption(variant, caption, await approvedPromo(variant.promo_code));

  const existingResult = await pool.query(`
    SELECT * FROM marketing_bot_rep_publications
    WHERE variant_id=$1 AND campaign_revision=$2 AND rep_revision=$3 AND target_page_id=$4
    LIMIT 1
  `, [variant.id, variant.campaign_revision, repRevision, connection.page_id]);
  const existing = existingResult.rows[0];
  if (existing?.status === "published" || existing?.status === "publishing") return existing;
  if (existing?.status === "failed" && !retryFailed) return existing;

  let publication: any;
  if (existing) {
    const retried = await pool.query(`
      UPDATE marketing_bot_rep_publications
      SET status='publishing', attempts=attempts+1, error_message=NULL, actor_user_id=$2, updated_at=NOW()
      WHERE id=$1 AND status='failed'
      RETURNING *
    `, [existing.id, userId]);
    publication = retried.rows[0] || existing;
    if (publication.status !== "publishing") return publication;
  } else {
    const inserted = await pool.query(`
      INSERT INTO marketing_bot_rep_publications
        (id, campaign_id, variant_id, rep_id, connection_id, target_page_id, campaign_revision, rep_revision,
         status, attempts, actor_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'publishing',1,$9)
      ON CONFLICT (variant_id,campaign_revision,rep_revision,target_page_id) DO NOTHING
      RETURNING *
    `, [crypto.randomUUID(), variant.campaign_id, variant.id, rep.id, connection.id, connection.page_id, variant.campaign_revision, repRevision, userId]);
    publication = inserted.rows[0];
    if (!publication) {
      const raced = await pool.query(`
        SELECT * FROM marketing_bot_rep_publications
        WHERE variant_id=$1 AND campaign_revision=$2 AND rep_revision=$3 AND target_page_id=$4
        LIMIT 1
      `, [variant.id, variant.campaign_revision, repRevision, connection.page_id]);
      return raced.rows[0];
    }
  }

  try {
    const token = decryptMarketingMetaSecret(connection.encrypted_page_token);
    const result = await publishFacebookPage({
      channel: "facebook",
      caption: trusted.caption,
      imageUrl: variant.image_url,
      campaignUrl: variant.destination_url,
      cta: variant.cta,
    }, { pageId: connection.page_id, accessToken: token });
    const published = await pool.query(`
      UPDATE marketing_bot_rep_publications
      SET status='published', external_id=$2, external_url=$3, metadata=$4::jsonb,
          error_message=NULL, published_at=NOW(), updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [publication.id, result.externalId, result.externalUrl || null, JSON.stringify(result.metadata || {})]);
    await audit({ actorUserId: userId, repId: rep.id, action: "rep_variant_published", targetType: "marketing_bot_rep_publication", targetId: publication.id, metadata: { campaignRevision: variant.campaign_revision, repRevision, pageId: connection.page_id, externalId: result.externalId, externalUrl: result.externalUrl || null } });
    return published.rows[0];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facebook Page publishing failed";
    await pool.query(`UPDATE marketing_bot_rep_publications SET status='failed', error_message=$2, updated_at=NOW() WHERE id=$1`, [publication.id, message.slice(0, 500)]);
    if (error instanceof MarketingProviderError && error.requiresReauthorization) {
      await pool.query(`UPDATE marketing_meta_connections SET status='reauth_required', encrypted_page_token=NULL, last_error=$2, updated_at=NOW() WHERE id=$1`, [connection.id, message.slice(0, 500)]);
    }
    await audit({ actorUserId: userId, repId: rep.id, action: "rep_variant_publish_failed", targetType: "marketing_bot_rep_publication", targetId: publication.id, metadata: { campaignRevision: variant.campaign_revision, repRevision, pageId: connection.page_id, reason: message.slice(0, 300) } });
    throw error;
  }
}

export async function getRepMarketingBotDashboard(userId: string) {
  const rep = await resolveAllowedMarketingRep(userId);
  const oauthReadiness = getMetaOAuthReadiness();
  const [connection, pending, campaigns] = await Promise.all([
    storedConnection(rep.id),
    currentPageSelectionSession(userId, rep.id),
    pool.query(`
      SELECT c.id AS campaign_id, c.campaign_code, c.headline, c.service, c.territory,
             c.revision AS campaign_revision, c.approved_at, c.feed_image_url, c.safety AS campaign_safety,
             v.id AS variant_id, v.variant_code, v.caption AS generated_caption,
             v.destination_url, v.image_url, v.promo_code,
             rr.id AS rep_revision_id, rr.revision AS rep_revision, rr.caption AS edited_caption, rr.safety AS rep_safety,
             rp.id AS publication_id, rp.status AS publication_status, rp.attempts AS publication_attempts,
             rp.external_id, rp.external_url, rp.error_message, rp.published_at,
             rp.target_page_id,
             COALESCE(ev.views,0)::int AS views, COALESCE(ev.booking_clicks,0)::int AS booking_clicks,
             COALESCE(ev.call_clicks,0)::int AS call_clicks, COALESCE(ev.message_clicks,0)::int AS message_clicks
      FROM marketing_bot_variants v
      JOIN marketing_bot_campaigns c ON c.id=v.campaign_id
      LEFT JOIN LATERAL (
        SELECT * FROM marketing_bot_rep_variant_revisions r
        WHERE r.variant_id=v.id AND r.campaign_revision=c.revision
        ORDER BY r.revision DESC LIMIT 1
      ) rr ON TRUE
      LEFT JOIN LATERAL (
        SELECT * FROM marketing_bot_rep_publications p
        WHERE p.variant_id=v.id AND p.campaign_revision=c.revision
        ORDER BY p.created_at DESC LIMIT 1
      ) rp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE event_type='landing_view') AS views,
               COUNT(*) FILTER (WHERE event_type='booking_click') AS booking_clicks,
               COUNT(*) FILTER (WHERE event_type='call_click') AS call_clicks,
               COUNT(*) FILTER (WHERE event_type='message_click') AS message_clicks
        FROM marketing_bot_events e WHERE e.variant_id=v.id
      ) ev ON TRUE
      WHERE v.rep_id=$1 AND v.is_company=FALSE AND v.channel='facebook'
        AND c.approved_at IS NOT NULL AND c.status <> 'skipped'
      ORDER BY c.approved_at DESC
      LIMIT 20
    `, [rep.id]),
  ]);
  return {
    rep: { id: rep.id, slug: rep.slug, displayName: rep.display_name, promoCode: rep.promo_code },
    meta: {
      configured: oauthReadiness.ready,
      connection: publicConnection(connection),
      canChoosePage: Boolean(pending),
    },
    campaigns: campaigns.rows.map((row) => ({
      id: row.campaign_id,
      campaignCode: row.campaign_code,
      headline: row.headline,
      service: row.service,
      territory: row.territory,
      campaignRevision: Number(row.campaign_revision),
      approvedAt: row.approved_at,
      imageUrl: row.image_url || row.feed_image_url,
      safety: row.rep_safety || row.campaign_safety,
      variantId: row.variant_id,
      variantCode: row.variant_code,
      caption: row.edited_caption || row.generated_caption,
      repRevision: Number(row.rep_revision || 0),
      destinationUrl: row.destination_url,
      promoCode: row.promo_code,
      metrics: {
        views: Number(row.views || 0),
        bookingClicks: Number(row.booking_clicks || 0),
        callClicks: Number(row.call_clicks || 0),
        messageClicks: Number(row.message_clicks || 0),
      },
      publication: row.publication_id && (!connection || row.target_page_id === connection.page_id) ? {
        id: row.publication_id,
        status: row.publication_status,
        attempts: Number(row.publication_attempts || 0),
        externalId: row.external_id,
        externalUrl: row.external_url,
        errorMessage: row.error_message,
        publishedAt: row.published_at,
      } : null,
    })),
  };
}

export async function listOwnerRepPublishingOverview() {
  await ensureMarketingBotSchema();
  const result = await pool.query(`
    SELECT mr.id, mr.slug, mr.display_name, mr.promo_code,
           mc.status AS connection_status, mc.page_id, mc.page_name, mc.last_verified_at, mc.last_error,
           COUNT(rp.id) FILTER (WHERE rp.status='published')::int AS published_count,
           COUNT(rp.id) FILTER (WHERE rp.status='failed')::int AS failed_count,
           MAX(rp.published_at) AS last_published_at
    FROM marketing_reps mr
    LEFT JOIN LATERAL (
      SELECT * FROM marketing_meta_connections candidate
      WHERE candidate.rep_id=mr.id
      ORDER BY candidate.connected_at DESC LIMIT 1
    ) mc ON TRUE
    LEFT JOIN marketing_bot_rep_publications rp ON rp.rep_id=mr.id
    WHERE mr.is_active=TRUE
    GROUP BY mr.id, mc.id, mc.status, mc.page_id, mc.page_name, mc.last_verified_at, mc.last_error
    ORDER BY mr.sort_order, mr.display_name
  `);
  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    promoCode: row.promo_code,
    pilotAllowed: allowedPilotSlugs().has(String(row.slug || "").toLowerCase()),
    connection: row.connection_status ? {
      status: row.connection_status,
      pageId: row.page_id,
      pageName: row.page_name,
      lastVerifiedAt: row.last_verified_at,
      lastError: row.last_error,
    } : null,
    publications: {
      published: Number(row.published_count || 0),
      failed: Number(row.failed_count || 0),
      lastPublishedAt: row.last_published_at,
    },
  }));
}

export const repCaptionInputSchema = z.object({
  caption: z.string().trim().min(40).max(1800),
});

export const selectMetaPageInputSchema = z.object({
  pageId: z.string().trim().min(3).max(100),
});

export function marketingCrewRedirect(params: Record<string, string>) {
  const url = new URL("/crew/marketing", getAppUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
