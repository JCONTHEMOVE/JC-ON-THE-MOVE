import assert from "node:assert/strict";
import { createBitPayCheckoutIntent, mapBitPayInvoiceStatus } from "../cryptoPayments";

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

async function asyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`OK ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log("cryptoPayments()");

test("keeps new invoices pending", () => {
  assert.deepEqual(mapBitPayInvoiceStatus("new"), {
    providerStatus: "new",
    intentStatus: "pending",
    creditEligible: false,
    terminal: false,
  });
});

test("does not credit merely paid invoices", () => {
  assert.deepEqual(mapBitPayInvoiceStatus("paid"), {
    providerStatus: "paid",
    intentStatus: "pending",
    creditEligible: false,
    terminal: false,
  });
});

test("credits confirmed and complete invoices", () => {
  assert.deepEqual(mapBitPayInvoiceStatus("confirmed"), {
    providerStatus: "confirmed",
    intentStatus: "paid",
    creditEligible: true,
    terminal: true,
  });
  assert.deepEqual(mapBitPayInvoiceStatus("complete"), {
    providerStatus: "complete",
    intentStatus: "paid",
    creditEligible: true,
    terminal: true,
  });
});

test("never credits failed terminal invoice statuses", () => {
  for (const status of ["expired", "invalid", "declined"] as const) {
    assert.deepEqual(mapBitPayInvoiceStatus(status), {
      providerStatus: status,
      intentStatus: status,
      creditEligible: false,
      terminal: true,
    });
  }
});

test("unknown statuses stay pending until inspected", () => {
  assert.deepEqual(mapBitPayInvoiceStatus("mystery"), {
    providerStatus: "unknown",
    intentStatus: "pending",
    creditEligible: false,
    terminal: false,
  });
});

await asyncTest("creates a BTC-only hosted invoice for the Lightning job rail", async () => {
  const previousToken = process.env.BITPAY_API_TOKEN;
  const previousEnvironment = process.env.BITPAY_ENV;
  const previousFetch = globalThis.fetch;
  process.env.BITPAY_API_TOKEN = "test-token";
  process.env.BITPAY_ENV = "sandbox";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({ data: { id: "invoice-1", url: "https://test.bitpay.com/invoice-1", status: "new" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await createBitPayCheckoutIntent({
      amountUsd: 95,
      userId: "customer-1",
      referenceType: "job_payment_btc_lightning",
      referenceId: "lead-1",
      itemDesc: "Lightning job payment",
      redirectUrl: "https://example.com/success",
      closeUrl: "https://example.com/cancel",
      notificationUrl: "https://example.com/webhook",
      paymentCurrencies: ["BTC"],
      forcedBuyerSelectedTransactionCurrency: "BTC",
    });
    assert.deepEqual(requestBody.paymentCurrencies, ["BTC"]);
    assert.equal(requestBody.forcedBuyerSelectedTransactionCurrency, "BTC");
    assert.equal(requestBody.price, 95);
    assert.equal(requestBody.currency, "USD", "USD is the quote denomination, not the settlement asset");
    assert.equal(requestBody.settlementCurrency, undefined, "settlement is controlled by the BTC custody policy, not converted per invoice");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.BITPAY_API_TOKEN;
    else process.env.BITPAY_API_TOKEN = previousToken;
    if (previousEnvironment === undefined) delete process.env.BITPAY_ENV;
    else process.env.BITPAY_ENV = previousEnvironment;
  }
});

if (process.exitCode) {
  console.error(`\n${passed} crypto payment assertion(s) passed before failure.`);
} else {
  console.log(`\nAll ${passed} crypto payment assertions passed.`);
}
