import { z } from "zod";

export const MARKETING_BOT_TIMEZONE = "America/Chicago";
export const MARKETING_BOT_MODEL = "openai/gpt-5.4-mini";

export const marketingBotServiceSchema = z.enum([
  "moving",
  "packing",
  "junk_removal",
  "helping_hands",
  "heavy_item",
  "lawn_seasonal",
  "last_minute",
  "reputation",
]);

export const marketingBotTerritorySchema = z.enum([
  "ironwood_hurley",
  "houghton",
  "eagle_river",
  "iron_river",
  "mercer_minocqua",
  "up_northwoods",
]);

export const marketingBotChannelSchema = z.enum([
  "facebook",
  "instagram",
  "google_business",
]);

export const marketingBotStatusSchema = z.enum([
  "pending_approval",
  "approved",
  "publishing",
  "partially_published",
  "published",
  "skipped",
  "failed",
]);

export const marketingBotCtaSchema = z.enum([
  "BOOK",
  "CALL",
  "GET_QUOTE",
  "LEARN_MORE",
]);

export const marketingBotDraftOutputSchema = z.object({
  selectedCandidateId: z.string().min(1).max(120),
  headline: z.string().min(8).max(100),
  facebookCaption: z.string().min(40).max(1800),
  instagramCaption: z.string().min(30).max(1800),
  googleBusinessSummary: z.string().min(30).max(1200),
  shortCaption: z.string().min(20).max(300),
  cta: marketingBotCtaSchema,
  visualDirection: z.string().min(15).max(500),
  rationale: z.string().min(15).max(800),
});

export const marketingBotEditSchema = z.object({
  headline: z.string().trim().min(8).max(100),
  facebookCaption: z.string().trim().min(40).max(1800),
  instagramCaption: z.string().trim().min(30).max(1800),
  googleBusinessSummary: z.string().trim().min(30).max(1200),
  shortCaption: z.string().trim().min(20).max(300),
  cta: marketingBotCtaSchema,
});

export type MarketingBotService = z.infer<typeof marketingBotServiceSchema>;
export type MarketingBotTerritory = z.infer<typeof marketingBotTerritorySchema>;
export type MarketingBotChannel = z.infer<typeof marketingBotChannelSchema>;
export type MarketingBotStatus = z.infer<typeof marketingBotStatusSchema>;
export type MarketingBotCta = z.infer<typeof marketingBotCtaSchema>;
export type MarketingBotDraftOutput = z.infer<typeof marketingBotDraftOutputSchema>;

export const MARKETING_SERVICE_LABELS: Record<MarketingBotService, string> = {
  moving: "Moving",
  packing: "Packing",
  junk_removal: "Junk Removal",
  helping_hands: "Helping Hands",
  heavy_item: "Heavy-Item Moving",
  lawn_seasonal: "Lawn / Seasonal Work",
  last_minute: "Last-Minute Availability",
  reputation: "Customer Reviews & Community",
};

export const MARKETING_TERRITORY_LABELS: Record<MarketingBotTerritory, string> = {
  ironwood_hurley: "Ironwood / Hurley",
  houghton: "Houghton",
  eagle_river: "Eagle River",
  iron_river: "Iron River",
  mercer_minocqua: "Mercer / Minocqua",
  up_northwoods: "UP / Northwoods corridor",
};

export const MARKETING_BOT_CHANNELS = marketingBotChannelSchema.options;
export const MARKETING_BOT_SERVICES = marketingBotServiceSchema.options;
export const MARKETING_BOT_TERRITORIES = marketingBotTerritorySchema.options;
