import assert from "node:assert";
import { test } from "node:test";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";

test("PDFKitGenerator generates valid PDF for all templates and types", async () => {
  const sampleData: DocumentData = {
    display_id: "INV-99999",
    title: "Test Tax Invoice",
    type: "invoice",
    date: "2026-10-12",
    due_date: "2026-10-26",
    customer: {
      name: "John Customer",
      email: "john@example.com",
      phone: "+44 7123 456789",
      address: "10 Downing Street, London",
    },
    company: {
      name: "Urban Device Care Ltd",
      address: "123 Tech Way, London",
      phone: "+44 20 7946 0000",
      email: "billing@example.com",
      payment_details: "Barclays Bank: 12345678",
      terms: "90-day repair warranty.",
    },
    items: [
      { title: "Screen Replacement", quantity: 1, unit_price: 150 },
      { title: "Labor Fee", quantity: 1, unit_price: 50 },
    ],
    subtotal: 200,
    tax_total: 20,
    total: 220,
    currency_code: "usd",
    payment_status: "unpaid",
    payment_link: "https://store.example.com/pay/test-token",
    qr_url: "https://store.example.com/pay/test-token",
    notes: "Scan QR code to pay instantly.",
  };

  // 1. Modern template
  const modernBuf = await PDFKitGenerator.generate(sampleData, "modern");
  assert.ok(modernBuf instanceof Buffer, "Modern output must be a Buffer");
  assert.ok(modernBuf.length > 1000, "Modern PDF must not be empty");
  assert.strictEqual(modernBuf.subarray(0, 4).toString(), "%PDF", "Must have valid %PDF header");

  // 2. Classic template
  const classicBuf = await PDFKitGenerator.generate(sampleData, "classic");
  assert.ok(classicBuf instanceof Buffer, "Classic output must be a Buffer");
  assert.ok(classicBuf.length > 1000, "Classic PDF must not be empty");
  assert.strictEqual(classicBuf.subarray(0, 4).toString(), "%PDF", "Must have valid %PDF header");

  // 3. Minimal template
  const minimalBuf = await PDFKitGenerator.generate(sampleData, "minimal");
  assert.ok(minimalBuf instanceof Buffer, "Minimal output must be a Buffer");
  assert.ok(minimalBuf.length > 1000, "Minimal PDF must not be empty");
  assert.strictEqual(minimalBuf.subarray(0, 4).toString(), "%PDF", "Must have valid %PDF header");

  // 4. Custom Document Type
  const customData: DocumentData = {
    ...sampleData,
    title: "Warranty Certificate",
    type: "custom",
    body_text: "This certifies that the iPhone 14 serial #123456 is covered under our 90-day extended hardware warranty.",
  };
  const customBuf = await PDFKitGenerator.generate(customData, "modern");
  assert.ok(customBuf.length > 1000, "Custom document PDF must not be empty");
  assert.strictEqual(customBuf.subarray(0, 4).toString(), "%PDF", "Must have valid %PDF header");
});
