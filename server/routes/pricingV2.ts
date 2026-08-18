import { Router, type NextFunction, type Request, type Response } from "express";
import { ZodError, z } from "zod";
import { canonicalPricingSnapshotSchema } from "@shared/canonicalPricing";
import { isAuthenticated } from "../auth";
import {
  activatePricingVersion,
  createPricingVersion,
  getActivePricingSnapshot,
  getPricingSnapshotByCode,
  listPricingVersions,
  shadowComparePricingVersion,
} from "../services/pricingVersions";

const router = Router();

function ownerOnly(req: Request, res: Response, next: NextFunction) {
  const role = String((req.session as any)?.userRole || (req.user as any)?.role || "");
  const email = String((req.session as any)?.userEmail || (req.user as any)?.email || "").toLowerCase();
  if (role !== "business_owner" && email !== "upmichiganstatemovers@gmail.com") {
    return res.status(403).json({ error: "Business-owner access required" });
  }
  next();
}

function actorFrom(req: Request) {
  return {
    userId: String((req.user as any)?.id || (req.session as any)?.userId || "") || null,
    email: String((req.user as any)?.email || (req.session as any)?.userEmail || "") || null,
  };
}

router.get("/pricing/v2", async (_req, res) => {
  const active = await getActivePricingSnapshot();
  return res.json({
    ...active.snapshot,
    versionId: active.versionId,
    source: active.source,
    fallbackUsed: active.source === "fallback",
  });
});

router.get("/admin/pricing/versions", isAuthenticated, ownerOnly, async (_req, res) => {
  try {
    return res.json({ versions: await listPricingVersions() });
  } catch (error) {
    console.error("[pricingV2] list failed:", error);
    return res.status(500).json({ error: "Failed to list pricing versions" });
  }
});

router.get("/admin/pricing/versions/:code/preview", isAuthenticated, ownerOnly, async (req, res) => {
  try {
    const result = await getPricingSnapshotByCode(req.params.code);
    if (!result) return res.status(404).json({ error: "Pricing version not found" });
    return res.json({
      ...result.snapshot,
      versionId: result.versionId,
      source: result.source,
    });
  } catch (error) {
    console.error("[pricingV2] preview failed:", error);
    return res.status(500).json({ error: "Failed to preview pricing version" });
  }
});

router.post("/admin/pricing/versions/:code/shadow-compare", isAuthenticated, ownerOnly, async (req, res) => {
  try {
    const limit = z.coerce.number().int().min(1).max(50).default(20).parse(req.body?.limit ?? 20);
    return res.json(await shadowComparePricingVersion(req.params.code, limit, actorFrom(req)));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: "Invalid shadow sample size", details: error.errors });
    if (String((error as Error)?.message || "").includes("was not found")) {
      return res.status(404).json({ error: "Pricing version not found" });
    }
    console.error("[pricingV2] shadow comparison failed:", error);
    return res.status(500).json({ error: "Failed to compare recent quotes" });
  }
});

const createVersionSchema = z.object({
  snapshot: canonicalPricingSnapshotSchema,
  notes: z.string().trim().max(1000).optional().nullable(),
});

router.post("/admin/pricing/versions/validate", isAuthenticated, ownerOnly, (req, res) => {
  try {
    const parsed = createVersionSchema.parse(req.body);
    return res.json({ valid: true, snapshot: parsed.snapshot });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ valid: false, error: "Invalid pricing version", details: error.errors });
    }
    return res.status(400).json({ valid: false, error: "Invalid pricing version" });
  }
});

router.post("/admin/pricing/versions", isAuthenticated, ownerOnly, async (req, res) => {
  try {
    const parsed = createVersionSchema.parse(req.body);
    const version = await createPricingVersion(parsed.snapshot, parsed.notes ?? null, actorFrom(req));
    return res.status(201).json({ version });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid pricing version", details: error.errors });
    }
    if ((error as any)?.code === "23505") {
      return res.status(409).json({ error: "Pricing version code already exists" });
    }
    console.error("[pricingV2] create failed:", error);
    return res.status(500).json({ error: "Failed to create pricing version" });
  }
});

async function activate(req: Request, res: Response) {
  try {
    const version = await activatePricingVersion(req.params.code, actorFrom(req));
    return res.json({ ok: true, version });
  } catch (error) {
    const message = String((error as Error)?.message || "");
    if (message.includes("was not found")) {
      return res.status(404).json({ error: "Pricing version not found" });
    }
    if (message.includes("shadow comparison")) {
      return res.status(409).json({ error: message });
    }
    if (error instanceof ZodError) {
      return res.status(409).json({ error: "Pricing version is incomplete", details: error.errors });
    }
    console.error("[pricingV2] activation failed:", error);
    return res.status(500).json({ error: "Failed to activate pricing version" });
  }
}

router.post("/admin/pricing/versions/:code/publish", isAuthenticated, ownerOnly, activate);
router.post("/admin/pricing/versions/:code/rollback", isAuthenticated, ownerOnly, activate);

export default router;
