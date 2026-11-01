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

test("Release 1.1.40 - Multi-item documents with notes and terms fit on 1 single page without orphan pages", async () => {
  const getPageCount = async (buf: Buffer): Promise<number> => {
    const pdfDoc = await PDFLibDoc.load(buf);
    return pdfDoc.getPageCount();
  };

  const multiItemData: DocumentData = {
    display_id: "RT-2005",
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
      terms: "Payment due within 14 days. 90-day warranty applies on parts and labor. No cash refunds.",
    },
    customer: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "0799 123 456",
      address: "Riverside Drive, Nairobi, Kenya",
    },
    items: [
      { title: "OEM Super Retina XDR Display", description: "OLED replacement module", quantity: 1, unit_price: 18000, total: 18000 },
      { title: "OEM Extended Battery Pack", description: "Internal cell replacement", quantity: 1, unit_price: 5500, total: 5500 },
      { title: "Precision Cleanroom Re-adhesion", description: "Water resistance gasket", quantity: 1, unit_price: 2500, total: 2500 },
      { title: "Earpiece Mesh & Audio Chamber Cleaning", description: "Acoustic debris removal", quantity: 1, unit_price: 1500, total: 1500 },
      { title: "Full Logic Board Diagnostics", description: "Voltage drop rail check", quantity: 1, unit_price: 2000, total: 2000 },
      { title: "Tempered Glass Screen Protector", description: "9H Oleophobic coating", quantity: 1, unit_price: 1000, total: 1000 },
    ],
    notes: "Client requested express turn-around before travel. Hardware passed all QC tests.",
    total: 30500,
    payment_link: "https://urbandevicecare.co.uk/r/pay-sample",
    qr_url: "https://urbandevicecare.co.uk/r/pay-sample",
  };

  // Test across all templates
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(multiItemData, "zoho_exact")), 1, "zoho_exact multi-item fits 1 page");
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(multiItemData, "modern")), 1, "modern multi-item fits 1 page");
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(multiItemData, "classic")), 1, "classic multi-item fits 1 page");
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(multiItemData, "minimal")), 1, "minimal multi-item fits 1 page");

  // Job card with detailed fields
  const jobCardData: DocumentData = {
    ...multiItemData,
    type: "job_card",
    title: "Workshop Job Card",
    custom_fields: {
      "Device Model": "Apple iPhone 14 Pro Max (256GB Space Black)",
      "Serial / IMEI": "F2LZ90K8MD6R / 354892019283741",
      "Intake Condition": "Glass shattered on upper right corner. Chassis scuffed. FaceID functional.",
      "Accessories": "Spigen Rugged Armor Case, SIM Tray present.",
      "Reported Issue": "Touch intermittent after accidental impact. Green vertical line on OLED.",
    },
  };
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(jobCardData, "standard")), 1, "job_card with full details fits 1 page");

  // Service report with 5 items
  const serviceReportData: DocumentData = {
    ...multiItemData,
    type: "service_report",
    title: "Diagnostic & Service Report",
  };
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(serviceReportData, "standard")), 1, "service_report with multi-items fits 1 page");

  // Certificate with notes
  const certData: DocumentData = {
    ...multiItemData,
    type: "certificate" as any,
    title: "Official Hardware Certificate",
    body_text: "Urban Device Care certifies that genuine OEM parts were installed and calibrated according to factory specifications.",
  };
  assert.strictEqual(await getPageCount(await PDFKitGenerator.generate(certData, "standard")), 1, "certificate with multi-items fits 1 page");
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
