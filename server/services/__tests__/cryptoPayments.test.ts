import assert from "node:assert/strict";
import { mapBitPayInvoiceStatus } from "../cryptoPayments";

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

if (process.exitCode) {
  console.error(`\n${passed} crypto payment assertion(s) passed before failure.`);
} else {
  console.log(`\nAll ${passed} crypto payment assertions passed.`);
}
