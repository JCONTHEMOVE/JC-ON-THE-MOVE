import { z } from "zod";

export const NORTHWOODS_PROVIDER_ID = "404EEC12FC5143";
export const NORTHWOODS_TIME_ZONE = "America/Chicago";

export const northwoodsFocusSchema = z.enum([
  "auto",
  "loading",
  "unloading",
  "u_box",
  "packing",
  "piano",
  "safe",
  "piano_safe",
]);

export const northwoodsAvailabilityStatusSchema = z.enum(["open", "limited", "closed"]);
export const northwoodsReservationStatusSchema = z.enum([
  "needs_review",
  "new",
  "changed",
  "confirmed",
  "ignored",
  "cancelled",
]);

export const northwoodsParsedReservationSchema = z.object({
  externalOrderId: z.string().trim().max(160).nullable().default(null),
  customerFirstName: z.string().trim().max(120).nullable().default(null),
  customerLastName: z.string().trim().max(120).nullable().default(null),
  customerEmail: z.string().trim().email().nullable().default(null),
  customerPhone: z.string().trim().max(40).nullable().default(null),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  durationHours: z.number().positive().max(24).nullable().default(null),
  crewSize: z.number().int().positive().max(12).nullable().default(null),
  fromAddress: z.string().trim().max(500).nullable().default(null),
  toAddress: z.string().trim().max(500).nullable().default(null),
  marketSlug: z.string().trim().max(120).nullable().default(null),
  focus: northwoodsFocusSchema.exclude(["auto"]).nullable().default(null),
  quotedAmountCents: z.number().int().nonnegative().nullable().default(null),
  notes: z.string().trim().max(5000).nullable().default(null),
  emailKind: z.enum(["new", "update", "cancel"]).default("new"),
  missingFields: z.array(z.string()).default([]),
});

export const northwoodsReservationPatchSchema = northwoodsParsedReservationSchema
  .omit({ emailKind: true, missingFields: true })
  .partial();

export const northwoodsAvailabilityInputSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).default("17:00"),
  services: z.array(northwoodsFocusSchema.exclude(["auto", "piano_safe"])).min(1).max(7),
  plannedCrewSize: z.number().int().min(1).max(12).default(2),
  openSlots: z.number().int().min(0).max(20),
  status: northwoodsAvailabilityStatusSchema,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type NorthwoodsFocus = z.infer<typeof northwoodsFocusSchema>;
export type NorthwoodsParsedReservation = z.infer<typeof northwoodsParsedReservationSchema>;
export type NorthwoodsAvailabilityInput = z.infer<typeof northwoodsAvailabilityInputSchema>;

export const NORTHWOODS_FOCUS_LABELS: Record<NorthwoodsFocus, string> = {
  auto: "Best opportunity",
  loading: "Loading help",
  unloading: "Unloading help",
  u_box: "U-Box services",
  packing: "Packing help",
  piano: "Piano moving",
  safe: "Safe moving",
  piano_safe: "Piano / safe moving",
};
