import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POST as manualPostHandler } from "../src/api/admin/documents/manual/route";

test("Release 1.1.62 - POST /admin/documents/manual enforces force_source: 'zoho'", async () => {
  let capturedInput: any = null;

  const mockDocumentService = {
    generateDocument: async (input: any) => {
      capturedInput = input;
      return {
        record: { id: "doc_mock_123", display_id: "INV-9999", source: "zoho" },
        success: true,
      };
    },
  };

  const mockScope = {
    resolve: (key: string) => {
      if (key === "documents") return mockDocumentService;
      if (key === "logger") return { error: () => {}, info: () => {} };
      return null;
    },
  };

  let responseData: any = null;
  const mockRes = {
    json: (data: any) => {
      responseData = data;
      return mockRes;
    },
    status: (code: number) => mockRes,
  };

  // 1. Pass force_source: 'pdfkit' in body to test enforcement
  const mockReq = {
    scope: mockScope,
    body: {
      title: "Manual Test Invoice",
      type: "invoice",
      force_source: "pdfkit",
      customer: {
        name: "Test Customer",
        email: "test@example.com",
        phone: "+254712345678",
      },
      items: [{ title: "Test Item", quantity: 1, unit_price: 100 }],
    },
  };

  await manualPostHandler(mockReq as any, mockRes as any);

  assert.ok(capturedInput, "generateDocument should have been called");
  assert.equal(
    capturedInput.force_source,
    "zoho",
    "force_source must be enforced to 'zoho' even when pdfkit was requested"
  );
  assert.equal(responseData?.success, true);
});

test("Release 1.1.62 - Custom Document presets remove 'blank' and 'proforma'", async () => {
  const pageFile = path.resolve(__dirname, "../src/admin/routes/documents/page.tsx");
  const content = fs.readFileSync(pageFile, "utf-8");

  // Verify proforma and blank presets are not present in CUSTOM_DOC_PRESETS definition
  const presetBlockMatch = content.match(/const CUSTOM_DOC_PRESETS: CustomDocPreset\[\] = \[([\s\S]*?)\];/);
  assert.ok(presetBlockMatch, "CUSTOM_DOC_PRESETS array must exist in page.tsx");

  const presetBlock = presetBlockMatch[1];
  assert.equal(
    presetBlock.includes('id: "proforma"'),
    false,
    "CUSTOM_DOC_PRESETS must not contain id: 'proforma'"
  );
  assert.equal(
    presetBlock.includes('id: "blank"'),
    false,
    "CUSTOM_DOC_PRESETS must not contain id: 'blank'"
  );
  assert.equal(
    presetBlock.includes('Commercial Quotation / Proforma'),
    false,
    "CUSTOM_DOC_PRESETS must not contain Commercial Quotation"
  );
  assert.equal(
    presetBlock.includes('Blank Custom Document'),
    false,
    "CUSTOM_DOC_PRESETS must not contain Blank Custom Document"
  );
});

test("Release 1.1.62 - page.tsx includes CustomerAutofillCombobox and RepairTicketCombobox", async () => {
  const pageFile = path.resolve(__dirname, "../src/admin/routes/documents/page.tsx");
  const content = fs.readFileSync(pageFile, "utf-8");

  assert.ok(
    content.includes("const CustomerAutofillCombobox"),
    "CustomerAutofillCombobox component must be defined"
  );
  assert.ok(
    content.includes("const RepairTicketCombobox"),
    "RepairTicketCombobox component must be defined"
  );
  assert.ok(
    content.includes("<CustomerAutofillCombobox"),
    "CustomerAutofillCombobox must be rendered in forms"
  );
  assert.ok(
    content.includes("<RepairTicketCombobox"),
    "RepairTicketCombobox must be rendered instead of standard Select"
  );
  assert.ok(
    content.includes('force_source: "zoho"'),
    "force_source: 'zoho' must be configured in manualForm and submissions"
  );
});

test("Release 1.1.62 - POST /admin/documents/manual preserves customer personal name when company_name is present", async () => {
  let capturedInput: any = null;

  const mockDocumentService = {
    generateDocument: async (input: any) => {
      capturedInput = input;
      return { record: { id: "doc_test_name" }, success: true };
    },
  };

  const mockReq = {
    scope: {
      resolve: (key: string) => (key === "documents" ? mockDocumentService : null),
    },
    body: {
      title: "Invoice with Company and Name",
      customer: {
        name: "Alice Smith",
        company_name: "Acme Enterprises Ltd",
        email: "alice@acme.com",
        phone: "+254700112233",
        address: "123 Business Park, Nairobi, Kenya",
      },
      items: [{ title: "Diagnostic Service", quantity: 1, unit_price: 2500 }],
    },
  };

  const mockRes = {
    json: () => mockRes,
    status: () => mockRes,
  };

  await manualPostHandler(mockReq as any, mockRes as any);

  assert.ok(capturedInput, "generateDocument must be called");
  assert.equal(
    capturedInput.customer.name,
    "Alice Smith",
    "Customer personal name must not be overwritten by company name"
  );
  assert.equal(
    capturedInput.customer.company_name,
    "Acme Enterprises Ltd",
    "Company name must be preserved"
  );
  assert.equal(
    capturedInput.customer.address,
    "123 Business Park, Nairobi, Kenya",
    "Customer address must be passed to generateDocument"
  );
});

test("Release 1.1.62 - loadCustomers in page.tsx requests fields=*addresses for complete customer profile retrieval", async () => {
  const pageFile = path.resolve(__dirname, "../src/admin/routes/documents/page.tsx");
  const content = fs.readFileSync(pageFile, "utf-8");

  assert.ok(
    content.includes("/admin/customers?limit=100&fields=*addresses"),
    "loadCustomers must query with fields=*addresses to retrieve billing address details from Medusa"
  );
  assert.ok(
    content.includes("fields=*addresses"),
    "CustomerAutofillCombobox debounced search must include fields=*addresses"
  );
});

test("Release 1.1.62 - RepairTicketCombobox supports prefix-insensitive searches and selection preservation", async () => {
  const pageFile = path.resolve(__dirname, "../src/admin/routes/documents/page.tsx");
  const content = fs.readFileSync(pageFile, "utf-8");

  assert.ok(
    content.includes("cleanQ && cleanNum.includes(cleanQ)"),
    "RepairTicketCombobox must support searching ticket number with or without prefix (e.g. RT-5390 or 5390)"
  );
  assert.ok(
    content.includes("isUnmodifiedSelection"),
    "RepairTicketCombobox must accurately differentiate unmodified selection from search queries"
  );
});
