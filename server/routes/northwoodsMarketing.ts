import { Router, type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  northwoodsAvailabilityInputSchema,
  northwoodsFocusSchema,
  northwoodsReservationPatchSchema,
} from "@shared/northwoodsMarketing";
import { users } from "@shared/schema";
import { db, pool } from "../db";
import { ipRateLimit } from "../lib/persistentRateLimit";
import { generateNorthwoodsCampaign, startNorthwoodsCampaignScheduler } from "../services/northwoodsCampaigns";
import { startNorthwoodsInboxScheduler, syncNorthwoodsInbox } from "../services/northwoodsGmailImporter";
import {
  applyNorthwoodsReservationChanges,
  confirmNorthwoodsReservation,
  getNorthwoodsDashboard,
  getPublicNorthwoodsMarket,
  ignoreNorthwoodsReservation,
  patchNorthwoodsReservation,
  upsertNorthwoodsAvailability,
} from "../services/northwoodsOperations";
import {
  assertNorthwoodsOfficialUrl,
  createManualNorthwoodsSnapshot,
  getNorthwoodsScan,
  reviewNorthwoodsScan,
  runNorthwoodsMarketScan,
} from "../services/northwoodsMarketScanner";
import { auditNorthwoods, ensureNorthwoodsSchema } from "../services/northwoodsSchema";
import { logMarketingBotEvent } from "../services/marketingBot";

const router = Router();

async function requireNorthwoodsAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUser = (req as any).user || (req as any).currentUser;
    const sessionUserId = (req.session as any)?.userId;
    const user = sessionUser || (sessionUserId
      ? (await db.select().from(users).where(eq(users.id, sessionUserId)).limit(1))[0]
      : null);
    if (!user || !["admin", "business_owner"].includes(user.role || "")) {
      return res.status(403).json({ error: "Owner or admin access required" });
    }
    (req as any).northwoodsActor = user;
    return next();
  } catch {
    return res.status(500).json({ error: "Unable to verify access" });
  }
}

function actorId(req: Request) {
  return String((req as any).northwoodsActor?.id || "");
}

const scanRateLimit = ipRateLimit({
  scope: "northwoods-market-scan",
  windowMs: 15 * 60_000,
  maxHits: 8,
  message: "Too many marketplace refreshes. Review the current scan before trying again.",
  identifier: (req) => actorId(req) || req.ip || "unknown",
});

router.get("/admin/northwoods-marketing/dashboard", requireNorthwoodsAdmin, async (_req, res) => {
  try {
    res.json(await getNorthwoodsDashboard());
  } catch (error) {
    console.error("[northwoods] dashboard failed:", error instanceof Error ? error.message : error);
    res.status(500).json({ error: "Failed to load Northwoods Marketing Bot" });
  }
});

router.patch("/admin/northwoods-marketing/markets/:id", requireNorthwoodsAdmin, async (req, res) => {
  try {
    await ensureNorthwoodsSchema();
    const input = z.object({
      priority: z.number().int().min(0).max(100).optional(),
      active: z.boolean().optional(),
      profileUrl: z.string().url().optional(),
      resultsUrl: z.string().url().optional(),
      serviceBookingUrls: z.record(z.string().url()).optional(),
    }).parse(req.body || {});
    if (input.profileUrl) assertNorthwoodsOfficialUrl(input.profileUrl);
    if (input.resultsUrl) assertNorthwoodsOfficialUrl(input.resultsUrl);
    for (const url of Object.values(input.serviceBookingUrls || {})) assertNorthwoodsOfficialUrl(url);
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown, cast = "") => { values.push(value); fields.push(`${column}=$${values.length}${cast}`); };
    if (input.priority !== undefined) add("priority", input.priority);
    if (input.active !== undefined) add("active", input.active);
    if (input.profileUrl) add("profile_url", input.profileUrl);
    if (input.resultsUrl) add("results_url", input.resultsUrl);
    if (input.serviceBookingUrls) add("service_booking_urls", JSON.stringify(input.serviceBookingUrls), "::jsonb");
    if (!fields.length) return res.status(400).json({ error: "No market changes supplied" });
    values.push(req.params.id);
    const result = await pool.query(`UPDATE northwoods_markets SET ${fields.join(",")},updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ error: "Market not found" });
    await auditNorthwoods({ actorUserId: actorId(req), action: "market_updated", targetType: "market", targetId: req.params.id, metadata: input });
    res.json({ market: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid market settings", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Market update failed" });
  }
});

router.put("/admin/northwoods-marketing/markets/:id/availability", requireNorthwoodsAdmin, async (req, res) => {
  try {
    const data = northwoodsAvailabilityInputSchema.parse(req.body || {});
    res.json({ availability: await upsertNorthwoodsAvailability({ marketId: req.params.id, actorUserId: actorId(req), data }) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Check the availability details", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Availability could not be saved" });
  }
});

router.post("/admin/northwoods-marketing/scans", requireNorthwoodsAdmin, scanRateLimit, async (req, res) => {
  try {
    const input = z.object({
      marketIds: z.array(z.string().uuid()).max(6).optional(),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(req.body || {});
    res.status(201).json({ scan: await runNorthwoodsMarketScan({ ...input, actorUserId: actorId(req) }) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid scan request", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Marketplace refresh failed" });
  }
});

router.post("/admin/northwoods-marketing/scans/manual", requireNorthwoodsAdmin, async (req, res) => {
  try {
    const input = z.object({
      marketId: z.string().uuid(),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      twoHourRateCents: z.number().int().nonnegative(),
      additionalHourRateCents: z.number().int().nonnegative().nullable().optional(),
      pianoFeeCents: z.number().int().nonnegative().nullable().optional(),
      safeFeeCents: z.number().int().nonnegative().nullable().optional(),
      rating: z.number().min(0).max(5).nullable().optional(),
      reviewCount: z.number().int().nonnegative().nullable().optional(),
    }).parse(req.body || {});
    res.status(201).json({ scan: await createManualNorthwoodsSnapshot({ ...input, actorUserId: actorId(req) }) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid snapshot", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Snapshot could not be saved" });
  }
});

router.get("/admin/northwoods-marketing/scans/:id", requireNorthwoodsAdmin, async (req, res) => {
  const scan = await getNorthwoodsScan(req.params.id).catch(() => null);
  if (!scan) return res.status(404).json({ error: "Scan not found" });
  res.json({ scan });
});

router.post("/admin/northwoods-marketing/scans/:id/:decision", requireNorthwoodsAdmin, async (req, res) => {
  try {
    const decision = z.enum(["approve", "reject"]).parse(req.params.decision);
    res.json({ scan: await reviewNorthwoodsScan(req.params.id, decision === "approve" ? "approved" : "rejected", actorId(req)) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid review decision" });
    res.status(409).json({ error: error instanceof Error ? error.message : "Scan review failed" });
  }
});

router.post("/admin/northwoods-marketing/email/sync", requireNorthwoodsAdmin, async (_req, res) => {
  try {
    res.json(await syncNorthwoodsInbox());
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Dedicated inbox sync failed" });
  }
});

router.patch("/admin/northwoods-marketing/reservations/:id", requireNorthwoodsAdmin, async (req, res) => {
  try {
    const patch = northwoodsReservationPatchSchema.extend({ marketId: z.string().uuid().nullable().optional() }).parse(req.body || {});
    res.json({ reservation: await patchNorthwoodsReservation(req.params.id, patch, actorId(req)) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid reservation correction", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Reservation could not be updated" });
  }
});

router.post("/admin/northwoods-marketing/reservations/:id/confirm", requireNorthwoodsAdmin, async (req, res) => {
  try {
    res.status(201).json(await confirmNorthwoodsReservation(req.params.id, actorId(req)));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Reservation confirmation failed" });
  }
});

router.post("/admin/northwoods-marketing/reservations/:id/apply-changes", requireNorthwoodsAdmin, async (req, res) => {
  try {
    res.json({ reservation: await applyNorthwoodsReservationChanges(req.params.id, actorId(req)) });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Reservation changes were not applied" });
  }
});

router.post("/admin/northwoods-marketing/reservations/:id/ignore", requireNorthwoodsAdmin, async (req, res) => {
  try {
    res.json({ reservation: await ignoreNorthwoodsReservation(req.params.id, actorId(req)) });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Reservation could not be ignored" });
  }
});

router.post("/admin/northwoods-marketing/campaigns/generate", requireNorthwoodsAdmin, async (req, res) => {
  try {
    const input = z.object({ marketId: z.string().uuid().optional(), focus: northwoodsFocusSchema.default("auto") }).parse(req.body || {});
    res.status(201).json({ campaign: await generateNorthwoodsCampaign({ actorUserId: actorId(req), marketId: input.marketId, focus: input.focus, source: "manual" }) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid campaign request", issues: error.issues });
    res.status(409).json({ error: error instanceof Error ? error.message : "Northwoods campaign generation failed" });
  }
});

router.get("/public/northwoods/markets/:slug", async (req, res) => {
  try {
    const slug = z.string().regex(/^[a-z0-9-]{2,80}$/).parse(req.params.slug);
    const variant = z.string().trim().min(5).max(160).optional().parse(req.query.variant);
    const market = await getPublicNorthwoodsMarket(slug);
    if (!market) return res.status(404).json({ error: "Market not found" });
    if (variant) await logMarketingBotEvent({ variantCode: variant, eventType: "landing_view", metadata: { market: slug, referrer: req.get("referer") || "" } }).catch(() => undefined);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ market });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid market" });
    res.status(500).json({ error: "Market could not be loaded" });
  }
});

router.get("/public/northwoods/redirect/:slug/:focus", async (req, res) => {
  try {
    const slug = z.string().regex(/^[a-z0-9-]{2,80}$/).parse(req.params.slug);
    const focus = northwoodsFocusSchema.exclude(["auto", "piano_safe"]).parse(req.params.focus);
    const variant = z.string().trim().min(5).max(160).optional().parse(req.query.variant);
    const market = await getPublicNorthwoodsMarket(slug);
    if (!market) return res.status(404).send("Market not found");
    const destination = assertNorthwoodsOfficialUrl(market.bookingUrls[focus] || market.bookingUrls.loading).toString();
    if (variant) await logMarketingBotEvent({ variantCode: variant, eventType: "booking_click", metadata: { market: slug, focus } }).catch(() => undefined);
    res.set("Cache-Control", "no-store");
    res.redirect(302, destination);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).send("Invalid booking destination");
    res.status(500).send("Booking destination could not be opened");
  }
});

startNorthwoodsInboxScheduler();
startNorthwoodsCampaignScheduler();

export default router;
