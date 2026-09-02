import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  COMMERCE_TERMS_VERSION,
  commerceAdjustmentRequestSchema,
  commerceCatalogItemUpdateSchema,
  commerceCheckoutSchema,
  commercePromotionSchema,
  commerceTermsText,
  commerceVariationUpdateSchema,
} from "@shared/commerceCatalog";
import { users } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { ipRateLimit } from "../lib/persistentRateLimit";
import {
  buildCommerceCatalogSnapshot,
  createPublicationPreview,
  ensureCommerceCatalogInfrastructure,
  getNextCommercePublicationRevision,
  getPublicCommerceOffers,
  listCommerceCatalog,
  listCommercePromotions,
  listCommercePublications,
  listSquareMappings,
  saveCommercePromotion,
  updateCommerceItem,
  updateCommerceVariation,
} from "../services/commerceCatalog";
import {
  createCommerceAdjustment,
  createCommerceCheckout,
  listCommerceAdjustments,
  reviewCommerceAdjustment,
} from "../services/commerceCheckout";
import {
  listSquareCatalogForAdmin,
  previewSquareCatalogDiff,
  publishSquareCatalogPublication,
  scanSquareCatalogDrift,
} from "../services/commerceSquareCatalog";
import { squareConfigSummary } from "../services/squareConfig";

const router = Router();

async function commerceOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionUser = (req as any).user || (req as any).currentUser;
    const userId = (req.session as any)?.userId;
    const user = sessionUser || (userId
      ? (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0]
      : null);
    const allowed = user && (["admin", "business_owner"].includes(user.role || "")
      || String(user.email || "").toLowerCase() === "upmichiganstatemovers@gmail.com");
    if (!allowed) return res.status(403).json({ error: "Owner or admin access required" });
    (req as any).commerceActor = user;
    return next();
  } catch (error) {
    console.error("[commerce-catalog] access check failed:", error);
    return res.status(500).json({ error: "Unable to verify catalog access" });
  }
}

function actorId(req: Request): string | null {
  return String((req as any).commerceActor?.id || (req.user as any)?.id || (req.session as any)?.userId || "") || null;
}

function respondError(res: Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: fallback, issues: error.issues });
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found|unavailable/i.test(message) ? 404
    : /requires a quote|not been published|cannot be published|invalid|expired|fixed price/i.test(message) ? 409
      : 500;
  return res.status(status).json({ error: message });
}

const checkoutLimit = ipRateLimit({
  scope: "commerce-checkout",
  windowMs: 15 * 60 * 1000,
  maxHits: 12,
  message: "Too many checkout attempts. Please wait and try again.",
  identifier: (req) => String(req.ip || req.headers["x-forwarded-for"] || "unknown"),
});

router.get("/catalog/terms", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({ version: COMMERCE_TERMS_VERSION, text: commerceTermsText() });
});

router.get("/catalog/offers", async (_req, res) => {
  try {
    const catalog = await getPublicCommerceOffers();
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json(catalog);
  } catch (error) {
    return respondError(res, error, "Unable to load offers");
  }
});

router.get("/catalog/offers/:code", async (req, res) => {
  try {
    const catalog = await getPublicCommerceOffers();
    const item = catalog.items.find((candidate) => candidate.code === req.params.code);
    if (!item) return res.status(404).json({ error: "Offer not found" });
    return res.json({ revision: catalog.revision, item });
  } catch (error) {
    return respondError(res, error, "Unable to load offer");
  }
});

router.post("/catalog/checkout", checkoutLimit, async (req, res) => {
  try {
    const parsed = commerceCheckoutSchema.parse(req.body);
    const result = await createCommerceCheckout(parsed);
    return res.status(result.replayed ? 200 : 201).json(result);
  } catch (error) {
    return respondError(res, error, "Unable to create checkout");
  }
});

router.post("/bookings/:id/adjustment-requests", async (req, res) => {
  try {
    const parsed = commerceAdjustmentRequestSchema.parse(req.body);
    const accessToken = String(req.headers["x-checkout-access-token"] || req.body?.accessToken || "");
    if (!accessToken) return res.status(401).json({ error: "Checkout access token is required" });
    const result = await createCommerceAdjustment({
      checkoutId: req.params.id,
      accessToken,
      type: parsed.type,
      requestedServiceDate: parsed.requestedServiceDate,
      replacementOfferCode: parsed.replacementOfferCode,
      reason: parsed.reason,
      termsVersion: parsed.termsVersion,
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request adjustment";
    if (/access could not be verified/i.test(message)) return res.status(401).json({ error: message });
    return respondError(res, error, "Unable to request adjustment");
  }
});

router.get("/admin/catalog", isAuthenticated, commerceOwner, async (_req, res) => {
  try {
    const [items, promotions, publications, mappings] = await Promise.all([
      listCommerceCatalog(), listCommercePromotions(), listCommercePublications(), listSquareMappings(),
    ]);
    return res.json({
      items, promotions, publications, mappings,
      terms: { version: COMMERCE_TERMS_VERSION, text: commerceTermsText() },
      square: squareConfigSummary(),
    });
  } catch (error) {
    return respondError(res, error, "Unable to load the commerce catalog");
  }
});

router.patch("/admin/catalog/items/:code", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    const updates = commerceCatalogItemUpdateSchema.parse(req.body);
    const item = await updateCommerceItem(req.params.code, updates, actorId(req));
    if (!item) return res.status(404).json({ error: "Catalog item not found" });
    return res.json({ item });
  } catch (error) {
    return respondError(res, error, "Unable to update catalog item");
  }
});

router.patch("/admin/catalog/variations/:code", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    const updates = commerceVariationUpdateSchema.parse(req.body);
    const variation = await updateCommerceVariation(req.params.code, updates, actorId(req));
    if (!variation) return res.status(404).json({ error: "Catalog variation not found" });
    return res.json({ variation });
  } catch (error) {
    return respondError(res, error, "Unable to update catalog variation");
  }
});

async function savePromotion(req: Request, res: Response) {
  try {
    const promotion = commercePromotionSchema.parse(req.body);
    return res.status(req.method === "POST" ? 201 : 200).json({ promotion: await saveCommercePromotion(promotion, actorId(req)) });
  } catch (error) {
    return respondError(res, error, "Unable to save promotion");
  }
}

router.post("/admin/promotions", isAuthenticated, commerceOwner, savePromotion);
router.put("/admin/promotions/:code", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    const promotion = commercePromotionSchema.parse({ ...req.body, code: req.params.code });
    return res.json({ promotion: await saveCommercePromotion(promotion, actorId(req)) });
  } catch (error) {
    return respondError(res, error, "Unable to save promotion");
  }
});

router.post("/admin/catalog/publications/preview", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    const revision = await getNextCommercePublicationRevision();
    const { snapshot } = await buildCommerceCatalogSnapshot();
    const diff = await previewSquareCatalogDiff(snapshot, revision);
    const publication = await createPublicationPreview({ actorId: actorId(req), diff, revision });
    return res.status(201).json({
      publication: {
        id: publication.id, revision: Number(publication.revision), status: publication.status,
        snapshotHash: publication.snapshot_hash, createdAt: publication.created_at,
      },
      diff,
    });
  } catch (error) {
    return respondError(res, error, "Unable to preview catalog publication");
  }
});

router.post("/admin/catalog/publications/:id/publish", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    if (req.body?.confirm !== true) return res.status(400).json({ error: "Owner confirmation is required" });
    const result = await publishSquareCatalogPublication(req.params.id, actorId(req));
    return res.json(result);
  } catch (error) {
    return respondError(res, error, "Unable to publish catalog");
  }
});

router.get("/admin/catalog/square", isAuthenticated, commerceOwner, async (_req, res) => {
  try {
    return res.json({ items: await listSquareCatalogForAdmin() });
  } catch (error) {
    return respondError(res, error, "Unable to load Square catalog");
  }
});

router.get("/admin/catalog/drift", isAuthenticated, commerceOwner, async (_req, res) => {
  try {
    return res.json(await scanSquareCatalogDrift());
  } catch (error) {
    return respondError(res, error, "Unable to check Square catalog drift");
  }
});

router.get("/admin/catalog/marketing-offers", isAuthenticated, commerceOwner, async (_req, res) => {
  try {
    const catalog = await getPublicCommerceOffers();
    return res.json({
      revision: catalog.revision,
      offers: catalog.items.filter((item) => item.advertisingEnabled).map((item) => ({
        offerCode: item.code,
        name: item.name,
        description: item.description,
        category: item.category,
        purchaseMode: item.purchaseMode,
        price: item.price,
        priceLabel: item.price == null ? "Get a quote" : `From $${item.price.toFixed(2)}`,
        href: `/offers/${item.code}`,
      })),
    });
  } catch (error) {
    return respondError(res, error, "Unable to load marketing offers");
  }
});

router.get("/admin/adjustment-requests", isAuthenticated, commerceOwner, async (_req, res) => {
  try {
    return res.json({ requests: await listCommerceAdjustments() });
  } catch (error) {
    return respondError(res, error, "Unable to load adjustment requests");
  }
});

const reviewSchema = z.object({ decision: z.enum(["approve", "reject"]), notes: z.string().trim().max(2000).nullable().optional() });
router.patch("/admin/adjustment-requests/:id", isAuthenticated, commerceOwner, async (req, res) => {
  try {
    const parsed = reviewSchema.parse(req.body);
    const request = await reviewCommerceAdjustment({ id: req.params.id, actorId: actorId(req), decision: parsed.decision, notes: parsed.notes });
    return res.json({ request, executionRequired: parsed.decision === "approve" });
  } catch (error) {
    return respondError(res, error, "Unable to review adjustment request");
  }
});

ensureCommerceCatalogInfrastructure().catch((error) => {
  console.error("[commerce-catalog] infrastructure initialization failed:", error);
});

export default router;
