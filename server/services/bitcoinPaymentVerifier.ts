import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import {
  bitcoinPayments,
  jewelryItems,
  rewards,
  rewardSettings,
  type BitcoinPayment,
} from "@shared/schema";
import { storage } from "../storage";
import { sendEmail } from "./email";
import { treasuryService } from "./treasury";

/**
 * Shared verification flow for a Bitcoin payment. Used by:
 *   - the admin /api/admin/btc-payments/:id/verify endpoint
 *   - the periodic blockchain poller (runBitcoinPaymentSweep)
 *
 * Idempotent: if the payment is already in a terminal state, we just return
 * the row without re-running side effects. If the row is still pending and we
 * are transitioning it to "verified", the conditional UPDATE … RETURNING is
 * the single-winner gate that protects against the admin endpoint and the
 * poller racing on the same row.
 */
export interface VerifyOptions {
  status: "verified" | "expired" | "cancelled";
  verifiedByUserId?: string | null;
  autoVerified?: boolean;
  autoVerifiedTxid?: string | null;
}

export async function verifyBitcoinPayment(
  paymentId: string,
  opts: VerifyOptions,
): Promise<BitcoinPayment | null> {
  const [payment] = await db.select().from(bitcoinPayments).where(eq(bitcoinPayments.id, paymentId));
  if (!payment) return null;

  // Single-winner transition: only flip rows that are still pending. If the
  // row is already verified/expired/cancelled, we skip the side-effect block
  // entirely so a re-trigger (admin re-clicks, poller revisits the same tx)
  // is a no-op.
  const updatedRows = await db.update(bitcoinPayments)
    .set({
      status: opts.status,
      verifiedByUserId: opts.verifiedByUserId ?? null,
      verifiedAt: opts.status === "verified" ? new Date() : null,
      autoVerified: opts.autoVerified ?? false,
      autoVerifiedTxid: opts.autoVerifiedTxid ?? null,
      jcmovesCredited:
        opts.status === "verified" && payment.jcmovesAmount && parseFloat(payment.jcmovesAmount) > 0
          ? 1
          : payment.jcmovesCredited ?? 0,
    })
    .where(and(eq(bitcoinPayments.id, paymentId), eq(bitcoinPayments.status, "pending")))
    .returning();

  if (updatedRows.length === 0) {
    // Lost the race — another caller already verified/cancelled this row.
    return payment;
  }

  const updated = updatedRows[0];

  // Only run side effects when transitioning to "verified". Cancellations /
  // expirations don't credit tokens or finalize jewelry.
  if (opts.status !== "verified") return updated;

  const tag = opts.autoVerified ? "[BTC AutoVerify]" : "[BTC Verify]";

  // Credit JCMOVES tokens to the buyer (token-purchase payments only).
  if (
    payment.userId &&
    payment.jcmovesAmount &&
    parseFloat(payment.jcmovesAmount) > 0 &&
    !payment.jcmovesCredited
  ) {
    try {
      const tokensToCredit = parseFloat(payment.jcmovesAmount);
        await storage.creditWalletTokens(payment.userId, tokensToCredit, { skipRewardLedger: true });
      await db.insert(rewards).values({
        userId: payment.userId,
        rewardType: "btc_token_purchase",
        tokenAmount: tokensToCredit.toFixed(8),
        cashValue: payment.usdAmount,
        status: "confirmed",
        earnedDate: new Date(),
        metadata: {
          paymentId: payment.id,
          btcAmount: payment.btcAmount,
          btcPrice: payment.btcPrice,
          usdAmount: payment.usdAmount,
          verifiedBy: opts.verifiedByUserId ?? (opts.autoVerified ? "auto" : null),
          autoVerified: !!opts.autoVerified,
          autoVerifiedTxid: opts.autoVerifiedTxid ?? null,
          description: "JCMOVES tokens purchased via Bitcoin payment",
        },
      });
      console.log(`${tag} Credited ${tokensToCredit} JCMOVES to user ${payment.userId} for payment ${paymentId}`);
    } catch (creditErr) {
      console.error(`${tag} Token credit failed (non-fatal):`, creditErr);
    }
  }

  // Finalize a held jewelry pending_balance reservation.
  if (payment.referenceType === "jewelry" && payment.referenceId && payment.userId) {
    try {
      const jItem = await storage.getJewelryItem(payment.referenceId);
      if (
        jItem &&
        jItem.status === "pending_balance" &&
        jItem.pendingCreditUserId === payment.userId
      ) {
        const finalized = await db.transaction(async (tx) => {
          const updatedItemRows = await tx.update(jewelryItems)
            .set({
              status: "sold",
              inStock: false,
              soldAt: new Date(),
              pendingCreditUserId: null,
              pendingCreditCents: null,
              pendingExpiresAt: null,
              pendingSquareOrderId: null,
            })
            .where(and(
              eq(jewelryItems.id, payment.referenceId!),
              eq(jewelryItems.status, "pending_balance"),
              eq(jewelryItems.pendingCreditUserId, payment.userId!),
            ))
            .returning({ id: jewelryItems.id });
          if (updatedItemRows.length === 0) return false;
          await tx.update(rewards)
            .set({ status: "confirmed" })
            .where(and(
              eq(rewards.userId, payment.userId!),
              eq(rewards.rewardType, "wallet_balance_redemption"),
              eq(rewards.referenceId, payment.referenceId!),
              eq(rewards.status, "pending"),
            ));
          return true;
        });
        if (finalized) {
          console.log(`💎 ${tag} Finalized pending_balance jewelry item ${payment.referenceId} for user ${payment.userId} via BTC payment ${paymentId}`);
        } else {
          console.warn(`${tag} Jewelry item ${payment.referenceId} no longer in pending_balance at write time — skipping reward confirmation (likely auto-released).`);
        }
      } else if (jItem && jItem.status !== "sold") {
        console.warn(`${tag} Jewelry item ${payment.referenceId} not in pending_balance for user ${payment.userId} — skipping finalization (item status=${jItem?.status}).`);
      }
    } catch (jErr) {
      console.error(`${tag} Jewelry finalization failed (non-fatal, BTC payment still marked verified):`, jErr);
    }

    // Award JCMOVES rewards for the jewelry purchase. Authorization that *this*
    // user was the actual buyer is enforced by requiring an existing confirmed
    // wallet_balance_redemption reward row for this user+item. Idempotent on
    // referenceId+rewardType+userId.
    try {
      const jItem2 = await storage.getJewelryItem(payment.referenceId!);
      if (jItem2 && jItem2.status === "sold") {
        const purchasePrice = parseFloat(jItem2.price || "0");
        if (purchasePrice > 0) {
          const buyerProof = await db.select({ id: rewards.id })
            .from(rewards)
            .where(and(
              eq(rewards.userId, payment.userId!),
              eq(rewards.rewardType, "wallet_balance_redemption"),
              eq(rewards.referenceId, payment.referenceId!),
              eq(rewards.status, "confirmed"),
            ))
            .limit(1);

          if (buyerProof.length > 0) {
            const alreadyRewarded = await db.select({ id: rewards.id })
              .from(rewards)
              .where(and(
                eq(rewards.userId, payment.userId!),
                eq(rewards.rewardType, "jewelry_purchase"),
                eq(rewards.referenceId, payment.referenceId!),
              ))
              .limit(1);

            if (alreadyRewarded.length === 0) {
              const rateSetting = await db.select().from(rewardSettings)
                .where(eq(rewardSettings.settingKey, "earn_rate_per_dollar"))
                .limit(1);
              const earnRate = rateSetting.length > 0 ? parseFloat(rateSetting[0].tokenAmount) : 50;
              const tokensEarned = Math.round(purchasePrice * earnRate);

              if (tokensEarned > 0) {
      await storage.creditWalletTokens(payment.userId!, tokensEarned, { skipRewardLedger: true });
                await db.insert(rewards).values({
                  userId: payment.userId!,
                  rewardType: "jewelry_purchase",
                  tokenAmount: tokensEarned.toFixed(8),
                  cashValue: (purchasePrice * 0.01).toFixed(2),
                  status: "confirmed",
                  referenceId: payment.referenceId!,
                  metadata: {
                    source: "jewelry_shop",
                    paymentMethod: "bitcoin",
                    itemId: payment.referenceId,
                    itemTitle: jItem2.title,
                    purchasePrice,
                    earnRate,
                    tokensPerDollar: earnRate,
                    btcPaymentId: payment.id,
                    autoVerified: !!opts.autoVerified,
                  },
                });

                try {
                  await treasuryService.distributeTokens(
                    tokensEarned,
                    `Jewelry purchase reward (BTC): ${tokensEarned} JCMOVES for "${jItem2.title}" ($${purchasePrice.toFixed(2)}) — source: jewelry_shop`,
                    "jewelry_shop",
                    payment.referenceId!,
                  );
                } catch (treasuryErr) {
                  console.warn(`${tag} Treasury distribution failed (non-fatal):`, treasuryErr);
                }

                console.log(`💎 ${tag} Jewelry purchase reward: ${tokensEarned} JCMOVES to user ${payment.userId} for item "${jItem2.title}" ($${purchasePrice})`);
              }
            }
          } else {
            console.warn(`${tag} No confirmed wallet_balance_redemption for user ${payment.userId} on item ${payment.referenceId} — skipping JCMOVES award (this user was not the finalizing buyer).`);
          }
        }
      }
    } catch (rewardErr) {
      console.error(`${tag} Failed to award jewelry purchase JCMOVES (non-fatal):`, rewardErr);
    }
  }

  // Confirmation email to the customer.
  try {
    const paymentContext = payment.referenceType === "job_payment"
      ? (payment.notes || "your moving/junk removal job")
      : payment.notes || "your purchase";
    const autoLine = opts.autoVerified
      ? '<p style="color:#94a3b8;text-align:center;font-size:12px;margin:12px 0 0;">Auto-confirmed on the Bitcoin blockchain.</p>'
      : "";
  const baseUrl = process.env.APP_URL?.trim()
    || process.env.RENDER_EXTERNAL_URL?.trim()
    || "https://www.jconthemove.com";
    const receiptUrl = `${baseUrl}/payment-success?btcPaymentId=${encodeURIComponent(payment.id)}`;
    const receiptCta = `
          <div style="text-align:center;margin-top:20px;">
            <a href="${receiptUrl}" style="display:inline-block;padding:12px 28px;background:#f97316;color:#fff;font-size:14px;font-weight:700;border-radius:6px;text-decoration:none;">View Receipt${opts.autoVerified ? " & On-Chain Proof" : ""} →</a>
          </div>`;
    const emailBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#f97316;font-size:28px;margin:0;">JC ON THE MOVE</h1>
          <p style="color:#94a3b8;margin-top:4px;">Bitcoin Payment Confirmed</p>
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:24px;margin-bottom:20px;border:1px solid #f97316/30;">
          <h2 style="color:#4ade80;margin:0 0 16px;">✅ Payment Received!</h2>
          <p style="color:#cbd5e1;margin:0 0 12px;">Hello ${payment.customerName},</p>
          <p style="color:#cbd5e1;margin:0 0 12px;">Your Bitcoin payment for <strong style="color:#f97316;">${paymentContext}</strong> has been confirmed and received by our team.</p>
          <div style="background:#0f172a;border-radius:6px;padding:16px;margin-top:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#94a3b8;">Payment ID</span>
              <span style="color:#f1f5f9;font-family:monospace;">${payment.id.slice(0, 8)}...</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
              <span style="color:#94a3b8;">Amount Paid</span>
              <span style="color:#4ade80;font-weight:bold;">$${parseFloat(payment.usdAmount).toFixed(2)} (${Number(payment.discountPercent || 5).toFixed(0)}% Crypto Discount Applied)</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
              <span style="color:#94a3b8;">BTC Amount</span>
              <span style="color:#f97316;">${parseFloat(payment.btcAmount).toFixed(8)} BTC</span>
            </div>
          </div>
          ${autoLine}
          ${receiptCta}
        </div>
        <p style="color:#94a3b8;text-align:center;font-size:14px;margin:0;">Questions? Call us at <a href="tel:9062859312" style="color:#f97316;">(906) 285-9312</a></p>
      </div>`;
    const fromAddr = process.env.COMPANY_EMAIL || "michigankid906@gmail.com";
    await sendEmail({
      to: payment.customerEmail,
      from: fromAddr,
      subject: "✅ Bitcoin Payment Confirmed — JC ON THE MOVE",
      html: emailBody,
      text: `Hello ${payment.customerName}, your Bitcoin payment of $${parseFloat(payment.usdAmount).toFixed(2)} for ${paymentContext} has been confirmed. View your receipt: ${receiptUrl} — Payment ID: ${payment.id.slice(0,8)}. Questions? Call (906) 285-9312.`,
    });
    console.log(`${tag} Confirmation email sent to ${payment.customerEmail}`);
  } catch (emailErr) {
    console.error(`${tag} Email notification failed:`, emailErr);
  }

  return updated;
}

// ─── Per-payment blockchain status (for the customer-facing live status) ──
//
// Used by GET /api/btc/payment/:id so the payment status page can show
// "Detected on blockchain — finalizing your hold…" before the row is
// flipped, and "auto-confirmed at HH:MM" with the txid once it is.
//
// We cache the lookup per-payment for a few seconds so that aggressive
// polling from the customer doesn't hammer mempool.space.
export interface BlockchainStatus {
  detected: boolean;
  txid: string | null;
  confirmations: number;
  requiredConfirmations: number;
  mempoolUrl: string | null;
  /** UNIX seconds the tx was first observed on chain or in mempool. */
  seenAt: number | null;
  /** True once the row is verified+autoVerified — caller can stop polling. */
  finalized: boolean;
}

const STATUS_CACHE_MS = 8_000;
const statusCache = new Map<string, { ts: number; status: BlockchainStatus }>();

function emptyStatus(finalized = false): BlockchainStatus {
  return {
    detected: false,
    txid: null,
    confirmations: 0,
    requiredConfirmations: MIN_CONFIRMATIONS,
    mempoolUrl: null,
    seenAt: null,
    finalized,
  };
}

export async function getBlockchainStatus(payment: BitcoinPayment): Promise<BlockchainStatus> {
  // Persisted: once we auto-verified, we already know the txid and the row
  // is final — no need to re-query mempool.space.
  if (payment.status === "verified" && payment.autoVerified && payment.autoVerifiedTxid) {
    const verifiedAt = payment.verifiedAt ? Math.floor(new Date(payment.verifiedAt).getTime() / 1000) : null;
    return {
      detected: true,
      txid: payment.autoVerifiedTxid,
      confirmations: MIN_CONFIRMATIONS,
      requiredConfirmations: MIN_CONFIRMATIONS,
      mempoolUrl: `https://mempool.space/tx/${payment.autoVerifiedTxid}`,
      seenAt: verifiedAt,
      finalized: true,
    };
  }

  // Manual verify or non-pending non-auto rows: nothing to look up.
  if (payment.status !== "pending") {
    return emptyStatus(payment.status === "verified");
  }

  const cached = statusCache.get(payment.id);
  if (cached && Date.now() - cached.ts < STATUS_CACHE_MS) return cached.status;

  const btcAddress = process.env.BTC_WALLET_ADDRESS;
  if (!btcAddress) return emptyStatus();

  try {
    const sats = Math.round(parseFloat(payment.btcAmount) * 1e8);
    if (!Number.isFinite(sats) || sats <= 0) return emptyStatus();
    const paymentCreatedAt = Math.floor(new Date(payment.createdAt).getTime() / 1000);
    const SKEW_TOLERANCE_S = 5 * 60;

    const [confirmedRes, mempoolRes, tipRes] = await Promise.all([
      fetch(`https://mempool.space/api/address/${btcAddress}/txs/chain`),
      fetch(`https://mempool.space/api/address/${btcAddress}/txs/mempool`),
      fetch("https://mempool.space/api/blocks/tip/height"),
    ]);
    const confirmed = confirmedRes.ok ? await confirmedRes.json() : [];
    const unconfirmed = mempoolRes.ok ? await mempoolRes.json() : [];
    const tipHeight = tipRes.ok ? parseInt(await tipRes.text(), 10) || 0 : 0;
    const txs = [
      ...(Array.isArray(confirmed) ? confirmed : []),
      ...(Array.isArray(unconfirmed) ? unconfirmed : []),
    ];

    // Don't surface txids that already settled a different payment.
    const priorTxidRows = await db.select({ txid: bitcoinPayments.autoVerifiedTxid })
      .from(bitcoinPayments)
      .where(isNotNull(bitcoinPayments.autoVerifiedTxid));
    const consumed = new Set<string>();
    for (const row of priorTxidRows) {
      if (row.txid) consumed.add(row.txid);
    }

    let best: BlockchainStatus | null = null;
    for (const tx of txs) {
      if (!tx?.txid || consumed.has(tx.txid)) continue;
      let outSats = 0;
      for (const out of (tx.vout || [])) {
        if (out?.scriptpubkey_address === btcAddress && typeof out.value === "number") {
          outSats += out.value;
        }
      }
      if (outSats !== sats) continue;
      const confirmedFlag = tx?.status?.confirmed === true;
      const blockHeight = typeof tx?.status?.block_height === "number" ? tx.status.block_height : 0;
      const confs = confirmedFlag && tipHeight && blockHeight
        ? Math.max(0, tipHeight - blockHeight + 1)
        : 0;
      const blockTime = typeof tx?.status?.block_time === "number" ? tx.status.block_time : 0;
      const firstSeen = typeof tx?.firstSeen === "number" ? tx.firstSeen : 0;
      const seenAt = blockTime || firstSeen || Math.floor(Date.now() / 1000);
      if (seenAt < paymentCreatedAt - SKEW_TOLERANCE_S) continue;
      const candidate: BlockchainStatus = {
        detected: true,
        txid: tx.txid,
        confirmations: confs,
        requiredConfirmations: MIN_CONFIRMATIONS,
        mempoolUrl: `https://mempool.space/tx/${tx.txid}`,
        seenAt,
        finalized: false,
      };
      if (!best || candidate.confirmations > best.confirmations) best = candidate;
    }

    const status = best ?? emptyStatus();
    statusCache.set(payment.id, { ts: Date.now(), status });
    return status;
  } catch (_err) {
    return emptyStatus();
  }
}

// ─── Blockchain poller ────────────────────────────────────────────────────────
//
// Polls mempool.space for the configured BTC_WALLET_ADDRESS and matches
// incoming transactions against pending bitcoin_payments rows by exact
// btcAmount (sat-precision) within the payment's lifetime. Once a tx with
// MIN_CONFIRMATIONS confirmations is matched, the payment is auto-verified
// via verifyBitcoinPayment, which finalizes any held jewelry and credits
// rewards just like the manual admin path.
//
// Matching strategy: each pending payment quotes a BTC amount derived from a
// live USD/BTC price at create time, so the resulting BTC values have
// 8-decimal precision and are extremely unlikely to collide between two
// concurrent customers. We require an exact sat match. If two pending rows
// happen to share the same satoshi amount (degenerate case), we skip both
// for that tick rather than risk crediting the wrong customer.

export const MIN_CONFIRMATIONS = 1;
// Look back this far past createdAt — sometimes a tx broadcasts late or
// the admin is slow to flip the row from pending; we still want to
// auto-verify rather than leave a paid customer stranded. Sized to
// comfortably exceed the jewelry-hold extension window (BTC payment
// expiry ~30min + 24h grace from /api/btc/create-payment) so the sweep
// never goes blind on a still-held row in its final hour.
const POST_EXPIRY_GRACE_MS = 72 * 60 * 60 * 1000;

let sweepRunning = false;

export interface BitcoinSweepResult {
  scanned: number;
  verified: number;
  failures: Array<{ paymentId: string; error: string }>;
}

export async function runBitcoinPaymentSweep(): Promise<BitcoinSweepResult | null> {
  if (sweepRunning) return null;
  sweepRunning = true;
  try {
    return await sweepInternal();
  } finally {
    sweepRunning = false;
  }
}

async function sweepInternal(): Promise<BitcoinSweepResult> {
  const result: BitcoinSweepResult = { scanned: 0, verified: 0, failures: [] };
  const btcAddress = process.env.BTC_WALLET_ADDRESS;
  if (!btcAddress) return result;

  const now = Date.now();
  const cutoff = new Date(now - POST_EXPIRY_GRACE_MS);

  // Pending payments still within their grace window. We sweep by createdAt
  // rather than expiresAt so payments without an explicit expiresAt still
  // qualify; the grace cutoff prevents an unbounded scan of ancient rows.
  const pending = await db.select().from(bitcoinPayments)
    .where(and(
      eq(bitcoinPayments.status, "pending"),
      sql`${bitcoinPayments.createdAt} > ${cutoff}`,
    ));

  result.scanned = pending.length;
  if (pending.length === 0) return result;

  // Fetch recent address activity from mempool.space. Returns up to ~50
  // confirmed + all unconfirmed txs for the address.
  let txs: Array<any>;
  try {
    const [confirmedRes, mempoolRes] = await Promise.all([
      fetch(`https://mempool.space/api/address/${btcAddress}/txs/chain`),
      fetch(`https://mempool.space/api/address/${btcAddress}/txs/mempool`),
    ]);
    if (!confirmedRes.ok) throw new Error(`mempool.space chain ${confirmedRes.status}`);
    if (!mempoolRes.ok) throw new Error(`mempool.space mempool ${mempoolRes.status}`);
    const confirmed = await confirmedRes.json();
    const unconfirmed = await mempoolRes.json();
    txs = [...(Array.isArray(confirmed) ? confirmed : []), ...(Array.isArray(unconfirmed) ? unconfirmed : [])];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[btc-auto-verify] mempool.space fetch failed (will retry next tick): ${msg}`);
    return result;
  }

  // Get the current chain tip for confirmation math.
  let tipHeight = 0;
  try {
    const tipRes = await fetch("https://mempool.space/api/blocks/tip/height");
    if (tipRes.ok) tipHeight = parseInt(await tipRes.text(), 10) || 0;
  } catch (_e) { /* best effort */ }

  // Persistent dedup: any txid already consumed by a prior auto-verify must
  // never be reused to verify a different payment, even across sweeps. We
  // load every previously-consumed txid (cheap — a single indexed-ish col)
  // and exclude them as candidate matches.
  const priorTxidRows = await db.select({ txid: bitcoinPayments.autoVerifiedTxid })
    .from(bitcoinPayments)
    .where(isNotNull(bitcoinPayments.autoVerifiedTxid));
  const consumedTxids = new Set<string>();
  for (const row of priorTxidRows) {
    if (row.txid) consumedTxids.add(row.txid);
  }

  // Sum sats sent TO our address per tx, with confirmation count and
  // earliest-known timestamp for the tx (block_time when confirmed,
  // first_seen for mempool). Time gating below requires this so we never
  // match a historical tx to a newly-created pending payment.
  interface IncomingTx {
    txid: string;
    sats: number;
    confirmations: number;
    /** UNIX seconds when the tx was first observed (block_time or first_seen). */
    seenAt: number;
  }
  const incoming: IncomingTx[] = [];
  for (const tx of txs) {
    if (!tx?.vout || !Array.isArray(tx.vout)) continue;
    if (!tx.txid || consumedTxids.has(tx.txid)) continue;
    let sats = 0;
    for (const out of tx.vout) {
      if (out?.scriptpubkey_address === btcAddress && typeof out.value === "number") {
        sats += out.value;
      }
    }
    if (sats <= 0) continue;
    const confirmed = tx?.status?.confirmed === true;
    const blockHeight = typeof tx?.status?.block_height === "number" ? tx.status.block_height : 0;
    const confirmations = confirmed && tipHeight && blockHeight
      ? Math.max(0, tipHeight - blockHeight + 1)
      : 0;
    const blockTime = typeof tx?.status?.block_time === "number" ? tx.status.block_time : 0;
    const firstSeen = typeof tx?.firstSeen === "number" ? tx.firstSeen : 0;
    // For unconfirmed mempool entries mempool.space does not always return
    // first_seen; fall back to "now" so we still gate against truly old
    // historical txs (those will have block_time set).
    const seenAt = blockTime || firstSeen || Math.floor(Date.now() / 1000);
    incoming.push({ txid: tx.txid, sats, confirmations, seenAt });
  }

  if (incoming.length === 0) return result;

  // Group payments by exact sat amount so we can skip ambiguous matches
  // (two pending rows with the same sat amount).
  const paymentsBySats = new Map<number, typeof pending>();
  for (const p of pending) {
    const sats = Math.round(parseFloat(p.btcAmount) * 1e8);
    if (!Number.isFinite(sats) || sats <= 0) continue;
    const arr = paymentsBySats.get(sats) ?? [];
    arr.push(p);
    paymentsBySats.set(sats, arr);
  }

  // Group incoming txs by sat amount — if two valid txs share the same
  // sat amount within the qualifying window we cannot tell which one paid
  // which payment, so we skip the whole bucket rather than guess.
  const txsBySats = new Map<number, IncomingTx[]>();
  for (const tx of incoming) {
    if (tx.confirmations < MIN_CONFIRMATIONS) continue;
    if (!paymentsBySats.has(tx.sats)) continue;
    const arr = txsBySats.get(tx.sats) ?? [];
    arr.push(tx);
    txsBySats.set(tx.sats, arr);
  }

  for (const [sats, txList] of txsBySats) {
    const candidates = paymentsBySats.get(sats);
    if (!candidates || candidates.length === 0) continue;
    if (candidates.length > 1) {
      console.warn(`[btc-auto-verify] ambiguous sat match (${sats} sats) — ${candidates.length} pending payments share this amount, skipping`);
      continue;
    }
    const payment = candidates[0];
    const paymentCreatedAt = Math.floor(new Date(payment.createdAt).getTime() / 1000);
    // Time gate: the tx must have been seen at or after the payment was
    // created. Allow a small clock-skew tolerance (5 min) so a tx that was
    // broadcast right around the same second as the payment row was
    // written still qualifies.
    const SKEW_TOLERANCE_S = 5 * 60;
    const eligible = txList.filter(t => t.seenAt >= paymentCreatedAt - SKEW_TOLERANCE_S);
    if (eligible.length === 0) {
      // We saw a sat-match, but every candidate tx predates this payment —
      // almost certainly a historical/replay match against this shared
      // wallet. Do NOT auto-verify.
      console.warn(`[btc-auto-verify] sat-match for payment ${payment.id} (${sats} sats) ignored — all candidate txs predate payment creation`);
      continue;
    }
    if (eligible.length > 1) {
      console.warn(`[btc-auto-verify] ambiguous tx match for payment ${payment.id} (${sats} sats) — ${eligible.length} eligible txs, skipping`);
      continue;
    }
    const tx = eligible[0];
    try {
      await verifyBitcoinPayment(payment.id, {
        status: "verified",
        verifiedByUserId: null,
        autoVerified: true,
        autoVerifiedTxid: tx.txid,
      });
      result.verified += 1;
      console.log(`[btc-auto-verify] verified payment ${payment.id} via txid ${tx.txid} (${tx.confirmations} confs, seenAt=${tx.seenAt}, paymentCreatedAt=${paymentCreatedAt})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failures.push({ paymentId: payment.id, error: msg });
    }
  }

  return result;
}

// Re-export for callers that only need the type.
export type { BitcoinPayment };
