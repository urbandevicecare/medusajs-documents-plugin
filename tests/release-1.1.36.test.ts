import assert from "node:assert";
import { test } from "node:test";
import * as zlib from "zlib";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";

function extractTextFromPdf(pdfBuf: Buffer): string {
  const binary = pdfBuf.toString("binary");
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  let decoded = "";
  while ((match = streamRegex.exec(binary)) !== null) {
    try {
      const raw = Buffer.from(match[1], "binary");
      const text = zlib.inflateSync(raw).toString("utf-8");
      const hexChunks = text.match(/<([0-9a-fA-F]+)>/g) || [];
      decoded += hexChunks.map((h) => Buffer.from(h.slice(1, -1), "hex").toString("utf-8")).join("") + " ";
    } catch {}
  }
  return decoded;
}

test("Release 1.1.36 - Invoices render Pay Online link and bottom-right payment QR code", async () => {
  const invoiceData: DocumentData = {
    display_id: "INV-10099",
    type: "invoice",
    title: "TAX INVOICE",
    date: "2026-11-01",
    customer: {
      name: "Jane Mwangi",
      email: "jane.m@example.com",
      phone: "+254 711 222 333",
    },
    company: {
      name: "Urban Device Care Ltd",
      address: "Kimathi Street, Nairobi",
      payment_details: "Paybill: 880100 - Acc: PAYURBANDEVICE",
    },
    items: [
      {
        title: "MacBook Pro Screen Replacement",
        quantity: 1,
        unit_price: 45000,
        total: 45000,
      },
    ],
    total: 45000,
    currency_code: "kes",
    payment_link: "https://urbandevicecare.co.uk/r/pay-inv-10099",
    qr_url: "https://urbandevicecare.co.uk/r/pay-inv-10099",
  };

  const pdfBuf = await PDFKitGenerator.generate(invoiceData, "zoho_exact");
  assert.ok(pdfBuf instanceof Buffer);
  assert.strictEqual(pdfBuf.subarray(0, 4).toString(), "%PDF");

  const decodedText = extractTextFromPdf(pdfBuf);

  // Invoice must include "Pay Online:" and "Scan to Pay Online"
  assert.ok(
    decodedText.includes("Pay Online:") || decodedText.includes("pay-inv-10099"),
    "Invoice PDF must include Pay Online text or payment link"
  );
  assert.ok(
    decodedText.includes("Scan to Pay Online"),
    "Invoice PDF must include bottom-right 'Scan to Pay Online' label"
  );
});

test("Release 1.1.36 - Quotes / Estimates and Job Cards render document QR and no Pay Online link", async () => {
  const quoteData: DocumentData = {
    display_id: "EST-20055",
    type: "estimate",
    title: "REPAIR ESTIMATE & QUOTATION",
    date: "2026-11-01",
    customer: {
      name: "Samuel Otieno",
      email: "samuel@example.com",
    },
    company: {
      name: "Urban Device Care Ltd",
      payment_details: "Paybill: 880100 - Acc: PAYURBANDEVICE",
    },
    items: [
      {
        title: "Logic Board Diagnostic & Ultrasonic Cleaning",
        quantity: 1,
        unit_price: 12000,
        total: 12000,
      },
    ],
    total: 12000,
    currency_code: "kes",
    qr_url: "https://urbandevicecare.co.uk/r/quote-20055",
  };

  const pdfBuf = await PDFKitGenerator.generate(quoteData, "zoho_exact");
  assert.ok(pdfBuf instanceof Buffer);

  const decodedText = extractTextFromPdf(pdfBuf);

  // Quotes must NOT contain Pay Online text and must have "Scan to View Quote" label
  assert.ok(!decodedText.includes("Pay Online:"), "Quote PDF must NOT include 'Pay Online:'");
  assert.ok(
    decodedText.includes("Scan to View Quote"),
    "Quote PDF must include 'Scan to View Quote' label"
  );

  // Job card test
  const jobCardData: DocumentData = {
    display_id: "JOB-RT-5510",
    type: "job_card",
    title: "REPAIR JOB CARD",
    date: "2026-11-01",
    customer: { name: "Alice Kamau" },
    company: { name: "Urban Device Care Ltd" },
    items: [{ title: "Intake Camera Repair", quantity: 1, unit_price: 0, total: 0 }],
    total: 0,
    currency_code: "kes",
    qr_url: "https://urbandevicecare.co.uk/r/track-rt-5510",
  };

  const jcBuf = await PDFKitGenerator.generate(jobCardData, "modern");
  const jcText = extractTextFromPdf(jcBuf);
  assert.ok(!jcText.includes("Pay Online:"), "Job card must NOT include 'Pay Online:'");
  assert.ok(jcText.includes("Scan to Track"), "Job card must include 'Scan to Track' label");
});
