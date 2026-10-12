import assert from "node:assert";
import { test } from "node:test";
import { generateOrderPaymentLink, generateRepairPaymentLink } from "../src/utils/payment-link";

test("generateOrderPaymentLink correctly calculates remaining balances and HMAC links", () => {
  const storeUrl = "https://store.example.com";

  // Case 1: Unpaid Order
  const unpaidOrder = {
    id: "order_12345",
    total: 250,
    payment_collections: [],
  };
  const res1 = generateOrderPaymentLink(unpaidOrder, storeUrl);
  assert.strictEqual(res1.isUnpaid, true);
  assert.strictEqual(res1.remainingBalance, 250);
  assert.ok(res1.paymentLink?.startsWith("https://store.example.com/pay/"));
  assert.ok(res1.paymentLink?.endsWith("/order_12345"));

  // Case 2: Partially Paid Order
  const partialOrder = {
    id: "order_partial",
    total: 300,
    payment_collections: [
      {
        captured_amount: 100,
      },
    ],
  };
  const res2 = generateOrderPaymentLink(partialOrder, storeUrl);
  assert.strictEqual(res2.isUnpaid, true);
  assert.strictEqual(res2.remainingBalance, 200);

  // Case 3: Fully Paid Order
  const paidOrder = {
    id: "order_paid",
    total: 150,
    payment_collections: [
      {
        captured_amount: 150,
      },
    ],
  };
  const res3 = generateOrderPaymentLink(paidOrder, storeUrl);
  assert.strictEqual(res3.isUnpaid, false);
  assert.strictEqual(res3.remainingBalance, 0);
  assert.strictEqual(res3.paymentLink, null);
});

test("generateRepairPaymentLink correctly creates tracking links for repair tickets", () => {
  const storeUrl = "https://store.example.com";

  const unpaidTicket = {
    id: "rep_1",
    ticket_number: "RT-1001",
    total_estimate: 180,
    amount_paid: 0,
    approval_token: "tok_secure_123",
  };

  const res = generateRepairPaymentLink(unpaidTicket, storeUrl);
  assert.strictEqual(res.isUnpaid, true);
  assert.strictEqual(res.remainingBalance, 180);
  assert.strictEqual(res.paymentLink, "https://store.example.com/repairs/track?token=tok_secure_123");
});
