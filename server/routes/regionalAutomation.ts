import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { crewCloseoutSubmissionSchema } from "@shared/regionalAutomation";
import { ensureRegionalAutomationSchema } from "../services/regionalAutomationMigration";
import { listPublicServiceAreaCapabilities } from "../services/serviceAreaEligibility";
import {
  approveCustomerCloseout,
  approveAuthenticatedCustomerCloseout,
  getCustomerCloseout,
  getAuthenticatedCustomerCloseout,
  ownerApproveCloseout,
  rejectCustomerCloseout,
  rejectAuthenticatedCustomerCloseout,
  submitJobCloseout,
} from "../services/jobCloseout";
import { acceptCrewSlotOffer, declineCrewSlotOffer } from "../dispatch/multiSlot";

const router = Router();

async function currentUser(req: any) {
  const id = req.currentUser?.id || req.user?.id || req.session?.userId;
  return id ? storage.getUser(id) : null;
}

async function requireRole(req: any, res: Response, roles: string[]) {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  if (!roles.includes(user.role || "")) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  return user;
}

router.get("/service-areas/capabilities", async (_req, res) => {
  try {
    res.json({ areas: await listPublicServiceAreaCapabilities() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not load service areas" });
  }
});

router.get("/admin/service-areas", isAuthenticated, async (req: any, res) => {
  if (!(await requireRole(req, res, ["admin", "business_owner"]))) return;
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query(`SELECT * FROM service_area_capabilities ORDER BY state_code, locality, name`);
  res.json({ areas: rows });
});

const serviceAreaUpdateSchema = z.object({
  verificationStatus: z.enum(["pending", "verified", "suspended"]).optional(),
  autoBookEnabled: z.boolean().optional(),
  adsEnabled: z.boolean().optional(),
  serviceTypes: z.array(z.string().trim().min(1)).max(30).optional(),
  truckModes: z.array(z.string().trim().min(1)).max(10).optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
});

router.patch("/admin/service-areas/:code", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["admin", "business_owner"]);
  if (!user) return;
  try {
    await ensureRegionalAutomationSchema();
    const input = serviceAreaUpdateSchema.parse(req.body);
    if (input.autoBookEnabled === true && input.verificationStatus && input.verificationStatus !== "verified") {
      return res.status(409).json({ error: "A pending or suspended area cannot have automatic booking enabled" });
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => { values.push(value); fields.push(`${column}=$${values.length}`); };
    if (input.verificationStatus !== undefined) add("verification_status", input.verificationStatus);
    if (input.autoBookEnabled !== undefined) add("auto_book_enabled", input.autoBookEnabled);
    else if (input.verificationStatus && input.verificationStatus !== "verified") add("auto_book_enabled", false);
    if (input.adsEnabled !== undefined) add("ads_enabled", input.adsEnabled);
    if (input.serviceTypes !== undefined) add("service_types", input.serviceTypes);
    if (input.truckModes !== undefined) add("truck_modes", input.truckModes);
    if (input.notes !== undefined) add("notes", input.notes);
    if (!fields.length) return res.status(400).json({ error: "No changes supplied" });
    if (input.autoBookEnabled === true && input.verificationStatus !== "verified") {
      const current = await pool.query<{ verification_status: string }>(`SELECT verification_status FROM service_area_capabilities WHERE code=$1`, [req.params.code]);
      if (current.rows[0]?.verification_status !== "verified") {
        return res.status(409).json({ error: "Verify the operating area before enabling automatic booking" });
      }
    }
    if (input.verificationStatus === "verified") {
      add("verified_at", new Date());
      add("verified_by_user_id", user.id);
    }
    add("updated_at", new Date());
    values.push(req.params.code);
    const updated = await pool.query(
      `UPDATE service_area_capabilities SET ${fields.join(", ")} WHERE code=$${values.length} RETURNING *`,
      values,
    );
    if (!updated.rows[0]) return res.status(404).json({ error: "Service area not found" });
    res.json({ area: updated.rows[0] });
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: "Invalid service-area update", details: error.errors });
    res.status(500).json({ error: error instanceof Error ? error.message : "Could not update service area" });
  }
});

router.get("/crew/offers", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["employee", "admin", "business_owner"]);
  if (!user) return;
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query(
    `SELECT o.id, o.lead_id, o.slot_key, o.role_on_job, o.requires_driver, o.score,
            o.distance_miles, o.reasons, o.expires_at,
            l.first_name, l.last_name, l.service_type, l.confirmed_date, l.move_date,
            l.from_address, l.to_address, l.total_price, l.crew_size
       FROM dispatch_offers o
       JOIN leads l ON l.id=o.lead_id
      WHERE o.worker_id=$1 AND o.status='offered' AND o.expires_at>NOW()
      ORDER BY o.expires_at ASC`,
    [user.id],
  );
  res.json({ offers: rows });
});

router.post("/crew/offers/:offerId/accept", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["employee", "admin", "business_owner"]);
  if (!user) return;
  const found = await pool.query<{ lead_id: string }>(`SELECT lead_id FROM dispatch_offers WHERE id=$1 AND worker_id=$2`, [req.params.offerId, user.id]);
  if (!found.rows[0]) return res.status(404).json({ error: "Offer not found" });
  const result = await acceptCrewSlotOffer(found.rows[0].lead_id, user.id);
  res.status(result.ok ? 200 : 409).json(result);
});

router.post("/crew/offers/:offerId/decline", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["employee", "admin", "business_owner"]);
  if (!user) return;
  const found = await pool.query<{ lead_id: string }>(`SELECT lead_id FROM dispatch_offers WHERE id=$1 AND worker_id=$2`, [req.params.offerId, user.id]);
  if (!found.rows[0]) return res.status(404).json({ error: "Offer not found" });
  const result = await declineCrewSlotOffer(found.rows[0].lead_id, user.id);
  res.status(result.ok ? 200 : 409).json(result);
});

router.post("/crew/jobs/:id/closeout", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["employee", "admin", "business_owner"]);
  if (!user) return;
  try {
    const data = crewCloseoutSubmissionSchema.parse(req.body);
    res.json(await submitJobCloseout({ leadId: req.params.id, submittedByUserId: user.id, data }));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: "Check the closeout details", details: error.errors });
    const message = error instanceof Error ? error.message : "Could not submit closeout";
    res.status(/assigned|not found|required/i.test(message) ? 400 : 500).json({ error: message });
  }
});

router.get("/job-closeouts/:token", async (req, res) => {
  try {
    const closeout = await getCustomerCloseout(req.params.token);
    res.json({ closeout });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Closeout not found" });
  }
});

router.post("/job-closeouts/:token/approve", async (req, res) => {
  try {
    res.json(await approveCustomerCloseout(req.params.token));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not approve closeout" });
  }
});

router.post("/job-closeouts/:token/reject", async (req, res) => {
  try {
    const note = z.string().trim().min(1).max(3000).parse(req.body?.note);
    res.json(await rejectCustomerCloseout(req.params.token, note));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: "Please explain what needs correction" });
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not reject closeout" });
  }
});

router.get("/customer/jobs/:id/closeout", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["customer", "admin", "business_owner"]);
  if (!user?.email) return;
  try {
    res.json({ closeout: await getAuthenticatedCustomerCloseout(req.params.id, user.email) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Closeout not found" });
  }
});

router.post("/customer/jobs/:id/closeout/approve", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["customer", "admin", "business_owner"]);
  if (!user?.email) return;
  try {
    res.json(await approveAuthenticatedCustomerCloseout(req.params.id, user.email));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not approve closeout" });
  }
});

router.post("/customer/jobs/:id/closeout/reject", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["customer", "admin", "business_owner"]);
  if (!user?.email) return;
  try {
    const note = z.string().trim().min(1).max(3000).parse(req.body?.note);
    res.json(await rejectAuthenticatedCustomerCloseout(req.params.id, user.email, note));
  } catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ error: "Please explain what needs correction" });
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not reject closeout" });
  }
});

router.get("/admin/closeout-exceptions", isAuthenticated, async (req: any, res) => {
  if (!(await requireRole(req, res, ["admin", "business_owner"]))) return;
  await ensureRegionalAutomationSchema();
  const { rows } = await pool.query(
    `SELECT c.*, l.first_name, l.last_name, l.service_type, l.phone, l.email
       FROM job_closeouts c JOIN leads l ON l.id=c.lead_id
      WHERE c.status IN ('owner_review','customer_rejected','refund_review')
      ORDER BY c.updated_at ASC`,
  );
  res.json({ closeouts: rows });
});

router.post("/admin/closeout-exceptions/:id/approve", isAuthenticated, async (req: any, res) => {
  const user = await requireRole(req, res, ["admin", "business_owner"]);
  if (!user) return;
  try {
    res.json(await ownerApproveCloseout(req.params.id, user.id));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not approve closeout" });
  }
});

export default router;
