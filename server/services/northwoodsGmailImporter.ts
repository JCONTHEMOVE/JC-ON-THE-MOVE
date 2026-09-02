import crypto from "crypto";
import { google, type gmail_v1 } from "googleapis";
import { pool } from "../db";
import { ensureNorthwoodsSchema } from "./northwoodsSchema";
import { parseNorthwoodsReservationEmail } from "./northwoodsReservationParser";
import type { NorthwoodsParsedReservation } from "@shared/northwoodsMarketing";

let inboxScheduler: NodeJS.Timeout | null = null;
export const DEFAULT_NORTHWOODS_GMAIL_QUERY = "in:inbox newer_than:30d {from:uhaul.com from:movinghelp.com}";

function configuredAllowedSenders() {
  return (process.env.NORTHWOODS_GMAIL_ALLOWED_SENDERS || "uhaul.com,movinghelp.com")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedNorthwoodsSender(value: string, allowed = configuredAllowedSenders()) {
  const match = String(value || "").toLowerCase().match(/<?([a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+)>?/i);
  const email = match?.[1] || "";
  const domain = email.split("@")[1] || "";
  return allowed.some((entry) => {
    const normalized = entry.replace(/^@/, "");
    return entry.includes("@") ? email === entry : domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

function credentials() {
  const user = process.env.NORTHWOODS_GMAIL_USER?.trim();
  const clientId = process.env.NORTHWOODS_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.NORTHWOODS_GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.NORTHWOODS_GMAIL_REFRESH_TOKEN?.trim();
  if (!user || !clientId || !clientSecret || !refreshToken) return null;
  return { user, clientId, clientSecret, refreshToken };
}

function gmailClient() {
  const config = credentials();
  if (!config) throw new Error("Dedicated Northwoods Gmail OAuth credentials are not configured");
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
  auth.setCredentials({ refresh_token: config.refreshToken });
  return google.gmail({ version: "v1", auth });
}

function header(message: gmail_v1.Schema$Message, name: string) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decode(data?: string | null) {
  return data ? Buffer.from(data, "base64url").toString("utf8") : "";
}

function collectParts(part?: gmail_v1.Schema$MessagePart | null, result = { text: "", html: "" }) {
  if (!part) return result;
  const mime = String(part.mimeType || "").toLowerCase();
  const body = decode(part.body?.data);
  if (mime === "text/plain") result.text += `${body}\n`;
  if (mime === "text/html") result.html += `${body}\n`;
  for (const child of part.parts || []) collectParts(child, result);
  return result;
}

function redactPaymentCodes<T>(value: T): T {
  const serialized = JSON.stringify(value).replace(/(payment\s*code\s*[:#-]?\s*)\d{6}/gi, "$1[REDACTED]");
  return JSON.parse(serialized) as T;
}

function reservationFields(parsed: NorthwoodsParsedReservation, marketId: string | null) {
  return [
    parsed.customerFirstName,
    parsed.customerLastName,
    parsed.customerEmail,
    parsed.customerPhone,
    parsed.serviceDate,
    parsed.startTime,
    parsed.durationHours,
    parsed.crewSize,
    parsed.fromAddress,
    parsed.toAddress,
    marketId,
    parsed.focus,
    parsed.quotedAmountCents,
    parsed.notes,
  ];
}

async function resolveMarketId(slug: string | null) {
  if (!slug) return null;
  const result = await pool.query<{ id: string }>("SELECT id FROM northwoods_markets WHERE slug=$1 AND active=true LIMIT 1", [slug]);
  return result.rows[0]?.id || null;
}

async function persistMessage(message: gmail_v1.Schema$Message) {
  const gmailMessageId = String(message.id || "");
  if (!gmailMessageId) return "ignored" as const;
  const existingMessage = await pool.query("SELECT id FROM northwoods_inbound_messages WHERE gmail_message_id=$1 LIMIT 1", [gmailMessageId]);
  if (existingMessage.rows[0]) return "duplicate" as const;

  const parts = collectParts(message.payload);
  const subject = header(message, "Subject");
  const sender = header(message, "From");
  const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
  const contentHash = crypto.createHash("sha256").update(`${subject}\n${parts.text}\n${parts.html}`).digest("hex");
  if (!isAllowedNorthwoodsSender(sender)) {
    await pool.query(`
      INSERT INTO northwoods_inbound_messages
        (gmail_message_id, gmail_thread_id, sender, subject, received_at, content_hash,
         parse_status, parse_errors, parsed_payload)
      VALUES ($1,$2,$3,$4,$5,$6,'ignored_sender','[]'::jsonb,'{}'::jsonb)
      ON CONFLICT (gmail_message_id) DO NOTHING
    `, [gmailMessageId, message.threadId || null, sender, subject, receivedAt, contentHash]);
    return "ignored_sender" as const;
  }
  const parsed = redactPaymentCodes(parseNorthwoodsReservationEmail({ subject, text: parts.text, html: parts.html }));
  const parseStatus = parsed.externalOrderId
    ? parsed.missingFields.length ? "needs_review" : "parsed"
    : "unmatched";
  const messageInsert = await pool.query<{ id: string }>(`
    INSERT INTO northwoods_inbound_messages
      (gmail_message_id, gmail_thread_id, sender, subject, received_at, content_hash,
       parse_status, parse_errors, parsed_payload, external_order_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)
    ON CONFLICT (gmail_message_id) DO NOTHING
    RETURNING id
  `, [gmailMessageId, message.threadId || null, sender, subject, receivedAt, contentHash, parseStatus,
      JSON.stringify(parsed.missingFields), JSON.stringify(parsed), parsed.externalOrderId]);
  const messageId = messageInsert.rows[0]?.id;
  if (!messageId) return "duplicate" as const;
  if (!parsed.externalOrderId) return "unmatched" as const;

  const marketId = await resolveMarketId(parsed.marketSlug);
  const current = await pool.query<any>("SELECT * FROM northwoods_reservations WHERE external_order_id=$1 LIMIT 1", [parsed.externalOrderId]);
  const existing = current.rows[0] || null;
  if (!existing) {
    const initialStatus = parsed.emailKind === "cancel"
      ? "cancelled"
      : parsed.missingFields.length ? "needs_review" : "new";
    await pool.query(`
      INSERT INTO northwoods_reservations
        (external_order_id, latest_message_id, status, customer_first_name, customer_last_name,
         customer_email, customer_phone, service_date, start_time, duration_hours, crew_size,
         from_address, to_address, market_id, focus, quoted_amount_cents, notes, last_received_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [parsed.externalOrderId, messageId, initialStatus, ...reservationFields(parsed, marketId), receivedAt]);
    return "created" as const;
  }

  const nextFields = {
    customerFirstName: parsed.customerFirstName,
    customerLastName: parsed.customerLastName,
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,
    serviceDate: parsed.serviceDate,
    startTime: parsed.startTime,
    durationHours: parsed.durationHours,
    crewSize: parsed.crewSize,
    fromAddress: parsed.fromAddress,
    toAddress: parsed.toAddress,
    marketId,
    focus: parsed.focus,
    quotedAmountCents: parsed.quotedAmountCents,
    notes: parsed.notes,
    emailKind: parsed.emailKind,
  };
  if (existing.linked_lead_id || existing.status === "confirmed") {
    await pool.query(`
      UPDATE northwoods_reservations SET latest_message_id=$2, status='changed', pending_changes=$3::jsonb,
        last_received_at=$4, updated_at=NOW() WHERE id=$1
    `, [existing.id, messageId, JSON.stringify(nextFields), receivedAt]);
    return "changed" as const;
  }

  const nextStatus = parsed.emailKind === "cancel"
    ? "cancelled"
    : parsed.missingFields.length ? "needs_review" : "new";
  await pool.query(`
    UPDATE northwoods_reservations SET latest_message_id=$2, status=$3,
      customer_first_name=COALESCE($4,customer_first_name), customer_last_name=COALESCE($5,customer_last_name),
      customer_email=COALESCE($6,customer_email), customer_phone=COALESCE($7,customer_phone),
      service_date=COALESCE($8::date,service_date), start_time=COALESCE($9,start_time),
      duration_hours=COALESCE($10,duration_hours), crew_size=COALESCE($11,crew_size),
      from_address=COALESCE($12,from_address), to_address=COALESCE($13,to_address),
      market_id=COALESCE($14,market_id), focus=COALESCE($15,focus),
      quoted_amount_cents=COALESCE($16,quoted_amount_cents), notes=COALESCE($17,notes),
      pending_changes='{}'::jsonb, last_received_at=$18, updated_at=NOW()
    WHERE id=$1
  `, [existing.id, messageId, nextStatus, ...reservationFields(parsed, marketId), receivedAt]);
  return "updated" as const;
}

export function northwoodsGmailHealth() {
  const missing = [
    "NORTHWOODS_GMAIL_USER",
    "NORTHWOODS_GMAIL_CLIENT_ID",
    "NORTHWOODS_GMAIL_CLIENT_SECRET",
    "NORTHWOODS_GMAIL_REFRESH_TOKEN",
  ].filter((key) => !process.env[key]?.trim());
  return {
    configured: Boolean(credentials()),
    enabled: process.env.NORTHWOODS_EMAIL_IMPORT_ENABLED === "true",
    query: process.env.NORTHWOODS_GMAIL_QUERY?.trim() || DEFAULT_NORTHWOODS_GMAIL_QUERY,
    allowedSenders: configuredAllowedSenders(),
    missing,
    pollMinutes: 5,
  };
}

async function recordImportFailure(messageId: string, message: gmail_v1.Schema$Message | null, error: unknown) {
  const subject = message ? header(message, "Subject") : "Unable to load Gmail message";
  const sender = message ? header(message, "From") : "";
  const receivedAt = message?.internalDate ? new Date(Number(message.internalDate)) : new Date();
  const safeError = (error instanceof Error ? error.message : String(error || "Unknown import error"))
    .replace(/(?:ya29\.|1\/\/)[a-z0-9._-]+/gi, "[redacted-token]")
    .slice(0, 1_000);
  const contentHash = crypto.createHash("sha256").update(`${messageId}\n${subject}\n${safeError}`).digest("hex");
  await pool.query(`
    INSERT INTO northwoods_inbound_messages
      (gmail_message_id,gmail_thread_id,sender,subject,received_at,content_hash,parse_status,parse_errors,parsed_payload)
    VALUES ($1,$2,$3,$4,$5,$6,'error',$7::jsonb,'{}'::jsonb)
    ON CONFLICT (gmail_message_id) DO UPDATE SET
      parse_status='error',parse_errors=EXCLUDED.parse_errors,processed_at=NOW()
  `, [messageId, message?.threadId || null, sender, subject, receivedAt, contentHash, JSON.stringify([safeError])]);
}

export async function syncNorthwoodsInbox() {
  await ensureNorthwoodsSchema();
  const gmail = gmailClient();
  const response = await gmail.users.messages.list({
    userId: "me",
    q: process.env.NORTHWOODS_GMAIL_QUERY?.trim() || DEFAULT_NORTHWOODS_GMAIL_QUERY,
    maxResults: 25,
  });
  const counts: Record<string, number> = {};
  for (const item of response.data.messages || []) {
    if (!item.id) continue;
    let fullMessage: gmail_v1.Schema$Message | null = null;
    try {
      const full = await gmail.users.messages.get({ userId: "me", id: item.id, format: "full" });
      fullMessage = full.data;
      const result = await persistMessage(fullMessage);
      counts[result] = (counts[result] || 0) + 1;
    } catch (error) {
      counts.failed = (counts.failed || 0) + 1;
      await recordImportFailure(item.id, fullMessage, error).catch(() => undefined);
      console.error(`[northwoods-email] message ${item.id} failed:`, error instanceof Error ? error.message : error);
    }
  }
  return { checked: response.data.messages?.length || 0, counts, syncedAt: new Date().toISOString() };
}

export function startNorthwoodsInboxScheduler() {
  if (inboxScheduler || process.env.NORTHWOODS_EMAIL_IMPORT_ENABLED !== "true") return;
  inboxScheduler = setInterval(() => {
    void syncNorthwoodsInbox().catch((error) => console.error("[northwoods-email] scheduled sync failed:", error instanceof Error ? error.message : error));
  }, 5 * 60_000);
  inboxScheduler.unref?.();
  setTimeout(() => void syncNorthwoodsInbox().catch(() => undefined), 15_000).unref?.();
  console.log("[northwoods-email] dedicated Gmail polling active every 5 minutes");
}
