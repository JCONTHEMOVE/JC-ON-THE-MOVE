import { generateText, Output } from "ai";
import { z } from "zod";
import { pool } from "../db";
import { sendEmail } from "./email";
import { ensureAshleyShopSchema } from "./ashleyShopSchema";

const reportSchema = z.object({
  headline: z.string().max(180),
  summary: z.string().max(1_200),
  actions: z.array(z.object({
    title: z.string().max(160),
    reason: z.string().max(500),
    authority: z.enum(["automatic", "ashley_approval", "owner_approval"]),
  })).min(1).max(7),
  risks: z.array(z.string().max(300)).max(5),
});

function localParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, weekday: value("weekday"), hour: Number(value("hour")) };
}

async function metrics(days: number) {
  const [inventory, drafts, orders] = await Promise.all([
    pool.query(`SELECT count(*) FILTER (WHERE status='active' AND in_stock=true)::int AS active,
                       count(*) FILTER (WHERE status='sold')::int AS sold,
                       count(*)::int AS total FROM jewelry_items`),
    pool.query(`SELECT status, count(*)::int AS count FROM ashley_shop_listing_drafts GROUP BY status`),
    pool.query(`SELECT count(*)::int AS paid_orders, COALESCE(sum(due_now_cents),0)::int AS revenue_cents,
                       COALESCE(sum(discount_cents),0)::int AS discounts_cents,
                       COALESCE(sum(reward_moves),0)::int AS reward_moves
                  FROM commerce_orders WHERE status='paid' AND paid_at > now() - ($1 || ' days')::interval`, [days]),
  ]);
  return { periodDays: days, inventory: inventory.rows[0], drafts: drafts.rows, orders: orders.rows[0], targetListings: 500 };
}

async function writeReport(kind: "daily" | "weekly", data: unknown) {
  const models = Array.from(new Set([
    process.env.ASHLEY_SHOP_EXECUTIVE_MODEL || "spacexai/grok-4.6",
    process.env.ASHLEY_SHOP_EXECUTIVE_FALLBACK_MODEL || "openai/gpt-5.6-terra",
  ]));
  for (const model of models) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: reportSchema }),
        temperature: 0.2,
        prompt: `Act as a careful retail chief-of-staff for Handmade Jewels by Ashley. Create a ${kind} owner report from these server metrics: ${JSON.stringify(data)}. Pricing, publishing, public campaigns, and custom discounts require human approval. Automatic authority is limited to sorting photos, drafting listings, rotating the configured feature, and reporting. Be warm, concise, and practical.`,
      });
      if (result.output) return { ...result.output, model };
    } catch (error) {
      console.warn(`[Ashley executive] ${model} failed`, error instanceof Error ? error.message : error);
    }
  }
  const active = Number((data as any)?.inventory?.active || 0);
  return {
    headline: `${active} active handmade pieces; ${Math.max(0, 500 - active)} to the 500-item target`,
    summary: "The catalog pipeline is operating with approval gates for prices and publishing.",
    actions: [{ title: "Review ready drafts", reason: "Final prices and Ashley's approval are required before publishing.", authority: "ashley_approval" as const }],
    risks: ["Review low-confidence material descriptions before approval."],
    model: "deterministic-fallback",
  };
}

export async function runAshleyExecutiveDigest(kind: "daily" | "weekly", force = false) {
  await ensureAshleyShopSchema();
  const local = localParts();
  if (!force && (local.hour < 8 || (kind === "weekly" && local.weekday !== "Mon"))) return { sent: false, reason: "outside_schedule" };
  const actionType = `executive_${kind}_email`;
  const existing = await pool.query(
    `SELECT id FROM ashley_shop_ai_audit
      WHERE action_type = $1 AND status = 'sent'
        AND (created_at AT TIME ZONE 'America/Chicago')::date = $2::date LIMIT 1`,
    [actionType, local.date],
  );
  if (!force && existing.rows[0]) return { sent: false, reason: "already_sent" };
  const data = await metrics(kind === "daily" ? 1 : 7);
  const report = await writeReport(kind, data);
  const audit = await pool.query<{ id: string }>(
    `INSERT INTO ashley_shop_ai_audit
      (action_type, authority_tier, status, model_id, input_summary, output_summary, requires_approval)
     VALUES ($1, 'tier_1_report_only', 'dispatching', $2, $3::jsonb, $4::jsonb, false) RETURNING id`,
    [actionType, report.model, JSON.stringify(data), JSON.stringify(report)],
  );
  const actionHtml = report.actions.map((action) => `<li><strong>${action.title}</strong> — ${action.reason} <em>(${action.authority.replace("_", " ")})</em></li>`).join("");
  const riskHtml = report.risks.length ? `<h3>Watch list</h3><ul>${report.risks.map((risk) => `<li>${risk}</li>`).join("")}</ul>` : "";
  const sent = await sendEmail({
    to: process.env.ASHLEY_SHOP_AUTHORIZED_SENDER || "ashleyseegert64@gmail.com",
    from: process.env.ASHLEY_SHOP_MAILBOX || process.env.COMPANY_EMAIL,
    replyTo: process.env.ASHLEY_SHOP_INTAKE_ALIAS || "ashleyseegert64+shop@gmail.com",
    subject: `Ashley Shop ${kind === "daily" ? "daily actions" : "weekly CEO report"}: ${report.headline}`,
    text: `${report.headline}\n\n${report.summary}\n\n${report.actions.map((action) => `- ${action.title}: ${action.reason} (${action.authority})`).join("\n")}\n\n${report.risks.join("\n")}`,
    html: `<h2>${report.headline}</h2><p>${report.summary}</p><h3>Recommended actions</h3><ul>${actionHtml}</ul>${riskHtml}<p><a href="${process.env.PUBLIC_APP_URL || "https://www.jconthemove.com"}/ashley-shop-admin">Open Ashley's shop dashboard</a></p>`,
  });
  await pool.query("UPDATE ashley_shop_ai_audit SET status = $2 WHERE id = $1", [audit.rows[0].id, sent ? "sent" : "failed"]);
  return { sent, report };
}
