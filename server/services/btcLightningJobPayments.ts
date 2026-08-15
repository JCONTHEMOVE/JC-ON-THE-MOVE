import { pool } from "../db";
import { storage } from "../storage";
import { emitJobEvent } from "./jobEventBus";
import { PLATFORM_REDEEM_RATE } from "../../shared/tokenRedemptionRules";
import {
  BTC_LIGHTNING_PAYMENT_RAIL,
  BTC_LIGHTNING_SETTLEMENT_CURRENCY,
  BTC_LIGHTNING_TREASURY_RETENTION_PERCENT,
} from "../../shared/btcLightningOffer";
import {
  TREASURY_CONVERSION_POLICY,
  TREASURY_CUSTODY_POLICY,
  TREASURY_VALUATION_CURRENCY,
} from "../../shared/treasuryAssetPolicy";

export const BTC_LIGHTNING_JOB_REFERENCE_TYPE = "job_payment_btc_lightning";

export type BtcLightningIntentRow = {
  id: number | string;
  user_id?: string | null;
  provider: string;
  provider_invoice_id?: string | null;
  status?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  amount_usd: string | number;
  original_amount_usd?: string | number | null;
  discount_percent?: string | number | null;
  discount_amount_usd?: string | number | null;
  reward_percent?: string | number | null;
  reward_value_usd?: string | number | null;
  bonus_tokens?: string | number | null;
  retention_percent?: string | number | null;
  payment_rail?: string | null;
  settlement_currency?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  metadata?: Record<string, unknown> | null;
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function providerInvoiceId(intent: BtcLightningIntentRow, invoice: Record<string, unknown>) {
  return typeof invoice.id === "string" && invoice.id.trim()
    ? invoice.id.trim()
    : String(intent.provider_invoice_id || "").trim();
}

function invoiceTransactionCurrency(invoice: Record<string, unknown>) {
  const value = invoice.transactionCurrency ?? invoice.selectedTransactionCurrency;
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function invoiceBtcAmount(invoice: Record<string, unknown>) {
  // BitPay documents displayAmountPaid in the base currency. amountPaid is
  // the smallest unit and is intentionally not used for treasury accounting.
  const display = numberValue(invoice.displayAmountPaid, Number.NaN);
  return Number.isFinite(display) && display > 0 ? display : null;
}

export function getBtcLightningReadiness() {
  const enabled = process.env.CRYPTO_PAYMENTS_ENABLED === "true";
  const provider = (process.env.CRYPTO_PAYMENTS_PROVIDER || "bitpay").trim().toLowerCase();
  const hasApiToken = Boolean(process.env.BITPAY_API_TOKEN?.trim());
  const declaredCurrency = (process.env.BITPAY_BTC_SETTLEMENT_CURRENCY || "").trim().toUpperCase();
  const declaredRetention = numberValue(process.env.BITPAY_BTC_SETTLEMENT_PERCENT, 0);
  const declaredCustodyPolicy = String(process.env.CRYPTO_TREASURY_CUSTODY_POLICY || "").trim().toLowerCase();
  const declaredConversionPolicy = String(process.env.CRYPTO_TREASURY_CONVERSION_POLICY || "").trim().toLowerCase();
  const settlementPolicyReady = declaredCurrency === BTC_LIGHTNING_SETTLEMENT_CURRENCY
    && declaredRetention === BTC_LIGHTNING_TREASURY_RETENTION_PERCENT;
  const custodyPolicyReady = declaredCustodyPolicy === TREASURY_CUSTODY_POLICY
    && declaredConversionPolicy === TREASURY_CONVERSION_POLICY;
  const ready = enabled && provider === "bitpay" && hasApiToken && settlementPolicyReady && custodyPolicyReady;
  const blockers: string[] = [];
  if (!enabled) blockers.push("CRYPTO_PAYMENTS_ENABLED must be true");
  if (provider !== "bitpay") blockers.push("CRYPTO_PAYMENTS_PROVIDER must be bitpay");
  if (!hasApiToken) blockers.push("BITPAY_API_TOKEN is missing");
  if (!settlementPolicyReady) {
    blockers.push("Declare BITPAY_BTC_SETTLEMENT_CURRENCY=BTC and BITPAY_BTC_SETTLEMENT_PERCENT=100 after configuring the same split in BitPay");
  }
  if (!custodyPolicyReady) {
    blockers.push("Declare CRYPTO_TREASURY_CUSTODY_POLICY=preserve_received_asset and CRYPTO_TREASURY_CONVERSION_POLICY=manual_only");
  }
  return {
    ready,
    provider,
    paymentRail: BTC_LIGHTNING_PAYMENT_RAIL,
    receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
    settlementCurrency: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
    treasuryRetentionPercent: BTC_LIGHTNING_TREASURY_RETENTION_PERCENT,
    valuationCurrency: TREASURY_VALUATION_CURRENCY,
    custodyPolicy: TREASURY_CUSTODY_POLICY,
    conversionPolicy: TREASURY_CONVERSION_POLICY,
    automaticConversionEnabled: false,
    externalSettlementVerificationRequired: true,
    blockers,
  };
}

export async function ensureBtcLightningJobPaymentTables() {
  await pool.query(`
    ALTER TABLE crypto_payment_intents ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS original_amount_usd NUMERIC(10,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS discount_amount_usd NUMERIC(10,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS reward_percent NUMERIC(5,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS reward_value_usd NUMERIC(10,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS retention_percent NUMERIC(5,2);
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS payment_rail TEXT;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS settlement_currency TEXT;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS customer_name TEXT;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS customer_email TEXT;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS customer_phone TEXT;
    ALTER TABLE crypto_payment_intents ADD COLUMN IF NOT EXISTS status_token TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_crypto_payment_intents_status_token
      ON crypto_payment_intents(status_token) WHERE status_token IS NOT NULL;

    CREATE TABLE IF NOT EXISTS btc_lightning_reward_claims (
      id                    BIGSERIAL PRIMARY KEY,
      crypto_intent_id      INTEGER NOT NULL REFERENCES crypto_payment_intents(id) ON DELETE CASCADE,
      lead_id               VARCHAR NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      customer_email        TEXT NOT NULL,
      customer_user_id      VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      token_amount          NUMERIC(18,8) NOT NULL CHECK (token_amount >= 0),
      reward_value_usd      NUMERIC(10,2) NOT NULL CHECK (reward_value_usd >= 0),
      reversed_tokens       NUMERIC(18,8) NOT NULL DEFAULT 0 CHECK (reversed_tokens >= 0),
      status                TEXT NOT NULL DEFAULT 'pending_claim',
      credited_at           TIMESTAMPTZ,
      metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (crypto_intent_id)
    );
    CREATE INDEX IF NOT EXISTS idx_btc_lightning_reward_claims_email
      ON btc_lightning_reward_claims(LOWER(customer_email), status);

    CREATE TABLE IF NOT EXISTS btc_treasury_ledger (
      id                    BIGSERIAL PRIMARY KEY,
      crypto_intent_id      INTEGER NOT NULL REFERENCES crypto_payment_intents(id) ON DELETE RESTRICT,
      lead_id               VARCHAR NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
      provider              TEXT NOT NULL,
      provider_invoice_id   TEXT NOT NULL,
      payment_rail          TEXT NOT NULL DEFAULT 'btc_lightning',
      transaction_currency  TEXT NOT NULL DEFAULT 'BTC',
      settlement_currency   TEXT NOT NULL DEFAULT 'BTC',
      valuation_currency    TEXT NOT NULL DEFAULT 'USD',
      custody_policy        TEXT NOT NULL DEFAULT 'preserve_received_asset',
      conversion_status     TEXT NOT NULL DEFAULT 'not_converted',
      converted_at          TIMESTAMPTZ,
      conversion_reference TEXT,
      conversion_metadata  JSONB,
      original_amount_usd   NUMERIC(10,2) NOT NULL,
      discount_amount_usd   NUMERIC(10,2) NOT NULL,
      amount_paid_usd       NUMERIC(10,2) NOT NULL,
      reward_value_usd      NUMERIC(10,2) NOT NULL,
      reward_tokens         NUMERIC(18,8) NOT NULL,
      gross_btc_amount      NUMERIC(24,12),
      provider_fee_usd      NUMERIC(10,2),
      net_btc_amount        NUMERIC(24,12),
      retained_btc_amount   NUMERIC(24,12),
      retention_percent     NUMERIC(5,2) NOT NULL DEFAULT 100,
      refunded_amount_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
      reward_reversed_tokens NUMERIC(18,8) NOT NULL DEFAULT 0,
      settlement_reference  TEXT,
      status                TEXT NOT NULL DEFAULT 'received_asset_pending_reconciliation',
      raw_provider_payload  JSONB,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (crypto_intent_id),
      UNIQUE (provider, provider_invoice_id)
    );
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS valuation_currency TEXT NOT NULL DEFAULT 'USD';
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS custody_policy TEXT NOT NULL DEFAULT 'preserve_received_asset';
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS conversion_status TEXT NOT NULL DEFAULT 'not_converted';
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS conversion_reference TEXT;
    ALTER TABLE btc_treasury_ledger ADD COLUMN IF NOT EXISTS conversion_metadata JSONB;
    UPDATE btc_treasury_ledger
       SET status='received_asset_pending_reconciliation'
     WHERE status='policy_pending_reconciliation';
    CREATE INDEX IF NOT EXISTS idx_btc_treasury_ledger_lead ON btc_treasury_ledger(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS btc_treasury_adjustments (
      id                    BIGSERIAL PRIMARY KEY,
      crypto_intent_id      INTEGER NOT NULL REFERENCES crypto_payment_intents(id) ON DELETE RESTRICT,
      adjustment_key        TEXT NOT NULL UNIQUE,
      adjustment_type       TEXT NOT NULL,
      amount_usd            NUMERIC(10,2) NOT NULL DEFAULT 0,
      btc_amount            NUMERIC(24,12),
      reward_tokens         NUMERIC(18,8) NOT NULL DEFAULT 0,
      external_reference    TEXT,
      reason                TEXT NOT NULL,
      recorded_by_user_id   VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_btc_treasury_adjustments_intent
      ON btc_treasury_adjustments(crypto_intent_id, created_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_rewards_btc_lightning_bonus_ref
      ON rewards(reference_id)
      WHERE reward_type = 'customer_btc_lightning_bonus' AND reference_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_rewards_btc_lightning_reversal_ref
      ON rewards(reference_id)
      WHERE reward_type = 'customer_btc_lightning_bonus_reversal' AND reference_id IS NOT NULL;
  `);
}

async function creditRewardClaim(claimId: number): Promise<{ awarded: boolean; pendingClaim: boolean; userId: string | null }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      id: number;
      crypto_intent_id: number;
      lead_id: string;
      customer_email: string;
      customer_user_id: string | null;
      token_amount: string;
      reward_value_usd: string;
      reversed_tokens: string;
      status: string;
    }>("SELECT * FROM btc_lightning_reward_claims WHERE id = $1 FOR UPDATE", [claimId]);
    const claim = rows[0];
    if (!claim) throw new Error("Bitcoin Lightning reward claim was not found");
    if (["credited", "partially_reversed", "reversed"].includes(claim.status)) {
      await client.query("COMMIT");
      return { awarded: false, pendingClaim: false, userId: claim.customer_user_id };
    }

    let userId = claim.customer_user_id;
    if (!userId) {
      const userRows = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [claim.customer_email],
      );
      userId = userRows.rows[0]?.id || null;
    }
    if (!userId) {
      await client.query("COMMIT");
      return { awarded: false, pendingClaim: true, userId: null };
    }

    const originalTokens = numberValue(claim.token_amount);
    const reversedTokens = numberValue(claim.reversed_tokens);
    const tokens = Math.max(0, originalTokens - reversedTokens);
    if (tokens <= 0) {
      await client.query(
        "UPDATE btc_lightning_reward_claims SET customer_user_id=$1, status='reversed', updated_at=NOW() WHERE id=$2",
        [userId, claimId],
      );
      await client.query("COMMIT");
      return { awarded: false, pendingClaim: false, userId };
    }

    await client.query(
      "INSERT INTO wallet_accounts (user_id, token_balance, cash_balance) VALUES ($1, '0', '0.00') ON CONFLICT (user_id) DO NOTHING",
      [userId],
    );
    const rewardValueUsd = tokens / PLATFORM_REDEEM_RATE;
    const inserted = await client.query(
      `INSERT INTO rewards
        (user_id, reward_type, token_amount, cash_value, status, earned_date, reference_id, metadata)
       VALUES ($1, 'customer_btc_lightning_bonus', $2, $3, 'confirmed', NOW(), $4, $5::jsonb)
       ON CONFLICT (reference_id)
         WHERE reward_type = 'customer_btc_lightning_bonus' AND reference_id IS NOT NULL
       DO NOTHING
       RETURNING id`,
      [
        userId,
        tokens.toFixed(8),
        rewardValueUsd.toFixed(2),
        `btc-lightning:${claim.crypto_intent_id}`,
        JSON.stringify({
          source: BTC_LIGHTNING_PAYMENT_RAIL,
          leadId: claim.lead_id,
          cryptoIntentId: claim.crypto_intent_id,
          rewardPercent: 5,
          platformRedeemRate: PLATFORM_REDEEM_RATE,
        }),
      ],
    );
    if ((inserted.rowCount ?? 0) > 0) {
      await client.query(
        `UPDATE wallet_accounts
            SET token_balance = COALESCE(token_balance, 0)::numeric + $1::numeric,
                total_earned = COALESCE(total_earned, 0)::numeric + $1::numeric,
                last_activity = NOW()
          WHERE user_id = $2`,
        [tokens.toFixed(8), userId],
      );
    }
    await client.query(
      `UPDATE btc_lightning_reward_claims
          SET customer_user_id=$1,
              status='credited',
              credited_at=COALESCE(credited_at, NOW()),
              metadata=metadata || jsonb_build_object('walletCreditedAt', NOW()::text),
              updated_at=NOW()
        WHERE id=$2`,
      [userId, claimId],
    );
    await client.query("COMMIT");
    return { awarded: (inserted.rowCount ?? 0) > 0, pendingClaim: false, userId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createOrCreditRewardClaim(intent: BtcLightningIntentRow) {
  const leadId = String(intent.reference_id || "").trim();
  const email = normalizedEmail(intent.customer_email);
  const tokenAmount = numberValue(intent.bonus_tokens);
  const rewardValueUsd = numberValue(intent.reward_value_usd, tokenAmount / PLATFORM_REDEEM_RATE);
  if (!leadId || !email || tokenAmount <= 0) {
    throw new Error("Lightning reward claim is missing its job, customer email, or token amount");
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO btc_lightning_reward_claims
      (crypto_intent_id, lead_id, customer_email, customer_user_id, token_amount, reward_value_usd, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
     ON CONFLICT (crypto_intent_id) DO UPDATE
       SET updated_at=NOW()
     RETURNING id`,
    [
      intent.id,
      leadId,
      email,
      intent.user_id || null,
      tokenAmount.toFixed(8),
      rewardValueUsd.toFixed(2),
      JSON.stringify({ source: BTC_LIGHTNING_PAYMENT_RAIL, rewardPercent: numberValue(intent.reward_percent, 5) }),
    ],
  );
  return creditRewardClaim(rows[0].id);
}

export async function settleBtcLightningJobPayment(
  intent: BtcLightningIntentRow,
  providerInvoice: Record<string, unknown>,
  source: string,
) {
  if (intent.reference_type !== BTC_LIGHTNING_JOB_REFERENCE_TYPE) {
    throw new Error("Not a Bitcoin Lightning job-payment intent");
  }
  const leadId = String(intent.reference_id || "").trim();
  const invoiceId = providerInvoiceId(intent, providerInvoice);
  const currency = invoiceTransactionCurrency(providerInvoice);
  if (!leadId || !invoiceId) throw new Error("Lightning payment is missing its job or provider invoice");
  if (currency && currency !== BTC_LIGHTNING_SETTLEMENT_CURRENCY) {
    throw new Error(`Lightning job checkout only accepts BTC; provider reported ${currency}`);
  }

  const lead = await storage.getLead(leadId);
  if (!lead) throw new Error("Paid Lightning invoice references a missing job");

  const originalAmountUsd = numberValue(intent.original_amount_usd);
  const discountAmountUsd = numberValue(intent.discount_amount_usd);
  const amountPaidUsd = numberValue(intent.amount_usd);
  const rewardValueUsd = numberValue(intent.reward_value_usd);
  const rewardTokens = numberValue(intent.bonus_tokens);
  if (originalAmountUsd <= 0 || amountPaidUsd <= 0 || rewardTokens <= 0) {
    throw new Error("Lightning job offer amounts are incomplete");
  }

  await pool.query(
    `INSERT INTO btc_treasury_ledger
      (crypto_intent_id, lead_id, provider, provider_invoice_id, payment_rail,
       transaction_currency, settlement_currency, valuation_currency, custody_policy,
       conversion_status, original_amount_usd,
       discount_amount_usd, amount_paid_usd, reward_value_usd, reward_tokens,
       gross_btc_amount, retention_percent, raw_provider_payload)
     VALUES ($1,$2,$3,$4,$5,'BTC','BTC','USD','preserve_received_asset','not_converted',$6,$7,$8,$9,$10,$11,100,$12::jsonb)
     ON CONFLICT (crypto_intent_id) DO UPDATE
       SET raw_provider_payload=EXCLUDED.raw_provider_payload,
           gross_btc_amount=COALESCE(btc_treasury_ledger.gross_btc_amount, EXCLUDED.gross_btc_amount),
           custody_policy='preserve_received_asset',
           conversion_status=CASE WHEN btc_treasury_ledger.conversion_status='converted' THEN 'converted' ELSE 'not_converted' END,
           updated_at=NOW()`,
    [
      intent.id,
      leadId,
      intent.provider || "bitpay",
      invoiceId,
      BTC_LIGHTNING_PAYMENT_RAIL,
      originalAmountUsd.toFixed(2),
      discountAmountUsd.toFixed(2),
      amountPaidUsd.toFixed(2),
      rewardValueUsd.toFixed(2),
      rewardTokens.toFixed(8),
      invoiceBtcAmount(providerInvoice),
      JSON.stringify({ source, providerInvoice }),
    ],
  );

  const alreadyPaid = Boolean(lead.paymentPaidAt);
  await pool.query(
    `UPDATE leads
        SET payment_paid_at=COALESCE(payment_paid_at, NOW()),
            payment_plan='btc_lightning',
            deposit_paid=true,
            last_quote_updated_at=NOW()
      WHERE id=$1`,
    [leadId],
  );
  if (!alreadyPaid) {
    await pool.query(
      `INSERT INTO lead_history (lead_id, from_status, to_status, changed_by_user_id, note)
       VALUES ($1,$2,$2,NULL,$3)`,
      [
        leadId,
        lead.status || "paid",
        `Bitcoin Lightning payment confirmed: original USD accounting value $${originalAmountUsd.toFixed(2)}, discount $${discountAmountUsd.toFixed(2)}, paid value $${amountPaidUsd.toFixed(2)}, reward ${rewardTokens.toLocaleString()} JCMOVES. Received asset remains BTC; automatic conversion is disabled. Provider invoice ${invoiceId}.`,
      ],
    ).catch(() => {});
  }

  const reward = await createOrCreditRewardClaim(intent);
  await pool.query(
    `UPDATE crypto_payment_intents
        SET status='paid',
            provider_status=$1,
            credited_at=COALESCE(credited_at, NOW()),
            bonus_awarded_at=CASE WHEN $2::boolean THEN COALESCE(bonus_awarded_at, NOW()) ELSE bonus_awarded_at END,
            paid_at=COALESCE(paid_at, NOW()),
            raw_provider_payload=$3::jsonb,
            updated_at=NOW()
      WHERE id=$4`,
    [String(providerInvoice.status || "complete"), !reward.pendingClaim, JSON.stringify({ source, providerInvoice }), intent.id],
  );

  const freshLead = await storage.getLead(leadId);
  if (freshLead) {
    await emitJobEvent("job_updated", freshLead, {
      source: "btc_lightning_payment",
      previousStatus: lead.status,
      status: freshLead.status,
      note: "Bitcoin Lightning payment confirmed. Job payment and treasury ledgers were updated.",
      extra: { paymentReceived: true, providerInvoiceId: invoiceId, paymentRail: BTC_LIGHTNING_PAYMENT_RAIL },
    }).catch(() => {});
  }

  try {
    const { grantWalletCreditForSource } = await import("./bundleBilling");
    await grantWalletCreditForSource({
      sourceType: "lead",
      sourceId: leadId,
      paymentReference: `crypto:${intent.provider || "bitpay"}:${invoiceId}`,
    });
  } catch (error) {
    console.error("[btc-lightning] Shop-card grant reconciliation failed (non-fatal):", error);
  }

  if (lead.status === "completed") {
    try {
      const { disburseJobTokens } = await import("./disburse-job-tokens");
      await disburseJobTokens(leadId);
    } catch (error) {
      console.error("[btc-lightning] Completed-job JCMOVES disbursement failed (non-fatal):", error);
    }
  }

  return {
    success: true,
    status: "paid",
    providerStatus: String(providerInvoice.status || "complete"),
    bonusTokens: rewardTokens,
    bonusAwarded: reward.awarded,
    pendingCustomerClaim: reward.pendingClaim,
    treasuryRetentionPercent: BTC_LIGHTNING_TREASURY_RETENTION_PERCENT,
    receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
    valuationCurrency: TREASURY_VALUATION_CURRENCY,
    custodyPolicy: TREASURY_CUSTODY_POLICY,
    conversionPolicy: TREASURY_CONVERSION_POLICY,
  };
}

export async function claimPendingBtcLightningBonuses(args: { userId: string; email?: string | null }) {
  const email = normalizedEmail(args.email);
  if (!email) return 0;
  const { rows } = await pool.query<{ id: number }>(
    `UPDATE btc_lightning_reward_claims
        SET customer_user_id=$1, updated_at=NOW()
      WHERE LOWER(customer_email)=$2
        AND customer_user_id IS NULL
        AND status='pending_claim'
      RETURNING id`,
    [args.userId, email],
  );
  let credited = 0;
  for (const row of rows) {
    const result = await creditRewardClaim(row.id);
    if (result.awarded) credited++;
  }
  return credited;
}

export async function recordBtcLightningRefund(args: {
  intentId: number;
  refundAmountUsd: number;
  providerRefundReference: string;
  reason: string;
  actorUserId: string | null;
}) {
  if (!Number.isFinite(args.refundAmountUsd) || args.refundAmountUsd <= 0) throw new Error("Refund amount must be greater than zero");
  if (!args.providerRefundReference.trim()) throw new Error("Provider refund reference is required");
  if (!args.reason.trim()) throw new Error("Refund reason is required");
  const adjustmentKey = `btc-lightning-refund:${args.providerRefundReference.trim()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM btc_treasury_adjustments WHERE adjustment_key=$1", [adjustmentKey]);
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("COMMIT");
      return { success: true, alreadyRecorded: true };
    }
    const ledgerRows = await client.query<{
      lead_id: string;
      amount_paid_usd: string;
      refunded_amount_usd: string;
      reward_tokens: string;
      reward_reversed_tokens: string;
    }>("SELECT * FROM btc_treasury_ledger WHERE crypto_intent_id=$1 FOR UPDATE", [args.intentId]);
    const ledger = ledgerRows.rows[0];
    if (!ledger) throw new Error("Bitcoin treasury ledger entry was not found");
    const paid = numberValue(ledger.amount_paid_usd);
    const alreadyRefunded = numberValue(ledger.refunded_amount_usd);
    const refund = Math.round(args.refundAmountUsd * 100) / 100;
    if (alreadyRefunded + refund > paid + 0.005) throw new Error("Refund adjustments cannot exceed the amount paid");

    const claimRows = await client.query<{
      id: number;
      lead_id: string;
      customer_user_id: string | null;
      token_amount: string;
      reversed_tokens: string;
      status: string;
    }>("SELECT * FROM btc_lightning_reward_claims WHERE crypto_intent_id=$1 FOR UPDATE", [args.intentId]);
    const claim = claimRows.rows[0];
    if (!claim) throw new Error("Bitcoin Lightning reward claim was not found");
    const totalTokens = numberValue(claim.token_amount);
    const alreadyReversedTokens = numberValue(claim.reversed_tokens);
    const isFullRefund = Math.abs((alreadyRefunded + refund) - paid) < 0.005;
    const proportionalTokens = isFullRefund
      ? totalTokens - alreadyReversedTokens
      : Math.round(totalTokens * (refund / paid));
    const tokensToReverse = Math.max(0, Math.min(totalTokens - alreadyReversedTokens, proportionalTokens));
    const reversalValueUsd = tokensToReverse / PLATFORM_REDEEM_RATE;

    if (claim.customer_user_id && claim.status !== "pending_claim" && tokensToReverse > 0) {
      await client.query(
        `UPDATE wallet_accounts
            SET token_balance=COALESCE(token_balance, 0)::numeric - $1::numeric,
                last_activity=NOW()
          WHERE user_id=$2`,
        [tokensToReverse.toFixed(8), claim.customer_user_id],
      );
      await client.query(
        `INSERT INTO rewards
          (user_id, reward_type, token_amount, cash_value, status, earned_date, reference_id, metadata)
         VALUES ($1,'customer_btc_lightning_bonus_reversal',$2,$3,'confirmed',NOW(),$4,$5::jsonb)
         ON CONFLICT (reference_id)
           WHERE reward_type='customer_btc_lightning_bonus_reversal' AND reference_id IS NOT NULL
         DO NOTHING`,
        [
          claim.customer_user_id,
          (-tokensToReverse).toFixed(8),
          (-reversalValueUsd).toFixed(2),
          adjustmentKey,
          JSON.stringify({
            source: "btc_lightning_refund",
            leadId: claim.lead_id,
            cryptoIntentId: args.intentId,
            providerRefundReference: args.providerRefundReference,
            reason: args.reason,
          }),
        ],
      );
    }

    const newReversedTokens = alreadyReversedTokens + tokensToReverse;
    await client.query(
      `UPDATE btc_lightning_reward_claims
          SET reversed_tokens=$1,
              status=CASE WHEN $1::numeric >= token_amount THEN 'reversed' ELSE CASE WHEN status='pending_claim' THEN 'pending_claim' ELSE 'partially_reversed' END END,
              metadata=metadata || jsonb_build_object('lastRefundReference',$2,'lastRefundReason',$3),
              updated_at=NOW()
        WHERE id=$4`,
      [newReversedTokens.toFixed(8), args.providerRefundReference, args.reason, claim.id],
    );
    await client.query(
      `UPDATE btc_treasury_ledger
          SET refunded_amount_usd=refunded_amount_usd + $1,
              reward_reversed_tokens=reward_reversed_tokens + $2,
              status=CASE WHEN refunded_amount_usd + $1 >= amount_paid_usd THEN 'refunded' ELSE 'partially_refunded' END,
              updated_at=NOW()
        WHERE crypto_intent_id=$3`,
      [refund.toFixed(2), tokensToReverse.toFixed(8), args.intentId],
    );
    await client.query(
      `INSERT INTO btc_treasury_adjustments
        (crypto_intent_id, adjustment_key, adjustment_type, amount_usd, reward_tokens,
         external_reference, reason, recorded_by_user_id, metadata)
       VALUES ($1,$2,'refund',$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        args.intentId,
        adjustmentKey,
        refund.toFixed(2),
        tokensToReverse.toFixed(8),
        args.providerRefundReference,
        args.reason,
        args.actorUserId,
        JSON.stringify({ platformRedeemRate: PLATFORM_REDEEM_RATE }),
      ],
    );
    if (isFullRefund) {
      const leadRows = await client.query<{ status: string | null }>(
        `UPDATE leads
            SET payment_paid_at=NULL,
                deposit_paid=false,
                last_quote_updated_at=NOW()
          WHERE id=$1
          RETURNING status`,
        [ledger.lead_id],
      );
      const leadStatus = leadRows.rows[0]?.status || "paid";
      await client.query(
        `INSERT INTO lead_history (lead_id, from_status, to_status, changed_by_user_id, note)
         VALUES ($1,$2,$2,$3,$4)`,
        [
          ledger.lead_id,
          leadStatus,
          args.actorUserId,
          `Bitcoin payment was fully refunded. Payment confirmation was removed. Provider refund ${args.providerRefundReference.trim()}. Reason: ${args.reason.trim()}`,
        ],
      );
    }
    await client.query("COMMIT");
    return { success: true, alreadyRecorded: false, refundAmountUsd: refund, rewardTokensReversed: tokensToReverse };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function reconcileBtcLightningSettlement(args: {
  intentId: number;
  netBtcAmount: number;
  providerFeeUsd?: number | null;
  settlementReference: string;
  reason: string;
  actorUserId: string | null;
}) {
  if (!Number.isFinite(args.netBtcAmount) || args.netBtcAmount <= 0) throw new Error("Net BTC amount must be greater than zero");
  if (!args.settlementReference.trim()) throw new Error("Settlement reference is required");
  if (!args.reason.trim()) throw new Error("Reconciliation reason is required");
  const fee = args.providerFeeUsd == null ? null : Math.round(args.providerFeeUsd * 100) / 100;
  if (fee != null && (!Number.isFinite(fee) || fee < 0)) throw new Error("Provider fee cannot be negative");
  const adjustmentKey = `btc-lightning-custody:${args.settlementReference.trim()}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id FROM btc_treasury_adjustments WHERE adjustment_key=$1", [adjustmentKey]);
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("COMMIT");
      return {
        success: true,
        retainedBtcAmount: args.netBtcAmount,
        retentionPercent: 100,
        receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
        conversionStatus: "not_converted",
        alreadyRecorded: true,
      };
    }
    const updated = await client.query(
      `UPDATE btc_treasury_ledger
          SET provider_fee_usd=$1,
              net_btc_amount=$2,
              retained_btc_amount=$2,
              retention_percent=100,
              settlement_reference=$3,
              custody_policy='preserve_received_asset',
              conversion_status=CASE WHEN conversion_status='converted' THEN 'converted' ELSE 'not_converted' END,
              status=CASE WHEN refunded_amount_usd >= amount_paid_usd THEN 'refunded' ELSE 'asset_held' END,
              updated_at=NOW()
        WHERE crypto_intent_id=$4
        RETURNING id`,
      [fee?.toFixed(2) ?? null, args.netBtcAmount.toFixed(12), args.settlementReference, args.intentId],
    );
    if ((updated.rowCount ?? 0) === 0) throw new Error("Bitcoin treasury ledger entry was not found");
    await client.query(
      `INSERT INTO btc_treasury_adjustments
        (crypto_intent_id, adjustment_key, adjustment_type, btc_amount, external_reference,
         reason, recorded_by_user_id, metadata)
       VALUES ($1,$2,'asset_custody_reconciliation',$3,$4,$5,$6,$7::jsonb)`,
      [
        args.intentId,
        adjustmentKey,
        args.netBtcAmount.toFixed(12),
        args.settlementReference,
        args.reason,
        args.actorUserId,
        JSON.stringify({
          retentionPercent: 100,
          receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
          valuationCurrency: TREASURY_VALUATION_CURRENCY,
          custodyPolicy: TREASURY_CUSTODY_POLICY,
          conversionPolicy: TREASURY_CONVERSION_POLICY,
        }),
      ],
    );
    await client.query("COMMIT");
    return {
      success: true,
      retainedBtcAmount: args.netBtcAmount,
      retentionPercent: 100,
      receivedAsset: BTC_LIGHTNING_SETTLEMENT_CURRENCY,
      conversionStatus: "not_converted",
      alreadyRecorded: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function listBtcLightningTreasuryLedger(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const [entries, totals, adjustments] = await Promise.all([
    pool.query(
      `SELECT ledger.*, l.order_number, l.first_name, l.last_name,
              claim.status AS reward_status, claim.customer_email
         FROM btc_treasury_ledger ledger
         JOIN leads l ON l.id=ledger.lead_id
         LEFT JOIN btc_lightning_reward_claims claim ON claim.crypto_intent_id=ledger.crypto_intent_id
        ORDER BY ledger.created_at DESC
        LIMIT $1`,
      [safeLimit],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS payment_count,
              COALESCE(SUM(original_amount_usd),0)::text AS original_amount_usd,
              COALESCE(SUM(discount_amount_usd),0)::text AS discount_amount_usd,
              COALESCE(SUM(amount_paid_usd),0)::text AS gross_amount_paid_usd,
              COALESCE(SUM(refunded_amount_usd),0)::text AS refunded_amount_usd,
              COALESCE(SUM(amount_paid_usd - refunded_amount_usd),0)::text AS amount_paid_usd,
              COALESCE(SUM(GREATEST(reward_tokens - reward_reversed_tokens, 0)) / ${PLATFORM_REDEEM_RATE},0)::text AS reward_value_usd,
              COALESCE(SUM(GREATEST(reward_tokens - reward_reversed_tokens, 0)),0)::text AS reward_tokens,
              COALESCE(SUM(gross_btc_amount),0)::text AS gross_btc_amount,
              COALESCE(SUM(net_btc_amount),0)::text AS net_btc_amount,
              COALESCE(SUM(retained_btc_amount),0)::text AS retained_btc_amount,
              COUNT(*) FILTER (WHERE net_btc_amount IS NULL)::int AS pending_reconciliation_count
         FROM btc_treasury_ledger`,
    ),
    pool.query(
      `SELECT * FROM btc_treasury_adjustments ORDER BY created_at DESC LIMIT $1`,
      [safeLimit],
    ),
  ]);
  return {
    readiness: getBtcLightningReadiness(),
    policy: {
      valuationCurrency: TREASURY_VALUATION_CURRENCY,
      custodyPolicy: TREASURY_CUSTODY_POLICY,
      conversionPolicy: TREASURY_CONVERSION_POLICY,
      automaticConversionEnabled: false,
    },
    offer: { discountPercent: 5, rewardPercent: 5, treasuryRetentionPercent: 100 },
    entries: entries.rows,
    totals: totals.rows[0],
    adjustments: adjustments.rows,
  };
}

/**
 * Returns the customer revenue still recognized for a Lightning-paid job.
 * The saved quote remains unchanged; discounts and any later refunds live in
 * the immutable payment/treasury records and flow into payout math here.
 */
export async function getBtcLightningRecognizedRevenue(leadId: string): Promise<{
  originalAmountUsd: number;
  amountPaidUsd: number;
  refundedAmountUsd: number;
  recognizedRevenueUsd: number;
} | null> {
  const { rows } = await pool.query<{
    original_amount_usd: string;
    amount_paid_usd: string;
    refunded_amount_usd: string;
    recognized_revenue_usd: string;
  }>(
    `SELECT COALESCE(SUM(original_amount_usd),0)::text AS original_amount_usd,
            COALESCE(SUM(amount_paid_usd),0)::text AS amount_paid_usd,
            COALESCE(SUM(refunded_amount_usd),0)::text AS refunded_amount_usd,
            COALESCE(SUM(amount_paid_usd - refunded_amount_usd),0)::text AS recognized_revenue_usd
       FROM btc_treasury_ledger
      WHERE lead_id=$1
      HAVING COUNT(*) > 0`,
    [leadId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    originalAmountUsd: numberValue(row.original_amount_usd),
    amountPaidUsd: numberValue(row.amount_paid_usd),
    refundedAmountUsd: numberValue(row.refunded_amount_usd),
    recognizedRevenueUsd: Math.max(0, numberValue(row.recognized_revenue_usd)),
  };
}
