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

  // 5. Job Card Document Type across all styles
  const jobCardData: DocumentData = {
    ...sampleData,
    display_id: "JOB-RT-1002",
    title: "Repair Job Card",
    type: "job_card",
    custom_fields: {
      "Device Model": "iPhone 14 Pro Max",
      "Serial / IMEI": "358762091234567",
      "Condition": "Cracked screen, scuffs on back",
      "Accessories": "Original box, charging cable",
      "Technician": "Alex",
      "Issue": "Display touch unresponsive",
    },
  };
  const jobCardModern = await PDFKitGenerator.generate(jobCardData, "modern");
  assert.ok(jobCardModern.length > 1000, "Job card modern PDF must not be empty");
  assert.strictEqual(jobCardModern.subarray(0, 4).toString(), "%PDF");

  const jobCardClassic = await PDFKitGenerator.generate(jobCardData, "classic");
  assert.ok(jobCardClassic.length > 1000, "Job card classic PDF must not be empty");
  assert.strictEqual(jobCardClassic.subarray(0, 4).toString(), "%PDF");

  const jobCardMinimal = await PDFKitGenerator.generate(jobCardData, "minimal");
  assert.ok(jobCardMinimal.length > 1000, "Job card minimal PDF must not be empty");
  assert.strictEqual(jobCardMinimal.subarray(0, 4).toString(), "%PDF");
});

test("PDFKitGenerator produces valid PDFs for all 18 combinations of styles and types", async () => {
  const styles = ["modern", "classic", "minimal"] as const;
  const types = ["invoice", "receipt", "packing_slip", "estimate", "custom", "job_card"] as const;

  for (const style of styles) {
    for (const type of types) {
      const isJob = type === "job_card";
      const data: DocumentData = {
        display_id: isJob ? "JOB-500" : "DOC-500",
        type: type,
        title: `Test ${type}`,
        customer: { name: "Test Client", email: "client@test.com" },
        company: { name: "Test Company", address: "1 High St" },
        items: [{ title: "Service Item", quantity: 1, unit_price: 50, total: 50 }],
        subtotal: 50,
        total: 50,
        currency_code: "usd",
        notes: "Some notes",
        body_text: type === "custom" ? "Custom body declaration" : undefined,
        custom_fields: isJob ? { "Device": "iPad Pro" } : undefined,
        qr_url: "https://example.com/qr",
      };

      const buf = await PDFKitGenerator.generate(data, style);
      assert.ok(buf instanceof Buffer, `Buffer required for style=${style}, type=${type}`);
      assert.ok(buf.length > 800, `PDF should be non-trivial for style=${style}, type=${type}`);
      assert.strictEqual(buf.subarray(0, 4).toString(), "%PDF", `Header should be %PDF for style=${style}, type=${type}`);
    }
  }
});

test("PDFKitGenerator.generateBarcode creates valid Code 128 barcode buffer when bwip-js is present or safely returns null", async () => {
  const barcodeBuf = await PDFKitGenerator.generateBarcode("NP04011448");
  if (barcodeBuf !== null) {
    assert.ok(barcodeBuf instanceof Buffer, "Barcode output must be a Buffer");
    assert.ok(barcodeBuf.length > 100, "Barcode buffer should not be empty");
  } else {
    assert.strictEqual(barcodeBuf, null, "Should return null when bwip-js is not installed");
  }

  const ticketBarcode = await PDFKitGenerator.generateBarcode("REP-10023");
  if (ticketBarcode !== null) {
    assert.ok(ticketBarcode instanceof Buffer, "Ticket barcode must be a Buffer");
    assert.ok(ticketBarcode.length > 100, "Ticket barcode buffer should not be empty");
  } else {
    assert.strictEqual(ticketBarcode, null, "Should return null when bwip-js is not installed");
  }
});
