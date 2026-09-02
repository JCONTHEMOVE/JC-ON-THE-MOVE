import { z } from "zod";

export const MARKETING_CREATIVE_VARIANTS = ["feed", "og"] as const;
export type MarketingCreativeVariant = typeof MARKETING_CREATIVE_VARIANTS[number];

export const MARKETING_CREATIVE_SOURCE_KINDS = [
  "approved_photo",
  "uploaded_photo",
  "ai_scene",
] as const;
export type MarketingCreativeSourceKind = typeof MARKETING_CREATIVE_SOURCE_KINDS[number];

export const APPROVED_MARKETING_PHOTOS = [
  {
    key: "crew-ramp",
    label: "Crew at loaded truck",
    description: "Real JC crew beside a loaded customer-rented moving truck.",
    thumbnailUrl: "/marketing-sources/crew-ramp.jpg",
    focusTags: ["moving", "u-haul", "load", "unload", "delivery", "labor"],
  },
] as const;

export type ApprovedMarketingPhotoKey = typeof APPROVED_MARKETING_PHOTOS[number]["key"];

export const DEFAULT_APPROVED_MARKETING_PHOTO: ApprovedMarketingPhotoKey = "crew-ramp";
export const MARKETING_CREATIVE_MAX_AI_GENERATIONS = 3;

const optionalPhotoDataUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string()
    .regex(/^data:image\/(png|jpe?g|webp);base64,/i, "photoDataUrl must be a png, jpg, jpeg, or webp data URL")
    .max(7_000_000)
    .optional(),
);

export const marketingCreativeSourceSchema = z.object({
  kind: z.enum(MARKETING_CREATIVE_SOURCE_KINDS).default("approved_photo"),
  approvedPhotoKey: z.enum([DEFAULT_APPROVED_MARKETING_PHOTO]).default(DEFAULT_APPROVED_MARKETING_PHOTO),
  photoDataUrl: optionalPhotoDataUrlSchema,
});

export const marketingCreativeRequestSchema = z.object({
  source: marketingCreativeSourceSchema.default({
    kind: "approved_photo",
    approvedPhotoKey: DEFAULT_APPROVED_MARKETING_PHOTO,
  }),
  refreshCaption: z.boolean().optional().default(false),
});

export type MarketingCreativeSource = z.infer<typeof marketingCreativeSourceSchema>;
export type MarketingCreativeRequest = z.infer<typeof marketingCreativeRequestSchema>;

export type MarketingCreativeResult = {
  feedImageUrl: string;
  ogImageUrl: string;
  shareUrl: string;
  altText: string;
  revision: number;
  source: MarketingCreativeSourceKind;
  sourceKind: MarketingCreativeSourceKind;
  approvedPhotoKey: ApprovedMarketingPhotoKey;
  provider: "jc_photo" | "openai" | "upload";
  model: string;
  fallbackUsed: boolean;
  reason?: string;
  aiGenerationCount: number;
  generatedAt: string;
  feedAssetUrl?: string;
  ogAssetUrl?: string;
  overlay?: {
    offerLine?: string;
    secondaryLine?: string;
    brandName?: string;
    siteLabel?: string;
  };
};

export function approvedMarketingPhoto(key: string | null | undefined) {
  return APPROVED_MARKETING_PHOTOS.find((photo) => photo.key === key)
    || APPROVED_MARKETING_PHOTOS[0];
}
