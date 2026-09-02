import assert from "node:assert/strict";
import { appendNorthwoodsCampaignFacts, validateNorthwoodsCampaignSafety } from "../northwoodsCampaignPolicy";

const destinationUrl = "https://jconthemove.com/uhaul/ironwood";
const caption = appendNorthwoodsCampaignFacts({
  text: "Need loading help around Ironwood this week?",
  destinationUrl,
  marketLabel: "Ironwood, MI",
});
assert.match(caption, /Northwoods Moving and Junk Removing/);
assert.match(caption, /Moving Help powered by U-Haul/);
assert.match(caption, /jconthemove\.com\/uhaul\/ironwood/);
assert.equal(appendNorthwoodsCampaignFacts({ text: caption, destinationUrl, marketLabel: "Ironwood, MI" }), caption, "facts remain idempotent after editing");

const safeInput = {
  headline: "Loading help in Ironwood",
  facebookCaption: caption,
  instagramCaption: caption,
  googleBusinessSummary: caption,
  shortCaption: caption,
  destinationUrl,
};
assert.equal(validateNorthwoodsCampaignSafety(safeInput).passed, true);
assert.equal(validateNorthwoodsCampaignSafety({ ...safeInput, facebookCaption: `${caption} Only $99 today.` }).passed, false, "cached price claims are blocked");
assert.equal(validateNorthwoodsCampaignSafety({ ...safeInput, facebookCaption: `${caption} Visit our Wausau office.` }).passed, false, "unsupported local-office claims are blocked");

console.log("northwoods campaign policy tests passed");
