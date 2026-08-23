// Task #175 — Routes for the consolidated admin payment panel + launch
// checklist + crew payment-status pill data source.
//
// Mounted as /api by the registerRoutes call in server/routes.ts so the
// frontend can hit /api/admin/leads/:id/payment-panel and /api/payment-status/:id
// without a second express app.

import { Router, type Request, type Response } from "express";
import { pool } from "../db";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { deriveLeadPaymentStatus } from "../services/paymentStatus";
import { listScenarios, runAllScenarios, runScenario } from "../services/launchChecklist";
import {
  reconcilePaidCompletedJcMoves,
  startPaidCompletedJcMovesReconciliation,
} from "../services/reconcilePaidCompletedJcMoves";

const router = Router();

// Safety-net for jobs that complete before their final payment arrives. The
// feature flag defaults off, so deploying this code alone cannot issue tokens.
startPaidCompletedJcMovesReconciliation();

async function requireAdmin(req: any, res: Response): Promise<boolean> {
  const userId = req.user?.id || (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const user = await storage.getUser(userId);
  const ok = user && (user.role === "admin" || user.role === "business_owner");
  if (!ok) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// ── Crew + customer-facing pill -------------------------------------------
router.get("/payment-status/:leadId", async (req: Request, res: Response) => {
  const status = await deriveLeadPaymentStatus(req.params.leadId);
  res.json({ status });
});

// ── Admin consolidated payment panel for one job --------------------------
router.get("/admin/leads/:id/payment-panel", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const id = req.params.id;
  try {
    const status = await deriveLeadPaymentStatus(id);

    const lead = await pool.query(
      `SELECT id, first_name, last_name, email, phone,
              total_price, deposit_required, deposit_paid, deposit_amount_gate,
              payment_plan, payment_paid_at, square_payment_url,
              dispatch_override_reason
         FROM leads WHERE id = $1`,
      [id],
    ).then((r) => r.rows[0]).catch(() => null);

    const invoices = await pool.query(
      `SELECT id, square_invoice_id, status, amount, sent_at, paid_at, public_url
         FROM square_invoices WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id],
    ).then((r) => r.rows).catch(() => []);

    const btcPayments = await pool.query(
      `SELECT id, btc_amount, usd_amount, tx_hash, status, verified_at, created_at
         FROM bitcoin_payments WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id],
    ).then((r) => r.rows).catch(() => []);

    const walletEntries = await pool.query(
      `SELECT id, kind, amount_usd, balance_after, ref_type, ref_id, note, created_at
         FROM wallet_ledger WHERE ref_type = 'lead' AND ref_id = $1
         ORDER BY created_at DESC LIMIT 20`,
      [id],
    ).then((r) => r.rows).catch(() => []);

    res.json({
      status,
      lead,
      invoices,
      btcPayments,
      walletEntries,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── Admin: override the deposit gate for a single job ---------------------
router.post(
  "/admin/leads/:id/dispatch-override",
  isAuthenticated,
  async (req: any, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    const reason = String(req.body?.reason ?? "").trim().slice(0, 500);
    if (!reason) return res.status(400).json({ error: "Reason required" });
    try {
      await pool.query(
        `UPDATE leads SET dispatch_override_reason = $2 WHERE id = $1`,
        [req.params.id, reason],
      );
      try {
        await pool.query(
          `INSERT INTO dispatch_log (lead_id, event, actor_user_id, reason)
                VALUES ($1, 'deposit_override', $2, $3)`,
          [req.params.id, req.user?.id ?? null, reason],
        );
      } catch { /* dispatch_log shape may differ — best effort */ }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  },
);

// ── Admin: clear the override (re-enables the deposit gate) ---------------
router.post(
  "/admin/leads/:id/dispatch-override/clear",
  isAuthenticated,
  async (req: any, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    try {
      await pool.query(
        `UPDATE leads SET dispatch_override_reason = NULL WHERE id = $1`,
        [req.params.id],
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  },
);

// ── Launch checklist ------------------------------------------------------
router.get("/admin/launch-checklist", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  res.json({ scenarios: listScenarios() });
});

router.post("/admin/launch-checklist/run", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const id = req.body?.id;
    if (id) {
      const result = await runScenario(id);
      return res.json({ results: [result] });
    }
    const results = await runAllScenarios();
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

// ── Wallet ledger view (admin closet) -------------------------------------
router.get("/admin/wallet-ledger", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  try {
    const { rows } = await pool.query(
      `SELECT wl.id, wl.user_id, u.first_name, u.last_name, u.email,
              wl.kind, wl.amount_usd, wl.balance_after, wl.ref_type, wl.ref_id,
              wl.note, wl.created_at
         FROM wallet_ledger wl
         LEFT JOIN users u ON u.id = wl.user_id
        ORDER BY wl.created_at DESC
        LIMIT $1`,
      [limit],
    );
    res.json({ entries: rows });
  } catch (e) {
    // Table missing in some envs — return empty so the page renders.
    res.json({ entries: [], note: "wallet_ledger not present" });
  }
});

// ── Cashout queue (admin closet) ------------------------------------------
router.get("/admin/cashouts", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { rows } = await pool.query(
      `SELECT cr.id, cr.user_id, u.first_name, u.last_name, u.email,
              cr.amount_usd, cr.status, cr.requested_at, cr.processed_at, cr.note
         FROM cashout_requests cr
         LEFT JOIN users u ON u.id = cr.user_id
        ORDER BY cr.requested_at DESC
        LIMIT 200`,
    );
    res.json({ requests: rows });
  } catch {
    res.json({ requests: [], note: "cashout_requests not present" });
  }
});

// ── Square invoice index (admin closet) -----------------------------------
router.get("/admin/square-invoices", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { rows } = await pool.query(
      `SELECT si.id, si.square_invoice_id, si.lead_id, si.status, si.amount,
              si.sent_at, si.paid_at, si.public_url, si.created_at,
              l.first_name, l.last_name, l.email, l.phone
         FROM square_invoices si
         LEFT JOIN leads l ON l.id = si.lead_id
        ORDER BY si.created_at DESC
        LIMIT 200`,
    );
    res.json({ invoices: rows });
  } catch (e) {
    res.json({ invoices: [], note: "square_invoices not present" });
  }
});

// Owner-only manual reconciliation is intentionally available even while the
// automatic scheduler flag is off. This gives us a controlled production test
// path before enabling recurring automatic reward issuance.
router.post("/admin/rewards-reconciliation/paid-completed", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const limit = Math.min(100, Math.max(1, Number(req.body?.limit) || 25));
    const result = await reconcilePaidCompletedJcMoves(limit);
    res.json({ ok: result.failed === 0, result });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

router.get("/admin/rewards-reconciliation", isAuthenticated, async (req: any, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 250));
  const minDelta = Math.max(0, Number(req.query.minDelta) || 0.01);
  try {
    const { rows } = await pool.query(
      `WITH reward_totals AS (
         SELECT
           user_id,
           COALESCE(SUM(CASE WHEN token_amount::numeric > 0 THEN token_amount::numeric ELSE 0 END), 0) AS reward_credits,
           COALESCE(SUM(CASE WHEN token_amount::numeric < 0 THEN token_amount::numeric ELSE 0 END), 0) AS reward_debits,
           COUNT(*) FILTER (WHERE token_amount::numeric > 0) AS reward_credit_count,
           COUNT(*) FILTER (WHERE token_amount::numeric < 0) AS reward_debit_count,
           MAX(earned_date) AS last_reward_at
         FROM rewards
         GROUP BY user_id
       )
       SELECT
         wa.user_id,
         u.first_name,
         u.last_name,
         u.email,
         u.role,
         wa.token_balance,
         wa.total_earned,
         wa.total_redeemed,
         wa.staked_balance,
         wa.last_activity,
         COALESCE(rt.reward_credits, 0) AS reward_credits,
         COALESCE(rt.reward_debits, 0) AS reward_debits,
         COALESCE(rt.reward_credit_count, 0) AS reward_credit_count,
         COALESCE(rt.reward_debit_count, 0) AS reward_debit_count,
         rt.last_reward_at,
         (wa.total_earned::numeric - COALESCE(rt.reward_credits, 0)) AS earned_delta,
         (wa.token_balance::numeric - (COALESCE(rt.reward_credits, 0) + COALESCE(rt.reward_debits, 0))) AS balance_delta
       FROM wallet_accounts wa
       LEFT JOIN reward_totals rt ON rt.user_id = wa.user_id
       LEFT JOIN users u ON u.id = wa.user_id
       WHERE ABS(wa.total_earned::numeric - COALESCE(rt.reward_credits, 0)) >= $1
          OR ABS(wa.token_balance::numeric - (COALESCE(rt.reward_credits, 0) + COALESCE(rt.reward_debits, 0))) >= $1
       ORDER BY ABS(wa.total_earned::numeric - COALESCE(rt.reward_credits, 0)) DESC,
                ABS(wa.token_balance::numeric - (COALESCE(rt.reward_credits, 0) + COALESCE(rt.reward_debits, 0))) DESC
       LIMIT $2`,
      [minDelta, limit],
    );

    const summary = rows.reduce(
      (acc, row: any) => {
        acc.userCount += 1;
        acc.totalEarnedDelta += Number(row.earned_delta || 0);
        acc.totalBalanceDelta += Number(row.balance_delta || 0);
        return acc;
      },
      { userCount: 0, totalEarnedDelta: 0, totalBalanceDelta: 0 },
    );

    res.json({ rows, summary, filters: { limit, minDelta } });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

export default router;