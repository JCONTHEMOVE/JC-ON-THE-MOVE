import assert from "node:assert/strict";
import {
  appendTrustedCampaignFacts,
  buildCampaignCode,
  buildCampaignKey,
  buildFallbackDraft,
  marketingLocalParts,
  scoreMarketingCandidates,
  validateCampaignSafety,
} from "../marketingBotPolicy";

const duplicateKey = buildCampaignKey("moving", "ironwood_hurley");
const candidates = scoreMarketingCandidates({
  localDate: "2026-08-17",
  weekday: 1,
  month: 8,
  availableCrew: 4,
  upcomingJobs: 2,
  openCapacity: 6,
  weatherSummary: "72°F and clear",
  activePromotion: null,
  prior14DayKeys: new Set([duplicateKey]),
  performance: {
    [buildCampaignKey("moving", "houghton")]: { bookings: 2, leads: 3, callClicks: 4 },
  },
});

assert.ok(candidates.length > 0);
assert.ok(!candidates.some((candidate) => candidate.id === duplicateKey), "14-day repeats must be excluded");
assert.equal(candidates[0].service, "moving", "Monday and confirmed bookings should favor moving");
assert.equal(candidates[0].territory, "houghton", "confirmed bookings should influence territory selection");

const code = buildCampaignCode({ localDate: "2026-08-17", service: "junk_removal", territory: "ironwood_hurley" });
assert.equal(code, "JC-2026-08-17-JUNK-REMOVAL-IRONWOOD-HURLEY");

const fallback = buildFallbackDraft(candidates[0]);
const campaignUrl = "https://www.jconthemove.com/api/public/marketing-bot/campaign/test";
const trusted = appendTrustedCampaignFacts({
  draft: fallback,
  phone: "(906) 285-9312",
  campaignUrl,
  promoCode: null,
});
const trustedAgain = appendTrustedCampaignFacts({ draft: trusted, phone: "(906) 285-9312", campaignUrl, promoCode: null });
assert.deepEqual(trustedAgain, trusted, "verified campaign facts should not duplicate when an edit is saved again");
const safety = validateCampaignSafety({
  draft: trusted,
  phone: "(906) 285-9312",
  campaignUrl,
  promotionActive: true,
  duplicate: false,
});
assert.equal(safety.passed, true);
assert.equal(validateCampaignSafety({ ...safetyInput(trusted, campaignUrl), duplicate: true }).passed, false);

const local = marketingLocalParts(new Date("2026-08-17T12:00:00Z"));
assert.equal(local.localDate, "2026-08-17");

function safetyInput(draft: typeof trusted, url: string) {
  return {
    draft,
    phone: "(906) 285-9312",
    campaignUrl: url,
    promotionActive: true,
    duplicate: false,
  };
}

console.log("marketing bot policy tests passed");
