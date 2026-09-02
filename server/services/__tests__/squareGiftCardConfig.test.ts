import assert from "node:assert/strict";
import {
  getGiftCardBonusReadiness,
  getSquareAccessToken,
  getSquareEnvironment,
  getSquareLocationId,
} from "../squareConfig";

const names = [
  "GIFT_CARD_BONUS_ENABLED",
  "GIFT_CARD_BONUS_PUBLIC_ENABLED",
  "GIFT_CARD_BONUS_START_AT",
  "SQUARE_ACCESS_TOKEN",
  "SQUARE_LOCATION_ID",
  "SQUARE_PRODUCTION_ACCESS_TOKEN",
  "SQUARE_PRODUCTION_LOCATION_ID",
  "SQUARE_SANDBOX_ACCESS_TOKEN",
  "SQUARE_SANDBOX_LOCATION_ID",
  "SQUARE_ENVIRONMENT",
  "SQUARE_WEBHOOK_SIGNATURE_KEY",
  "SQUARE_WEBHOOK_URL",
] as const;

const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

function clearSquareTestEnv() {
  for (const name of names) delete process.env[name];
}

try {
  clearSquareTestEnv();
  process.env.SQUARE_ENVIRONMENT = "production";
  process.env.SQUARE_PRODUCTION_ACCESS_TOKEN = "production-test-token";
  process.env.SQUARE_PRODUCTION_LOCATION_ID = "production-test-location";

  assert.equal(getSquareEnvironment(), "production");
  assert.equal(getSquareAccessToken(), "production-test-token");
  assert.equal(getSquareLocationId(), "production-test-location");

  process.env.GIFT_CARD_BONUS_ENABLED = "true";
  process.env.GIFT_CARD_BONUS_START_AT = "2026-08-31T12:00:00-05:00";
  process.env.SQUARE_WEBHOOK_SIGNATURE_KEY = "test-signature-key";
  process.env.SQUARE_WEBHOOK_URL = "https://www.jconthemove.com/api/webhooks/square";

  assert.deepEqual(getGiftCardBonusReadiness(), {
    enabled: true,
    requested: true,
    publicRequested: false,
    publicEnabled: false,
    startAt: "2026-08-31T17:00:00.000Z",
    blockers: [],
  });

  process.env.GIFT_CARD_BONUS_PUBLIC_ENABLED = "true";
  assert.equal(getGiftCardBonusReadiness().publicEnabled, true);

  delete process.env.SQUARE_PRODUCTION_LOCATION_ID;
  assert.equal(getGiftCardBonusReadiness().enabled, false);
  assert.equal(getGiftCardBonusReadiness().publicEnabled, false);
  assert.ok(getGiftCardBonusReadiness().blockers.includes("Square location id is required for the active environment"));

  clearSquareTestEnv();
  process.env.SQUARE_ENVIRONMENT = "sandbox";
  process.env.SQUARE_ACCESS_TOKEN = "legacy-test-token";
  process.env.SQUARE_LOCATION_ID = "legacy-test-location";
  assert.equal(getSquareEnvironment(), "sandbox");
  assert.equal(getSquareAccessToken(), "legacy-test-token");
  assert.equal(getSquareLocationId(), "legacy-test-location");

  console.log("Square gift-card configuration tests passed");
} finally {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
