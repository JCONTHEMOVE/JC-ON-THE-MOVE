import crypto from "node:crypto";
import { google, gmail_v1 } from "googleapis";
import sharp from "sharp";
import { pool } from "../db";
import { ObjectStorageService } from "../objectStorage";
import { sendEmail } from "./email";
import {
  canonicalGmailAddress,
  getAshleyShopSetup,
  normalizeAshleyEmailAddress,
} from "./ashleyShopPolicy";
import { ensureAshleyShopSchema } from "./ashleyShopSchema";

const INGEST_LOCK_KEY = 1782202609;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function shopGmailClient() {
  const clientId = process.env.ASHLEY_GMAIL_CLIENT_ID?.trim();
  const clientSecret = process.env.ASHLEY_GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = process.env.ASHLEY_GMAIL_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth });
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function header(message: gmail_v1.Schema$Message, name: string): string {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function normalizeAddress(value: string): string {
  return normalizeAshleyEmailAddress(value);
}

function headerAddresses(message: gmail_v1.Schema$Message, names: string[]): string[] {
  const values = (message.payload?.headers || [])
    .filter((item) => names.includes(String(item.name || "").toLowerCase()))
    .flatMap((item) => String(item.value || "").match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+/gi) || []);
  return Array.from(new Set(values.map(normalizeAddress).filter(Boolean)));
}

function attachmentParts(part?: gmail_v1.Schema$MessagePart): gmail_v1.Schema$MessagePart[] {
  if (!part) return [];
  return [part, ...(part.parts || []).flatMap((child) => attachmentParts(child))];
}

export function inspectAshleyIntakeMessage(
  message: gmail_v1.Schema$Message,
  setup: Pick<ReturnType<typeof getAshleyShopSetup>, "authorizedSender" | "intakeAlias"> = getAshleyShopSetup(),
) {
  const sender = normalizeAddress(header(message, "From"));
  const recipients = headerAddresses(message, ["to", "delivered-to", "x-original-to"]);
  const imageParts = attachmentParts(message.payload || undefined).filter((part) => {
    const mime = String(part.mimeType || "").toLowerCase();
    return SUPPORTED_IMAGE_TYPES.has(mime) && Boolean(part.body?.attachmentId || part.body?.data);
  });
  const senderAuthorized = sender === setup.authorizedSender;
  const intakeAddressed = recipients.includes(setup.intakeAlias);
  return {
    eligible: senderAuthorized && intakeAddressed && imageParts.length > 0,
    sender,
    recipients,
    senderAuthorized,
    intakeAddressed,
    imageParts,
    supportedImageCount: imageParts.length,
    reason: !senderAuthorized
      ? "unauthorized_sender"
      : !intakeAddressed
        ? "wrong_recipient"
        : imageParts.length === 0
          ? "no_supported_images"
          : null,
  } as const;
}

async function attachmentData(gmail: gmail_v1.Gmail, messageId: string, part: gmail_v1.Schema$MessagePart) {
  if (part.body?.data) return decodeBase64Url(part.body.data);
  if (!part.body?.attachmentId) throw new Error("Gmail attachment has no data ID");
  const result = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: part.body.attachmentId,
  });
  if (!result.data.data) throw new Error("Gmail returned an empty attachment");
  return decodeBase64Url(result.data.data);
}

async function saveImage(buffer: Buffer) {
  if (buffer.byteLength > 20 * 1024 * 1024) throw new Error("Photo exceeds the 20 MB intake limit");
  const image = sharp(buffer, { failOn: "warning" }).rotate();
  const metadata = await image.metadata();
  const normalized = await image
    .resize({ width: 2_048, height: 2_048, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  const normalizedMeta = await sharp(normalized).metadata();
  const objectUrl = await new ObjectStorageService().savePublicFileBuffer(
    normalized,
    "image/jpeg",
    "jpg",
    "shop/ashley-intake",
  );
  return {
    objectUrl,
    sha256: crypto.createHash("sha256").update(normalized).digest("hex"),
    width: normalizedMeta.width || metadata.width || null,
    height: normalizedMeta.height || metadata.height || null,
  };
}

async function ingestMessage(gmail: gmail_v1.Gmail, messageId: string) {
  const full = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const message = full.data;
  const setup = getAshleyShopSetup();
  const inspection = inspectAshleyIntakeMessage(message, setup);
  if (!inspection.eligible) return null;
  const sender = inspection.sender;

  const existing = await pool.query("SELECT id FROM ashley_shop_intake_batches WHERE gmail_message_id = $1", [messageId]);
  if (existing.rows[0]) return null;

  const imageParts = inspection.imageParts;

  const batchResult = await pool.query<{ id: string }>(
    `INSERT INTO ashley_shop_intake_batches
      (gmail_message_id, gmail_thread_id, sender_email, recipient_email, subject, status, attachment_count, metadata)
     VALUES ($1, $2, $3, $4, $5, 'receiving', 0, $6::jsonb)
     ON CONFLICT (gmail_message_id) DO NOTHING
     RETURNING id`,
    [messageId, message.threadId || null, sender, setup.intakeAlias, header(message, "Subject"), JSON.stringify({ historyId: message.historyId })],
  );
  const batchId = batchResult.rows[0]?.id;
  if (!batchId) return null;

  let saved = 0;
  try {
    for (let index = 0; index < imageParts.length; index += 1) {
      const part = imageParts[index];
      const buffer = await attachmentData(gmail, messageId, part);
      const image = await saveImage(buffer);
      const filename = part.filename || `photo-${index + 1}.jpg`;
      const inserted = await pool.query(
        `INSERT INTO ashley_shop_media
          (batch_id, gmail_attachment_id, filename, mime_type, object_url, sha256, width, height, metadata)
         VALUES ($1, $2, $3, 'image/jpeg', $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (batch_id, sha256) DO NOTHING
         RETURNING id`,
        [batchId, part.body?.attachmentId || null, filename, image.objectUrl, image.sha256, image.width, image.height,
          JSON.stringify({ originalMimeType: part.mimeType, originalBytes: buffer.byteLength })],
      );
      if (inserted.rows[0]) saved += 1;
    }
    if (!saved) throw new Error("The email did not contain any unique supported photos");
    await pool.query(
      `UPDATE ashley_shop_intake_batches
          SET status = 'received', attachment_count = $2, updated_at = now()
        WHERE id = $1`,
      [batchId, saved],
    );
    await sendEmail({
      to: setup.authorizedSender,
      from: process.env.COMPANY_EMAIL || process.env.FROM_EMAIL,
      replyTo: setup.intakeAlias,
      subject: `Photos received — preparing ${saved} jewelry images`,
      text: `We received ${saved} supported photos. Draft listings will be emailed back for your review. Nothing will publish until you set prices and approve it.`,
      html: `<h2>Photos received</h2><p>We received <strong>${saved}</strong> supported jewelry photos and are preparing draft listings.</p><p>Nothing will publish until you set final prices and approve it.</p>`,
    });
    return { batchId, attachmentCount: saved };
  } catch (error) {
    await pool.query(
      `UPDATE ashley_shop_intake_batches SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
      [batchId, error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000)],
    );
    throw error;
  }
}

export function isAshleyEmailIntakeConfigured() {
  return getAshleyShopSetup().credentialsReady;
}

function safeConnectionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Gmail connection failed");
  return raw
    .replace(/ya29\.[a-z0-9._-]+/gi, "[redacted-token]")
    .replace(/1\/\/[a-z0-9._-]+/gi, "[redacted-token]")
    .slice(0, 500);
}

export async function getAshleyEmailIntakeStatus(options: { verifyConnection?: boolean } = {}) {
  const setup = getAshleyShopSetup();
  const connection: {
    checked: boolean;
    ok: boolean;
    connectedMailbox?: string;
    error?: string;
  } = { checked: false, ok: false };

  if (options.verifyConnection && setup.credentialsReady && setup.mailboxMatchesAlias && setup.senderMatchesMailbox) {
    connection.checked = true;
    try {
      const gmail = shopGmailClient();
      if (!gmail) throw new Error("Ashley Gmail OAuth credentials are incomplete");
      const profile = await gmail.users.getProfile({ userId: "me" });
      const connectedMailbox = normalizeAddress(profile.data.emailAddress || "");
      connection.connectedMailbox = connectedMailbox;
      connection.ok = canonicalGmailAddress(connectedMailbox) === canonicalGmailAddress(setup.mailbox);
      if (!connection.ok) {
        connection.error = `OAuth is connected to ${connectedMailbox || "an unknown account"}, not ${setup.mailbox}`;
      }
    } catch (error) {
      connection.error = safeConnectionError(error);
    }
  }

  return {
    ...setup,
    connection,
    ready: setup.requiredReady && connection.checked && connection.ok,
  };
}

export async function runAshleyEmailIngest() {
  await ensureAshleyShopSchema();
  const status = await getAshleyEmailIntakeStatus({ verifyConnection: true });
  if (!status.credentialsReady) return { configured: false, ingested: 0 };
  if (!status.connection.ok) {
    throw new Error(status.connection.error || "Ashley Gmail connection did not match the configured mailbox");
  }
  const gmail = shopGmailClient();
  if (!gmail) return { configured: false, ingested: 0 };
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) AS locked", [INGEST_LOCK_KEY]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return { configured: true, ingested: 0, skipped: "locked" };
    const setup = getAshleyShopSetup();
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: 100,
      q: `to:(${setup.intakeAlias}) from:(${setup.authorizedSender}) has:attachment newer_than:30d`,
    });
    let ingested = 0;
    for (const message of list.data.messages || []) {
      if (!message.id) continue;
      const result = await ingestMessage(gmail, message.id);
      if (result) ingested += 1;
    }
    return { configured: true, ingested };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [INGEST_LOCK_KEY]).catch(() => {});
    client.release();
  }
}
