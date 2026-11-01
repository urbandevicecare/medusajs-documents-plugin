import { test } from "node:test";
import assert from "node:assert";
import { PDFDocument as PDFLibDoc } from "pdf-lib";
import { sanitizePhoneNumber } from "../src/utils/phone-sanitizer";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";
import { postProcessPdf } from "../src/services/pdf-post-processor";
import { ZohoBooksService } from "../src/services/zoho-books";

test("Release 1.1.40 - Phone Sanitizer strips invisible Unicode, leading hyphens and trims", () => {
  // Test case with \u202D and \u202C directly preceding 0720 702 537
  const dirty = "0729 436 660 / 0794 700 241 / \u202D0720 702 537\u202C";
  const cleaned = sanitizePhoneNumber(dirty);
  assert.strictEqual(cleaned, "0729 436 660 / 0794 700 241 / 0720 702 537");
  assert.ok(!cleaned.includes("\u202D"));
  assert.ok(!cleaned.includes("\u202C"));

  // Leading hyphen
  assert.strictEqual(sanitizePhoneNumber("-0720 702 537"), "0720 702 537");
  assert.strictEqual(sanitizePhoneNumber("0729 436 660 / -0720 702 537"), "0729 436 660 / 0720 702 537");

  // Trailing and leading slashes or commas
  assert.strictEqual(sanitizePhoneNumber("/ 0720 702 537 , "), "0720 702 537");

  // Null and undefined
  assert.strictEqual(sanitizePhoneNumber(null), "");
  assert.strictEqual(sanitizePhoneNumber(undefined), "");
});

test("Release 1.1.40 - All standard templates fit on exactly 1 single page without spillage", async () => {
  const baseDocData: DocumentData = {
    display_id: "RT-1001",
    title: "Tax Invoice",
    type: "invoice",
    date: "2026-11-01",
    currency_code: "KES",
    company: {
      name: "Urban Device Care Ltd",
      address: "Bekim House, 04 Westlands Crossway Rd, Nairobi",
      phone: "0729 436 660 / 0794 700 241 / \u202D0720 702 537\u202C",
      email: "info@urbandevicecare.co.uk",
      website: "www.urbandevicecare.co.uk",
      payment_details: "Paybill: 400200 | Acc: 1039764",
      terms: "Payment due within 14 days. 90-day warranty applies.",
    },
    customer: {
      name: "John Doe",
      email: "john@example.com",
      phone: "0712 345 678",
      address: "Nairobi, Kenya",
    },
    items: [
      { title: "OEM Screen Assembly", description: "Display replacement", quantity: 1, unit_price: 15000, total: 15000 },
      { title: "Battery Replacement", description: "Standard replacement", quantity: 1, unit_price: 4500, total: 4500 },
    ],
    subtotal: 19500,
    tax_total: 0,
    total: 19500,
    payment_link: "https://urbandevicecare.co.uk/r/pay-sample",
    qr_url: "https://urbandevicecare.co.uk/r/pay-sample",
  };

  const getPageCount = async (buf: Buffer): Promise<number> => {
    const pdfDoc = await PDFLibDoc.load(buf);
    return pdfDoc.getPageCount();
  };

  // 1. zoho_exact style invoice
  const zohoPdf = await PDFKitGenerator.generate(baseDocData, "zoho_exact");
  assert.strictEqual(await getPageCount(zohoPdf), 1, "zoho_exact should be 1 page");

  // 2. modern style invoice
  const modernPdf = await PDFKitGenerator.generate(baseDocData, "modern");
  assert.strictEqual(await getPageCount(modernPdf), 1, "modern should be 1 page");

  // 3. classic style invoice
  const classicPdf = await PDFKitGenerator.generate(baseDocData, "classic");
  assert.strictEqual(await getPageCount(classicPdf), 1, "classic should be 1 page");

  // 4. minimal style invoice
  const minimalPdf = await PDFKitGenerator.generate(baseDocData, "minimal");
  assert.strictEqual(await getPageCount(minimalPdf), 1, "minimal should be 1 page");

  // 5. job_card
  const jobCardData: DocumentData = {
    ...baseDocData,
    type: "job_card",
    title: "Job Card / Intake",
    custom_fields: {
      "Device Model": "iPhone 14 Pro",
      "Serial / IMEI": "F2LZ90K8MD6R",
      "Intake Condition": "Cracked screen",
    },
  };
  const jobCardPdf = await PDFKitGenerator.generate(jobCardData, "standard");
  assert.strictEqual(await getPageCount(jobCardPdf), 1, "job_card should be 1 page");

  // 6. service_report
  const serviceReportData: DocumentData = {
    ...baseDocData,
    type: "service_report",
    title: "Service Diagnostic Report",
    custom_fields: {
      "Device Model": "iPhone 14 Pro",
      "Diagnostics": "Screen digitizer fault cleared",
    },
  };
  const serviceReportPdf = await PDFKitGenerator.generate(serviceReportData, "standard");
  assert.strictEqual(await getPageCount(serviceReportPdf), 1, "service_report should be 1 page");

  // 7. handover
  const handoverData: DocumentData = {
    ...baseDocData,
    type: "handover",
    title: "Equipment Handover Slip",
    custom_fields: {
      "Device Model": "iPhone 14 Pro",
      "Condition": "Tested & working",
    },
  };
  const handoverPdf = await PDFKitGenerator.generate(handoverData, "standard");
  assert.strictEqual(await getPageCount(handoverPdf), 1, "handover should be 1 page");

  // 8. certificate
  const certData: DocumentData = {
    ...baseDocData,
    type: "certificate" as any,
    title: "Warranty Certificate",
    body_text: "This certificate confirms 90-day warranty on replaced parts.",
  };
  const certPdf = await PDFKitGenerator.generate(certData, "standard");
  assert.strictEqual(await getPageCount(certPdf), 1, "certificate should be 1 page");
});

test("Release 1.1.40 - ZohoBooksService has updateInvoice and updateEstimate methods", () => {
  const zoho = new ZohoBooksService({
    client_id: "test",
    client_secret: "test",
    refresh_token: "test",
    organization_id: "test",
  });

  assert.strictEqual(typeof zoho.updateInvoice, "function");
  assert.strictEqual(typeof zoho.updateEstimate, "function");
});

test("Release 1.1.40 - PDF post-processor stamps payment link and QR code cleanly", async () => {
  // Create a minimal 1-page PDF
  const samplePdf = await PDFKitGenerator.generate({
    display_id: "RT-1002",
    title: "Tax Invoice",
    type: "invoice",
    company: { name: "Test Store" },
    customer: { name: "Test Cust" },
    items: [{ title: "Item 1", quantity: 1, unit_price: 100, total: 100 }],
    total: 100,
  }, "modern");

  const processed = await postProcessPdf(samplePdf, {
    qrUrl: "https://urbandevicecare.co.uk/r/test-qr",
    obscureZohoFooter: true,
    isInvoice: true,
    paymentLink: "https://urbandevicecare.co.uk/r/test-pay",
  });

  assert.ok(processed.length > 0);
  const pdfDoc = await PDFLibDoc.load(processed);
  assert.strictEqual(pdfDoc.getPageCount(), 1, "Post-processed document remains 1 page");
});
