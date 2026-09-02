import { pool } from "../db";

export const OFFLINE_JOB_PAYMENT_METHODS = ["cash", "check"] as const;
export type OfflineJobPaymentMethod = (typeof OFFLINE_JOB_PAYMENT_METHODS)[number];

export const OFFLINE_CLOSEOUT_STATUSES = new Set([
  "confirmed",
  "available",
  "assigned",
  "accepted",
  "dispatched",
  "in_progress",
  "completed",
]);

const BUSINESS_TIME_ZONE = "America/Chicago";

type OfflineCloseoutLeadRow = {
  id: string;
  status: string;
  confirmed_date: string | null;
  move_date: string | null;
  total_price: string | null;
  base_price: string | null;
  payment_paid_at: Date | null;
  crew_members: string[] | null;
  assigned_to_user_id: string | null;
};

export type OfflineJobPaymentRecord = {
  id: string;
  lead_id: string;
  source: "manual";
  payment_scope: "paid_in_full";
  status: "confirmed";
  method: OfflineJobPaymentMethod;
  amount: string;
  paid_at: Date;
  reference: string | null;
  note: string | null;
  recorded_by_user_id: string | null;
  created_at: Date;
};

export class OfflineJobCloseoutError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = "OfflineJobCloseoutError";
  }
}

export function businessDateString(now = new Date(), timeZone = BUSINESS_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function normalizeJobDate(value: unknown): string | null {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!us) return null;
  return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

export function offlineCloseoutEligibility(input: {
  scheduledDate: unknown;
  currentDate: string;
  status: unknown;
  total: unknown;
  paymentPaidAt?: unknown;
  validCrewAccountCount: number;
}) {
  const scheduledDate = normalizeJobDate(input.scheduledDate);
  const status = String(input.status || "").toLowerCase();
  const total = Number(input.total);
  if (!scheduledDate || scheduledDate >= input.currentDate) {
    return { eligible: false as const, code: "not_past", message: "Only jobs scheduled before today can use past-job closeout." };
  }
  if (!OFFLINE_CLOSEOUT_STATUSES.has(status)) {
    return { eligible: false as const, code: "unsupported_status", message: `Job status '${status || "unknown"}' cannot use past-job closeout.` };
  }
  if (!Number.isFinite(total) || total <= 0) {
    return { eligible: false as const, code: "missing_total", message: "Save the final job total before recording payment." };
  }
  if (input.paymentPaidAt) {
    return { eligible: false as const, code: "already_paid", message: "This job is already recorded as paid." };
  }
  if (input.validCrewAccountCount < 1) {
    return { eligible: false as const, code: "crew_missing", message: "Assign at least one crew user account before closing the job so JCMOVES can be credited correctly." };
  }
  return { eligible: true as const, scheduledDate, status, total: Math.round(total * 100) / 100 };
}

export async function ensureOfflineJobPaymentTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS job_payment_records (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'manual',
      payment_scope TEXT NOT NULL DEFAULT 'paid_in_full',
      status TEXT NOT NULL DEFAULT 'confirmed',
      method TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
      paid_at TIMESTAMPTZ NOT NULL,
      reference TEXT,
      note TEXT,
      recorded_by_user_id VARCHAR REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_job_payment_records_method CHECK (method IN ('cash','check')),
      CONSTRAINT chk_job_payment_records_scope CHECK (payment_scope IN ('paid_in_full')),
      CONSTRAINT chk_job_payment_records_status CHECK (status IN ('confirmed'))
    );
    CREATE INDEX IF NOT EXISTS idx_job_payment_records_lead ON job_payment_records(lead_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_job_payment_records_manual_full
      ON job_payment_records(lead_id)
      WHERE source='manual' AND payment_scope='paid_in_full' AND status='confirmed';
  `);
}

function uniqueCrewIds(lead: Pick<OfflineCloseoutLeadRow, "crew_members" | "assigned_to_user_id">) {
  return Array.from(new Set([
    ...(Array.isArray(lead.crew_members) ? lead.crew_members : []),
    ...(lead.assigned_to_user_id ? [lead.assigned_to_user_id] : []),
  ].filter((id): id is string => typeof id === "string" && id.length > 0)));
}

export async function recordOfflineJobCloseout(input: {
  leadId: string;
  actorUserId: string;
  method: OfflineJobPaymentMethod;
  paidDate: string;
  reference?: string | null;
  note?: string | null;
  currentDate?: string;
}) {
  await ensureOfflineJobPaymentTables();
  const currentDate = input.currentDate || businessDateString();
  const paidDate = normalizeJobDate(input.paidDate);
  if (!paidDate || paidDate > currentDate) {
    throw new OfflineJobCloseoutError("Payment date must be today or earlier.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const leadResult = await client.query<OfflineCloseoutLeadRow>(
      `SELECT id, status, confirmed_date, move_date, total_price, base_price,
              payment_paid_at, crew_members, assigned_to_user_id
         FROM leads
        WHERE id=$1
        FOR UPDATE`,
      [input.leadId],
    );
    const lead = leadResult.rows[0];
    if (!lead) throw new OfflineJobCloseoutError("Job not found.", 404);

    const existingResult = await client.query<OfflineJobPaymentRecord>(
      `SELECT * FROM job_payment_records
        WHERE lead_id=$1 AND source='manual' AND payment_scope='paid_in_full' AND status='confirmed'
        LIMIT 1`,
      [input.leadId],
    );
    if (existingResult.rows[0]) {
      await client.query("COMMIT");
      return {
        alreadyRecorded: true,
        payment: existingResult.rows[0],
        total: Number(existingResult.rows[0].amount),
        previousStatus: lead.status,
        crewUserIds: uniqueCrewIds(lead),
      };
    }

    const crewUserIds = uniqueCrewIds(lead);
    const validCrewResult = crewUserIds.length
      ? await client.query<{ id: string }>("SELECT id FROM users WHERE id=ANY($1::varchar[])", [crewUserIds])
      : { rows: [] as Array<{ id: string }> };
    const total = Number(lead.total_price || lead.base_price || 0);
    const eligibility = offlineCloseoutEligibility({
      scheduledDate: lead.confirmed_date || lead.move_date,
      currentDate,
      status: lead.status,
      total,
      paymentPaidAt: lead.payment_paid_at,
      validCrewAccountCount: validCrewResult.rows.length,
    });
    if (!eligibility.eligible) {
      throw new OfflineJobCloseoutError(eligibility.message, eligibility.code === "already_paid" ? 409 : 400);
    }

    const paidAtResult = await client.query<{ paid_at: Date }>(
      `SELECT (($1::date + TIME '12:00') AT TIME ZONE $2) AS paid_at`,
      [paidDate, BUSINESS_TIME_ZONE],
    );
    const paidAt = paidAtResult.rows[0].paid_at;
    const reference = String(input.reference || "").trim().slice(0, 200) || null;
    const note = String(input.note || "").trim().slice(0, 1000) || null;
    const inserted = await client.query<OfflineJobPaymentRecord>(
      `INSERT INTO job_payment_records
         (lead_id, source, payment_scope, status, method, amount, paid_at, reference, note, recorded_by_user_id)
       VALUES ($1,'manual','paid_in_full','confirmed',$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [input.leadId, input.method, eligibility.total.toFixed(2), paidAt, reference, note, input.actorUserId],
    );

    await client.query(
      `UPDATE leads
          SET status='completed',
              payment_paid_at=COALESCE(payment_paid_at,$2),
              payment_plan='cash_or_check',
              financial_status='paid',
              closeout_status='paid',
              final_balance_amount=0,
              deposit_paid=CASE WHEN deposit_required THEN true ELSE deposit_paid END,
              dispatch_state='completed',
              dispatch_offered_to=NULL,
              dispatch_offer_expires_at=NULL,
              en_route_at=COALESCE(en_route_at,$2),
              on_site_at=COALESCE(on_site_at,$2),
              completed_at=COALESCE(completed_at,$2),
              last_quote_updated_at=NOW()
        WHERE id=$1`,
      [input.leadId, paidAt],
    );

    const methodLabel = input.method === "check" ? "Check" : "Cash";
    const detail = [
      `${methodLabel} payment of $${eligibility.total.toFixed(2)} recorded and past job closed by owner`,
      reference ? `reference ${reference}` : null,
      note,
    ].filter(Boolean).join(" · ");
    await client.query(
      `INSERT INTO lead_history (lead_id, from_status, to_status, changed_by_user_id, note)
       VALUES ($1,$2,'completed',$3,$4)`,
      [input.leadId, lead.status, input.actorUserId, detail],
    );
    await client.query("COMMIT");

    return {
      alreadyRecorded: false,
      payment: inserted.rows[0],
      total: eligibility.total,
      previousStatus: lead.status,
      crewUserIds: validCrewResult.rows.map((row) => row.id),
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
