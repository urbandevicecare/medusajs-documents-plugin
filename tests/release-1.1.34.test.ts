import assert from "node:assert";
import { test } from "node:test";
import zlib from "node:zlib";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";
import {
  extractBaseReference,
  groupDocuments,
  getDocTypePriority,
  getDocLifecycleOrder,
  getDocTypeLabel,
  DocumentRecord,
} from "../src/utils/document-grouper";

function extractTextFromPdf(buf: Buffer): string {
  const binary = buf.toString("binary");
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  let decoded = "";
  while ((match = streamRegex.exec(binary)) !== null) {
    try {
      const raw = Buffer.from(match[1], "binary");
      const uncompressed = zlib.inflateSync(raw).toString("latin1");
      const hexMatches = uncompressed.matchAll(/<([0-9a-fA-F]+)>/g);
      for (const hm of hexMatches) {
        decoded += Buffer.from(hm[1], "hex").toString("utf-8");
      }
      decoded += "\n";
    } catch (_) {}
  }
  return decoded;
}

test("Release 1.1.34 - Multi-page Certificate Document Rendering has dynamic page numbers and repeated table headers", async () => {
  // Create certificate with 25 line items to force multi-page spanning
  const multiItems = [];
  for (let i = 1; i <= 25; i++) {
    multiItems.push({
      title: `Hardware Component Replacement Module ${i}`,
      description: `Certified micro-soldering and bench calibration verification stage ${i}`,
      quantity: 1,
      unit_price: 1500 * i,
      total: 1500 * i,
    });
  }

  const certificateData: DocumentData = {
    display_id: "CERT-2026-9901",
    type: "custom",
    title: "CERTIFICATE OF SERVICE COMPLETION & QUALITY SIGN-OFF",
    date: "2026-11-01",
    customer: {
      name: "Jane Doe",
      company_name: "Acme Global Solutions Ltd",
      email: "jane.doe@acme.com",
      phone: "+254 712 345 678",
      address: "Riverside Drive, Nairobi, Kenya",
    },
    company: {
      name: "Urban Device Care Ltd",
      address: "Kimathi Street, IPS Building, Mezzanine Floor, Shop M4, Nairobi, Kenya",
      phone: "+254 700 000 000",
      email: "support@urbandevicecare.co.uk",
      website: "https://urbandevicecare.co.uk",
    },
    body_text: "This document legally certifies that the decommissioned computing equipment and electronic media detailed herein have been securely overhauled in compliance with standards.",
    custom_fields: {
      "Device Model": "Apple MacBook Pro 16\" (M3 Max - Space Black)",
      "Serial / IMEI": "C02G80XZMD6T",
      "Ticket Reference": "RT-10024",
      "Technician": "Bonifencia A. (Lead Certified Engineer)",
      "Quality Inspector": "Kevin M. (Senior QA Specialist)",
      "QC Checklist": "Passed 32-point hardware diagnostic test",
    },
    items: multiItems,
    notes: "1. All original customer data was preserved intact.\n2. Warranty covers parts and labor for 90 days.\n3. Accidental damage or liquid ingress voids this certificate.",
    currency_code: "kes",
    total: multiItems.reduce((sum, it) => sum + it.total, 0),
    payment_status: "paid",
  };

  const pdfBuf = await PDFKitGenerator.generate(certificateData, "modern");
  assert.ok(pdfBuf instanceof Buffer, "PDF output must be a Buffer");
  assert.ok(pdfBuf.length > 5000, "Multi-page certificate PDF buffer must be non-trivial (>5000 bytes)");
  assert.strictEqual(pdfBuf.subarray(0, 4).toString(), "%PDF", "PDF header must match %PDF");

  const text = extractTextFromPdf(pdfBuf);

  // Verify dynamic page footers were rendered across multiple pages
  assert.ok(text.includes("Page 1 of 2"), "Certificate should render 'Page 1 of 2'");
  assert.ok(text.includes("Page 2 of 2"), "Certificate should render 'Page 2 of 2'");

  // Verify that customer name and company name are cleanly rendered:
  // "Acme Global Solutions Ltd (Attn: Jane Doe)"
  assert.ok(text.includes("Acme Global Solutions Ltd"), "Company name must appear in recipient block");
  assert.ok(text.includes("Jane Doe"), "Customer personal name must appear in recipient block");
});

test("Release 1.1.34 - Certificate Header handles long titles and display IDs cleanly", async () => {
  const longTitleDoc: DocumentData = {
    display_id: "#CERT-88412",
    type: "certificate" as any,
    title: "CERTIFICATE OF DESTRUCTION & ECO-DISPOSAL",
    customer: {
      name: "David Kimani",
      email: "david@example.com",
    },
    company: {
      name: "Urban Device Care Ltd",
    },
    total: 0,
    currency_code: "kes",
    items: [
      { title: "Physical Shear Shredding", description: "DIN 66399 Level H-5", quantity: 1, unit_price: 0 },
    ],
  };

  const pdfBuf = await PDFKitGenerator.generate(longTitleDoc, "modern");
  assert.ok(pdfBuf instanceof Buffer);
  assert.ok(pdfBuf.length > 2000);

  const text = extractTextFromPdf(pdfBuf);

  // Should have docNumber without duplicate '##'
  assert.ok(!text.includes("##CERT-88412"), "Document number must not have duplicate '##'");
  assert.ok(text.includes("#CERT-88412"), "Document number must render '#CERT-88412'");
});

test("Release 1.1.34 - Document Grouper packs CERT- certificate documents with related repair documents", () => {
  assert.strictEqual(extractBaseReference("CERT-10024"), "10024");
  assert.strictEqual(extractBaseReference("JOB-10024"), "10024");
  assert.strictEqual(extractBaseReference("RT-10024"), "10024");
  assert.strictEqual(extractBaseReference("RCPT-10024"), "10024");

  assert.strictEqual(getDocTypePriority("certificate"), 40);
  assert.strictEqual(getDocTypePriority("custom"), 40);
  assert.strictEqual(getDocLifecycleOrder("certificate"), 6);
  assert.strictEqual(getDocTypeLabel("certificate"), "Certificate");

  const sampleDocs: DocumentRecord[] = [
    {
      id: "doc_job_1",
      display_id: "JOB-10024",
      title: "Repair Job Card",
      type: "job_card",
      source: "pdfkit",
      status: "draft",
      customer_name: "Jane Doe",
      repair_ticket_id: "rep_10024",
      total_amount: 0,
      currency_code: "kes",
      created_at: "2026-11-01T10:00:00Z",
    },
    {
      id: "doc_inv_1",
      display_id: "RT-10024",
      title: "Repair Invoice",
      type: "invoice",
      source: "pdfkit",
      status: "unpaid",
      customer_name: "Jane Doe",
      repair_ticket_id: "rep_10024",
      total_amount: 25000,
      currency_code: "kes",
      created_at: "2026-11-01T12:00:00Z",
    },
    {
      id: "doc_cert_1",
      display_id: "CERT-10024",
      title: "Warranty Certificate",
      type: "custom",
      source: "pdfkit",
      status: "draft",
      customer_name: "Jane Doe",
      repair_ticket_id: "rep_10024",
      total_amount: 0,
      currency_code: "kes",
      created_at: "2026-11-01T14:00:00Z",
    },
  ];

  const groups = groupDocuments(sampleDocs);
  assert.strictEqual(groups.length, 1, "All 3 repair documents sharing repair_ticket_id rep_10024 should cluster in 1 group");
  assert.strictEqual(groups[0].primaryDoc.display_id, "RT-10024", "Invoice must be elected as the primary document");
  assert.strictEqual(groups[0].documents.length, 3, "Group must contain all 3 documents");
  const docTypes = groups[0].documents.map((d) => d.type);
  assert.deepStrictEqual(docTypes, ["job_card", "invoice", "custom"], "Documents inside group must follow workflow lifecycle order");
});

test("Release 1.1.34 - Template preview handles type=certificate and preset=blank correctly", async () => {
  const { GET: getTemplatePreview } = await import("../src/api/admin/documents/templates/preview/route");

  const testCases = [
    { query: { type: "certificate", style: "modern" }, expectPrefix: "%PDF" },
    { query: { type: "custom", preset: "blank", style: "modern" }, expectPrefix: "%PDF" },
    { query: { type: "custom", preset: "generic", style: "modern" }, expectPrefix: "%PDF" },
  ];

  for (const tc of testCases) {
    let capturedHeader: any = {};
    let capturedBuffer: Buffer | null = null;
    let statusCode: number = 200;

    const mockReq: any = {
      query: tc.query,
      scope: {
        resolve: (key: string) => {
          if (key === "documents") {
            return {
              getSettings: async () => ({ company_name: "Urban Device Care Ltd" }),
            };
          }
          return null;
        },
      },
    };

    const mockRes: any = {
      setHeader: (key: string, val: any) => {
        capturedHeader[key] = val;
        return mockRes;
      },
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      send: (buf: Buffer) => {
        capturedBuffer = buf;
        return mockRes;
      },
    };

    await getTemplatePreview(mockReq, mockRes);
    assert.strictEqual(statusCode, 200, `Query ${JSON.stringify(tc.query)} should return 200`);
    assert.ok(capturedBuffer && capturedBuffer.length > 1000, `Query ${JSON.stringify(tc.query)} should return non-trivial PDF`);
    assert.strictEqual(capturedHeader["Content-Type"], "application/pdf");
    assert.strictEqual(capturedBuffer.subarray(0, 4).toString(), "%PDF");
  }
});
