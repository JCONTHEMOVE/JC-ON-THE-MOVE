import crypto from "node:crypto";
import {
  COMMERCE_TERMS_VERSION,
  FULL_PREPAY_DISCOUNT_PERCENT,
  calculateCancellationPolicy,
  calculateCheckoutPayment,
  calculateCommerceDiscounts,
  commerceTermsText,
  type CommerceAdjustmentType,
  type CommerceItem,
  type CommercePaymentChoice,
  type CommercePromotion,
} from "@shared/commerceCatalog";
import { pool } from "../db";
import { getActiveCommercePublication, getPublicCommerceOffers } from "./commerceCatalog";
import { squareInvoiceService } from "./square-invoice";

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function money(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round((parsed + Number.EPSILON) * 100) / 100) : 0;
}

function promotionIsAvailable(promotion: CommercePromotion, item: CommerceItem, now = new Date()): boolean {
  if (!promotion.active) return false;
  if (promotion.startsAt && new Date(promotion.startsAt) > now) return false;
  if (promotion.endsAt && new Date(promotion.endsAt) < now) return false;
  const hasTarget = promotion.eligibleItemCodes.length > 0 || promotion.eligibleCategories.length > 0;
  if (!hasTarget) return true;
  return promotion.eligibleItemCodes.includes(item.code) || promotion.eligibleCategories.includes(item.category);
}

function tomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function createCommerceCheckout(input: {
  offerCode: string;
  variationCode?: string | null;
  quantity: number;
  paymentChoice: CommercePaymentChoice;
  promoCode?: string | null;
  customer: { firstName: string; lastName: string; email: string; phone?: string | null };
  serviceAddress?: string | null;
  serviceDate?: string | null;
  scopeNotes?: string | null;
  termsVersion: typeof COMMERCE_TERMS_VERSION;
  acceptedTerms: true;
  idempotencyKey: string;
}) {
  const publication = await getActiveCommercePublication();
  if (!publication) throw new Error("The catalog has not been published yet");

  const existing = (await pool.query<any>(`
    SELECT id, status, invoice_url, square_invoice_id, amount_due, order_total
    FROM commerce_checkout_intents WHERE idempotency_key=$1 LIMIT 1
  `, [input.idempotencyKey])).rows[0];
  if (existing && existing.status !== "invoice_failed") {
    return {
      checkoutId: existing.id,
      status: existing.status,
      invoiceUrl: existing.invoice_url,
      squareInvoiceId: existing.square_invoice_id,
      amountDue: money(existing.amount_due),
      orderTotal: money(existing.order_total),
      accessToken: null,
      replayed: true,
    };
  }

  const catalog = await getPublicCommerceOffers();
  const item = catalog.items.find((candidate) => candidate.code === input.offerCode);
  if (!item || !item.active || !item.publicVisible) throw new Error("This offer is not currently available");
  if (item.purchaseMode !== "direct") throw new Error("This service requires a quote before payment");
  if (item.itemType !== "supply" && (!input.serviceAddress?.trim() || !input.serviceDate?.trim())) {
    throw new Error("A service address and requested date are required before payment");
  }

  const variation = input.variationCode
    ? item.variations.find((candidate) => candidate.code === input.variationCode)
    : null;
  if (input.variationCode && !variation) throw new Error("The selected catalog option is unavailable");
  const unitPrice = variation?.price ?? item.price;
  if (unitPrice == null || ["quote", "variable"].includes(variation?.pricingMode || item.pricingMode)) {
    throw new Error("An owner-approved fixed price is required before this offer can be purchased");
  }

  const quantity = Math.max(1, Math.round(input.quantity));
  const promotionList = Array.isArray(publication.snapshot?.promotions)
    ? publication.snapshot.promotions as CommercePromotion[]
    : [];
  const promo = input.promoCode
    ? promotionList.find((candidate) => candidate.code.toUpperCase() === input.promoCode!.toUpperCase() && promotionIsAvailable(candidate, item))
    : null;
  if (input.promoCode && !promo) throw new Error("That promotion is invalid, expired, or not eligible for this offer");

  const requestedPaymentChoice = item.itemType === "supply" ? "full" : input.paymentChoice;
  const offers = [] as Array<{ code: string; name: string; discountType: "percent" | "fixed"; value: number; maximumAmount?: number | null; priority: number }>;
  if (promo) {
    offers.push({
      code: promo.code, name: promo.name, discountType: promo.discountType,
      value: promo.value, maximumAmount: promo.maximumAmount, priority: promo.priority,
    });
  }
  if (requestedPaymentChoice === "full" && item.itemType !== "supply" && item.discountEligible && (!promo || promo.combinable)) {
    offers.push({ code: "FULL_PREPAY_5", name: "Full prepayment discount", discountType: "percent", value: FULL_PREPAY_DISCOUNT_PERCENT, priority: 900 });
  }
  const pricing = calculateCommerceDiscounts([{
    code: variation?.code || item.code,
    name: variation ? `${item.name} — ${variation.name}` : item.name,
    quantity,
    unitPrice,
    discountEligible: item.discountEligible && (variation?.discountEligible ?? true),
    category: item.category,
  }], offers);
  const payment = calculateCheckoutPayment({ total: pricing.total, paymentChoice: requestedPaymentChoice, itemType: item.itemType });
  const accessToken = crypto.randomBytes(32).toString("base64url");
  const terms = commerceTermsText();
  const termsHash = hash(`${input.termsVersion}:${terms}`);
  const pricingSnapshot = {
    catalogRevision: Number(publication.revision), offerCode: item.code, variationCode: variation?.code || null,
    itemName: item.name, variationName: variation?.name || null, quantity, unitPrice,
    subtotal: pricing.subtotal, discounts: pricing.applied, discountTotal: pricing.discountTotal,
    orderTotal: pricing.total, paymentChoice: payment.paymentChoice, amountDue: payment.amountDue,
  };

  let checkoutId: string;
  if (existing) {
    checkoutId = existing.id;
    await pool.query(`
      UPDATE commerce_checkout_intents SET access_token_hash=$2, status='pending_invoice', updated_at=now() WHERE id=$1
    `, [checkoutId, hash(accessToken)]);
  } else {
    const inserted = await pool.query<{ id: string }>(`
      INSERT INTO commerce_checkout_intents (
        idempotency_key, access_token_hash, catalog_revision, offer_code, variation_code, quantity,
        customer_email, customer_name, customer_phone, service_address, service_date, scope_notes,
        payment_choice, subtotal, discount_total, order_total, amount_due, pricing_snapshot,
        terms_version, terms_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20)
      RETURNING id
    `, [
      input.idempotencyKey, hash(accessToken), Number(publication.revision), item.code, variation?.code || null, quantity,
      input.customer.email.toLowerCase(), `${input.customer.firstName} ${input.customer.lastName}`.trim(), input.customer.phone || null,
      input.serviceAddress || null, input.serviceDate || null, input.scopeNotes || null,
      payment.paymentChoice, pricing.subtotal, pricing.discountTotal, pricing.total, payment.amountDue,
      JSON.stringify(pricingSnapshot), input.termsVersion, termsHash,
    ]);
    checkoutId = inserted.rows[0].id;
  }

  try {
    const deposit = payment.paymentChoice === "deposit";
    const invoiceLineName = deposit
      ? `30% scheduling deposit — ${item.name}${variation ? ` (${variation.name})` : ""}`
      : `${item.name}${variation ? ` — ${variation.name}` : ""}`;
    const invoiceLines = deposit
      ? [{ name: invoiceLineName, qty: 1, unitPrice: payment.amountDue, total: payment.amountDue, excludeFromBundleDiscount: true }]
      : [{ id: variation?.code, name: invoiceLineName, qty: quantity, unitPrice, total: quantity * unitPrice, excludeFromBundleDiscount: !item.discountEligible }];
    const discounts = deposit ? [] : pricing.applied.map((discount) => ({ code: discount.code, name: discount.name, amount: discount.amount }));
    const invoice = await squareInvoiceService.createItemizedInvoiceForLead({
      id: checkoutId,
      firstName: input.customer.firstName,
      lastName: input.customer.lastName,
      email: input.customer.email,
      phone: input.customer.phone || null,
      totalPrice: payment.amountDue,
      serviceType: item.sourceServiceCode || item.category,
    }, invoiceLines, tomorrowDate(), "email", {
      purpose: deposit ? "deposit" : "legacy_unknown",
      discounts,
      expectedTotal: payment.amountDue,
      catalogRevision: Number(publication.revision),
      pricingRevision: String(publication.snapshot?.pricingVersion || "unknown"),
      idempotencyKey: `commerce-${checkoutId}`,
      description: deposit ? "Scheduling deposit" : "Online catalog purchase",
    });
    await pool.query(`
      UPDATE commerce_checkout_intents SET status='invoice_sent', square_invoice_id=$2, invoice_url=$3, updated_at=now() WHERE id=$1
    `, [checkoutId, invoice.squareInvoiceId, invoice.invoiceUrl]);
    return {
      checkoutId, status: "invoice_sent", invoiceUrl: invoice.invoiceUrl,
      squareInvoiceId: invoice.squareInvoiceId, amountDue: payment.amountDue,
      orderTotal: pricing.total, accessToken, replayed: false,
    };
  } catch (error) {
    await pool.query(`UPDATE commerce_checkout_intents SET status='invoice_failed', updated_at=now() WHERE id=$1`, [checkoutId]);
    throw error;
  }
}

function validAccessToken(token: string, expectedHash: string | null): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hash(token));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function createCommerceAdjustment(input: {
  checkoutId: string;
  accessToken: string;
  type: CommerceAdjustmentType;
  requestedServiceDate?: string | null;
  replacementOfferCode?: string | null;
  reason: string;
  termsVersion: typeof COMMERCE_TERMS_VERSION;
}) {
  const checkout = (await pool.query<any>(`SELECT * FROM commerce_checkout_intents WHERE id=$1 LIMIT 1`, [input.checkoutId])).rows[0];
  if (!checkout || !validAccessToken(input.accessToken, checkout.access_token_hash)) throw new Error("Checkout access could not be verified");
  const start = checkout.service_date ? new Date(checkout.service_date) : null;
  const hoursBeforeStart = start && !Number.isNaN(start.getTime()) ? (start.getTime() - Date.now()) / 3_600_000 : 0;
  const amountPaid = checkout.status === "paid" ? money(checkout.amount_due) : 0;
  const cancellation = calculateCancellationPolicy({
    hoursBeforeStart,
    jobTotal: money(checkout.order_total),
    amountPaid,
  });
  const freeTransfer = ["reschedule", "job_switch"].includes(input.type) && hoursBeforeStart > 24;
  const policySnapshot = freeTransfer
    ? { policy: "free_one_time_transfer", fee: 0, retained: 0, refund: 0, amountDue: 0, transferable: amountPaid, hoursBeforeStart }
    : { ...cancellation, transferable: Math.max(0, amountPaid - cancellation.retained), hoursBeforeStart };
  const result = await pool.query<{ id: string }>(`
    INSERT INTO commerce_adjustment_requests (
      checkout_intent_id, adjustment_type, requested_service_date, replacement_offer_code,
      reason, scheduled_start_at, job_total, amount_paid, policy_snapshot, terms_version
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING id
  `, [
    checkout.id, input.type, input.requestedServiceDate || null, input.replacementOfferCode || null,
    input.reason, start && !Number.isNaN(start.getTime()) ? start.toISOString() : null,
    money(checkout.order_total), amountPaid, JSON.stringify(policySnapshot), input.termsVersion,
  ]);
  return { id: result.rows[0].id, status: "pending_owner_review", policy: policySnapshot };
}

export async function listCommerceAdjustments() {
  return (await pool.query<any>(`
    SELECT a.*, c.customer_name, c.customer_email, c.offer_code, c.square_invoice_id, c.square_payment_id
    FROM commerce_adjustment_requests a
    LEFT JOIN commerce_checkout_intents c ON c.id=a.checkout_intent_id
    ORDER BY a.created_at DESC LIMIT 100
  `)).rows;
}

export async function reviewCommerceAdjustment(input: {
  id: string;
  actorId: string | null;
  decision: "approve" | "reject";
  notes?: string | null;
}) {
  const status = input.decision === "approve" ? "approved_for_execution" : "rejected";
  const result = await pool.query<any>(`
    UPDATE commerce_adjustment_requests SET status=$2, reviewed_by_user_id=$3, review_notes=$4,
      reviewed_at=now(), updated_at=now() WHERE id=$1 AND status='pending_owner_review' RETURNING *
  `, [input.id, status, input.actorId, input.notes || null]);
  if (!result.rowCount) throw new Error("Adjustment request is not pending owner review");
  return result.rows[0];
}

export async function markCommerceCheckoutPaid(squareInvoiceId: string, squarePaymentId?: string | null) {
  const result = await pool.query(`
    UPDATE commerce_checkout_intents SET status='paid', square_payment_id=COALESCE($2, square_payment_id), updated_at=now()
    WHERE square_invoice_id=$1 AND status<>'paid'
  `, [squareInvoiceId, squarePaymentId || null]);
  return result.rowCount || 0;
}
