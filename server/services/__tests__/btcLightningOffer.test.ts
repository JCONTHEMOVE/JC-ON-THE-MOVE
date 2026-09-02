import assert from "node:assert/strict";
import {
  BTC_LIGHTNING_TREASURY_RETENTION_PERCENT,
  calculateBtcLightningOffer,
} from "../../../shared/btcLightningOffer";

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log("btcLightningOffer()");

test("applies the site-wide 5% crypto discount without the regular-payment bonus", () => {
  assert.deepEqual(calculateBtcLightningOffer(100), {
    originalAmountUsd: 100,
    discountPercent: 5,
    discountAmountUsd: 5,
    amountDueUsd: 95,
    rewardPercent: 0,
    rewardValueUsd: 0,
    rewardTokens: 0,
    treasuryRetentionPercent: 100,
    receivedAsset: "BTC",
    valuationCurrency: "USD",
    custodyPolicy: "preserve_received_asset",
    conversionPolicy: "manual_only",
  });
});

test("rounds every customer-facing USD amount to cents", () => {
  const offer = calculateBtcLightningOffer(99.99);
  assert.equal(offer.discountAmountUsd, 5);
  assert.equal(offer.amountDueUsd, 94.99);
  assert.equal(offer.rewardValueUsd, 0);
  assert.equal(offer.rewardTokens, 0);
});

test("retains the policy at 100%", () => {
  assert.equal(BTC_LIGHTNING_TREASURY_RETENTION_PERCENT, 100);
  assert.equal(calculateBtcLightningOffer(100).receivedAsset, "BTC");
  assert.equal(calculateBtcLightningOffer(100).conversionPolicy, "manual_only");
});

test("rejects invalid amounts", () => {
  assert.throws(() => calculateBtcLightningOffer(0));
  assert.throws(() => calculateBtcLightningOffer(Number.NaN));
});

if (process.exitCode) {
  console.error(`\n${passed} Lightning offer assertion(s) passed before failure.`);
} else {
  console.log(`\nAll ${passed} Lightning offer assertions passed.`);
}
