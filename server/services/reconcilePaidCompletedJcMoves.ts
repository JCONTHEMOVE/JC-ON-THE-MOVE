import { pool } from "../db";
import { disburseJobTokens } from "./disburse-job-tokens";

const DEFAULT_LIMIT = 25;

export type PaidCompletedReconciliationResult = {
  scanned: number;
  attempted: number;
  rewarded: number;
  skipped: number;
  failed: number;
  errors: Array<{ leadId: string; error: string }>;
};

/**
 * Safety-net for the payment-after-completion ordering case.
 *
 * Completion already attempts JCMOVES disbursement. If payment arrives later,
 * that first attempt correctly defers because payment_paid_at is still null.
 * This reconciliation pass finds those now-eligible jobs and retries the same
 * idempotent disbursement service. It does not calculate rewards itself.
 */
export async function reconcilePaidCompletedJcMoves(
  limit = DEFAULT_LIMIT,
): Promise<PaidCompletedReconciliationResult> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit || DEFAULT_LIMIT)));
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id
       FROM leads
      WHERE status = 'completed'
        AND payment_paid_at IS NOT NULL
        AND tokens_disbursed_at IS NULL
        AND completion_rewarded_at IS NULL
      ORDER BY payment_paid_at ASC
      LIMIT $1`,
    [safeLimit],
  );

  const result: PaidCompletedReconciliationResult = {
    scanned: rows.length,
    attempted: 0,
    rewarded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of rows) {
    result.attempted += 1;
    try {
      const summary = await disburseJobTokens(row.id);
      if (summary) result.rewarded += 1;
      else result.skipped += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        leadId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

let schedulerStarted = false;

/**
 * Starts a conservative reconciliation loop only when explicitly enabled.
 * The first pass runs after startup, then every five minutes. Multiple server
 * instances are safe because disburseJobTokens uses a per-job advisory lock
 * and durable reward/ledger idempotency checks.
 */
export function startPaidCompletedJcMovesReconciliation(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  if (process.env.JCMOVES_AUTO_PAYMENT_REWARDS_ENABLED !== "true") {
    console.log("[JCMOVES] Paid/completed reward reconciliation disabled");
    return;
  }

  const intervalMinutes = Math.max(
    1,
    Math.min(60, Number(process.env.JCMOVES_PAYMENT_REWARD_RECONCILE_MINUTES || 5) || 5),
  );
  const intervalMs = intervalMinutes * 60 * 1000;

  const tick = async () => {
    try {
      const result = await reconcilePaidCompletedJcMoves();
      if (result.scanned > 0 || result.failed > 0) {
        console.log(
          `[JCMOVES] paid/completed reconciliation scanned=${result.scanned} rewarded=${result.rewarded} skipped=${result.skipped} failed=${result.failed}`,
        );
      }
      for (const failure of result.errors) {
        console.error(`[JCMOVES] reconciliation failed lead=${failure.leadId}: ${failure.error}`);
      }
    } catch (error) {
      console.error(
        "[JCMOVES] paid/completed reconciliation sweep failed:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  setTimeout(tick, 60_000);
  setInterval(tick, intervalMs);
  console.log(`[JCMOVES] Paid/completed reward reconciliation enabled every ${intervalMinutes} minute(s)`);
}
