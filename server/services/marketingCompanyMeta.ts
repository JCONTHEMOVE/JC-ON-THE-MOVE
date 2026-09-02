import crypto from "crypto";
import { pool } from "../db";
import { MarketingProviderError } from "./marketingChannels";
import {
  assertMarketingMetaEncryptionConfigured,
  decryptMarketingMetaSecret,
  encryptMarketingMetaSecret,
} from "./marketingMetaCrypto";
import { ensureMarketingBotSchema } from "./marketingBot";

const REQUIRED_PAGE_SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"] as const;

type CompanyPageCredential = { pageId: string; accessToken: string };

function publicConnection(row: any) {
  return {
    id: row.id,
    pageId: row.page_id,
    pageName: row.page_name,
    status: row.status,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error || null,
  };
}

async function metaJson(path: string, accessToken: string, timeoutMs = 20_000) {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  if (!version) throw new Error("META_GRAPH_API_VERSION is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://graph.facebook.com/${encodeURIComponent(version)}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) {
      throw new MarketingProviderError(
        String(body?.error?.message || `Meta request failed (${response.status})`).slice(0, 500),
        response.status,
        body?.error?.code == null ? undefined : Number(body.error.code),
      );
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function inspectPageToken(accessToken: string) {
  const version = process.env.META_GRAPH_API_VERSION?.trim();
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!version || !appId || !appSecret) throw new Error("Meta app credentials are not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(version)}/debug_token?input_token=${encodeURIComponent(accessToken)}`,
      { headers: { Authorization: `Bearer ${appId}|${appSecret}` }, signal: controller.signal },
    );
    const text = await response.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    if (!response.ok) {
      throw new MarketingProviderError(
        String(body?.error?.message || `Meta token inspection failed (${response.status})`).slice(0, 500),
        response.status,
        body?.error?.code == null ? undefined : Number(body.error.code),
      );
    }
    const data = body?.data || {};
    if (data.is_valid !== true || String(data.app_id || "") !== appId) {
      throw new Error("The Facebook Page token is invalid or belongs to a different Meta app");
    }
    const scopes = Array.isArray(data.scopes) ? data.scopes.map(String) : [];
    const missing = REQUIRED_PAGE_SCOPES.filter((scope) => !scopes.includes(scope));
    if (missing.length) {
      throw new Error(`The Facebook Page token is missing required permissions: ${missing.join(", ")}`);
    }
    return scopes;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyCredential(input: CompanyPageCredential) {
  const [page, grantedScopes] = await Promise.all([
    metaJson(`/${encodeURIComponent(input.pageId)}?fields=id,name`, input.accessToken),
    inspectPageToken(input.accessToken),
  ]);
  if (String(page.id || "") !== input.pageId) {
    throw new Error("The supplied Page token does not match its Facebook Page ID");
  }
  return {
    pageId: input.pageId,
    pageName: String(page.name || "Facebook Page").slice(0, 250),
    encryptedToken: encryptMarketingMetaSecret(input.accessToken),
    grantedScopes,
  };
}

async function audit(actorUserId: string, action: string, targetId: string | null, metadata: Record<string, unknown>) {
  await pool.query(`
    INSERT INTO marketing_bot_audit_events
      (actor_user_id, action, target_type, target_id, metadata)
    VALUES ($1,$2,'marketing_company_meta_connection',$3,$4::jsonb)
  `, [actorUserId, action, targetId, JSON.stringify(metadata)]);
}

export async function listCompanyMetaConnections() {
  await ensureMarketingBotSchema();
  const result = await pool.query(`
    SELECT id, page_id, page_name, status, connected_at, last_verified_at, last_error
    FROM marketing_company_meta_connections
    ORDER BY page_name, page_id
  `);
  return result.rows.map(publicConnection);
}

export async function importCompanyMetaConnections(actorUserId: string, pages: CompanyPageCredential[]) {
  if (process.env.MARKETING_COMPANY_META_IMPORT_ENABLED !== "true") {
    throw new Error("Company Page credential import is disabled");
  }
  assertMarketingMetaEncryptionConfigured();
  await ensureMarketingBotSchema();

  // Validate every credential before changing any connection record.
  const verified = await Promise.all(pages.map(verifyCredential));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const connected: any[] = [];
    for (const page of verified) {
      const result = await client.query(`
        INSERT INTO marketing_company_meta_connections
          (id, connected_by_user_id, page_id, page_name, encrypted_page_token,
           granted_scopes, status, connected_at, last_verified_at, last_error, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,'connected',NOW(),NOW(),NULL,NOW())
        ON CONFLICT (page_id) DO UPDATE SET
          connected_by_user_id=EXCLUDED.connected_by_user_id,
          page_name=EXCLUDED.page_name,
          encrypted_page_token=EXCLUDED.encrypted_page_token,
          granted_scopes=EXCLUDED.granted_scopes,
          status='connected',
          connected_at=NOW(),
          last_verified_at=NOW(),
          last_error=NULL,
          updated_at=NOW()
        RETURNING id, page_id, page_name, status, connected_at, last_verified_at, last_error
      `, [crypto.randomUUID(), actorUserId, page.pageId, page.pageName, page.encryptedToken, JSON.stringify(page.grantedScopes)]);
      connected.push(result.rows[0]);
      await client.query(`
        INSERT INTO marketing_bot_audit_events
          (actor_user_id, action, target_type, target_id, metadata)
        VALUES ($1,'company_meta_page_connected','marketing_company_meta_connection',$2,$3::jsonb)
      `, [actorUserId, result.rows[0].id, JSON.stringify({ pageId: page.pageId, pageName: page.pageName })]);
    }
    await client.query("COMMIT");
    return connected.map(publicConnection);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyCompanyMetaConnection(actorUserId: string, connectionId: string) {
  assertMarketingMetaEncryptionConfigured();
  await ensureMarketingBotSchema();
  const stored = await pool.query("SELECT * FROM marketing_company_meta_connections WHERE id=$1 LIMIT 1", [connectionId]);
  const connection = stored.rows[0];
  if (!connection?.encrypted_page_token || connection.status === "disconnected") {
    throw new Error("This Facebook Page must be reconnected first");
  }
  try {
    const token = decryptMarketingMetaSecret(connection.encrypted_page_token);
    const [page, grantedScopes] = await Promise.all([
      metaJson(`/${encodeURIComponent(connection.page_id)}?fields=id,name`, token),
      inspectPageToken(token),
    ]);
    if (String(page.id || "") !== connection.page_id) throw new Error("Meta returned a different Facebook Page");
    const result = await pool.query(`
      UPDATE marketing_company_meta_connections
      SET page_name=$2, granted_scopes=$3::jsonb, status='connected',
          last_verified_at=NOW(), last_error=NULL, updated_at=NOW()
      WHERE id=$1
      RETURNING id, page_id, page_name, status, connected_at, last_verified_at, last_error
    `, [connectionId, String(page.name || connection.page_name).slice(0, 250), JSON.stringify(grantedScopes)]);
    await audit(actorUserId, "company_meta_page_verified", connectionId, { pageId: connection.page_id });
    return publicConnection(result.rows[0]);
  } catch (error) {
    if (error instanceof MarketingProviderError && error.requiresReauthorization) {
      await pool.query(`
        UPDATE marketing_company_meta_connections
        SET status='reauth_required', encrypted_page_token=NULL, last_error=$2, updated_at=NOW()
        WHERE id=$1
      `, [connectionId, error.message.slice(0, 500)]);
    }
    throw error;
  }
}

export async function disconnectCompanyMetaConnection(actorUserId: string, connectionId: string) {
  await ensureMarketingBotSchema();
  const result = await pool.query(`
    UPDATE marketing_company_meta_connections
    SET status='disconnected', encrypted_page_token=NULL, last_error=NULL, updated_at=NOW()
    WHERE id=$1
    RETURNING id, page_id
  `, [connectionId]);
  if (!result.rows[0]) throw new Error("Facebook Page connection not found");
  await audit(actorUserId, "company_meta_page_disconnected", connectionId, { pageId: result.rows[0].page_id });
  return { success: true };
}
