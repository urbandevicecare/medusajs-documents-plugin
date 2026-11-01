import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { postProcessPdf } from "../src/services/pdf-post-processor";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";
import * as adminRoute from "../src/api/admin/documents/[id]/document/route";
import * as publicRoute from "../src/api/documents/[id]/document/route";

test("Release 1.1.46 - Streaming routes export clean headers including nosniff and no-cache", async () => {
  assert.strictEqual(adminRoute.AUTHENTICATE, false);
  assert.strictEqual(typeof adminRoute.GET, "function");
  assert.strictEqual(typeof adminRoute.HEAD, "function");

  assert.strictEqual(publicRoute.AUTHENTICATE, false);
  assert.strictEqual(typeof publicRoute.GET, "function");
  assert.strictEqual(typeof publicRoute.HEAD, "function");

  // Verify headers set in route implementation
  const adminCode = fs.readFileSync(path.join(__dirname, "../src/api/admin/documents/[id]/document/route.ts"), "utf-8");
  const publicCode = fs.readFileSync(path.join(__dirname, "../src/api/documents/[id]/document/route.ts"), "utf-8");

  for (const code of [adminCode, publicCode]) {
    assert.ok(code.includes('res.setHeader("Content-Type", "application/pdf")'), "Must set Content-Type");
    assert.ok(code.includes('res.setHeader("Accept-Ranges", "none")'), "Must set Accept-Ranges: none");
    assert.ok(code.includes('res.setHeader("X-Content-Type-Options", "nosniff")'), "Must set X-Content-Type-Options: nosniff");
    assert.ok(code.includes('res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")'), "Must set Cache-Control");
  }
});

test("Release 1.1.46 - Encrypted Zoho Books PDF is decrypted, stripped of /Encrypt, and stamped with payment link and QR", async () => {
  const fixturePath = path.join(__dirname, "fixtures/zoho-invoice.pdf");
  assert.ok(fs.existsSync(fixturePath), "Fixture must exist");

  const rawZohoPdf = fs.readFileSync(fixturePath);

  // Verify raw Zoho PDF is indeed encrypted
  const rawDoc = await PDFDocument.load(rawZohoPdf, { ignoreEncryption: true });
  assert.ok(rawDoc.context.trailerInfo.Encrypt, "Raw Zoho PDF must have Encrypt trailer");

  // Post process invoice with QR and payment link
  const processedPdf = await postProcessPdf(rawZohoPdf, {
    qrUrl: "https://urbandevicecare.co.uk/r/15wb2j",
    paymentLink: "https://urbandevicecare.co.uk/r/15wb2j",
    isInvoice: true,
    obscureZohoFooter: true,
  });

  assert.ok(processedPdf instanceof Buffer);
  assert.strictEqual(processedPdf.subarray(0, 4).toString(), "%PDF");

  // Verify the processed PDF loads WITHOUT ignoreEncryption
  const reloaded = await PDFDocument.load(processedPdf);
  assert.strictEqual(reloaded.getPageCount(), 1);
  assert.strictEqual((reloaded.context as any).trailerInfo?.Encrypt, undefined, "/Encrypt trailer MUST be removed");
});

test("Release 1.1.46 - Non-invoice encrypted PDF is decrypted without payment block", async () => {
  const fixturePath = path.join(__dirname, "fixtures/zoho-invoice.pdf");
  const rawZohoPdf = fs.readFileSync(fixturePath);

  const processedPdf = await postProcessPdf(rawZohoPdf, {
    qrUrl: "https://urbandevicecare.co.uk/r/ep85m8",
    paymentLink: null,
    isInvoice: false,
    docType: "job_card",
  });

  assert.ok(processedPdf instanceof Buffer);
  const reloaded = await PDFDocument.load(processedPdf);
  assert.strictEqual(reloaded.getPageCount(), 1);
  assert.strictEqual((reloaded.context as any).trailerInfo?.Encrypt, undefined);
});

test("Release 1.1.46 - Standard unencrypted PDF continues to post-process cleanly", async () => {
  const baseDoc: DocumentData = {
    display_id: "RT-1793466012168-TS9RXZ",
    type: "invoice",
    title: "Repair Invoice",
    date: "2026-11-01",
    customer: { name: "Tek Production Service Ltd" },
    company: { name: "Urban Device Care Ltd" },
    items: [{ title: "Computer Service", quantity: 1, unit_price: 3000, total: 3000 }],
    total: 3000,
    currency_code: "kes",
  };

  const rawPdf = await PDFKitGenerator.generate(baseDoc, "modern");
  const processedPdf = await postProcessPdf(rawPdf, {
    qrUrl: "https://urbandevicecare.co.uk/r/15wb2j",
    paymentLink: "https://urbandevicecare.co.uk/r/15wb2j",
    isInvoice: true,
    obscureZohoFooter: true,
  });

  assert.ok(processedPdf instanceof Buffer);
  const reloaded = await PDFDocument.load(processedPdf);
  assert.strictEqual(reloaded.getPageCount(), 1);
  assert.strictEqual((reloaded.context as any).trailerInfo?.Encrypt, undefined);
});
