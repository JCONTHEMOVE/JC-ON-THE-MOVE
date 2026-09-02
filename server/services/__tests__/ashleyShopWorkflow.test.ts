import assert from "node:assert/strict";
import type { gmail_v1 } from "googleapis";
import { ashleyBatchApprovalSchema } from "@shared/ashleyShop";
import { buildAshleyReviewFallbackDrafts } from "../ashleyShopAi";
import { inspectAshleyIntakeMessage } from "../ashleyShopEmail";
import {
  canonicalGmailAddress,
  getAshleyShopSetup,
  isAshleyFinalApprovalActor,
  validateAshleyDraftPublication,
} from "../ashleyShopPolicy";

const addresses = {
  authorizedSender: "ashleyseegert64@gmail.com",
  intakeAlias: "ashleyseegert64+shop@gmail.com",
};

const photoParts: gmail_v1.Schema$MessagePart[] = [
  { filename: "earrings-front.jpg", mimeType: "image/jpeg", body: { attachmentId: "image-1" } },
  { filename: "earrings-side.png", mimeType: "image/png", body: { attachmentId: "image-2" } },
  { filename: "bracelet.webp", mimeType: "image/webp", body: { data: "AA==" } },
];

const severalPhotoEmail: gmail_v1.Schema$Message = {
  id: "gmail-message-1",
  payload: {
    mimeType: "multipart/mixed",
    headers: [
      { name: "From", value: "Ashley Seegert <ashleyseegert64@gmail.com>" },
      { name: "To", value: "Handmade Jewels intake <ashleyseegert64+shop@gmail.com>" },
      { name: "Subject", value: "New handmade pieces" },
    ],
    parts: [
      { mimeType: "text/plain", body: { data: "UGhvdG9z" } },
      ...photoParts,
      { filename: "notes.pdf", mimeType: "application/pdf", body: { attachmentId: "not-an-image" } },
    ],
  },
};

{
  const inspected = inspectAshleyIntakeMessage(severalPhotoEmail, addresses);
  assert.equal(inspected.eligible, true);
  assert.equal(inspected.supportedImageCount, 3, "all three supported photos in one eligible email are selected");
  assert.deepEqual(inspected.imageParts.map((part) => part.filename), photoParts.map((part) => part.filename));

  const media = inspected.imageParts.map((part, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    object_url: `/public-objects/ashley-test-${index}.jpg`,
    filename: part.filename || `photo-${index + 1}.jpg`,
    mime_type: "image/jpeg",
  }));
  const drafts = buildAshleyReviewFallbackDrafts(media, "vision provider intentionally unavailable in the workflow test");
  assert.equal(drafts.length, 3, "several email images become approval-ready review drafts even without AI");
  assert.ok(drafts.every((draft) => draft.status === "needs_review"));
  assert.ok(drafts.every((draft) => draft.finalPrice === null));
  assert.ok(drafts.every((draft) => draft.mediaIds.length === 1));
}

{
  const spoofed = structuredClone(severalPhotoEmail);
  spoofed.payload!.headers = spoofed.payload!.headers!.map((item) => item.name === "From"
    ? { ...item, value: "Someone Else <attacker@gmail.com>" }
    : item);
  const inspected = inspectAshleyIntakeMessage(spoofed, addresses);
  assert.equal(inspected.eligible, false);
  assert.equal(inspected.reason, "unauthorized_sender");
}

{
  const env = {
    ASHLEY_SHOP_AUTOMATION_ENABLED: "true",
    ASHLEY_SHOP_EMAIL_INGEST_ENABLED: "true",
    ASHLEY_SHOP_MAILBOX: addresses.authorizedSender,
    ASHLEY_SHOP_INTAKE_ALIAS: addresses.intakeAlias,
    ASHLEY_SHOP_AUTHORIZED_SENDER: addresses.authorizedSender,
    ASHLEY_GMAIL_CLIENT_ID: "configured-client",
    ASHLEY_GMAIL_CLIENT_SECRET: "configured-secret",
    ASHLEY_GMAIL_REFRESH_TOKEN: "configured-refresh",
    PUBLIC_OBJECT_SEARCH_PATHS: "/test-bucket/public",
  } as NodeJS.ProcessEnv;
  const setup = getAshleyShopSetup(env);
  assert.equal(setup.requiredReady, true);
  assert.equal(canonicalGmailAddress(setup.intakeAlias), canonicalGmailAddress(setup.mailbox));
  assert.equal(isAshleyFinalApprovalActor("Ashley Seegert <ashleyseegert64@gmail.com>", env), true);
  assert.equal(isAshleyFinalApprovalActor("owner@example.com", env), false);

  const pricedByAshley = {
    final_price: "48.00",
    final_price_set_by_user_id: "ashley-user-id",
    final_price_set_by_email: addresses.authorizedSender,
    final_price_set_at: new Date(),
    media_ids: ["00000000-0000-4000-8000-000000000000"],
  };
  assert.deepEqual(validateAshleyDraftPublication(pricedByAshley, addresses.authorizedSender, env), { ok: true, errors: [] });
  assert.equal(validateAshleyDraftPublication({ ...pricedByAshley, final_price: null }, addresses.authorizedSender, env).ok, false);
  assert.equal(validateAshleyDraftPublication(pricedByAshley, "owner@example.com", env).ok, false);
  assert.equal(validateAshleyDraftPublication({ ...pricedByAshley, final_price_set_by_email: "owner@example.com" }, addresses.authorizedSender, env).ok, false);
}

assert.throws(
  () => ashleyBatchApprovalSchema.parse({
    draftIds: ["00000000-0000-4000-8000-000000000000", "00000000-0000-4000-8000-000000000000"],
  }),
  /unique/i,
);

console.log("Ashley photo-email intake and approval guard tests passed");
