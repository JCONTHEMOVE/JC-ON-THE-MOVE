import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import {
  approveQuoteRevision,
  getLatestQuoteRevision,
  getQuoteRevision,
  listQuoteRevisions,
  saveQuoteDraft,
} from "../services/quoteRevisions";

const router = Router();

const lineItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  serviceCode: z.string().trim().max(80).optional().nullable(),
  quantity: z.coerce.number().positive().max(10_000).default(1),
  unitPrice: z.coerce.number().nonnegative().max(1_000_000),
  total: z.coerce.number().nonnegative().max(10_000_000).optional(),
  discountEligible: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

const draftSchema = z.object({
  lineItems: z.array(lineItemSchema).max(100).optional(),
  discountTotal: z.coerce.number().nonnegative().max(10_000_000).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  serviceDate: z.string().trim().max(50).optional().nullable(),
});

const approveSchema = z.object({
  overrideReason: z.string().trim().max(2000).optional().nullable(),
});

async function actorFor(req: Request) {
  const userId = String((req as any).currentUser?.id || (req.user as any)?.id || (req.session as any)?.userId || "");
  if (!userId) return null;
  const { rows } = await pool.query<{
    id: string;
    email: string | null;
    role: string;
    status: string;
    authority_tier: string | null;
  }>(`
    SELECT u.id, u.email, u.role, u.status, wp.authority_tier
    FROM users u
    LEFT JOIN worker_profiles wp ON wp.user_id = u.id
    WHERE u.id=$1 LIMIT 1
  `, [userId]);
  const user = rows[0];
  if (!user || !["approved", "active"].includes(String(user.status || "").toLowerCase()) && !["admin", "business_owner"].includes(user.role)) {
    return null;
  }
  const owner = user.role === "business_owner"
    || user.email === "upmichiganstatemovers@gmail.com";
  const rank: Record<string, number> = { worker: 0, bronze: 1, silver: 2, gold: 3, platinum: 4 };
  return {
    userId: user.id,
    email: user.email,
    isOwner: owner,
    canApproveStandard: owner || user.role === "admin"
      || (rank[user.authority_tier || "worker"] || 0) >= rank.gold,
  };
}

function routeError(res: Response, error: unknown) {
  if (error instanceof ZodError) return res.status(400).json({ error: "Invalid quote data", details: error.errors });
  const message = error instanceof Error ? error.message : "Quote request failed";
  if (message.includes("not found")) return res.status(404).json({ error: message });
  if (/required|Only|cannot be approved|exceeds/.test(message)) return res.status(403).json({ error: message });
  return res.status(400).json({ error: message });
}

router.get("/leads/:leadId/quotes", isAuthenticated, async (req, res) => {
  try {
    const actor = await actorFor(req);
    if (!actor) return res.status(403).json({ error: "Approved staff access required" });
    return res.json({ quotes: await listQuoteRevisions(req.params.leadId) });
  } catch (error) {
    return routeError(res, error);
  }
});

router.get("/quotes/:quoteId", isAuthenticated, async (req, res) => {
  try {
    const actor = await actorFor(req);
    if (!actor) return res.status(403).json({ error: "Approved staff access required" });
    const quote = await getQuoteRevision(req.params.quoteId);
    if (!quote) return res.status(404).json({ error: "Quote revision not found" });
    return res.json({ quote });
  } catch (error) {
    return routeError(res, error);
  }
});

router.post("/leads/:leadId/quotes/draft", isAuthenticated, async (req, res) => {
  try {
    const actor = await actorFor(req);
    if (!actor) return res.status(403).json({ error: "Approved staff access required" });
    const input = draftSchema.parse(req.body || {});
    const quote = await saveQuoteDraft({
      leadId: req.params.leadId,
      actorUserId: actor.userId,
      ...input,
    });
    return res.status(201).json({ quote });
  } catch (error) {
    return routeError(res, error);
  }
});

router.patch("/quotes/:quoteId", isAuthenticated, async (req, res) => {
  try {
    const actor = await actorFor(req);
    if (!actor) return res.status(403).json({ error: "Approved staff access required" });
    const input = draftSchema.parse(req.body || {});
    const existing = await getQuoteRevision(req.params.quoteId);
    if (!existing) return res.status(404).json({ error: "Quote revision not found" });
    const latest = await getLatestQuoteRevision(existing.leadId);
    if (!latest || latest.id !== existing.id) return res.status(409).json({ error: "Only the latest quote revision can be edited" });
    const quote = await saveQuoteDraft({
      leadId: existing.leadId,
      actorUserId: actor.userId,
      ...input,
      lineItems: input.lineItems ?? existing.lineItems,
      discountTotal: input.discountTotal ?? existing.discountTotal,
      notes: input.notes === undefined ? existing.notes : input.notes,
    });
    return res.json({ quote });
  } catch (error) {
    return routeError(res, error);
  }
});

router.post("/quotes/:quoteId/approve", isAuthenticated, async (req, res) => {
  try {
    const actor = await actorFor(req);
    if (!actor) return res.status(403).json({ error: "Approved staff access required" });
    const input = approveSchema.parse(req.body || {});
    const quote = await approveQuoteRevision({ quoteId: req.params.quoteId, actor, overrideReason: input.overrideReason });
    return res.json({ quote });
  } catch (error) {
    return routeError(res, error);
  }
});

export default router;
