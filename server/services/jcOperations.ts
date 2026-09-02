import crypto from "crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  JC_OPERATIONS_TIME_ZONE,
  estimateJobDuration,
  exactHourlyStarts,
  type CapacityStatus,
  type SizingBasis,
  type TruckSize,
} from "@shared/jcOperations";
import { pool } from "../db";
import { getAppUrl } from "../appUrl";
import { sendEmail } from "./email";
import { notificationService } from "./notification";

type SqlClient = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };

let infrastructurePromise: Promise<void> | null = null;

export function ensureJcOperationsInfrastructure() {
  if (!infrastructurePromise) {
    infrastructurePromise = pool.query(`
      CREATE TABLE IF NOT EXISTS lead_schedule_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id VARCHAR NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending_confirmation',
        preferred_date DATE NOT NULL,
        preferred_start_time TIME NOT NULL,
        pending_change_date DATE,
        pending_change_start_time TIME,
        timezone TEXT NOT NULL DEFAULT 'America/Chicago',
        service_address TEXT NOT NULL,
        zip TEXT NOT NULL,
        work_scope TEXT NOT NULL,
        sizing_basis TEXT NOT NULL,
        square_footage INTEGER,
        truck_size TEXT,
        recommended_crew_size INTEGER NOT NULL,
        selected_crew_size INTEGER NOT NULL,
        estimate_min_minutes INTEGER NOT NULL,
        estimate_max_minutes INTEGER NOT NULL,
        planning_minutes INTEGER NOT NULL,
        capacity_status TEXT NOT NULL,
        manage_token_hash TEXT NOT NULL UNIQUE,
        token_expires_at TIMESTAMPTZ NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        urgent BOOLEAN NOT NULL DEFAULT FALSE,
        customer_updated_at TIMESTAMPTZ,
        confirmed_at TIMESTAMPTZ,
        confirmed_by_user_id VARCHAR REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lead_schedule_requests_date
        ON lead_schedule_requests(preferred_date, preferred_start_time, status);

      CREATE TABLE IF NOT EXISTS lead_schedule_events (
        id BIGSERIAL PRIMARY KEY,
        schedule_request_id VARCHAR NOT NULL REFERENCES lead_schedule_requests(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        actor_user_id VARCHAR REFERENCES users(id),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_contact_events (
        id BIGSERIAL PRIMARY KEY,
        lead_id VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        outcome TEXT NOT NULL CHECK (outcome IN ('attempted','reached')),
        notes TEXT,
        actor_user_id VARCHAR REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_lead_contact_events_lead
        ON lead_contact_events(lead_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS lead_safety_alerts (
        id BIGSERIAL PRIMARY KEY,
        lead_id VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        alert_kind TEXT NOT NULL CHECK (alert_kind IN ('24h_reminder','48h_red_flag')),
        severity TEXT NOT NULL,
        delivery_suppressed BOOLEAN NOT NULL DEFAULT FALSE,
        notified_at TIMESTAMPTZ,
        cleared_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(lead_id, alert_kind)
      );
      CREATE INDEX IF NOT EXISTS idx_lead_safety_alerts_open
        ON lead_safety_alerts(alert_kind, cleared_at, created_at DESC);

      CREATE TABLE IF NOT EXISTS chief_of_staff_actions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        lead_id VARCHAR REFERENCES leads(id) ON DELETE SET NULL,
        recipient_email TEXT,
        subject TEXT,
        body_text TEXT,
        rationale TEXT,
        model TEXT,
        created_by_user_id VARCHAR NOT NULL REFERENCES users(id),
        approved_by_user_id VARCHAR REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).then(() => undefined).catch((error) => {
      infrastructurePromise = null;
      throw error;
    });
  }
  return infrastructurePromise;
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newManageToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function centralDateTimeToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wantedWallTime = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = wantedWallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JC_OPERATIONS_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((item) => item.type === type)?.value || 0);
    const renderedWallTime = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), 0);
    instant += wantedWallTime - renderedWallTime;
  }
  return new Date(instant);
}

export function validateSchedulingPreference(date: string, time: string, options: { requireLeadTime?: boolean } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose a valid service date.");
  if (!exactHourlyStarts().includes(time)) throw new Error("Choose an hourly start between 8:00 AM and 5:00 PM Central.");
  const startsAt = centralDateTimeToUtc(date, time);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Choose a valid date and time.");
  if (options.requireLeadTime !== false && startsAt.getTime() < Date.now() + 2 * 60 * 60_000) {
    throw new Error("Same-day requests need at least two hours of lead time. Call JC ON THE MOVE for urgent help.");
  }
  return { startsAt, urgent: startsAt.getTime() <= Date.now() + 48 * 60 * 60_000 };
}

export async function getPreferenceCapacity(input: {
  date: string;
  time: string;
  crewSize: number;
  planningMinutes: number;
  excludeScheduleRequestId?: string;
  allowWithinTwoHours?: boolean;
}, client: SqlClient = pool): Promise<{
  status: CapacityStatus;
  availableCrew: number;
  totalCrew: number;
  reservedCrew: number;
  message: string;
}> {
  const { startsAt } = validateSchedulingPreference(input.date, input.time, { requireLeadTime: !input.allowWithinTwoHours });
  const endsAt = new Date(startsAt.getTime() + Math.max(60, input.planningMinutes) * 60_000);
  const employeeResult = await client.query(`
    SELECT COUNT(*)::int AS total
      FROM users
     WHERE role IN ('employee','admin','business_owner')
       AND COALESCE(status, 'approved') IN ('approved','active')
  `);
  const totalCrew = Number(employeeResult.rows[0]?.total || 0);

  const legacyResult = await client.query(`
    SELECT COALESCE(SUM(COALESCE(crew_size, 2)), 0)::int AS reserved
      FROM leads
     WHERE (confirmed_date = $1 OR move_date = $1)
       AND COALESCE(status, '') NOT IN ('cancelled','completed','closed','archived')
       AND archived_at IS NULL
       AND COALESCE(source, '') NOT IN ('scheduled_request','instant_booking_hold')
  `, [input.date]);
  let reservedCrew = Number(legacyResult.rows[0]?.reserved || 0);

  const holdTable = await client.query(`SELECT to_regclass('public.booking_slot_holds') AS table_name`);
  if (holdTable.rows[0]?.table_name) {
    const holds = await client.query(`
      SELECT COALESCE(SUM(crew_size), 0)::int AS reserved
        FROM booking_slot_holds
       WHERE service_date = $1::date
         AND status IN ('pending_review','awaiting_deposit','confirmed')
         AND start_at < $3::timestamptz
         AND start_at + duration_minutes * INTERVAL '1 minute' > $2::timestamptz
    `, [input.date, startsAt.toISOString(), endsAt.toISOString()]);
    reservedCrew += Number(holds.rows[0]?.reserved || 0);
  }

  const tentative = await client.query(`
    SELECT COALESCE(SUM(selected_crew_size), 0)::int AS reserved
      FROM lead_schedule_requests
     WHERE preferred_date = $1::date
       AND status = 'confirmed'
       AND ($4::varchar IS NULL OR id <> $4)
       AND (preferred_date + preferred_start_time) AT TIME ZONE timezone < $3::timestamptz
       AND ((preferred_date + preferred_start_time) AT TIME ZONE timezone
            + planning_minutes * INTERVAL '1 minute') > $2::timestamptz
  `, [input.date, startsAt.toISOString(), endsAt.toISOString(), input.excludeScheduleRequestId || null]);
  reservedCrew += Number(tentative.rows[0]?.reserved || 0);

  const availableCrew = Math.max(0, totalCrew - reservedCrew);
  const status: CapacityStatus = totalCrew <= 0 || availableCrew < input.crewSize
    ? "ask_jc"
    : availableCrew === input.crewSize ? "limited" : "open";
  const message = status === "open"
    ? "That preference is currently open. JC will confirm it after reviewing the job."
    : status === "limited"
      ? "Capacity is limited. Submit the preference and JC will confirm it."
      : "Please ask JC about this time. You can still submit it as a preference.";
  return { status, availableCrew, totalCrew, reservedCrew, message };
}

export type CreateScheduleRequestInput = {
  leadId: string;
  customerEmail: string;
  customerName: string;
  serviceAddress: string;
  zip: string;
  workScope: string;
  sizingBasis: SizingBasis;
  squareFootage?: number | null;
  truckSize?: TruckSize | null;
  selectedCrewSize?: 2 | 3 | 4 | null;
  preferredDate: string;
  preferredStartTime: string;
};

export async function createLeadScheduleRequest(input: CreateScheduleRequestInput) {
  await ensureJcOperationsInfrastructure();
  const timing = validateSchedulingPreference(input.preferredDate, input.preferredStartTime);
  const estimate = estimateJobDuration(input);
  const capacity = await getPreferenceCapacity({
    date: input.preferredDate,
    time: input.preferredStartTime,
    crewSize: estimate.selectedCrewSize,
    planningMinutes: Math.round(estimate.planningHours * 60),
  });
  const token = newManageToken();
  const inserted = await pool.query(`
    INSERT INTO lead_schedule_requests (
      lead_id, preferred_date, preferred_start_time, service_address, zip, work_scope,
      sizing_basis, square_footage, truck_size, recommended_crew_size, selected_crew_size,
      estimate_min_minutes, estimate_max_minutes, planning_minutes, capacity_status,
      manage_token_hash, token_expires_at, urgent
    ) VALUES ($1,$2::date,$3::time,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()+INTERVAL '120 days',$17)
    ON CONFLICT (lead_id) DO UPDATE SET
      manage_token_hash=EXCLUDED.manage_token_hash,
      token_expires_at=EXCLUDED.token_expires_at,
      updated_at=NOW()
    RETURNING *
  `, [
    input.leadId, input.preferredDate, input.preferredStartTime, input.serviceAddress, input.zip,
    input.workScope, input.sizingBasis, input.squareFootage || null, input.truckSize || null,
    estimate.recommendedCrewSize, estimate.selectedCrewSize, Math.round(estimate.minimumHours * 60),
    Math.round(estimate.maximumHours * 60), Math.round(estimate.planningHours * 60), capacity.status,
    tokenHash(token), timing.urgent,
  ]);
  const row = inserted.rows[0];
  await pool.query(`
    INSERT INTO lead_schedule_events(schedule_request_id,event_type,actor_type,metadata)
    VALUES ($1,'created','customer',$2::jsonb)
  `, [row.id, JSON.stringify({ capacity, estimate })]);
  const manageUrl = `${getAppUrl().replace(/\/$/, "")}/schedule-request/${encodeURIComponent(token)}`;
  if (input.customerEmail && !input.customerEmail.endsWith("@jconthemove.local")) {
    const safeCustomerName = escapeHtml(input.customerName);
    const safeManageUrl = escapeHtml(manageUrl);
    await sendEmail({
      to: input.customerEmail,
      subject: `Manage your requested JC ON THE MOVE date — ${input.preferredDate}`,
      text: `Hi ${input.customerName}, we saved ${input.preferredDate} at ${input.preferredStartTime} Central as your preferred start. This is tentative until JC confirms it. Review or change it here: ${manageUrl}`,
      html: `<h2>Your preferred moving date is saved</h2><p>Hi ${safeCustomerName},</p><p>We saved <strong>${input.preferredDate} at ${input.preferredStartTime} Central</strong> as your preferred start. It remains tentative until JC confirms it.</p><p><a href="${safeManageUrl}">Review or request a change</a></p>`,
    }).catch((error) => console.error("[schedule-request] customer email failed:", error));
  }
  return { scheduleRequest: row, manageToken: token, manageUrl, capacity, estimate };
}

export async function rotateScheduleManageToken(leadId: string) {
  await ensureJcOperationsInfrastructure();
  const token = newManageToken();
  const result = await pool.query(`
    UPDATE lead_schedule_requests
       SET manage_token_hash=$2, token_expires_at=NOW()+INTERVAL '120 days', updated_at=NOW()
     WHERE lead_id=$1
     RETURNING *
  `, [leadId, tokenHash(token)]);
  if (!result.rows[0]) return null;
  return {
    scheduleRequest: result.rows[0],
    manageToken: token,
    manageUrl: `${getAppUrl().replace(/\/$/, "")}/schedule-request/${encodeURIComponent(token)}`,
  };
}

export async function scheduleRequestByToken(token: string) {
  await ensureJcOperationsInfrastructure();
  const result = await pool.query(`
    SELECT sr.*, l.first_name, l.last_name, l.email, l.phone, l.service_type
      FROM lead_schedule_requests sr JOIN leads l ON l.id=sr.lead_id
     WHERE sr.manage_token_hash=$1 AND sr.token_expires_at>NOW()
     LIMIT 1
  `, [tokenHash(token)]);
  return result.rows[0] || null;
}

export async function updateScheduleRequestByToken(token: string, input: { date: string; time: string }) {
  await ensureJcOperationsInfrastructure();
  const current = await scheduleRequestByToken(token);
  if (!current) throw new Error("This schedule-management link is invalid or expired.");
  const timing = validateSchedulingPreference(input.date, input.time);
  const capacity = await getPreferenceCapacity({
    date: input.date,
    time: input.time,
    crewSize: Number(current.selected_crew_size),
    planningMinutes: Number(current.planning_minutes),
    excludeScheduleRequestId: current.id,
  });
  const confirmed = current.status === "confirmed";
  const updated = await pool.query(confirmed ? `
    UPDATE lead_schedule_requests
       SET pending_change_date=$2::date, pending_change_start_time=$3::time,
           status='change_requested', capacity_status=$4, urgent=$5,
           customer_updated_at=NOW(), updated_at=NOW(), version=version+1
     WHERE id=$1 RETURNING *
  ` : `
    UPDATE lead_schedule_requests
       SET preferred_date=$2::date, preferred_start_time=$3::time,
           capacity_status=$4, urgent=$5, customer_updated_at=NOW(), updated_at=NOW(), version=version+1
     WHERE id=$1 RETURNING *
  `, [current.id, input.date, input.time, capacity.status, timing.urgent]);
  await pool.query(`INSERT INTO lead_schedule_events(schedule_request_id,event_type,actor_type,metadata)
                    VALUES ($1,$2,'customer',$3::jsonb)`, [
    current.id, confirmed ? "change_requested" : "preference_updated",
    JSON.stringify({ date: input.date, time: input.time, capacity, urgent: timing.urgent }),
  ]);
  return { scheduleRequest: updated.rows[0], capacity, requiresStaffApproval: confirmed };
}

async function ownerRecipients(client: SqlClient = pool) {
  const result = await client.query(`
    SELECT id,email,role FROM users
     WHERE role IN ('admin','business_owner') AND COALESCE(status,'approved') IN ('approved','active')
  `);
  return result.rows;
}

async function crewRecipients(client: SqlClient = pool) {
  const result = await client.query(`
    SELECT id,email,role FROM users
     WHERE role='employee' AND COALESCE(status,'approved') IN ('approved','active')
  `);
  return result.rows;
}

async function deliverLeadSafetyAlert(input: { lead: any; kind: "24h_reminder" | "48h_red_flag" }) {
  const owners = await ownerRecipients();
  const recipients = input.kind === "24h_reminder" ? [...owners, ...(await crewRecipients())] : owners;
  const title = input.kind === "48h_red_flag" ? "RED FLAG: lead has not been reached" : "Lead needs a contact attempt";
  const age = input.kind === "48h_red_flag" ? "48 hours" : "24 hours";
  const message = `${input.lead.first_name} ${input.lead.last_name}'s ${String(input.lead.service_type).replace(/_/g, " ")} lead is ${age} old. ${input.kind === "48h_red_flag" ? "Record a successful contact or close the lead." : "Record a contact attempt; do not dispatch it."}`;
  await Promise.allSettled(recipients.map((recipient) => notificationService.sendNotification({
    userId: recipient.id,
    type: "system_alert",
    title,
    message,
    data: { type: input.kind, leadId: input.lead.id, url: `/lead/${input.lead.id}` },
  })));
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  await Promise.allSettled(owners.filter((owner) => owner.email).map((owner) => sendEmail({
    to: owner.email,
    subject: `${title} — ${input.lead.first_name} ${input.lead.last_name}`,
    text: `${message}\n\nOpen: ${getAppUrl().replace(/\/$/, "")}/lead/${input.lead.id}`,
    html: `<h2>${safeTitle}</h2><p>${safeMessage}</p><p><a href="${getAppUrl().replace(/\/$/, "")}/lead/${encodeURIComponent(input.lead.id)}">Open lead</a></p>`,
  })));
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

export function dueLeadSafetyAlertKind(input: { ageHours: number; hasAttempt: boolean; hasReached: boolean }) {
  if (input.ageHours >= 48 && !input.hasReached) return "48h_red_flag" as const;
  if (input.ageHours >= 24 && !input.hasAttempt) return "24h_reminder" as const;
  return null;
}

export async function runLeadSafetySweep() {
  await ensureJcOperationsInfrastructure();
  const client = await pool.connect();
  let locked = false;
  try {
    const lockResult = await client.query(`SELECT pg_try_advisory_lock(hashtext('jc_lead_safety_sweep')) AS locked`);
    locked = Boolean(lockResult.rows[0]?.locked);
    if (!locked) return { skipped: true, reminders: 0, redFlags: 0 };
    await client.query(`
      UPDATE lead_safety_alerts a SET cleared_at=COALESCE(a.cleared_at,NOW())
       FROM leads l
       WHERE l.id=a.lead_id AND a.cleared_at IS NULL
         AND COALESCE(l.status,'') IN ('completed','closed','cancelled','paid')
    `);
    const unresolved = await client.query(`
      SELECT l.id,l.first_name,l.last_name,l.email,l.phone,l.service_type,l.created_at,
             EXTRACT(EPOCH FROM (NOW()-l.created_at))/3600 AS age_hours,
             EXISTS(SELECT 1 FROM lead_contact_events e WHERE e.lead_id=l.id AND e.outcome IN ('attempted','reached')) AS has_attempt,
             EXISTS(SELECT 1 FROM lead_contact_events e WHERE e.lead_id=l.id AND e.outcome='reached') AS has_reached
        FROM leads l
       WHERE l.archived_at IS NULL
         AND COALESCE(l.status,'') NOT IN ('completed','closed','cancelled','paid')
         AND l.created_at <= NOW()-INTERVAL '24 hours'
    `);
    let reminders = 0;
    let redFlags = 0;
    for (const lead of unresolved.rows) {
      const ageHours = Number(lead.age_hours || 0);
      const suppressHistoric = ageHours > 24 * 7;
      const alertKind = dueLeadSafetyAlertKind({ ageHours, hasAttempt: lead.has_attempt, hasReached: lead.has_reached });
      if (alertKind === "48h_red_flag") {
        const inserted = await client.query(`
          INSERT INTO lead_safety_alerts(lead_id,alert_kind,severity,delivery_suppressed)
          VALUES ($1,'48h_red_flag','red',$2)
          ON CONFLICT(lead_id,alert_kind) DO NOTHING RETURNING id
        `, [lead.id, suppressHistoric]);
        if (inserted.rows[0]) {
          redFlags += 1;
          if (!suppressHistoric) {
            await deliverLeadSafetyAlert({ lead, kind: "48h_red_flag" });
            await client.query(`UPDATE lead_safety_alerts SET notified_at=NOW() WHERE id=$1`, [inserted.rows[0].id]);
          }
        }
      } else if (alertKind === "24h_reminder") {
        const inserted = await client.query(`
          INSERT INTO lead_safety_alerts(lead_id,alert_kind,severity,delivery_suppressed)
          VALUES ($1,'24h_reminder','warning',$2)
          ON CONFLICT(lead_id,alert_kind) DO NOTHING RETURNING id
        `, [lead.id, suppressHistoric]);
        if (inserted.rows[0]) {
          reminders += 1;
          if (!suppressHistoric) {
            await deliverLeadSafetyAlert({ lead, kind: "24h_reminder" });
            await client.query(`UPDATE lead_safety_alerts SET notified_at=NOW() WHERE id=$1`, [inserted.rows[0].id]);
          }
        }
      }
    }
    return { skipped: false, reminders, redFlags };
  } finally {
    if (locked) await client.query(`SELECT pg_advisory_unlock(hashtext('jc_lead_safety_sweep'))`).catch(() => undefined);
    client.release();
  }
}

export async function recordLeadContact(input: { leadId: string; outcome: "attempted" | "reached"; notes?: string; actorUserId: string }) {
  await ensureJcOperationsInfrastructure();
  await pool.query(`INSERT INTO lead_contact_events(lead_id,outcome,notes,actor_user_id) VALUES ($1,$2,$3,$4)`, [
    input.leadId, input.outcome, input.notes || null, input.actorUserId,
  ]);
  if (input.outcome === "attempted") {
    await pool.query(`UPDATE lead_safety_alerts SET cleared_at=COALESCE(cleared_at,NOW()) WHERE lead_id=$1 AND alert_kind='24h_reminder'`, [input.leadId]);
  } else {
    await pool.query(`UPDATE lead_safety_alerts SET cleared_at=COALESCE(cleared_at,NOW()) WHERE lead_id=$1`, [input.leadId]);
    await pool.query(`UPDATE leads SET status=CASE WHEN status IN ('new','quote_requested') THEN 'contacted' ELSE status END WHERE id=$1`, [input.leadId]);
  }
}

export async function getLeadSafetyStatus() {
  await ensureJcOperationsInfrastructure();
  const result = await pool.query(`
    SELECT l.id AS lead_id,l.first_name,l.last_name,l.email,l.phone,l.service_type,l.created_at,
           EXTRACT(EPOCH FROM (NOW()-l.created_at))/3600 AS age_hours,
           MAX(CASE WHEN a.alert_kind='48h_red_flag' AND a.cleared_at IS NULL THEN 1 ELSE 0 END)::int AS red_flag,
           MAX(CASE WHEN a.alert_kind='24h_reminder' AND a.cleared_at IS NULL THEN 1 ELSE 0 END)::int AS reminder
      FROM leads l LEFT JOIN lead_safety_alerts a ON a.lead_id=l.id
     WHERE l.archived_at IS NULL AND COALESCE(l.status,'') NOT IN ('completed','closed','cancelled','paid')
     GROUP BY l.id,l.first_name,l.last_name,l.email,l.phone,l.service_type,l.created_at
     ORDER BY red_flag DESC,reminder DESC,l.created_at ASC
  `);
  return result.rows;
}

const briefingSchema = z.object({
  summary: z.string().min(20).max(1200),
  priorities: z.array(z.object({ title: z.string().min(3).max(120), reason: z.string().min(5).max(400) })).min(1).max(7),
});

export async function generateChiefOfStaffBriefing() {
  await ensureJcOperationsInfrastructure();
  const [alerts, schedule, jobs, revenue] = await Promise.all([
    pool.query(`SELECT COUNT(*) FILTER (WHERE alert_kind='48h_red_flag' AND cleared_at IS NULL)::int AS red,
                       COUNT(*) FILTER (WHERE alert_kind='24h_reminder' AND cleared_at IS NULL)::int AS reminders
                  FROM lead_safety_alerts`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='pending_confirmation')::int AS pending,
                       COUNT(*) FILTER (WHERE status='change_requested')::int AS changes,
                       COUNT(*) FILTER (WHERE urgent=TRUE AND status<>'confirmed')::int AS urgent
                  FROM lead_schedule_requests`),
    pool.query(`SELECT COUNT(*) FILTER (WHERE confirmed_date=CURRENT_DATE)::int AS today,
                       COUNT(*) FILTER (WHERE status IN ('new','quote_requested','contacted'))::int AS open_leads
                  FROM leads WHERE archived_at IS NULL`),
    pool.query(`SELECT COALESCE(SUM(COALESCE(total_price,base_price)::numeric),0)::numeric AS pipeline
                  FROM leads WHERE archived_at IS NULL AND status NOT IN ('cancelled','closed','completed')`),
  ]);
  const facts = {
    overdue48h: Number(alerts.rows[0]?.red || 0),
    due24h: Number(alerts.rows[0]?.reminders || 0),
    scheduleRequests: Number(schedule.rows[0]?.pending || 0),
    scheduleChanges: Number(schedule.rows[0]?.changes || 0),
    urgentScheduleRequests: Number(schedule.rows[0]?.urgent || 0),
    jobsToday: Number(jobs.rows[0]?.today || 0),
    openLeads: Number(jobs.rows[0]?.open_leads || 0),
    openPipelineDollars: Number(revenue.rows[0]?.pipeline || 0),
  };
  const fallback = {
    summary: `JC has ${facts.overdue48h} red-flag lead(s), ${facts.due24h} lead reminder(s), and ${facts.scheduleRequests + facts.scheduleChanges} schedule request(s) awaiting a decision.`,
    priorities: [
      { title: "Reach red-flag leads", reason: `${facts.overdue48h} lead(s) have gone 48 hours without a recorded successful contact.` },
      { title: "Confirm customer date preferences", reason: `${facts.scheduleRequests} tentative request(s) and ${facts.scheduleChanges} requested change(s) need review.` },
      { title: "Protect today's execution", reason: `${facts.jobsToday} confirmed job(s) are scheduled today.` },
    ],
  };
  const model = process.env.JC_CHIEF_OF_STAFF_MODEL?.trim() || "spacexai/grok-4.6";
  if (!process.env.AI_GATEWAY_API_KEY?.trim()) return { ...fallback, facts, model, aiFallback: true };
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: briefingSchema }),
      prompt: [
        "You are the owner-only JC ON THE MOVE Chief of Staff.",
        "Use only the supplied JC business facts. Rank overdue leads, same-day execution, pending schedule decisions, capacity, and revenue risk.",
        "Recommend human actions only. Never change a price, schedule, crew assignment, dispatch, payment, or reward. Never claim that an action was completed.",
        `Facts: ${JSON.stringify(facts)}`,
      ].join("\n\n"),
    });
    return { ...(result.output || fallback), facts, model, aiFallback: !result.output };
  } catch (error) {
    console.error("[chief-of-staff] Grok briefing fallback:", error instanceof Error ? error.message : error);
    return { ...fallback, facts, model, aiFallback: true };
  }
}

const emailDraftSchema = z.object({ subject: z.string().min(3).max(160), body: z.string().min(20).max(3000), rationale: z.string().min(5).max(500) });

export async function draftChiefOfStaffEmail(input: { leadId: string; actorUserId: string }) {
  await ensureJcOperationsInfrastructure();
  const leadResult = await pool.query(`SELECT id,first_name,last_name,email,service_type,created_at FROM leads WHERE id=$1 LIMIT 1`, [input.leadId]);
  const lead = leadResult.rows[0];
  if (!lead) throw new Error("Lead not found.");
  if (!lead.email || String(lead.email).endsWith("@jconthemove.local")) throw new Error("This lead does not have a deliverable customer email.");
  const model = process.env.JC_CHIEF_OF_STAFF_MODEL?.trim() || "spacexai/grok-4.6";
  const fallback = {
    subject: `Following up on your JC ON THE MOVE ${String(lead.service_type).replace(/_/g, " ")} request`,
    body: `Hi ${lead.first_name},\n\nThank you for contacting JC ON THE MOVE. We are following up on your ${String(lead.service_type).replace(/_/g, " ")} request so we can confirm the job details and your preferred date. Please reply to this email or call (906) 285-9312 when it is convenient.\n\nJC ON THE MOVE`,
    rationale: "A concise follow-up that asks the customer to reconnect without promising price, availability, or crew assignment.",
  };
  let draft = fallback;
  if (process.env.AI_GATEWAY_API_KEY?.trim()) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: emailDraftSchema }),
        prompt: `Draft a concise follow-up email for this JC ON THE MOVE lead: ${JSON.stringify({ firstName: lead.first_name, serviceType: lead.service_type, createdAt: lead.created_at })}. Do not invent prices, availability, dates, discounts, or promises. Ask the customer to reply or call (906) 285-9312. Return a rationale explaining why the draft is safe.`,
      });
      if (result.output) draft = result.output;
    } catch (error) {
      console.error("[chief-of-staff] email draft fallback:", error instanceof Error ? error.message : error);
    }
  }
  const inserted = await pool.query(`
    INSERT INTO chief_of_staff_actions(action_type,status,lead_id,recipient_email,subject,body_text,rationale,model,created_by_user_id)
    VALUES ('customer_email','draft',$1,$2,$3,$4,$5,$6,$7) RETURNING *
  `, [lead.id, lead.email, draft.subject, draft.body, draft.rationale, model, input.actorUserId]);
  return inserted.rows[0];
}

export async function approveChiefOfStaffAction(input: { actionId: string; actorUserId: string }) {
  await ensureJcOperationsInfrastructure();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT * FROM chief_of_staff_actions WHERE id=$1 FOR UPDATE`, [input.actionId]);
    const action = result.rows[0];
    if (!action) throw new Error("Draft action not found.");
    if (action.status !== "draft") throw new Error("This action was already reviewed.");
    if (action.action_type !== "customer_email") throw new Error("This action type cannot be executed.");
    const sent = await sendEmail({ to: action.recipient_email, subject: action.subject, text: action.body_text });
    if (!sent) throw new Error("The email provider did not confirm delivery.");
    const updated = await client.query(`
      UPDATE chief_of_staff_actions SET status='executed',approved_by_user_id=$2,approved_at=NOW(),executed_at=NOW()
       WHERE id=$1 RETURNING *
    `, [input.actionId, input.actorUserId]);
    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
