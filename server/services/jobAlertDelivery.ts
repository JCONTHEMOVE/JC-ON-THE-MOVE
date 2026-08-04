import { pool } from "../db";

export type JobAlertChannel = "in_app" | "push" | "email" | "sms" | "webhook";
export type JobAlertStatus = "sent" | "failed" | "skipped";

/**
 * A durable, append-only audit of operational alert delivery.  This is kept
 * separate from the in-app notification itself so a missing push subscription
 * or a provider outage is visible rather than looking like a sent alert.
 */
export async function recordJobAlertDelivery(input: {
  eventId: string;
  leadId: string;
  recipientUserId?: string | null;
  channel: JobAlertChannel;
  status: JobAlertStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await pool.query(
    `INSERT INTO job_alert_deliveries
      (event_id, lead_id, recipient_user_id, channel, status, error_message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (event_id, recipient_user_id, channel)
     DO UPDATE SET
       status = EXCLUDED.status,
       error_message = EXCLUDED.error_message,
       metadata = EXCLUDED.metadata,
       attempts = job_alert_deliveries.attempts + 1,
       updated_at = NOW()`,
    [
      input.eventId,
      input.leadId,
      input.recipientUserId || null,
      input.channel,
      input.status,
      input.errorMessage || null,
      JSON.stringify(input.metadata || {}),
    ],
  );
}

export async function hasJobAlertDelivery(eventId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM job_alert_deliveries WHERE event_id = $1 LIMIT 1",
    [eventId],
  );
  return (rowCount || 0) > 0;
}
