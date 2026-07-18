import crypto from "crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../db";
import { notificationService } from "./notification";
import { leads, users, type Lead } from "@shared/schema";

export type JobEventType =
  | "quote_requested"
  | "quote_sent"
  | "job_available"
  | "crew_claimed"
  | "crew_assigned"
  | "job_updated"
  | "job_completed";

type RecipientScope = "owners" | "eligible_crew" | "assigned_crew" | "owners_and_assigned_crew";

interface EmitJobEventOptions {
  actorId?: string | null;
  source?: string;
  note?: string;
  previousStatus?: string | null;
  status?: string | null;
  extra?: Record<string, unknown>;
}

interface JobEventMessage {
  title: string;
  message: string;
  notificationType: "quote_request" | "job_assigned" | "job_status_change" | "system_alert";
  scope: RecipientScope;
}

type UserRecipient = {
  id: string;
  email: string | null;
  role: string | null;
};

const OWNER_EMAILS = new Set([
  "upmichiganstatemovers@gmail.com",
  "michigankid906@gmail.com",
]);

const webhookUrls = (process.env.JC_JOB_EVENT_WEBHOOK_URLS || process.env.JOB_EVENT_WEBHOOK_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const webhookSecret = process.env.JC_JOB_EVENT_WEBHOOK_SECRET || process.env.JOB_EVENT_WEBHOOK_SECRET || "";

function customerName(lead: Pick<Lead, "firstName" | "lastName">) {
  return `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Customer";
}

function displayService(lead: Pick<Lead, "serviceType">) {
  return String(lead.serviceType || "job").replace(/_/g, " ");
}

function formatLeadPrice(lead: Pick<Lead, "totalPrice" | "basePrice">) {
  const amount = Number(lead.totalPrice || lead.basePrice || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `$${amount.toFixed(2)}`;
}

function adminLeadUrl(leadId: string) {
  return `/admin/jobs?lead=${encodeURIComponent(leadId)}`;
}

function crewLeadUrl(leadId: string) {
  return `/crew/jobs?lead=${encodeURIComponent(leadId)}`;
}

function appBaseUrl() {
  return process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.CLIENT_URL || "https://www.jconthemove.com";
}

function absoluteAppUrl(path: string) {
  try {
    return new URL(path, appBaseUrl()).toString();
  } catch {
    return path;
  }
}

function messageFor(type: JobEventType, lead: Lead, options: EmitJobEventOptions): JobEventMessage {
  const name = customerName(lead);
  const service = displayService(lead);
  const date = lead.confirmedDate || lead.moveDate || "date TBD";

  switch (type) {
    case "quote_requested":
      return {
        scope: "owners",
        notificationType: "quote_request",
        title: "New Job Request",
        message: `${name} submitted a ${service} request. Review and price it before sending it to crew.`,
      };
    case "quote_sent": {
      const total = formatLeadPrice(lead);
      const hasPaymentUrl = Boolean(options.extra?.paymentUrl);
      return {
        scope: "owners",
        notificationType: "system_alert",
        title: "Quote Sent",
        message: `${service} quote for ${name} was sent${total ? ` for ${total}` : ""}.${hasPaymentUrl ? " Payment link is ready." : ""}`,
      };
    }
    case "job_available":
      return {
        scope: "eligible_crew",
        notificationType: "system_alert",
        title: "New Job Available",
        message: `${service} job for ${name} is open for crew on ${date}.`,
      };
    case "crew_claimed":
      return {
        scope: "owners",
        notificationType: "job_status_change",
        title: "Crew Claim Needs Review",
        message: `A crew member claimed a slot on ${name}'s ${service} job. Confirm the crew and dispatch when it is ready.`,
      };
    case "crew_assigned":
      return {
        scope: "assigned_crew",
        notificationType: "job_assigned",
        title: "Job Assigned",
        message: `You are assigned to ${name}'s ${service} job on ${date}.`,
      };
    case "job_completed":
      return {
        scope: "owners_and_assigned_crew",
        notificationType: "job_status_change",
        title: "Job Completed",
        message: `${name}'s ${service} job is complete. Payout and JCMOVES flow can run.`,
      };
    case "job_updated":
    default:
      return {
        scope: "owners_and_assigned_crew",
        notificationType: "job_status_change",
        title: "Job Updated",
        message: `${name}'s ${service} job was updated${options.note ? `: ${options.note}` : "."}`,
      };
  }
}

async function ownerRecipients(): Promise<UserRecipient[]> {
  return db.select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(
      and(
        or(
          inArray(users.role, ["admin", "business_owner"]),
          inArray(sql<string>`lower(${users.email})`, Array.from(OWNER_EMAILS)),
        ),
        or(eq(users.notificationsEnabled, true), sql`${users.notificationsEnabled} IS NULL`),
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%.internal'`,
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%@system.internal'`,
      ),
    );
}

async function eligibleCrewRecipients(lead: Lead): Promise<UserRecipient[]> {
  const rawService = String(lead.serviceType || "").toLowerCase();
  const serviceAliases: Record<string, string> = {
    residential: "moving",
    commercial: "moving",
    delivery: "moving",
    junk_removal: "junk",
  };
  const service = serviceAliases[rawService] || rawService;
  return db.select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(
      and(
        or(
          eq(users.role, "employee"),
          and(
            inArray(users.role, ["admin", "business_owner"]),
            sql`COALESCE(${users.capabilities}, ARRAY[]::text[]) @> ARRAY['mover']::text[]`,
          ),
        ),
        or(eq(users.status, "approved"), eq(users.status, "active")),
        or(eq(users.isApproved, true), sql`${users.isApproved} IS NULL`),
        or(eq(users.notificationsEnabled, true), sql`${users.notificationsEnabled} IS NULL`),
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%.internal'`,
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%@system.internal'`,
        service
          ? sql`(${users.acceptedJobTypes} IS NULL OR cardinality(${users.acceptedJobTypes}) = 0 OR ${users.acceptedJobTypes} @> ARRAY[${service}]::text[])`
          : sql`true`,
      ),
    );
}

async function assignedCrewRecipients(lead: Lead): Promise<UserRecipient[]> {
  const ids = new Set<string>();
  if (lead.assignedToUserId) ids.add(lead.assignedToUserId);
  if (Array.isArray(lead.crewMembers)) {
    for (const id of lead.crewMembers) {
      if (id) ids.add(id);
    }
  }
  if (ids.size === 0) return [];
  return db.select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.id, Array.from(ids)),
        or(eq(users.status, "approved"), eq(users.status, "active")),
        or(eq(users.isApproved, true), sql`${users.isApproved} IS NULL`),
        or(eq(users.notificationsEnabled, true), sql`${users.notificationsEnabled} IS NULL`),
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%.internal'`,
        sql`lower(coalesce(${users.email}, '')) NOT LIKE '%@system.internal'`,
      ),
    );
}

function uniqueRecipients(recipients: UserRecipient[]) {
  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    if (seen.has(recipient.id)) return false;
    seen.add(recipient.id);
    return true;
  });
}

async function recipientsFor(scope: RecipientScope, lead: Lead) {
  if (scope === "owners") return ownerRecipients();
  if (scope === "eligible_crew") return eligibleCrewRecipients(lead);
  const assigned = await assignedCrewRecipients(lead);
  if (scope === "assigned_crew") return assigned;
  return uniqueRecipients([...(await ownerRecipients()), ...assigned]);
}

function summarizeLead(lead: Lead) {
  return {
    id: lead.id,
    orderNumber: lead.orderNumber,
    bookingId: lead.bookingId || null,
    status: lead.status,
    customerName: customerName(lead),
    customerEmail: lead.email || null,
    customerPhone: lead.phone || null,
    serviceType: lead.serviceType,
    fromAddress: lead.confirmedFromAddress || lead.fromAddress,
    toAddress: lead.confirmedToAddress || lead.toAddress || null,
    moveDate: lead.confirmedDate || lead.moveDate || null,
    crewSize: lead.crewSize || null,
    confirmedHours: lead.confirmedHours || null,
    totalPrice: lead.totalPrice || lead.basePrice || null,
    assignedToUserId: lead.assignedToUserId || null,
    crewMembers: Array.isArray(lead.crewMembers) ? lead.crewMembers : [],
  };
}

function formatWebhookBody(url: string, payload: Record<string, unknown>) {
  const title = String(payload.title || payload.type || "JC Job Event");
  const message = String(payload.message || "");
  const lead = payload.lead && typeof payload.lead === "object"
    ? payload.lead as Record<string, unknown>
    : {};
  const order = lead.orderNumber ? `JC-${lead.orderNumber}` : lead.id || "";
  const service = lead.serviceType ? String(lead.serviceType).replace(/_/g, " ") : "job";
  const date = lead.moveDate ? String(lead.moveDate) : "date TBD";

  if (url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks")) {
    const adminUrl = typeof payload.adminUrl === "string" ? payload.adminUrl : "";
    return JSON.stringify({
      username: "JC Job Events",
      content: `**${title}**\n${message}${adminUrl ? `\n${adminUrl}` : ""}`,
      embeds: [{
        title,
        ...(adminUrl ? { url: adminUrl } : {}),
        description: message,
        color: payload.type === "job_completed" ? 0x10b981 : payload.type === "job_available" ? 0x3b82f6 : 0xf97316,
        fields: [
          { name: "Job", value: String(order || "Unknown"), inline: true },
          { name: "Service", value: service, inline: true },
          { name: "Date", value: date, inline: true },
          { name: "Customer", value: String(lead.customerName || "Customer"), inline: true },
          { name: "Status", value: String(lead.status || payload.type || "event"), inline: true },
          { name: "Source", value: String(payload.source || "job_event_bus"), inline: true },
        ],
        timestamp: String(payload.createdAt || new Date().toISOString()),
      }],
    });
  }

  if (url.includes("hooks.slack.com")) {
    return JSON.stringify({
      text: `*${title}*\n${message}\nJob: ${order || "Unknown"} | ${service} | ${date}`,
    });
  }

  return JSON.stringify(payload);
}

async function deliverWebhooks(payload: Record<string, unknown>) {
  if (webhookUrls.length === 0) return;

  await Promise.allSettled(webhookUrls.map(async (url) => {
    const body = formatWebhookBody(url, payload);
    const signature = webhookSecret
      ? crypto.createHmac("sha256", webhookSecret).update(body).digest("hex")
      : "";
    const isDiscord = url.includes("discord.com/api/webhooks") || url.includes("discordapp.com/api/webhooks");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(isDiscord ? {} : { "x-jc-event": String(payload.type || "") }),
          ...(!isDiscord && signature ? { "x-jc-signature": `sha256=${signature}` } : {}),
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        console.warn(`[jobEventBus] webhook ${url} returned ${response.status}`);
      }
    } catch (error) {
      console.error(`[jobEventBus] webhook ${url} failed:`, error instanceof Error ? error.message : error);
    } finally {
      clearTimeout(timeout);
    }
  }));
}

export function eventTypeForStatus(status: string | null | undefined): JobEventType | null {
  if (!status) return null;
  if (status === "quote_requested" || status === "new") return "quote_requested";
  if (status === "available" || status === "open") return "job_available";
  if (status === "assigned" || status === "accepted" || status === "dispatched" || status === "in_progress") return "crew_assigned";
  if (status === "completed") return "job_completed";
  return "job_updated";
}

export async function emitJobEvent(
  type: JobEventType,
  leadOrId: Lead | string,
  options: EmitJobEventOptions = {},
) {
  try {
    const lead = typeof leadOrId === "string"
      ? (await db.select().from(leads).where(eq(leads.id, leadOrId)).limit(1))[0]
      : leadOrId;
    if (!lead) return;

    const eventId = crypto.randomUUID();
    const message = messageFor(type, lead, options);
    const recipients = uniqueRecipients(await recipientsFor(message.scope, lead));
    const baseData = {
      type,
      leadId: lead.id,
      orderNumber: lead.orderNumber,
      url: adminLeadUrl(lead.id),
      adminUrl: adminLeadUrl(lead.id),
      crewUrl: crewLeadUrl(lead.id),
      source: options.source || "job_event_bus",
      previousStatus: options.previousStatus || null,
      status: options.status || lead.status || null,
      eventId,
      ...(options.extra || {}),
    };

    await Promise.allSettled(recipients.map((recipient) => notificationService.sendNotification({
      userId: recipient.id,
      type: message.notificationType as any,
      title: message.title,
      message: message.message,
      data: baseData,
    })));

    await deliverWebhooks({
      id: eventId,
      type,
      scope: message.scope,
      title: message.title,
      message: message.message,
      createdAt: new Date().toISOString(),
      actorId: options.actorId || null,
      source: options.source || "job_event_bus",
      adminUrl: absoluteAppUrl(adminLeadUrl(lead.id)),
      crewUrl: absoluteAppUrl(crewLeadUrl(lead.id)),
      lead: summarizeLead(lead),
      recipientCount: recipients.length,
      extra: options.extra || {},
    });
  } catch (error) {
    console.error("[jobEventBus] emit failed:", error instanceof Error ? error.message : error);
  }
}
