import assert from "node:assert/strict";
import {
  evaluateCompanyPublisherForCampaign,
  evaluateMarketingMetaPilotTarget,
  getMarketingMetaPilotPolicy,
  isMarketingMetaPilotCampaign,
  isMarketingMetaPilotPage,
  isMarketingMetaPilotRep,
} from "../marketingMetaPilotPolicy";

const configuredEnv = {
  META_APP_ID: "meta-app-id",
  META_APP_SECRET: "meta-app-secret",
  META_OAUTH_REDIRECT_URI: "https://www.jconthemove.com/api/crew/marketing-bot/meta/callback",
  META_OAUTH_TOKEN_ENCRYPTION_KEY: "test-only-marketing-meta-encryption-key-1234567890",
  META_GRAPH_API_VERSION: "v99.0",
  MARKETING_META_PILOT_PAGE_ID: "112233445566778",
  MARKETING_META_PILOT_PAGE_NAME: "Matt Northwoods Pilot",
  MARKETING_META_PILOT_REP_SLUGS: "matt",
};

const policy = getMarketingMetaPilotPolicy(configuredEnv);
assert.equal(policy.ready, true);
assert.equal(policy.repSlug, "matt");
assert.equal(policy.channel, "facebook");
assert.equal(policy.brand, "northwoods_moving");
assert.equal(policy.instagramEnabled, false);
assert.equal(policy.otherRepresentativesEnabled, false);
assert.deepEqual(policy.scopes, ["pages_show_list", "pages_manage_posts", "pages_read_engagement"]);

assert.equal(isMarketingMetaPilotRep("Matt"), true);
assert.equal(isMarketingMetaPilotRep("ashley"), false);
assert.equal(isMarketingMetaPilotCampaign("northwoods_moving"), true);
assert.equal(isMarketingMetaPilotCampaign("jc_on_the_move"), false);
assert.equal(isMarketingMetaPilotPage("112233445566778", configuredEnv), true);
assert.equal(isMarketingMetaPilotPage("998877665544332", configuredEnv), false);

const authorizedTarget = {
  repSlug: "matt",
  brand: "northwoods_moving",
  channel: "facebook",
  pageId: "112233445566778",
};
assert.equal(evaluateMarketingMetaPilotTarget(authorizedTarget, configuredEnv).allowed, true);
assert.equal(evaluateMarketingMetaPilotTarget({ ...authorizedTarget, repSlug: "ashley" }, configuredEnv).allowed, false, "other representatives stay disabled");
assert.equal(evaluateMarketingMetaPilotTarget({ ...authorizedTarget, brand: "jc_on_the_move" }, configuredEnv).allowed, false, "non-Northwoods campaigns stay disabled");
assert.equal(evaluateMarketingMetaPilotTarget({ ...authorizedTarget, channel: "instagram" }, configuredEnv).allowed, false, "Instagram stays disabled");
assert.equal(evaluateMarketingMetaPilotTarget({ ...authorizedTarget, pageId: "998877665544332" }, configuredEnv).allowed, false, "another managed Page cannot be selected or published to");

assert.equal(evaluateCompanyPublisherForCampaign("northwoods_moving").allowed, false, "Northwoods cannot use global company credentials");
assert.equal(evaluateCompanyPublisherForCampaign("jc_on_the_move").allowed, true);

const widenedPilot = getMarketingMetaPilotPolicy({ ...configuredEnv, MARKETING_META_PILOT_REP_SLUGS: "matt,ashley" });
assert.equal(widenedPilot.ready, false, "the pilot fails closed if another representative is added");
assert.match(widenedPilot.configurationErrors[0], /exactly matt/);

const missingPage = getMarketingMetaPilotPolicy({ ...configuredEnv, MARKETING_META_PILOT_PAGE_ID: "" });
assert.equal(missingPage.ready, false);
assert.ok(missingPage.missing.includes("MARKETING_META_PILOT_PAGE_ID"), "an exact authorized Page ID is mandatory");

console.log("marketing Meta pilot policy tests passed");
