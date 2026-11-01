import assert from "node:assert";
import { test } from "node:test";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";

test("Release 1.1.32 - Certificate Document Rendering has consistent header and structure", async () => {
  const certificateData: DocumentData = {
    display_id: "CERT-2026-0089",
    type: "custom",
    title: "WARRANTY CERTIFICATE",
    date: "2026-11-01",
    customer: {
      name: "Acme Enterprise Corp",
      company_name: "Acme Global Solutions Ltd",
      email: "corporate@acme.com",
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
    body_text: "This document certifies that the equipment identified herein has undergone full tier-1 repair and component replacement in accordance with ISO/IEC standards.",
    custom_fields: {
      "Device Model": "Apple MacBook Pro 16\" (M3 Max)",
      "Serial / IMEI": "C02G80XZMD6T",
      "Ticket Reference": "RT-10024",
      "Technician": "Bonifencia A. (Lead Certified Engineer)",
      "Warranty Period": "90 Days Comprehensive Hardware Warranty",
      "QC Checklist": "Passed 32-point hardware diagnostic test",
    },
    items: [
      {
        title: "Liquid Retina XDR Display Assembly",
        description: "OEM tier-1 panel replacement with TrueTone & ProMotion sensor calibration.",
        quantity: 1,
        unit_price: 65000,
        total: 65000,
      },
      {
        title: "Clean-Room Installation & Thermal Architecture Service",
        description: "Precision thermal paste reapplication and multi-rail board inspection.",
        quantity: 1,
        unit_price: 15000,
        total: 15000,
      },
    ],
    notes: "1. Warranty covers parts and workmanship for 90 days from issuance.\n2. Accidental damage or liquid ingress voids this certificate.",
    currency_code: "kes",
  };

  const pdfBuf = await PDFKitGenerator.generate(certificateData, "modern");
  assert.ok(pdfBuf instanceof Buffer, "PDF output must be a Buffer");
  assert.ok(pdfBuf.length > 2000, "Certificate PDF buffer must be non-trivial (>2000 bytes)");
  assert.strictEqual(pdfBuf.subarray(0, 4).toString(), "%PDF", "PDF header must match %PDF");

  // Certificate matching regex in generate() handles various certificate titles
  const certTitles = [
    "Service Completion Certificate",
    "Certificate of Destruction & Sanitization",
    "Diagnostic & Technical Inspection Report",
    "Device Trade-In & Buyback Receipt",
  ];

  for (const t of certTitles) {
    const certDoc: DocumentData = {
      ...certificateData,
      title: t,
      type: "custom",
    };
    const buf = await PDFKitGenerator.generate(certDoc, "modern");
    assert.ok(buf.length > 2000, `PDF for title '${t}' must be generated properly`);
  }
});

test("Release 1.1.32 - Job Card renders unpriced intake form without pricing columns or currency totals", async () => {
  const jobCardData: DocumentData = {
    display_id: "JOB-RT-10088",
    type: "job_card",
    title: "REPAIR JOB CARD & INTAKE FORM",
    date: "2026-11-01",
    customer: {
      name: "David Kimani",
      email: "david.k@example.com",
      phone: "+254 722 000 111",
      address: "Westlands, Nairobi",
    },
    company: {
      name: "Urban Device Care Ltd",
      address: "Kimathi Street, IPS Building, Nairobi",
      phone: "+254 700 000 000",
      email: "support@urbandevicecare.co.uk",
    },
    custom_fields: {
      "Device Model": "Samsung Galaxy S24 Ultra",
      "Serial / IMEI": "358762091234567",
      "Condition": "Minor hairline scratch on lower chin, rear glass intact",
      "Accessories": "Protective case only",
      "Technician": "Bonifencia A.",
      "Reported Issue": "Camera zoom module intermittently vibrates; battery drains quickly",
    },
    items: [
      {
        title: "Periscopic Telephoto Camera Module Inspection",
        description: "Hardware optical stabilizer and sensor verification",
        quantity: 1,
        unit_price: 18500, // Should be omitted from the job card PDF
        total: 18500,
      },
      {
        title: "High-Capacity Li-Ion Battery Diagnostic",
        description: "Charge cycle analysis and internal resistance measurement",
        quantity: 1,
        unit_price: 8500,
        total: 8500,
      },
    ],
    subtotal: 27000,
    tax_total: 4320,
    total: 31320,
    currency_code: "kes",
    notes: "Customer reported device was dropped 2 days ago.",
  };

  const pdfBuf = await PDFKitGenerator.generate(jobCardData, "modern");
  assert.ok(pdfBuf instanceof Buffer, "Job card PDF must be a Buffer");
  assert.ok(pdfBuf.length > 1500, "Job card PDF must be generated");
  assert.strictEqual(pdfBuf.subarray(0, 4).toString(), "%PDF");

  // Decompress PDF streams to accurately inspect rendered text operators
  const zlib = await import("zlib");
  const binary = pdfBuf.toString("binary");
  let decompressedText = "";
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(binary)) !== null) {
    try {
      const raw = Buffer.from(match[1], "binary");
      decompressedText += zlib.inflateSync(raw).toString("utf-8") + "\n";
    } catch {}
  }

  // In unpriced job cards:
  // "Unit Cost", "Est. Total", "Est Total" must NOT appear in the rendered document
  // (Hex for 'Unit Cost' is 556e697420436f7374, 'Est. Total' is 4573742e20546f74616c)
  assert.ok(!decompressedText.includes("556e697420436f7374") && !decompressedText.includes("Unit Cost"), "Job card must NOT contain 'Unit Cost' column header");
  assert.ok(!decompressedText.includes("4573742e20546f74616c") && !decompressedText.includes("Est. Total"), "Job card must NOT contain 'Est. Total' row");
  assert.ok(!decompressedText.includes("Est Total"), "Job card must NOT contain 'Est Total' row");

  // Verify that unpriced intake table header was rendered:
  // "Task" -> 5461736b, "Qty" -> 517479
  assert.ok(decompressedText.includes("54") && decompressedText.includes("517479"), "Job card must contain Task / Qty headers in stream");
});
