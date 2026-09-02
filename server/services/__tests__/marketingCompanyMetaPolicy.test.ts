import assert from "node:assert/strict";
import {
  companyFacebookTargetKey,
  companyMetaPageCredentialsSchema,
} from "../marketingCompanyMetaPolicy";

const parsed = companyMetaPageCredentialsSchema.parse({
  pages: [
    { pageId: "912756211920086", accessToken: "page-token-long-enough-for-validation" },
    { pageId: "201994456322276", accessToken: "another-page-token-long-enough" },
  ],
});
assert.equal(parsed.pages.length, 2);
assert.equal(companyFacebookTargetKey("912756211920086"), "facebook:912756211920086");

assert.throws(() => companyMetaPageCredentialsSchema.parse({
  pages: [
    { pageId: "912756211920086", accessToken: "page-token-long-enough-for-validation" },
    { pageId: "912756211920086", accessToken: "another-page-token-long-enough" },
  ],
}), "duplicate Pages must be rejected");

assert.throws(
  () => companyFacebookTargetKey("facebook-page-name"),
  "publication target keys must use a numeric Page ID",
);

console.log("marketing company Meta policy tests passed");
