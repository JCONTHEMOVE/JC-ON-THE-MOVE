import { generateText, Output } from "ai";
import { z } from "zod";
import { pool } from "../db";
import { sendEmail } from "./email";
import { getAshleyShopSetup } from "./ashleyShopPolicy";
import { ensureAshleyShopSchema } from "./ashleyShopSchema";

const listingSchema = z.object({
  listings: z.array(z.object({
    mediaIds: z.array(z.string().uuid()).min(1),
    title: z.string().min(1).max(200),
    shortDescription: z.string().max(500),
    description: z.string().max(4_000),
    category: z.enum(["earrings", "rings", "necklaces", "bracelets", "sets", "custom", "other"]),
    materials: z.string().max(500),
    tags: z.array(z.string().max(80)).max(20),
    suggestedPriceMin: z.number().positive().max(100_000),
    suggestedPriceMax: z.number().positive().max(100_000),
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string().max(300)).max(10),
  })).min(1).max(20),
});

type MediaRow = { id: string; object_url: string; filename: string; mime_type: string };

export function buildAshleyReviewFallbackDrafts(media: MediaRow[], reason: string) {
  return media.map((item) => ({
    status: "needs_review" as const,
    title: item.filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Handmade jewelry piece",
    shortDescription: "Handmade with love by Ashley.",
    description: "Review this photo, add the item details, and set a final price before publishing.",
    category: "other",
    materials: "",
    suggestedPriceMin: null,
    suggestedPriceMax: null,
    finalPrice: null,
    mediaIds: [item.id],
    confidence: 0,
    warnings: ["AI analysis was unavailable; Ashley must review all details."],
    aiMetadata: { fallback: true, reason: reason.slice(0, 500) },
  }));
}

function absoluteMediaUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const base = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://www.jconthemove.com";
  return new URL(value, base).toString();
}

function modelCandidates(): string[] {
  return Array.from(new Set([
    process.env.ASHLEY_SHOP_VISION_MODEL || "spacexai/grok-4.6",
    process.env.ASHLEY_SHOP_VISION_FALLBACK_MODEL || "openai/gpt-5.6-luna",
  ].filter(Boolean)));
}

async function analyzeMedia(media: MediaRow[]) {
  const text = [
    "You are the catalog assistant for Handmade Jewels by Ashley — Made with Love.",
    "Group photos that clearly show the same physical handmade item into one listing.",
    "Return the supplied media UUIDs exactly. Never merge uncertain items.",
    "Write warm, accurate sales copy. Do not claim a gemstone, metal, size, origin, or technique unless visually certain.",
    "Put uncertainties in warnings. Suggest a price range only; Ashley must set the final price before publishing.",
    `Media manifest: ${media.map((item) => `${item.id} (${item.filename})`).join(", ")}`,
  ].join("\n");
  const content: any[] = [{ type: "text", text }];
  for (const item of media) {
    content.push({ type: "image", image: new URL(absoluteMediaUrl(item.object_url)) });
  }

  let lastError: unknown;
  for (const model of modelCandidates()) {
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: listingSchema }),
        messages: [{ role: "user", content }],
        temperature: 0.2,
      });
      return { output: result.output, model };
    } catch (error) {
      lastError = error;
      console.warn(`[Ashley Shop AI] model ${model} failed; trying fallback`, error instanceof Error ? error.message : error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All configured Ashley Shop vision models failed");
}

async function insertFallbackDrafts(batchId: string, media: MediaRow[], reason: string) {
  for (const draft of buildAshleyReviewFallbackDrafts(media, reason)) {
    await pool.query(
      `INSERT INTO ashley_shop_listing_drafts
        (batch_id, status, title, short_description, description, category, materials,
         suggested_price_min, suggested_price_max, media_ids, confidence, warnings, ai_metadata)
       VALUES ($1, 'needs_review', $2, $3, $4, 'other', '', NULL, NULL, $5::jsonb, 0,
               $6::jsonb, $7::jsonb)`,
      [
        batchId,
        draft.title,
        draft.shortDescription,
        draft.description,
        JSON.stringify(draft.mediaIds),
        JSON.stringify(draft.warnings),
        JSON.stringify(draft.aiMetadata),
      ],
    );
  }
}

export async function processAshleyBatch(batchId: string) {
  await ensureAshleyShopSchema();
  const claimed = await pool.query<{ status: string; draft_count: number }>(
    `UPDATE ashley_shop_intake_batches
        SET status = 'processing', error_message = NULL, updated_at = now()
      WHERE id = $1 AND status IN ('received', 'queued')
      RETURNING status, draft_count`,
    [batchId],
  );
  if (!claimed.rows[0]) {
    const current = await pool.query<{ status: string; draft_count: number }>(
      `SELECT status, draft_count FROM ashley_shop_intake_batches WHERE id = $1`,
      [batchId],
    );
    if (!current.rows[0]) throw new Error("Intake batch not found");
    if (["awaiting_approval", "approved"].includes(current.rows[0].status)) {
      return { batchId, draftCount: Number(current.rows[0].draft_count || 0), alreadyProcessed: true };
    }
    if (current.rows[0].status === "processing") throw new Error("This intake batch is already being processed");
    throw new Error(`Intake batch cannot be processed while its status is ${current.rows[0].status}`);
  }
  const mediaResult = await pool.query<MediaRow>(
    `SELECT id, object_url, filename, mime_type
       FROM ashley_shop_media WHERE batch_id = $1 ORDER BY created_at`,
    [batchId],
  );
  if (!mediaResult.rows.length) {
    await pool.query(
      `UPDATE ashley_shop_intake_batches
          SET status = 'failed', error_message = 'Batch has no supported image attachments', updated_at = now()
        WHERE id = $1`,
      [batchId],
    );
    throw new Error("Batch has no supported image attachments");
  }

  let created = 0;
  try {
    for (let offset = 0; offset < mediaResult.rows.length; offset += 20) {
      const chunk = mediaResult.rows.slice(offset, offset + 20);
      try {
        const { output, model } = await analyzeMedia(chunk);
        const allowedIds = new Set(chunk.map((item) => item.id));
        for (const listing of output.listings) {
          const mediaIds = Array.from(new Set(listing.mediaIds.filter((id) => allowedIds.has(id))));
          if (!mediaIds.length) continue;
          const low = Math.min(listing.suggestedPriceMin, listing.suggestedPriceMax);
          const high = Math.max(listing.suggestedPriceMin, listing.suggestedPriceMax);
          await pool.query(
            `INSERT INTO ashley_shop_listing_drafts
              (batch_id, status, title, short_description, description, category, materials, tags,
               suggested_price_min, suggested_price_max, media_ids, confidence, warnings, ai_metadata)
             VALUES ($1, 'needs_price', $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb, $11, $12::jsonb, $13::jsonb)`,
            [batchId, listing.title, listing.shortDescription, listing.description, listing.category,
              listing.materials, JSON.stringify(listing.tags), low, high, JSON.stringify(mediaIds),
              listing.confidence, JSON.stringify(listing.warnings), JSON.stringify({ model })],
          );
          created += 1;
        }
        const used = new Set(output.listings.flatMap((listing) => listing.mediaIds));
        const unused = chunk.filter((item) => !used.has(item.id));
        if (unused.length) {
          await insertFallbackDrafts(batchId, unused, "AI did not assign these photos to a listing");
          created += unused.length;
        }
      } catch (error) {
        await insertFallbackDrafts(batchId, chunk, error instanceof Error ? error.message : String(error));
        created += chunk.length;
      }
    }

    await pool.query(
      `UPDATE ashley_shop_intake_batches
          SET status = 'awaiting_approval', draft_count = $2, processed_at = now(), updated_at = now()
        WHERE id = $1`,
      [batchId, created],
    );
    await pool.query(
      `INSERT INTO ashley_shop_ai_audit
        (action_type, authority_tier, status, input_summary, output_summary, requires_approval)
       VALUES ('catalog_draft_generation', 'tier_1_draft_only', 'completed', $1::jsonb, $2::jsonb, true)`,
      [JSON.stringify({ batchId, mediaCount: mediaResult.rows.length }), JSON.stringify({ draftCount: created })],
    );

    const appUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://www.jconthemove.com";
    const shopSetup = getAshleyShopSetup();
    await sendEmail({
      to: shopSetup.authorizedSender,
      from: process.env.COMPANY_EMAIL || process.env.FROM_EMAIL,
      replyTo: shopSetup.intakeAlias,
      subject: `${created} Handmade Jewels drafts are ready for your approval`,
      text: `${created} listing drafts are ready. Review details, set every final price, and approve them here: ${appUrl}/ashley-shop-admin?batch=${batchId}`,
      html: `<h2>Your jewelry drafts are ready</h2><p>We prepared <strong>${created}</strong> draft listings from your photos.</p><p>Review the details, set every final price, then approve the batch. Nothing has been published yet.</p><p><a href="${appUrl}/ashley-shop-admin?batch=${batchId}">Review and approve drafts</a></p>`,
    });
    return { batchId, draftCount: created };
  } catch (error) {
    await pool.query(
      `UPDATE ashley_shop_intake_batches SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
      [batchId, error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000)],
    );
    throw error;
  }
}

export async function processNextAshleyBatch() {
  await ensureAshleyShopSchema();
  const claimed = await pool.query<{ id: string }>(`
    UPDATE ashley_shop_intake_batches
       SET status = 'queued', updated_at = now()
     WHERE id = (
       SELECT id FROM ashley_shop_intake_batches
        WHERE status = 'received' AND attachment_count > 0
        ORDER BY received_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     RETURNING id
  `);
  if (!claimed.rows[0]) return null;
  return processAshleyBatch(claimed.rows[0].id);
}
