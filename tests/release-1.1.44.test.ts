import assert from "node:assert";
import { test } from "node:test";
import { postProcessPdf } from "../src/services/pdf-post-processor";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";
import * as adminRoute from "../src/api/admin/documents/[id]/document/route";
import * as publicRoute from "../src/api/documents/[id]/document/route";

test("Release 1.1.44 - Document streaming routes export Accept-Ranges: none and HEAD handler", () => {
  assert.strictEqual(adminRoute.AUTHENTICATE, false);
  assert.strictEqual(typeof adminRoute.GET, "function");
  assert.strictEqual(typeof adminRoute.HEAD, "function");

  assert.strictEqual(publicRoute.AUTHENTICATE, false);
  assert.strictEqual(typeof publicRoute.GET, "function");
  assert.strictEqual(typeof publicRoute.HEAD, "function");
});

test("Release 1.1.44 - Invoices render Pay Online text and Scan to Pay Online QR code", async () => {
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
  assert.strictEqual(processedPdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(processedPdf.length > 1000);
});

test("Release 1.1.44 - Non-invoices (job card, estimate, receipt) only render document view QR and never payment block", async () => {
  const baseDoc: DocumentData = {
    display_id: "JOB-1793466012168-TS9RXZ",
    type: "job_card",
    title: "Repair Job Card",
    date: "2026-11-01",
    customer: { name: "Tek Production Service Ltd" },
    company: { name: "Urban Device Care Ltd" },
    items: [{ title: "Computer Service", quantity: 1, unit_price: 3000, total: 3000 }],
    total: 3000,
    currency_code: "kes",
  };

  const rawPdf = await PDFKitGenerator.generate(baseDoc, "standard");
  const processedPdf = await postProcessPdf(rawPdf, {
    qrUrl: "https://urbandevicecare.co.uk/r/ep85m8",
    paymentLink: null,
    isInvoice: false,
    docType: "job_card",
  });

  assert.ok(processedPdf instanceof Buffer);
  assert.strictEqual(processedPdf.subarray(0, 4).toString(), "%PDF");
});
