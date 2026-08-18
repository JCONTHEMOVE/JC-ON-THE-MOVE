import crypto from "crypto";
import { pool } from "../db";
import { sendEmail } from "./email";
import { smsService } from "./sms";
import { ensureRegionalAutomationSchema } from "./regionalAutomationMigration";
import type { CustomerJobEventType } from "@shared/regionalAutomation";

function destinationHash(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function appUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://www.jconthemove.com";
}

export async function emitCustomerLifecycleEvent(input: {
  leadId: string;
  type: CustomerJobEventType;
  eventKey: string;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  actionUrl?: string;
}): Promise<{ id: string; created: boolean }> {
  await ensureRegionalAutomationSchema();
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO customer_job_events
       (lead_id, event_type, event_key, title, message, payload)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [input.leadId, input.type, input.eventKey, input.title, input.message, JSON.stringify(input.payload || {})],
  );
  if (!inserted.rows[0]) {
    const existing = await pool.query<{ id: string }>(`SELECT id FROM customer_job_events WHERE event_key=$1`, [input.eventKey]);
    return { id: existing.rows[0]?.id || "", created: false };
  }

  const eventId = inserted.rows[0].id;
  const leadResult = await pool.query<{
    email: string;
    phone: string;
    sms_consent: boolean;
    first_name: string;
  }>(`SELECT email, phone, COALESCE(sms_consent,false) AS sms_consent, first_name FROM leads WHERE id=$1`, [input.leadId]);
  const lead = leadResult.rows[0];
  if (!lead) return { id: eventId, created: true };

  const portalLink = input.actionUrl || `${appUrl().replace(/\/$/, "")}/my-jobs`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email || "")) {
    const sent = await sendEmail({
      to: lead.email,
      subject: `${input.title} | JC ON THE MOVE`,
      text: `${input.message}\n\nView your job: ${portalLink}`,
      html: `<p>Hi ${lead.first_name || "there"},</p><p>${input.message}</p><p><a href="${portalLink}">View your job</a></p>`,
    }).catch(() => false);
    await recordDelivery(eventId, "email", lead.email, sent ? "sent" : "failed", null, sent ? null : "Email provider did not confirm delivery");
  }

  if (lead.sms_consent && lead.phone) {
    const result = await smsService.sendSMS(lead.phone, `${input.title}: ${input.message} ${portalLink}`);
    await recordDelivery(eventId, "sms", lead.phone, result.success ? "sent" : "failed", result.messageSid || null, result.error || null);
  }
  return { id: eventId, created: true };
}

async function recordDelivery(
  eventId: string,
  channel: string,
  destination: string,
  status: string,
  providerReference: string | null,
  error: string | null,
) {
  await pool.query(
    `INSERT INTO customer_notification_deliveries
       (event_id, channel, destination_hash, status, provider_reference, error)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (event_id, channel, destination_hash)
     DO UPDATE SET status=EXCLUDED.status, provider_reference=EXCLUDED.provider_reference,
                   error=EXCLUDED.error, attempts=customer_notification_deliveries.attempts + 1,
                   updated_at=NOW()`,
    [eventId, channel, destinationHash(destination), status, providerReference, error],
  );
}

export async function listCustomerJobEvents(leadIds: string[]) {
  if (!leadIds.length) return new Map<string, unknown[]>();
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query(
    `SELECT id, lead_id, event_type, title, message, payload, occurred_at
       FROM customer_job_events
      WHERE lead_id = ANY($1::varchar[])
      ORDER BY occurred_at ASC`,
    [leadIds],
  );
  const grouped = new Map<string, unknown[]>();
  for (const row of rows) {
    const list = grouped.get(row.lead_id) || [];
    list.push({
      id: row.id,
      type: row.event_type,
      title: row.title,
      message: row.message,
      payload: row.payload || {},
      occurredAt: row.occurred_at,
    });
    grouped.set(row.lead_id, list);
  }
  return grouped;
}
