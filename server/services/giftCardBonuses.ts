import crypto from "crypto";
import type { SquareClient } from "square";
import { pool } from "../db";
import { getAppUrl } from "../appUrl";
import { sendEmail } from "./email";
import {
  getGiftCardBonusReadiness,
  getGiftCardBonusStartAt,
  getSquareAccessToken,
  getSquareEnvironment,
  getSquareLocationId,
} from "./squareConfig";
export { getGiftCardBonusReadiness } from "./squareConfig";
import {
  GIFT_CARD_BONUS_AMOUNTS,
  GIFT_CARD_BONUS_HOLD_DAYS,
  GIFT_CARD_BONUS_MINIMUM_CENTS,
  GIFT_CARD_BONUS_TIERS,
  GIFT_CARD_BONUS_TOKENS_PER_DOLLAR,
  GIFT_CARD_RECIPIENT_INVITE_DAYS,
  calculateGiftCardBonusTokens,
  calculateProportionalGiftCardReversal,
  classifyGiftCardDisputeState,
  classifySquareGiftCardOrder,
  currentGiftCardBonusValueUsd,
  giftCardOrderReviewReason,
  giftCardStatusAfterReversal,
  isGoldGiftCardOrder,
} from "../../shared/giftCardBonuses";
import { PLATFORM_REDEEM_RATE } from "../../shared/tokenRedemptionRules";

type UnknownRecord = Record<string, unknown>;

type GiftCardBonusRow = {
  id: string;
  square_order_id: string;
  square_payment_id: string | null;
  square_location_id: string | null;
  buyer_email: string | null;
  face_value_cents: number;
  paid_cents: number;
  token_amount: string | number;
  refunded_cents: number;
  reversed_tokens: string | number;
  status: string;
  target_email: string | null;
  target_user_id: string | null;
  recipient_invite_expires_at: Date | null;
  purchased_at: Date | null;
  eligible_at: Date | null;
  credited_at: Date | null;
  claim_email_sent_at: Date | null;
  gold_eligible: boolean;
  metadata: UnknownRecord | null;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? value as UnknownRecord : {};
}

function stringField(source: UnknownRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function intField(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function moneyCents(source: unknown): number {
  const money = record(source);
  return intField(money.amount);
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function newClaimToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function safeDate(value: unknown, fallback = new Date()): Date {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date : fallback;
}

export function getPublicGiftCardBonusConfig() {
  const readiness = getGiftCardBonusReadiness();
  return {
    enabled: readiness.publicEnabled,
    startAt: readiness.startAt,
    tokensPerDollar: GIFT_CARD_BONUS_TOKENS_PER_DOLLAR,
    minimumAmountUsd: GIFT_CARD_BONUS_MINIMUM_CENTS / 100,
    holdDays: GIFT_CARD_BONUS_HOLD_DAYS,
    recipientInviteDays: GIFT_CARD_RECIPIENT_INVITE_DAYS,
    redeemRate: PLATFORM_REDEEM_RATE,
    amounts: [...GIFT_CARD_BONUS_AMOUNTS],
    tiers: GIFT_CARD_BONUS_TIERS,
    exclusions: {
      reloads: true,
      discountedGiftCards: true,
      normalPerDollarRewardsOnGiftFundedService: true,
    },
  };
}

export async function ensureGiftCardBonusTables(): Promise<void> {
  await pool.query(`
    ALTER TABLE square_invoices
      ADD COLUMN IF NOT EXISTS gift_card_paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

    CREATE TABLE IF NOT EXISTS gift_card_bonus_purchases (
      id                         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      square_order_id            TEXT NOT NULL UNIQUE,
      square_payment_id          TEXT UNIQUE,
      square_location_id         TEXT,
      buyer_email                TEXT,
      face_value_cents           INTEGER NOT NULL DEFAULT 0,
      paid_cents                 INTEGER NOT NULL DEFAULT 0,
      token_rate                 NUMERIC(10,4) NOT NULL DEFAULT 25,
      token_amount               NUMERIC(18,8) NOT NULL DEFAULT 0,
      redeem_rate_snapshot       NUMERIC(18,8) NOT NULL DEFAULT 500,
      refunded_cents             INTEGER NOT NULL DEFAULT 0,
      reversed_tokens            NUMERIC(18,8) NOT NULL DEFAULT 0,
      status                     TEXT NOT NULL DEFAULT 'awaiting_payment',
      claim_token_hash           TEXT UNIQUE,
      recipient_claim_token_hash TEXT UNIQUE,
      claim_email_sent_at        TIMESTAMPTZ,
      target_email               TEXT,
      target_user_id             VARCHAR REFERENCES users(id) ON DELETE SET NULL,
      target_selected_at         TIMESTAMPTZ,
      recipient_invite_expires_at TIMESTAMPTZ,
      purchased_at               TIMESTAMPTZ,
      eligible_at                TIMESTAMPTZ,
      credited_at                TIMESTAMPTZ,
      gold_eligible              BOOLEAN NOT NULL DEFAULT FALSE,
      metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_gift_card_bonus_status_eligible
      ON gift_card_bonus_purchases(status, eligible_at);
    CREATE INDEX IF NOT EXISTS idx_gift_card_bonus_target_user
      ON gift_card_bonus_purchases(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_gift_card_bonus_buyer_email
      ON gift_card_bonus_purchases(LOWER(buyer_email));
    ALTER TABLE gift_card_bonus_purchases ALTER COLUMN token_rate SET DEFAULT 25;

    CREATE TABLE IF NOT EXISTS gift_card_bonus_activations (
      id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      square_activity_id TEXT NOT NULL UNIQUE,
      square_order_id    TEXT NOT NULL,
      line_item_uid      TEXT,
      amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
      activated_at       TIMESTAMPTZ NOT NULL,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_gift_card_bonus_activation_order
      ON gift_card_bonus_activations(square_order_id);

    CREATE TABLE IF NOT EXISTS gift_card_bonus_adjustments (
      id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_id          VARCHAR NOT NULL REFERENCES gift_card_bonus_purchases(id) ON DELETE CASCADE,
      square_adjustment_id TEXT NOT NULL UNIQUE,
      adjustment_type      TEXT NOT NULL,
      amount_cents         INTEGER NOT NULL DEFAULT 0,
      status               TEXT NOT NULL,
      metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_gift_card_bonus_adjustment_purchase
      ON gift_card_bonus_adjustments(purchase_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_gift_card_purchase_bonus_reward
      ON rewards(user_id, reference_id)
      WHERE reward_type = 'gift_card_purchase_bonus';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_gift_card_purchase_bonus_reversal
      ON rewards(user_id, reference_id)
      WHERE reward_type = 'gift_card_purchase_bonus_reversal';
  `);
}

async function getSquareClient(): Promise<SquareClient> {
  const { SquareClient, SquareEnvironment } = await import("square");
  return new SquareClient({
    token: getSquareAccessToken(),
    environment: getSquareEnvironment() === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
}

async function buyerEmailForPayment(payment: UnknownRecord): Promise<string | null> {
  const direct = normalizeEmail(payment.buyerEmailAddress ?? payment.buyer_email_address);
  if (direct) return direct;
  const customerId = stringField(payment, "customerId", "customer_id");
  if (!customerId) return null;
  try {
    const client = await getSquareClient();
    const response = await client.customers.get({ customerId });
    return normalizeEmail(response.customer?.emailAddress);
  } catch (error) {
    console.warn("[gift-card-bonus] Could not resolve Square customer email:", (error as Error).message);
    return null;
  }
}

async function sendBuyerClaimEmail(purchaseId: string): Promise<boolean> {
  const { rows } = await pool.query<GiftCardBonusRow>(
    "SELECT * FROM gift_card_bonus_purchases WHERE id=$1 LIMIT 1",
    [purchaseId],
  );
  const purchase = rows[0];
  if (!purchase?.buyer_email) return false;
  const token = newClaimToken();
  await pool.query(
    "UPDATE gift_card_bonus_purchases SET claim_token_hash=$2, updated_at=NOW() WHERE id=$1",
    [purchaseId, hashToken(token)],
  );
  const claimUrl = `${getAppUrl()}/gift-cards/bonus#claim=${encodeURIComponent(token)}`;
  const tokens = Number(purchase.token_amount || 0) - Number(purchase.reversed_tokens || 0);
  const sent = await sendEmail({
    to: purchase.buyer_email,
    subject: `Choose who receives ${tokens.toLocaleString("en-US")} bonus JCMOVES`,
    text: `Thank you for purchasing a JC ON THE MOVE eGift card. Choose whether the ${tokens.toLocaleString("en-US")} bonus JCMOVES belong to you or the gift recipient: ${claimUrl}. The bonus becomes spendable after the 14-day hold.`,
    html: `<p>Thank you for purchasing a JC ON THE MOVE eGift card.</p><p><strong>${tokens.toLocaleString("en-US")} bonus JCMOVES</strong> are ready to assign to you or the gift recipient.</p><p><a href="${claimUrl}">Choose the bonus owner</a></p><p>The bonus becomes spendable after the 14-day hold.</p>`,
  });
  if (sent) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET claim_email_sent_at=NOW(), updated_at=NOW() WHERE id=$1",
      [purchaseId],
    );
  }
  return sent;
}

async function reconcileStoredPurchase(squareOrderId: string): Promise<void> {
  const { rows } = await pool.query<GiftCardBonusRow & { activation_cents: number; max_activation_cents: number }>(
    `SELECT p.*,
            COALESCE(a.activation_cents, 0)::int AS activation_cents,
            COALESCE(a.max_activation_cents, 0)::int AS max_activation_cents
       FROM gift_card_bonus_purchases p
       LEFT JOIN (
         SELECT square_order_id, SUM(amount_cents) activation_cents, MAX(amount_cents) max_activation_cents
           FROM gift_card_bonus_activations GROUP BY square_order_id
       ) a ON a.square_order_id=p.square_order_id
      WHERE p.square_order_id=$1 LIMIT 1`,
    [squareOrderId],
  );
  const purchase = rows[0];
  if (!purchase) return;
  const metadata = record(purchase.metadata);
  const startAt = getGiftCardBonusStartAt();
  if (!getGiftCardBonusReadiness().enabled || !startAt || !purchase.purchased_at || purchase.purchased_at < startAt) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET status='disabled', updated_at=NOW() WHERE id=$1 AND credited_at IS NULL",
      [purchase.id],
    );
    return;
  }
  const reviewReason = giftCardOrderReviewReason({
    hasDiscount: metadata.hasDiscount === true,
    orderCompleted: metadata.orderCompleted === true,
    locationMismatch: metadata.locationMismatch === true,
  });
  if (reviewReason) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET status='needs_review', metadata=metadata || $2::jsonb, updated_at=NOW() WHERE id=$1",
      [purchase.id, JSON.stringify({ reason: reviewReason })],
    );
    return;
  }
  if (!purchase.square_payment_id || purchase.paid_cents <= 0) {
    await pool.query("UPDATE gift_card_bonus_purchases SET status='awaiting_payment', updated_at=NOW() WHERE id=$1", [purchase.id]);
    return;
  }
  if (purchase.activation_cents <= 0) {
    await pool.query("UPDATE gift_card_bonus_purchases SET status='awaiting_activation', updated_at=NOW() WHERE id=$1", [purchase.id]);
    return;
  }
  if (!purchase.buyer_email) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET status='needs_review', metadata=metadata || '{\"reason\":\"buyer_email_missing\"}'::jsonb, updated_at=NOW() WHERE id=$1",
      [purchase.id],
    );
    return;
  }
  const tokens = calculateGiftCardBonusTokens(purchase.activation_cents);
  if (tokens <= 0) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET face_value_cents=$2, token_amount=0, status='ineligible', updated_at=NOW() WHERE id=$1",
      [purchase.id, purchase.activation_cents],
    );
    return;
  }
  const eligibleAt = addDays(purchase.purchased_at, GIFT_CARD_BONUS_HOLD_DAYS);
  const needsClaimEmail = !purchase.claim_email_sent_at;
  await pool.query(
    `UPDATE gift_card_bonus_purchases
        SET face_value_cents=$2, token_amount=$3, token_rate=$4,
            redeem_rate_snapshot=$5, eligible_at=$6,
            gold_eligible=$7,
            status=CASE WHEN status IN ('released','partially_reversed','reversed','disputed','invite_pending','assigned_pending') THEN status ELSE 'awaiting_claim' END,
            updated_at=NOW()
      WHERE id=$1`,
    [purchase.id, purchase.activation_cents, tokens, GIFT_CARD_BONUS_TOKENS_PER_DOLLAR, PLATFORM_REDEEM_RATE, eligibleAt, isGoldGiftCardOrder(purchase.activation_cents)],
  );
  if (needsClaimEmail && !(await sendBuyerClaimEmail(purchase.id))) {
    throw new Error(`Could not deliver gift-card bonus claim email for purchase ${purchase.id}`);
  }
}

export async function handleSquareGiftCardActivityEvent(activityValue: unknown): Promise<void> {
  if (!getGiftCardBonusReadiness().enabled) return;
  const activity = record(activityValue);
  if (stringField(activity, "type")?.toUpperCase() !== "ACTIVATE") return;
  const details = record(activity.activateActivityDetails ?? activity.activate_activity_details);
  const orderId = stringField(details, "orderId", "order_id");
  const activityId = stringField(activity, "id");
  const amountCents = moneyCents(details.amountMoney ?? details.amount_money);
  const activatedAt = safeDate(activity.createdAt ?? activity.created_at);
  const startAt = getGiftCardBonusStartAt();
  if (!orderId || !activityId || amountCents <= 0 || !startAt || activatedAt < startAt) return;

  await pool.query(
    `INSERT INTO gift_card_bonus_activations
       (square_activity_id, square_order_id, line_item_uid, amount_cents, activated_at)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (square_activity_id) DO NOTHING`,
    [activityId, orderId, stringField(details, "lineItemUid", "line_item_uid"), amountCents, activatedAt],
  );
  await pool.query(
    `INSERT INTO gift_card_bonus_purchases (square_order_id, square_location_id, status, metadata)
     VALUES ($1,$2,'awaiting_payment',$3::jsonb)
     ON CONFLICT (square_order_id) DO UPDATE SET updated_at=NOW()`,
    [orderId, stringField(activity, "locationId", "location_id"), JSON.stringify({ source: "square_activate" })],
  );
  await reconcileStoredPurchase(orderId);
}

export async function handleSquareGiftCardPaymentEvent(paymentValue: unknown): Promise<void> {
  if (!getGiftCardBonusReadiness().enabled) return;
  let payment = record(paymentValue);
  if (stringField(payment, "status")?.toUpperCase() !== "COMPLETED") return;
  const paymentId = stringField(payment, "id");
  const orderId = stringField(payment, "orderId", "order_id");
  if (!paymentId || !orderId) return;

  const client = await getSquareClient();
  const orderResponse = await client.orders.get({ orderId });
  const order = orderResponse.order;
  if (!order) return;
  const classification = classifySquareGiftCardOrder(order);
  if (classification.giftCardLineItemUids.length === 0) return;
  if (!payment.buyerEmailAddress && !payment.buyer_email_address) {
    const paymentResponse = await client.payments.get({ paymentId });
    payment = record(paymentResponse.payment || payment);
  }
  const buyerEmail = await buyerEmailForPayment(payment);
  const purchasedAt = safeDate(payment.createdAt ?? payment.created_at);
  const startAt = getGiftCardBonusStartAt();
  if (!startAt || purchasedAt < startAt) return;
  const paidCents = moneyCents(payment.amountMoney ?? payment.amount_money);
  const locationId = stringField(payment, "locationId", "location_id") || order.locationId;
  const requiredLocation = getSquareLocationId();
  const locationMismatch = Boolean(requiredLocation && locationId !== requiredLocation);

  await pool.query(
    `INSERT INTO gift_card_bonus_purchases
       (square_order_id, square_payment_id, square_location_id, buyer_email,
        paid_cents, purchased_at, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,'awaiting_activation',$7::jsonb)
     ON CONFLICT (square_order_id) DO UPDATE SET
       square_payment_id=EXCLUDED.square_payment_id,
       square_location_id=EXCLUDED.square_location_id,
       buyer_email=COALESCE(EXCLUDED.buyer_email, gift_card_bonus_purchases.buyer_email),
       paid_cents=EXCLUDED.paid_cents,
       purchased_at=EXCLUDED.purchased_at,
       metadata=gift_card_bonus_purchases.metadata || EXCLUDED.metadata,
       updated_at=NOW()`,
    [orderId, paymentId, locationId, buyerEmail, paidCents, purchasedAt, JSON.stringify({
      source: "square_payment",
      hasDiscount: classification.hasDiscount,
      orderCompleted: classification.completed,
      locationMismatch,
      giftCardLineItemUids: classification.giftCardLineItemUids,
    })],
  );
  if (locationMismatch || !classification.completed) {
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET status='needs_review', metadata=metadata || $2::jsonb, updated_at=NOW() WHERE square_order_id=$1",
      [orderId, JSON.stringify({ reason: locationMismatch ? "location_mismatch" : "order_not_completed" })],
    );
    return;
  }
  await reconcileStoredPurchase(orderId);
}

async function purchaseByClaimToken(token: string): Promise<(GiftCardBonusRow & { claim_role: "buyer" | "recipient" }) | null> {
  if (!token || token.length < 32 || token.length > 256) return null;
  const digest = hashToken(token);
  const { rows } = await pool.query<GiftCardBonusRow & { claim_role: "buyer" | "recipient" }>(
    `SELECT p.*,
            CASE WHEN recipient_claim_token_hash=$1 THEN 'recipient' ELSE 'buyer' END AS claim_role
       FROM gift_card_bonus_purchases p
      WHERE claim_token_hash=$1 OR recipient_claim_token_hash=$1
      LIMIT 1`,
    [digest],
  );
  return rows[0] || null;
}

function publicPurchaseSummary(purchase: GiftCardBonusRow & { claim_role?: "buyer" | "recipient" }) {
  const remainingTokens = Math.max(0, Number(purchase.token_amount || 0) - Number(purchase.reversed_tokens || 0));
  return {
    id: purchase.id,
    claimRole: purchase.claim_role || "buyer",
    status: purchase.status,
    faceValueUsd: purchase.face_value_cents / 100,
    bonusTokens: remainingTokens,
    currentServiceCreditUsd: currentGiftCardBonusValueUsd(remainingTokens),
    goldEligible: purchase.gold_eligible,
    eligibleAt: purchase.eligible_at,
    targetSelected: Boolean(purchase.target_email),
    recipientInviteExpiresAt: purchase.recipient_invite_expires_at,
    creditedAt: purchase.credited_at,
  };
}

export async function resolveGiftCardBonusClaim(token: string) {
  const purchase = await purchaseByClaimToken(token);
  return purchase ? publicPurchaseSummary(purchase) : null;
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { rows } = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM users WHERE LOWER(email)=LOWER($1) AND status IN ('approved','active') LIMIT 1",
    [email],
  );
  return rows[0] || null;
}

async function sendRecipientInvite(purchase: GiftCardBonusRow, recipientEmail: string, token: string): Promise<boolean> {
  const url = `${getAppUrl()}/gift-cards/bonus#claim=${encodeURIComponent(token)}`;
  const tokens = Math.max(0, Number(purchase.token_amount || 0) - Number(purchase.reversed_tokens || 0));
  return sendEmail({
    to: recipientEmail,
    subject: `You received ${tokens.toLocaleString("en-US")} bonus JCMOVES`,
    text: `A JC ON THE MOVE eGift-card purchaser chose you to receive ${tokens.toLocaleString("en-US")} bonus JCMOVES. Sign in or create your account using the same email address, then accept here: ${url}. Please accept within ${GIFT_CARD_RECIPIENT_INVITE_DAYS} days.`,
    html: `<p>Someone who purchased a JC ON THE MOVE eGift card chose you to receive <strong>${tokens.toLocaleString("en-US")} bonus JCMOVES</strong>.</p><p><a href="${url}">Sign in and accept your bonus</a></p><p>Use this email address for your account and accept within ${GIFT_CARD_RECIPIENT_INVITE_DAYS} days.</p>`,
  });
}

export async function assignGiftCardBonus(input: {
  token: string;
  destination: "buyer" | "recipient";
  recipientEmail?: string;
}) {
  const purchase = await purchaseByClaimToken(input.token);
  if (!purchase || purchase.claim_role !== "buyer") throw new Error("This bonus link is invalid or has expired.");
  if (!["awaiting_claim", "invite_pending"].includes(purchase.status)) {
    throw new Error("This bonus has already been assigned or is no longer available.");
  }
  const targetEmail = input.destination === "buyer"
    ? normalizeEmail(purchase.buyer_email)
    : normalizeEmail(input.recipientEmail);
  if (!targetEmail) throw new Error("Enter a valid recipient email address.");
  const user = await findUserByEmail(targetEmail);
  const recipientToken = input.destination === "recipient" && !user ? newClaimToken() : null;
  const inviteExpiresAt = input.destination === "recipient" && !user
    ? addDays(new Date(), GIFT_CARD_RECIPIENT_INVITE_DAYS)
    : null;
  const status = user ? "assigned_pending" : "invite_pending";

  const updated = await pool.query<GiftCardBonusRow>(
    `UPDATE gift_card_bonus_purchases
        SET target_email=$2,
            target_user_id=$3,
            target_selected_at=NOW(),
            recipient_invite_expires_at=$4,
            recipient_claim_token_hash=$5,
            status=$6,
            metadata=metadata || $7::jsonb,
            updated_at=NOW()
      WHERE id=$1 AND status IN ('awaiting_claim','invite_pending')
      RETURNING *`,
    [purchase.id, targetEmail, user?.id || null, inviteExpiresAt, recipientToken ? hashToken(recipientToken) : null, status, JSON.stringify({ destination: input.destination })],
  );
  if (!updated.rows[0]) throw new Error("This bonus was assigned by another request. Refresh to see its status.");
  if (recipientToken && !(await sendRecipientInvite(updated.rows[0], targetEmail, recipientToken))) {
    throw new Error("The recipient invitation could not be delivered. Please try again.");
  }
  if (user) await releaseGiftCardBonusIfEligible(updated.rows[0].id);
  const refreshed = await pool.query<GiftCardBonusRow>("SELECT * FROM gift_card_bonus_purchases WHERE id=$1", [purchase.id]);
  return publicPurchaseSummary(refreshed.rows[0]);
}

export async function acceptGiftCardBonus(input: { token: string; userId: string; userEmail: string }) {
  const purchase = await purchaseByClaimToken(input.token);
  const authenticatedEmail = normalizeEmail(input.userEmail);
  if (!purchase || purchase.claim_role !== "recipient" || !authenticatedEmail) {
    throw new Error("This recipient invitation is invalid or has expired.");
  }
  if (!purchase.target_email || purchase.target_email.toLowerCase() !== authenticatedEmail) {
    throw new Error("Sign in with the exact email address that received this invitation.");
  }
  if (purchase.recipient_invite_expires_at && purchase.recipient_invite_expires_at < new Date()) {
    throw new Error("This recipient invitation expired and the bonus returned to the purchaser.");
  }
  const { rows } = await pool.query<GiftCardBonusRow>(
    `UPDATE gift_card_bonus_purchases
        SET target_user_id=$2, status='assigned_pending', recipient_claim_token_hash=NULL,
            updated_at=NOW()
      WHERE id=$1 AND status='invite_pending'
      RETURNING *`,
    [purchase.id, input.userId],
  );
  if (!rows[0] && purchase.target_user_id !== input.userId) throw new Error("This bonus is no longer awaiting acceptance.");
  await releaseGiftCardBonusIfEligible(purchase.id);
  const refreshed = await pool.query<GiftCardBonusRow>("SELECT * FROM gift_card_bonus_purchases WHERE id=$1", [purchase.id]);
  return publicPurchaseSummary(refreshed.rows[0]);
}

async function releaseGiftCardBonusIfEligible(purchaseId: string): Promise<boolean> {
  const client = await pool.connect();
  let creditedUserId: string | null = null;
  let creditedTokens = 0;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<GiftCardBonusRow>(
      "SELECT * FROM gift_card_bonus_purchases WHERE id=$1 FOR UPDATE",
      [purchaseId],
    );
    const purchase = rows[0];
    if (!purchase || purchase.credited_at || purchase.status === "disputed" || purchase.status === "reversed"
      || !purchase.target_user_id || !purchase.eligible_at || purchase.eligible_at > new Date()) {
      await client.query("ROLLBACK");
      return false;
    }
    const tokens = Math.max(0, Number(purchase.token_amount || 0) - Number(purchase.reversed_tokens || 0));
    if (tokens <= 0) {
      await client.query("UPDATE gift_card_bonus_purchases SET status='reversed', updated_at=NOW() WHERE id=$1", [purchaseId]);
      await client.query("COMMIT");
      return false;
    }
    const reward = await client.query(
      `INSERT INTO rewards
         (user_id, reward_type, token_amount, cash_value, status, earned_date, reference_id, metadata)
       VALUES ($1,'gift_card_purchase_bonus',$2,$3,'confirmed',NOW(),$4,$5::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [purchase.target_user_id, tokens, currentGiftCardBonusValueUsd(tokens).toFixed(2), purchase.square_order_id, JSON.stringify({
        source: "square_egift_purchase",
        faceValueUsd: purchase.face_value_cents / 100,
        holdDays: GIFT_CARD_BONUS_HOLD_DAYS,
        redeemRateSnapshot: PLATFORM_REDEEM_RATE,
      })],
    );
    if (reward.rows.length > 0) {
      await client.query(
        `INSERT INTO wallet_accounts (user_id, token_balance, total_earned, last_activity)
         VALUES ($1,$2,$2,NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           token_balance=(COALESCE(wallet_accounts.token_balance,0)::numeric + EXCLUDED.token_balance)::numeric(18,8),
           total_earned=(COALESCE(wallet_accounts.total_earned,0)::numeric + EXCLUDED.total_earned)::numeric(18,8),
           last_activity=NOW()`,
        [purchase.target_user_id, tokens],
      );
    }
    await client.query(
      "UPDATE gift_card_bonus_purchases SET status='released', credited_at=COALESCE(credited_at,NOW()), updated_at=NOW() WHERE id=$1",
      [purchaseId],
    );
    await client.query("COMMIT");
    creditedUserId = purchase.target_user_id;
    creditedTokens = tokens;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  if (creditedUserId) {
    const { rows } = await pool.query<{ email: string }>("SELECT email FROM users WHERE id=$1 LIMIT 1", [creditedUserId]);
    if (rows[0]?.email) {
      await sendEmail({
        to: rows[0].email,
        subject: `${creditedTokens.toLocaleString("en-US")} bonus JCMOVES are ready`,
        text: `Your gift-card purchase bonus has completed its ${GIFT_CARD_BONUS_HOLD_DAYS}-day hold and is now in your JC ON THE MOVE rewards wallet.`,
      }).catch(() => false);
    }
  }
  return true;
}

async function applyCompletedAdjustment(input: {
  adjustmentId: string;
  adjustmentType: "refund" | "dispute";
  amountCents: number;
  orderId?: string | null;
  paymentId?: string | null;
  metadata?: UnknownRecord;
}): Promise<void> {
  if (input.amountCents <= 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<GiftCardBonusRow>(
      `SELECT * FROM gift_card_bonus_purchases
        WHERE ($1::text IS NOT NULL AND square_order_id=$1)
           OR ($2::text IS NOT NULL AND square_payment_id=$2)
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.orderId || null, input.paymentId || null],
    );
    const purchase = rows[0];
    if (!purchase) {
      await client.query("ROLLBACK");
      return;
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO gift_card_bonus_adjustments
         (purchase_id, square_adjustment_id, adjustment_type, amount_cents, status, metadata)
       VALUES ($1,$2,$3,$4,'completed',$5::jsonb)
       ON CONFLICT (square_adjustment_id) DO NOTHING RETURNING id`,
      [purchase.id, input.adjustmentId, input.adjustmentType, input.amountCents, JSON.stringify(input.metadata || {})],
    );
    if (!inserted.rows[0]) {
      await client.query("ROLLBACK");
      return;
    }
    const sums = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents),0)::text total
         FROM gift_card_bonus_adjustments
        WHERE purchase_id=$1 AND status='completed'`,
      [purchase.id],
    );
    const cumulativeCents = Math.min(purchase.paid_cents || purchase.face_value_cents, Number(sums.rows[0]?.total || 0));
    const originalTokens = Number(purchase.token_amount || 0);
    const targetReversed = calculateProportionalGiftCardReversal(
      originalTokens,
      purchase.paid_cents || purchase.face_value_cents,
      cumulativeCents,
    );
    const incrementalTokens = Math.max(0, targetReversed - Number(purchase.reversed_tokens || 0));
    if (incrementalTokens > 0 && purchase.credited_at && purchase.target_user_id) {
      const referenceId = `${input.adjustmentType}:${input.adjustmentId}`.slice(0, 255);
      const reward = await client.query(
        `INSERT INTO rewards
           (user_id, reward_type, token_amount, cash_value, status, earned_date, reference_id, metadata)
         VALUES ($1,'gift_card_purchase_bonus_reversal',$2,$3,'confirmed',NOW(),$4,$5::jsonb)
         ON CONFLICT DO NOTHING RETURNING id`,
        [purchase.target_user_id, -incrementalTokens, (-currentGiftCardBonusValueUsd(incrementalTokens)).toFixed(2), referenceId, JSON.stringify({
          sourceOrderId: purchase.square_order_id,
          adjustmentType: input.adjustmentType,
          mayCreateRewardDebt: true,
        })],
      );
      if (reward.rows.length > 0) {
        await client.query(
          `UPDATE wallet_accounts
              SET token_balance=(COALESCE(token_balance,0)::numeric - $2)::numeric(18,8),
                  last_activity=NOW()
            WHERE user_id=$1`,
          [purchase.target_user_id, incrementalTokens],
        );
      }
    }
    const fullyReversed = targetReversed >= originalTokens;
    const nextStatus = giftCardStatusAfterReversal({
      fullyReversed,
      credited: Boolean(purchase.credited_at),
      currentStatus: purchase.status,
      preDisputeStatus: stringField(record(purchase.metadata), "preDisputeStatus"),
    });
    await client.query(
      `UPDATE gift_card_bonus_purchases
          SET refunded_cents=$2, reversed_tokens=$3, status=$4,
              metadata=metadata || $5::jsonb, updated_at=NOW()
        WHERE id=$1`,
      [purchase.id, cumulativeCents, targetReversed, nextStatus, JSON.stringify({ lastAdjustmentType: input.adjustmentType })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function handleSquareGiftCardRefundEvent(refundValue: unknown): Promise<void> {
  const refund = record(refundValue);
  if (stringField(refund, "status")?.toUpperCase() !== "COMPLETED") return;
  const id = stringField(refund, "id");
  if (!id) return;
  await applyCompletedAdjustment({
    adjustmentId: id,
    adjustmentType: "refund",
    amountCents: moneyCents(refund.amountMoney ?? refund.amount_money),
    orderId: stringField(refund, "orderId", "order_id"),
    paymentId: stringField(refund, "paymentId", "payment_id"),
  });
}

export async function handleSquareGiftCardDisputeEvent(disputeValue: unknown): Promise<void> {
  const dispute = record(disputeValue);
  const id = stringField(dispute, "id", "disputeId", "dispute_id");
  const state = stringField(dispute, "state")?.toUpperCase();
  const disputedPayment = record(dispute.disputedPayment ?? dispute.disputed_payment);
  const paymentId = stringField(disputedPayment, "paymentId", "payment_id");
  if (!id || !paymentId || !state) return;
  const resolution = classifyGiftCardDisputeState(state);
  const { rows } = await pool.query<GiftCardBonusRow>(
    "SELECT * FROM gift_card_bonus_purchases WHERE square_payment_id=$1 LIMIT 1",
    [paymentId],
  );
  const purchase = rows[0];
  if (!purchase) return;
  if (resolution === "won") {
    const previous = stringField(record(purchase.metadata), "preDisputeStatus") || (purchase.target_user_id ? "assigned_pending" : "awaiting_claim");
    await pool.query(
      "UPDATE gift_card_bonus_purchases SET status=$2, metadata=metadata || $3::jsonb, updated_at=NOW() WHERE id=$1 AND status='disputed'",
      [purchase.id, previous, JSON.stringify({ disputeState: state })],
    );
    await releaseGiftCardBonusIfEligible(purchase.id);
    return;
  }
  if (resolution === "lost") {
    await applyCompletedAdjustment({
      adjustmentId: `dispute:${id}`,
      adjustmentType: "dispute",
      amountCents: moneyCents(dispute.amountMoney ?? dispute.amount_money)
        || Math.max(purchase.paid_cents, purchase.face_value_cents),
      paymentId,
      metadata: { disputeState: state },
    });
    return;
  }
  const preDisputeStatus = stringField(record(purchase.metadata), "preDisputeStatus") || purchase.status;
  await pool.query(
    `UPDATE gift_card_bonus_purchases
        SET status='disputed', metadata=metadata || $2::jsonb, updated_at=NOW()
      WHERE id=$1 AND status <> 'reversed'`,
    [purchase.id, JSON.stringify({ disputeState: state, preDisputeStatus })],
  );
}

export async function recordSquareGiftCardTenderForOrder(squareOrderId: string): Promise<number> {
  if (!squareOrderId) return 0;
  const client = await getSquareClient();
  const response = await client.orders.get({ orderId: squareOrderId });
  const tenders = response.order?.tenders || [];
  const giftCardCents = tenders.reduce((sum, tender) =>
    String(tender.type || "").toUpperCase() === "SQUARE_GIFT_CARD"
      ? sum + Number(tender.amountMoney?.amount || 0n)
      : sum,
  0);
  await pool.query(
    "UPDATE square_invoices SET gift_card_paid_amount=$2, updated_at=NOW() WHERE square_order_id=$1",
    [squareOrderId, (giftCardCents / 100).toFixed(2)],
  );
  return giftCardCents;
}

export async function reconcileGiftCardBonusOrder(squareOrderId: string): Promise<void> {
  const client = await getSquareClient();
  const response = await client.orders.get({ orderId: squareOrderId });
  const order = response.order;
  if (!order) throw new Error("Square order was not found.");
  const paymentId = order.tenders?.map((tender) => tender.paymentId || tender.id).find(Boolean);
  if (paymentId) {
    const payment = await client.payments.get({ paymentId });
    if (payment.payment) await handleSquareGiftCardPaymentEvent(payment.payment);
  }
  await reconcileStoredPurchase(squareOrderId);
}

export async function resendGiftCardBonusClaimByEmail(emailValue: string): Promise<number> {
  const email = normalizeEmail(emailValue);
  if (!email) return 0;
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM gift_card_bonus_purchases
      WHERE LOWER(buyer_email)=LOWER($1)
        AND status IN ('awaiting_claim','invite_pending','assigned_pending')
      ORDER BY created_at DESC LIMIT 5`,
    [email],
  );
  let sent = 0;
  for (const row of rows) if (await sendBuyerClaimEmail(row.id)) sent += 1;
  return sent;
}

export async function resendGiftCardBonusClaimById(id: string): Promise<boolean> {
  return sendBuyerClaimEmail(id);
}

export async function listGiftCardBonuses(limit = 100) {
  const safeLimit = Number.isFinite(limit) ? Math.min(500, Math.max(1, Math.trunc(limit))) : 100;
  const { rows } = await pool.query(
    `SELECT p.id, p.square_order_id, p.square_payment_id, p.buyer_email,
            p.face_value_cents, p.paid_cents, p.token_amount, p.refunded_cents,
            p.reversed_tokens, p.status, p.target_email, p.target_user_id,
            p.purchased_at, p.eligible_at, p.credited_at, p.gold_eligible,
            p.claim_email_sent_at, p.recipient_invite_expires_at, p.updated_at,
            u.email AS target_account_email
       FROM gift_card_bonus_purchases p
       LEFT JOIN users u ON u.id=p.target_user_id
      ORDER BY p.created_at DESC LIMIT $1`,
    [safeLimit],
  );
  return rows;
}

export async function listUserGiftCardBonuses(userId: string) {
  const { rows } = await pool.query<GiftCardBonusRow>(
    "SELECT * FROM gift_card_bonus_purchases WHERE target_user_id=$1 ORDER BY created_at DESC LIMIT 100",
    [userId],
  );
  return rows.map((row) => publicPurchaseSummary(row));
}

export async function runGiftCardBonusSweep(): Promise<{ assigned: number; fellBack: number; released: number }> {
  if (!getGiftCardBonusReadiness().enabled) return { assigned: 0, fellBack: 0, released: 0 };
  const lockClient = await pool.connect();
  let lockAcquired = false;
  let assigned = 0;
  let fellBack = 0;
  let released = 0;
  try {
    const lock = await lockClient.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(1718062026) locked");
    lockAcquired = Boolean(lock.rows[0]?.locked);
    if (!lockAcquired) return { assigned: 0, fellBack: 0, released: 0 };

    // A completed-payment webhook may arrive before the activation event, or
    // its Square order lookup may fail transiently. Recheck pending rows so a
    // brief Square/API outage cannot permanently strand an earned bonus.
    const pending = await pool.query<{ square_order_id: string }>(
      `SELECT square_order_id FROM gift_card_bonus_purchases
        WHERE status IN ('awaiting_payment','awaiting_activation')
          AND updated_at <= NOW() - INTERVAL '2 minutes'
        ORDER BY updated_at ASC LIMIT 25`,
    );
    for (const row of pending.rows) {
      await reconcileGiftCardBonusOrder(row.square_order_id).catch((error) => {
        console.warn(`[gift-card-bonus] Pending order ${row.square_order_id} still could not reconcile:`, (error as Error).message);
      });
    }

    const resolved = await pool.query(
      `UPDATE gift_card_bonus_purchases p
          SET target_user_id=u.id, status='assigned_pending', recipient_claim_token_hash=NULL, updated_at=NOW()
         FROM users u
        WHERE p.status='invite_pending'
          AND p.target_user_id IS NULL
          AND LOWER(u.email)=LOWER(p.target_email)
          AND u.status IN ('approved','active')
        RETURNING p.id`,
    );
    assigned = resolved.rowCount || 0;

    const expired = await pool.query<GiftCardBonusRow>(
      `SELECT * FROM gift_card_bonus_purchases
        WHERE status='invite_pending'
          AND recipient_invite_expires_at IS NOT NULL
          AND recipient_invite_expires_at <= NOW()`,
    );
    for (const purchase of expired.rows) {
      const buyer = purchase.buyer_email ? await findUserByEmail(purchase.buyer_email) : null;
      await pool.query(
        `UPDATE gift_card_bonus_purchases
            SET target_email=buyer_email, target_user_id=$2,
                recipient_claim_token_hash=NULL, recipient_invite_expires_at=NULL,
                status=$3, metadata=metadata || '{"recipientInviteFallback":true}'::jsonb,
                updated_at=NOW()
          WHERE id=$1`,
        [purchase.id, buyer?.id || null, buyer ? "assigned_pending" : "invite_pending"],
      );
      fellBack += 1;
      if (!buyer) await sendBuyerClaimEmail(purchase.id);
    }

    const due = await pool.query<{ id: string }>(
      `SELECT id FROM gift_card_bonus_purchases
        WHERE status='assigned_pending' AND target_user_id IS NOT NULL
          AND eligible_at IS NOT NULL AND eligible_at <= NOW()
          AND credited_at IS NULL
        ORDER BY eligible_at ASC LIMIT 200`,
    );
    for (const row of due.rows) if (await releaseGiftCardBonusIfEligible(row.id)) released += 1;
    return { assigned, fellBack, released };
  } finally {
    if (lockAcquired) await lockClient.query("SELECT pg_advisory_unlock(1718062026)").catch(() => {});
    lockClient.release();
  }
}
