import assert from "node:assert/strict";
import { classifyJobInvoicePayment } from "../jobPaymentClassification";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

console.log("job invoice payment classification");

test("does not treat a paid 30% deposit invoice as a paid-in-full job", () => {
  assert.deepEqual(classifyJobInvoicePayment({
    invoiceAmount: 600,
    jobTotal: 2000,
    depositAmount: 600,
    depositRequired: true,
    depositAlreadyPaid: false,
  }), { kind: "deposit", invoiceAmount: 600, jobTotal: 2000, accountingAmount: 0 });
});

test("treats a full-price first invoice as paid in full", () => {
  assert.equal(classifyJobInvoicePayment({
    invoiceAmount: 2000,
    jobTotal: 2000,
    depositAmount: 600,
    depositRequired: true,
    depositAlreadyPaid: false,
  }).kind, "paid_in_full");
});

test("accounts for the full approved total when the balance follows a deposit", () => {
  assert.deepEqual(classifyJobInvoicePayment({
    invoiceAmount: 1400,
    jobTotal: 2000,
    depositAmount: 600,
    depositRequired: true,
    depositAlreadyPaid: true,
  }), { kind: "paid_in_full", invoiceAmount: 1400, jobTotal: 2000, accountingAmount: 2000 });
});

test("keeps a duplicate deposit webhook classified as a deposit", () => {
  assert.equal(classifyJobInvoicePayment({
    invoiceAmount: 600,
    jobTotal: 2000,
    depositAmount: 600,
    depositRequired: true,
    depositAlreadyPaid: true,
  }).kind, "deposit");
});

test("falls back to the invoice amount when a legacy lead has no job total", () => {
  assert.equal(classifyJobInvoicePayment({
    invoiceAmount: "725.50",
    jobTotal: null,
    depositRequired: false,
  }).accountingAmount, 725.5);
});

test("uses explicit deposit purpose even when legacy amounts are ambiguous", () => {
  assert.equal(classifyJobInvoicePayment({
    invoiceAmount: 500,
    jobTotal: 500,
    depositRequired: false,
    invoicePurpose: "deposit",
  }).kind, "deposit");
});

test("uses explicit final-balance purpose after an earlier deposit", () => {
  assert.deepEqual(classifyJobInvoicePayment({
    invoiceAmount: 1400,
    jobTotal: 2000,
    depositAmount: 600,
    depositRequired: true,
    depositAlreadyPaid: true,
    invoicePurpose: "final_balance",
  }), { kind: "paid_in_full", invoiceAmount: 1400, jobTotal: 2000, accountingAmount: 2000 });
});

if (!process.exitCode) console.log(`  ${passed} tests passed`);
