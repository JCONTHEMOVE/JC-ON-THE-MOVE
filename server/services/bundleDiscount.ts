// Server-side bundle-discount service.
//
// Two exported entrypoints:
//   • evaluateBundleDiscount(input) — takes the customer's identifying
//     info + service + raw subtotal, decides whether the discount is
//     owed, and returns the deterministic result. Pure decision; does
//     not mutate any rows.
//   • logBundleDiscountApplication(args) — fire-and-forget audit-log
//     write to the `bundle_discount_applications` table; called by the
//     route only when the discount was actually persisted on the
//     downstream lead/quote/subscription row.
//
// Endpoints persist the result on their own row so the Square invoice
// generator + admin emails can read the same number deterministically.

import { db } from "../db";
import { sql, and, or, gte, eq, ne } from "drizzle-orm";
import {
  leads,
  lawnCareQuotes,
  trashSubscriptions,
  bundleDiscountApplications,
} from "@shared/schema";
import {
  calculateBundleDiscount,
  type BundleDiscountReason,
  type BundleDiscountResult,
} from "@shared/bundleDiscount";

const REPEAT_LOOKBACK_DAYS = 90;

export interface BundleEligibilityInput {
  /** The service the customer is currently quoting. Excluded from history matches. */
  currentService: string;
  /** Customer phone (any format; normalized internally). */
  phone?: string | null;
  /** Customer email (any case; normalized internally). */
  email?: string | null;
  /** Other services ticked in this same submission ("intent" trigger). */
  bundleAddons?: string[];
}

export interface BundleEligibility {
  eligible: boolean;
  reason: BundleDiscountReason | null;
  triggeringServices: string[];
}

/** Strip non-digits so "(906) 555-1212" matches "9065551212" stored variants. */
function normalizePhone(phone: string | null | undefined): string {
  return (phone || "").replace(/\D/g, "");
}
function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Look up paid/active bookings in the last 90 days across every service
 * table for the same phone or email. Returns the distinct list of OTHER
 * services this customer has used.
 *
 * "Paid/active" semantics per table — strictly excludes leads that are
 * still in the quote-request stage so we don't reward people who never
 * actually became customers:
 *   - leads               → depositPaid=true OR status in real-job states
 *                            (available/accepted/scheduled/dispatched/
 *                             in_progress/completed/paid)
 *   - lawn_care_quotes    → status in (scheduled/in_progress/completed/paid)
 *                            i.e. anything past "quote_requested"
 *   - trash_subscriptions → status = 'active'
 */
async function findCrossServiceHistory(
  currentService: string,
  phone: string,
  email: string,
): Promise<string[]> {
  const normPhone = normalizePhone(phone);
  const normEmail = normalizeEmail(email);
  if (!normPhone && !normEmail) return [];

  const sinceDate = new Date(Date.now() - REPEAT_LOOKBACK_DAYS * 86400_000);
  const found = new Set<string>();

  // ── leads (moving / junk / window_cleaning / cleaning / handyman / etc) ──
  try {
    const leadMatches = await db
      .select({ serviceType: leads.serviceType, status: leads.status })
      .from(leads)
      .where(
        and(
          gte(leads.createdAt, sinceDate),
          ne(leads.serviceType, currentService),
          sql`COALESCE(${leads.source}, '') <> 'moving_help_uhaul'`,
          // Real-customer filter: deposit paid OR status indicates a booked /
          // active / completed job (not a stale quote_requested record).
          or(
            eq(leads.depositPaid, true),
            sql`${leads.status} IN ('available','accepted','scheduled','dispatched','in_progress','completed','paid')`,
          ),
          or(
            normPhone ? sql`regexp_replace(${leads.phone}, '\\D', '', 'g') = ${normPhone}` : sql`false`,
            normEmail ? sql`LOWER(${leads.email}) = ${normEmail}` : sql`false`,
          ),
        ),
      )
      .limit(20);
    for (const r of leadMatches) {
      if (r.serviceType && r.serviceType !== currentService) found.add(r.serviceType);
    }
  } catch (e) {
    console.warn("[bundleDiscount] leads history lookup failed:", (e as Error).message);
  }

  // ── lawn_care_quotes ──
  if (currentService !== "lawn_care") {
    try {
      const lawnMatches = await db
        .select({ id: lawnCareQuotes.id })
        .from(lawnCareQuotes)
        .where(
          and(
            gte(lawnCareQuotes.createdAt, sinceDate),
            // Exclude pure quote-only records (status='quote_requested').
            sql`${lawnCareQuotes.status} IN ('scheduled','in_progress','completed','paid','active')`,
            or(
              normPhone ? sql`regexp_replace(${lawnCareQuotes.phone}, '\\D', '', 'g') = ${normPhone}` : sql`false`,
              normEmail ? sql`LOWER(${lawnCareQuotes.email}) = ${normEmail}` : sql`false`,
            ),
          ),
        )
        .limit(1);
      if (lawnMatches.length > 0) found.add("lawn_care");
    } catch (e) {
      console.warn("[bundleDiscount] lawn_care history lookup failed:", (e as Error).message);
    }
  }

  // ── trash_subscriptions ──
  if (currentService !== "trash_valet") {
    try {
      const trashMatches = await db
        .select({ id: trashSubscriptions.id })
        .from(trashSubscriptions)
        .where(
          and(
            gte(trashSubscriptions.createdAt, sinceDate),
            eq(trashSubscriptions.status, "active"),
            or(
              normPhone ? sql`regexp_replace(${trashSubscriptions.phone}, '\\D', '', 'g') = ${normPhone}` : sql`false`,
              normEmail ? sql`LOWER(${trashSubscriptions.email}) = ${normEmail}` : sql`false`,
            ),
          ),
        )
        .limit(1);
      if (trashMatches.length > 0) found.add("trash_valet");
    } catch (e) {
      console.warn("[bundleDiscount] trash history lookup failed:", (e as Error).message);
    }
  }

  return Array.from(found);
}

/**
 * Decide whether the discount applies. `bundleAddons` (intent in same
 * submission) wins over the history lookup if both fire — the customer
 * explicitly told us they want to bundle, and we don't want to silently
 * downgrade the reason to a generic "loyalty" string in the audit log.
 */
export async function checkBundleEligibility(input: BundleEligibilityInput): Promise<BundleEligibility> {
  const cleanedAddons = (input.bundleAddons || [])
    .map((s) => String(s || "").trim())
    .filter((s) => s && s !== input.currentService);

  if (cleanedAddons.length > 0) {
    return {
      eligible: true,
      reason: "bundle_intent",
      triggeringServices: cleanedAddons,
    };
  }

  const history = await findCrossServiceHistory(
    input.currentService,
    input.phone || "",
    input.email || "",
  );
  if (history.length > 0) {
    return {
      eligible: true,
      reason: "cross_service_history",
      triggeringServices: history,
    };
  }

  return { eligible: false, reason: null, triggeringServices: [] };
}

export interface ApplyBundleDiscountInput extends BundleEligibilityInput {
  subtotal: number;
}

export interface ApplyBundleDiscountResult extends BundleDiscountResult {
  triggeringServices: string[];
}

/** Eligibility check + math, no DB writes. Use this when you want to compute
 *  the discount but defer the audit-log write until after the row is created
 *  (so the audit row can carry the real reference id). */
export async function evaluateBundleDiscount(input: ApplyBundleDiscountInput): Promise<ApplyBundleDiscountResult> {
  const elig = await checkBundleEligibility(input);
  const calc = calculateBundleDiscount(input.subtotal, elig.eligible, elig.reason);
  return { ...calc, triggeringServices: elig.triggeringServices };
}

/** Best-effort audit write. Errors are swallowed — the discount is already
 *  persisted on the per-service row, so a failed audit-log insert must not
 *  block the customer's quote response. */
export async function logBundleDiscountApplication(args: {
  referenceTable: "leads" | "lawn_care_quotes" | "trash_subscriptions";
  referenceId: string | number;
  serviceType: string;
  customerEmail: string | null;
  customerPhone: string | null;
  subtotalBefore: number;
  result: ApplyBundleDiscountResult;
}): Promise<void> {
  if (!args.result.applied) return;
  try {
    await db.insert(bundleDiscountApplications).values({
      referenceTable: args.referenceTable,
      referenceId: String(args.referenceId),
      serviceType: args.serviceType,
      customerEmail: args.customerEmail || null,
      customerPhone: args.customerPhone || null,
      subtotalBefore: args.subtotalBefore.toFixed(2),
      discountAmount: args.result.amount.toFixed(2),
      discountPercent: args.result.percent,
      reason: args.result.reason || "bundle_intent",
      triggeringServices: args.result.triggeringServices,
    });
  } catch (e) {
    console.warn("[bundleDiscount] audit insert failed (non-fatal):", (e as Error).message);
  }
}
