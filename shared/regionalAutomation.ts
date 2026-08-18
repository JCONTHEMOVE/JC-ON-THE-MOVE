import { z } from "zod";

export const operatingEligibilityDecisionSchema = z.enum(["eligible", "manual_review", "blocked"]);
export type OperatingEligibilityDecision = z.infer<typeof operatingEligibilityDecisionSchema>;

export const operatingEligibilityReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const operatingEligibilitySchema = z.object({
  decision: operatingEligibilityDecisionSchema,
  areaCode: z.string().nullable(),
  reasons: z.array(operatingEligibilityReasonSchema),
  routeVerified: z.boolean(),
  originState: z.string().nullable(),
  destinationState: z.string().nullable(),
  autoBookEnabled: z.boolean(),
  adsEnabled: z.boolean(),
});
export type OperatingEligibility = z.infer<typeof operatingEligibilitySchema>;

export const invoicePurposeSchema = z.enum([
  "deposit",
  "final_balance",
  "supplement",
  "refund",
  "legacy_unknown",
]);
export type InvoicePurpose = z.infer<typeof invoicePurposeSchema>;

export const dispatchSlotRoleSchema = z.enum(["crew_lead", "mover"]);
export type DispatchSlotRole = z.infer<typeof dispatchSlotRoleSchema>;

export const jobCloseoutStatusSchema = z.enum([
  "draft",
  "awaiting_customer",
  "owner_review",
  "customer_rejected",
  "approved",
  "balance_due",
  "paid",
  "refund_review",
]);
export type JobCloseoutStatus = z.infer<typeof jobCloseoutStatusSchema>;

export const customerJobEventTypeSchema = z.enum([
  "booking_request_received",
  "deposit_invoice_sent",
  "deposit_received",
  "crew_confirmation_in_progress",
  "crew_confirmed",
  "crew_en_route",
  "crew_arrived",
  "closeout_ready",
  "final_invoice_sent",
  "final_payment_received",
]);
export type CustomerJobEventType = z.infer<typeof customerJobEventTypeSchema>;

export const closeoutProofSchema = z.object({
  id: z.string().optional(),
  url: z.string().url(),
  type: z.enum(["before", "after", "completion", "issue"]),
  description: z.string().max(500).optional(),
  capturedAt: z.string().datetime().optional(),
});
export type CloseoutProof = z.infer<typeof closeoutProofSchema>;

export const closeoutChangeOrderInputSchema = z.object({
  code: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive().max(100),
  unitPrice: z.coerce.number().min(0).max(100_000),
  catalogBacked: z.boolean().default(true),
  customerAcknowledged: z.boolean().default(false),
});
export type CloseoutChangeOrderInput = z.infer<typeof closeoutChangeOrderInputSchema>;

export const crewCloseoutSubmissionSchema = z.object({
  actualStartAt: z.string().datetime().optional(),
  actualEndAt: z.string().datetime(),
  breakMinutes: z.coerce.number().int().min(0).max(24 * 60).default(0),
  proofPhotos: z.array(closeoutProofSchema).min(1, "Add at least one completion photo").max(30),
  changeOrders: z.array(closeoutChangeOrderInputSchema).max(25).default([]),
  damageReported: z.boolean().default(false),
  customerDisputed: z.boolean().default(false),
  crewNotes: z.string().trim().max(5000).optional().default(""),
});
export type CrewCloseoutSubmission = z.infer<typeof crewCloseoutSubmissionSchema>;
