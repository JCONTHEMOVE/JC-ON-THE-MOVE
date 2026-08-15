import assert from "node:assert/strict";
import sharp from "sharp";
import {
  buildMarketingOverlaySvg,
  createMarketingCreative,
  escapeMarketingCreativeXml,
  loadApprovedMarketingPhoto,
  marketingCampaignShareUrl,
  marketingCreativeImageUrl,
  renderMarketingCreativeBuffer,
} from "../marketingCreativeGenerator";
import { buildApprovedMarketingFacebookPost, marketingAdDraftSchema } from "../marketingAdGenerator";

const overlay = {
  area: "Northwoods",
  focus: "U-Haul load/unload",
  promoCode: "YYSE09Z9",
};

const approvedPhoto = await loadApprovedMarketingPhoto("crew-ramp");

for (const [variant, expected] of Object.entries({
  feed: { width: 1080, height: 1350 },
  og: { width: 1200, height: 630 },
}) as Array<["feed" | "og", { width: number; height: number }]>) {
  const rendered = await renderMarketingCreativeBuffer({ sourceBuffer: approvedPhoto, variant, overlay });
  const metadata = await sharp(rendered).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, expected.width);
  assert.equal(metadata.height, expected.height);
}

const feedSvg = buildMarketingOverlaySvg("feed", overlay).toString("utf8");
for (const exactText of [
  "JC ON THE MOVE",
  "NORTHWOODS U-HAUL",
  "LOAD / UNLOAD HELP",
  "SAVE 5% ON YOUR AREA'S ROUTE DAY",
  "IRONWOOD SAVES 5% EVERY DAY",
  "JCONTHEMOVE.COM • CODE YYSE09Z9",
]) {
  assert.ok(feedSvg.includes(escapeMarketingCreativeXml(exactText)), `overlay should contain ${exactText}`);
}

assert.equal(escapeMarketingCreativeXml(`A&B <move> "today" 'now'`), "A&amp;B &lt;move&gt; &quot;today&quot; &apos;now&apos;");
const escapedSvg = buildMarketingOverlaySvg("og", {
  area: "North < Woods & More",
  focus: "U-Haul load/unload",
  promoCode: `A&B<'`,
}).toString("utf8");
assert.ok(escapedSvg.includes("NORTH &lt; WOODS &amp; MORE U-HAUL"));
assert.ok(escapedSvg.includes("CODE A&amp;B&lt;&apos;"));
assert.ok(!escapedSvg.includes("NORTH < WOODS"));

assert.equal(
  marketingCreativeImageUrl("campaign-123", "feed", 4, "https://www.jconthemove.com"),
  "https://www.jconthemove.com/api/public/marketing/campaigns/campaign-123/creative/feed.jpg?v=4",
);
assert.equal(
  marketingCampaignShareUrl("campaign-123", 4, "https://www.jconthemove.com"),
  "https://www.jconthemove.com/c/campaign-123?v=4",
);

const previousOpenAi = process.env.OPENAI_API_KEY;
const previousStorage = process.env.PUBLIC_OBJECT_SEARCH_PATHS;
delete process.env.OPENAI_API_KEY;
delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
try {
  const fallback = await createMarketingCreative({
    campaignId: "campaign-fallback",
    revision: 1,
    ...overlay,
    source: { kind: "ai_scene", approvedPhotoKey: "crew-ramp" },
  });
  assert.equal(fallback.sourceKind, "approved_photo");
  assert.equal(fallback.provider, "jc_photo");
  assert.equal(fallback.fallbackUsed, true);
  assert.match(fallback.reason || "", /object storage is not configured/i);
  assert.match(fallback.feedImageUrl, /creative\/feed\.jpg\?v=1$/);
  assert.match(fallback.ogImageUrl, /creative\/og\.jpg\?v=1$/);

  const uploadFallback = await createMarketingCreative({
    campaignId: "campaign-upload-fallback",
    revision: 1,
    ...overlay,
    source: { kind: "uploaded_photo", approvedPhotoKey: "crew-ramp", photoDataUrl: "data:image/jpeg;base64,AA==" },
  });
  assert.equal(uploadFallback.sourceKind, "approved_photo");
  assert.match(uploadFallback.reason || "", /object storage is not configured/i);

  process.env.OPENAI_API_KEY = "test-key-not-used";
  process.env.PUBLIC_OBJECT_SEARCH_PATHS = "/test-bucket/public";
  const limited = await createMarketingCreative({
    campaignId: "campaign-ai-limit",
    revision: 4,
    ...overlay,
    source: { kind: "ai_scene", approvedPhotoKey: "crew-ramp" },
    previous: { aiGenerationCount: 3 },
  });
  assert.equal(limited.sourceKind, "approved_photo");
  assert.equal(limited.aiGenerationCount, 3);
  assert.match(limited.reason || "", /AI image limit reached \(3 per campaign\)/i);
} finally {
  if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenAi;
  if (previousStorage === undefined) delete process.env.PUBLIC_OBJECT_SEARCH_PATHS;
  else process.env.PUBLIC_OBJECT_SEARCH_PATHS = previousStorage;
}

const trackedShareUrl = "https://www.jconthemove.com/c/5f483ba5-5109-48b2-9abe-928677bafa05?v=1";
const caption = buildApprovedMarketingFacebookPost(marketingAdDraftSchema.parse({
  area: "Northwoods",
  focus: "U-Haul load/unload",
  referralLink: trackedShareUrl,
  promoCode: "YYSE09Z9",
  rawText: "Last-minute load/unload and delivery help may be available depending on crew timing.",
}));
const orderedCaptionParts = [
  "Need U-Haul load/unload around Northwoods?",
  "JC ON THE MOVE can help",
  "Route-day schedule:",
  "Route-day travel options:",
  "1.25x travel pricing",
  "We will build the right quote before the crew is confirmed.",
  trackedShareUrl,
  "Use code YYSE09Z9.",
];
let lastIndex = -1;
for (const part of orderedCaptionParts) {
  const index = caption.indexOf(part);
  assert.ok(index > lastIndex, `caption part should be in approved order: ${part}`);
  lastIndex = index;
}
assert.equal(caption.split("Route-day schedule:").length - 1, 1);
assert.equal(caption.split(trackedShareUrl).length - 1, 1);

console.log("marketing creative generator tests passed");
