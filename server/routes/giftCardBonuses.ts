import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { ipRateLimit } from "../lib/persistentRateLimit";
import {
  acceptGiftCardBonus,
  assignGiftCardBonus,
  getGiftCardBonusReadiness,
  getPublicGiftCardBonusConfig,
  listGiftCardBonuses,
  listUserGiftCardBonuses,
  reconcileGiftCardBonusOrder,
  resendGiftCardBonusClaimByEmail,
  resendGiftCardBonusClaimById,
  resolveGiftCardBonusClaim,
  runGiftCardBonusSweep,
} from "../services/giftCardBonuses";

const router = Router();

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

const tokenSchema = z.string().min(32).max(256);
const emailSchema = z.string().trim().email().max(320);

function ownerOnly(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (user && (user.role === "admin" || user.role === "business_owner" || user.email?.toLowerCase() === "upmichiganstatemovers@gmail.com")) {
    return next();
  }
  return res.status(403).json({ error: "Business owner access required" });
}

const claimRateLimit = ipRateLimit({
  scope: "gift-card-bonus-claim",
  windowMs: 15 * 60 * 1000,
  maxHits: 30,
});

const resendRateLimit = ipRateLimit({
  scope: "gift-card-bonus-resend",
  windowMs: 60 * 60 * 1000,
  maxHits: 5,
});

router.get("/public/gift-card-bonus-config", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(getPublicGiftCardBonusConfig());
});

router.post("/gift-card-bonuses/resolve", claimRateLimit, asyncRoute(async (req, res) => {
  const parsed = z.object({ token: tokenSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "A valid claim link is required." });
  const claim = await resolveGiftCardBonusClaim(parsed.data.token);
  if (!claim) return res.status(404).json({ error: "This bonus link is invalid or has expired." });
  return res.json({ claim });
}));

router.post("/gift-card-bonuses/assign", claimRateLimit, asyncRoute(async (req, res) => {
  const parsed = z.discriminatedUnion("destination", [
    z.object({ token: tokenSchema, destination: z.literal("buyer") }),
    z.object({ token: tokenSchema, destination: z.literal("recipient"), recipientEmail: emailSchema }),
  ]).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose yourself or enter a valid recipient email." });
  try {
    const claim = await assignGiftCardBonus(parsed.data);
    return res.json({ claim });
  } catch (error) {
    return res.status(409).json({ error: (error as Error).message });
  }
}));

router.post("/gift-card-bonuses/accept", isAuthenticated, asyncRoute(async (req, res) => {
  const parsed = z.object({ token: tokenSchema }).safeParse(req.body);
  if (!parsed.success || !req.user?.id || !req.user.email) return res.status(400).json({ error: "A valid invitation is required." });
  try {
    const claim = await acceptGiftCardBonus({ token: parsed.data.token, userId: req.user.id, userEmail: req.user.email });
    return res.json({ claim });
  } catch (error) {
    return res.status(409).json({ error: (error as Error).message });
  }
}));

router.post("/gift-card-bonuses/resend", resendRateLimit, asyncRoute(async (req, res) => {
  const parsed = z.object({ buyerEmail: emailSchema }).safeParse(req.body);
  if (parsed.success) await resendGiftCardBonusClaimByEmail(parsed.data.buyerEmail).catch(() => 0);
  return res.json({ message: "If that email has an eligible gift-card bonus, a fresh link has been sent." });
}));

router.get("/gift-card-bonuses/mine", isAuthenticated, asyncRoute(async (req, res) => {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required" });
  return res.json({ bonuses: await listUserGiftCardBonuses(req.user.id) });
}));

router.get("/admin/gift-card-bonuses", isAuthenticated, ownerOnly, asyncRoute(async (req, res) => {
  const limit = Number(req.query.limit || 100);
  return res.json({ readiness: getGiftCardBonusReadiness(), bonuses: await listGiftCardBonuses(limit) });
}));

router.post("/admin/gift-card-bonuses/:id/resend", isAuthenticated, ownerOnly, asyncRoute(async (req, res) => {
  const sent = await resendGiftCardBonusClaimById(req.params.id);
  return res.json({ sent });
}));

router.post("/admin/gift-card-bonuses/:orderId/reconcile", isAuthenticated, ownerOnly, asyncRoute(async (req, res) => {
  await reconcileGiftCardBonusOrder(req.params.orderId);
  return res.json({ reconciled: true });
}));

router.post("/admin/gift-card-bonuses/sweep", isAuthenticated, ownerOnly, asyncRoute(async (_req, res) => {
  return res.json(await runGiftCardBonusSweep());
}));

export default router;
