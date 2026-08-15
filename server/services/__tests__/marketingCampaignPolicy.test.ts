import assert from "node:assert/strict";
import {
  buildMarketingCampaignShareDocument,
  canEditMarketingCampaign,
  safeMarketingCampaignDestination,
} from "../marketingCampaignPolicy";

const originalDestination = "https://www.jconthemove.com/book?promo=YYSE09Z9&utm_source=crew_ad&utm_medium=facebook&utm_campaign=northwoods-u-haul-load-unload&jc_area=Northwoods&jc_focus=U-Haul+load%2Funload&utm_content=5f483ba5-5109-48b2-9abe-928677bafa05&jc_campaign=5f483ba5-5109-48b2-9abe-928677bafa05";
const safe = safeMarketingCampaignDestination(originalDestination, "https://www.jconthemove.com");
const parsed = new URL(safe);
for (const [key, value] of new URL(originalDestination).searchParams) {
  assert.equal(parsed.searchParams.get(key), value, `tracking parameter should be preserved: ${key}`);
}

assert.equal(
  safeMarketingCampaignDestination("https://example.com/phishing", "https://www.jconthemove.com"),
  "https://www.jconthemove.com/book",
);
assert.equal(
  safeMarketingCampaignDestination("javascript:alert(1)", "https://www.jconthemove.com"),
  "https://www.jconthemove.com/book",
);

assert.equal(canEditMarketingCampaign("owner-1", { id: "owner-1", role: "employee" }), true);
assert.equal(canEditMarketingCampaign("owner-1", { id: "other", role: "employee" }), false);
assert.equal(canEditMarketingCampaign("owner-1", { id: "other", role: "admin" }), true);
assert.equal(canEditMarketingCampaign("owner-1", { id: "other", role: "business_owner" }), true);
assert.equal(canEditMarketingCampaign("owner-1", { id: "other", email: "UPMICHIGANSTATEMOVERS@GMAIL.COM" }), true);

const shareUrl = "https://www.jconthemove.com/c/5f483ba5-5109-48b2-9abe-928677bafa05?v=2";
const imageUrl = "https://www.jconthemove.com/api/public/marketing/campaigns/5f483ba5-5109-48b2-9abe-928677bafa05/creative/og.jpg?v=2";
const html = buildMarketingCampaignShareDocument({
  title: `Northwoods "U-Haul" <help>`,
  description: "Save 5% & book the route day.",
  shareUrl,
  imageUrl,
  imageAlt: "JC ON THE MOVE Northwoods ad",
  destination: originalDestination,
});
assert.ok(html.includes('property="og:image"'));
assert.ok(html.includes('content="1200"'));
assert.ok(html.includes('content="630"'));
assert.ok(html.includes(imageUrl.replace(/&/g, "&amp;")));
assert.ok(html.includes(shareUrl.replace(/&/g, "&amp;")));
assert.ok(html.includes("Northwoods &quot;U-Haul&quot; &lt;help&gt;"));
assert.ok(!html.includes("<help>"));
assert.ok(html.includes(JSON.stringify(originalDestination)));

console.log("marketing campaign policy tests passed");
