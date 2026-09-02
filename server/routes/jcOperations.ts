import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth";
import { pool } from "../db";
import {
  approveChiefOfStaffAction,
  draftChiefOfStaffEmail,
  ensureJcOperationsInfrastructure,
  generateChiefOfStaffBriefing,
  getLeadSafetyStatus,
  getPreferenceCapacity,
  recordLeadContact,
  scheduleRequestByToken,
  updateScheduleRequestByToken,
} from "../services/jcOperations";

const preferenceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:00$/),
  crewSize: z.coerce.number().int().min(2).max(4),
  planningMinutes: z.coerce.number().int().min(60).max(24 * 60),
});

function requestUser(req: any) {
  return req.user || req.currentUser || null;
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = requestUser(req);
  if (!user || !["admin", "business_owner"].includes(String(user.role || ""))) {
    return res.status(403).json({ error: "Administrator access required" });
  }
  next();
}

function requireStaff(req: Request, res: Response, next: NextFunction) {
  const user = requestUser(req);
  if (!user || !["employee", "admin", "business_owner"].includes(String(user.role || ""))) {
    return res.status(403).json({ error: "Crew or administrator access required" });
  }
  next();
}

function requireBusinessOwner(req: Request, res: Response, next: NextFunction) {
  const user = requestUser(req);
  const owner = user && (user.role === "business_owner" || user.email === "upmichiganstatemovers@gmail.com");
  if (!owner) return res.status(403).json({ error: "Business-owner approval required" });
  next();
}

function publicScheduleRequest(row: any) {
  if (!row) return null;
  const { manage_token_hash: _hash, token_expires_at: _expiry, ...safe } = row;
  return safe;
}

function apiError(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const clientError = /choose|invalid|expired|not found|lead time|already|capacity|deliverable/i.test(message);
  return res.status(clientError ? 400 : 500).json({ error: message || fallback });
}

export function createJcOperationsRouter() {
  const router = Router();

  router.post("/scheduling/preference-capacity", async (req, res) => {
    try {
      await ensureJcOperationsInfrastructure();
      const input = preferenceSchema.parse(req.body);
      res.json(await getPreferenceCapacity(input));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(422).json({ error: "Choose a valid date, hourly start, crew size, and estimated duration.", details: error.errors });
      return apiError(res, error, "Could not check that time.");
    }
  });

  router.get("/public/schedule-request/:token", async (req, res) => {
    try {
      const request = await scheduleRequestByToken(req.params.token);
      if (!request) return res.status(404).json({ error: "This schedule-management link is invalid or expired." });
      res.setHeader("Cache-Control", "no-store");
      res.json({ scheduleRequest: publicScheduleRequest(request) });
    } catch (error) {
      return apiError(res, error, "Could not load the schedule request.");
    }
  });

  router.patch("/public/schedule-request/:token", async (req, res) => {
    try {
      const input = preferenceSchema.pick({ date: true, time: true }).parse(req.body);
      const result = await updateScheduleRequestByToken(req.params.token, input);
      res.json({ ...result, scheduleRequest: publicScheduleRequest(result.scheduleRequest) });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(422).json({ error: "Choose a valid date and hourly start.", details: error.errors });
      return apiError(res, error, "Could not update the schedule request.");
    }
  });

  router.get("/admin/schedule-requests", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      await ensureJcOperationsInfrastructure();
      const result = await pool.query(`
        SELECT sr.*,l.first_name,l.last_name,l.email,l.phone,l.service_type,l.order_number,l.created_at AS lead_created_at
          FROM lead_schedule_requests sr JOIN leads l ON l.id=sr.lead_id
         WHERE sr.status IN ('pending_confirmation','confirmed','change_requested')
         ORDER BY sr.urgent DESC,sr.preferred_date,sr.preferred_start_time
      `);
      res.json({ requests: result.rows.map(publicScheduleRequest) });
    } catch (error) {
      return apiError(res, error, "Could not load schedule requests.");
    }
  });

  router.get("/staff/schedule-requests", isAuthenticated, requireStaff, async (_req, res) => {
    try {
      await ensureJcOperationsInfrastructure();
      const result = await pool.query(`
        SELECT sr.*,l.first_name,l.last_name,l.email,l.phone,l.service_type,l.order_number,
               l.created_at AS lead_created_at,contact.outcome AS latest_contact_outcome,
               contact.created_at AS latest_contact_at
          FROM lead_schedule_requests sr
          JOIN leads l ON l.id=sr.lead_id
          LEFT JOIN LATERAL (
            SELECT outcome,created_at FROM lead_contact_events
             WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1
          ) contact ON true
         WHERE sr.status IN ('pending_confirmation','change_requested')
         ORDER BY sr.urgent DESC,sr.preferred_date,sr.preferred_start_time
         LIMIT 100
      `);
      res.json({ requests: result.rows.map(publicScheduleRequest) });
    } catch (error) {
      return apiError(res, error, "Could not load staff schedule requests.");
    }
  });

  router.patch("/admin/schedule-requests/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    const decisionSchema = z.object({
      decision: z.enum(["confirm", "decline", "approve_change", "reject_change"]),
      force: z.boolean().optional().default(false),
      overrideReason: z.string().trim().max(500).optional().default(""),
    });
    const client = await pool.connect();
    try {
      await ensureJcOperationsInfrastructure();
      const input = decisionSchema.parse(req.body);
      await client.query("BEGIN");
      const currentResult = await client.query(`SELECT * FROM lead_schedule_requests WHERE id=$1 FOR UPDATE`, [req.params.id]);
      const current = currentResult.rows[0];
      if (!current) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Schedule request not found" });
      }
      const expectedStatus: Record<typeof input.decision, string> = {
        confirm: "pending_confirmation",
        decline: "pending_confirmation",
        approve_change: "change_requested",
        reject_change: "change_requested",
      };
      if (current.status !== expectedStatus[input.decision]) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: `This request is already ${String(current.status).replaceAll("_", " ")}; refresh before taking another action.` });
      }
      const actor = requestUser(req);
      if (["decline", "reject_change"].includes(input.decision)) {
        const status = input.decision === "decline" ? "declined" : "confirmed";
        const updated = await client.query(`
          UPDATE lead_schedule_requests
             SET status=$2,pending_change_date=NULL,pending_change_start_time=NULL,updated_at=NOW(),version=version+1
           WHERE id=$1 RETURNING *
        `, [current.id, status]);
        await client.query(`INSERT INTO lead_schedule_events(schedule_request_id,event_type,actor_type,actor_user_id,metadata)
                            VALUES ($1,$2,'staff',$3,$4::jsonb)`, [current.id, input.decision, actor.id, JSON.stringify({ overrideReason: input.overrideReason })]);
        await client.query("COMMIT");
        return res.json({ scheduleRequest: publicScheduleRequest(updated.rows[0]) });
      }

      const approvingChange = input.decision === "approve_change";
      const date = String(approvingChange ? current.pending_change_date : current.preferred_date).slice(0, 10);
      const time = String(approvingChange ? current.pending_change_start_time : current.preferred_start_time).slice(0, 5);
      if (!date || !time || date === "null" || time === "null") throw new Error("The requested date or time is missing.");
      const capacity = await getPreferenceCapacity({
        date,
        time,
        crewSize: Number(current.selected_crew_size),
        planningMinutes: Number(current.planning_minutes),
        excludeScheduleRequestId: current.id,
        allowWithinTwoHours: true,
      }, client);
      if (capacity.status === "ask_jc" && !input.force) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Capacity is not currently available. Review the crew plan or confirm with an owner override.", capacity });
      }
      if (input.force && input.overrideReason.length < 5) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Record an override reason before confirming over capacity." });
      }
      const updated = await client.query(`
        UPDATE lead_schedule_requests
           SET preferred_date=$2::date,preferred_start_time=$3::time,status='confirmed',
               pending_change_date=NULL,pending_change_start_time=NULL,capacity_status=$4,
               confirmed_at=NOW(),confirmed_by_user_id=$5,updated_at=NOW(),version=version+1
         WHERE id=$1 RETURNING *
      `, [current.id, date, time, capacity.status, actor.id]);
      await client.query(`
        UPDATE leads
           SET move_date=$2,confirmed_date=$2,arrival_window=$3,crew_size=$4,updated_at=NOW()
         WHERE id=$1
      `, [current.lead_id, date, `${time} Central`, Number(current.selected_crew_size)]);
      await client.query(`INSERT INTO lead_schedule_events(schedule_request_id,event_type,actor_type,actor_user_id,metadata)
                          VALUES ($1,$2,'staff',$3,$4::jsonb)`, [current.id, input.decision, actor.id, JSON.stringify({ capacity, force: input.force, overrideReason: input.overrideReason })]);
      await client.query("COMMIT");
      res.json({ scheduleRequest: publicScheduleRequest(updated.rows[0]), capacity });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (error instanceof z.ZodError) return res.status(422).json({ error: "Choose a valid review decision.", details: error.errors });
      return apiError(res, error, "Could not review the schedule request.");
    } finally {
      client.release();
    }
  });

  router.get("/admin/lead-safety/status", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      res.json({ leads: await getLeadSafetyStatus() });
    } catch (error) {
      return apiError(res, error, "Could not load lead alerts.");
    }
  });

  router.post("/admin/leads/:id/contact-events", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const input = z.object({ outcome: z.enum(["attempted", "reached"]), notes: z.string().trim().max(1000).optional() }).parse(req.body);
      await recordLeadContact({ leadId: req.params.id, outcome: input.outcome, notes: input.notes, actorUserId: requestUser(req).id });
      res.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(422).json({ error: "Choose attempted or reached.", details: error.errors });
      return apiError(res, error, "Could not record customer contact.");
    }
  });

  router.post("/staff/leads/:id/contact-events", isAuthenticated, requireStaff, async (req: any, res) => {
    try {
      const input = z.object({ outcome: z.enum(["attempted", "reached"]), notes: z.string().trim().max(1000).optional() }).parse(req.body);
      await recordLeadContact({ leadId: req.params.id, outcome: input.outcome, notes: input.notes, actorUserId: requestUser(req).id });
      res.status(201).json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(422).json({ error: "Choose attempted or reached.", details: error.errors });
      return apiError(res, error, "Could not record customer contact.");
    }
  });

  router.post("/admin/chief-of-staff/briefing", isAuthenticated, requireBusinessOwner, async (_req, res) => {
    try {
      res.json(await generateChiefOfStaffBriefing());
    } catch (error) {
      return apiError(res, error, "Could not prepare the owner briefing.");
    }
  });

  router.post("/admin/chief-of-staff/email-drafts", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      const input = z.object({ leadId: z.string().min(1) }).parse(req.body);
      res.status(201).json({ action: await draftChiefOfStaffEmail({ leadId: input.leadId, actorUserId: requestUser(req).id }) });
    } catch (error) {
      return apiError(res, error, "Could not draft the email.");
    }
  });

  router.post("/admin/chief-of-staff/actions/:id/approve", isAuthenticated, requireBusinessOwner, async (req: any, res) => {
    try {
      res.json({ action: await approveChiefOfStaffAction({ actionId: req.params.id, actorUserId: requestUser(req).id }) });
    } catch (error) {
      return apiError(res, error, "Could not approve the action.");
    }
  });

  return router;
}
