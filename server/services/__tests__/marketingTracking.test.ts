import assert from "node:assert/strict";
import { buildMarketingRepQrDestination } from "@shared/marketingTracking";

const generic = new URL(buildMarketingRepQrDestination({
  appUrl: "https://www.jconthemove.com/ignored/path",
  slug: "Matt",
}));

assert.equal(generic.origin, "https://www.jconthemove.com");
assert.equal(generic.pathname, "/network/matt");
assert.equal(generic.searchParams.get("utm_source"), "qr_code");
assert.equal(generic.searchParams.get("utm_medium"), "offline");
assert.equal(generic.searchParams.get("utm_campaign"), "crew-profile-matt");

const campaign = new URL(buildMarketingRepQrDestination({
  appUrl: "https://staging.jconthemove.com",
  slug: "darrell",
  query: {
    utm_source: "crew_ad",
    utm_medium: "facebook",
    utm_campaign: "ironwood-moving",
    jc_campaign: "campaign-123",
    jc_package: "three-movers-four-hours",
    jc_crew_target: "3",
    promo: "WRONG-CODE",
    rep: "wrong-worker",
    redirect: "https://example.com",
  },
}));

assert.equal(campaign.pathname, "/network/darrell");
assert.equal(campaign.searchParams.get("jc_campaign"), "campaign-123");
assert.equal(campaign.searchParams.get("jc_package"), "three-movers-four-hours");
assert.equal(campaign.searchParams.get("jc_crew_target"), "3");
assert.equal(campaign.searchParams.get("promo"), null, "identity promo cannot be overridden through a QR query");
assert.equal(campaign.searchParams.get("rep"), null, "worker attribution cannot be overridden through a QR query");
assert.equal(campaign.searchParams.get("redirect"), null, "QRs cannot be redirected away from the JC website");

assert.throws(() => buildMarketingRepQrDestination({
  appUrl: "https://www.jconthemove.com",
  slug: "../../outside",
}));

console.log("marketing tracking QR destination tests passed");
