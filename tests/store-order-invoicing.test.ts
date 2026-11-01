import test from "node:test";
import assert from "node:assert";
import ZohoBooksService from "../src/services/zoho-books";
import DocumentModuleService, { DEFAULT_DOCUMENT_SETTINGS } from "../src/modules/documents/service";
import orderDocumentsSubscriber from "../src/subscribers/order-documents";
import { extractBaseReference, groupDocuments } from "../src/utils/document-grouper";

test("Requirement 1: DocumentSettings defaults store_invoice_prefix to ST-", () => {
  assert.strictEqual(DEFAULT_DOCUMENT_SETTINGS.store_invoice_prefix, "ST-");
});

test("Requirement 2: orderDocumentsSubscriber uses store_invoice_prefix (default ST-) for invoice number", async () => {
  let generatedInput: any = null;

  const mockDocService = {
    getSettings: async () => ({
      event_order_placed_enabled: true,
      store_invoice_prefix: "ST-",
      company_name: "Urban Device Care Ltd",
    }),
    listDocumentRecords: async () => [],
    generateDocument: async (input: any) => {
      generatedInput = input;
      return { record: { id: "doc_order_1", display_id: input.display_id } };
    },
  };

  const container = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") {
        return {
          graph: async () => ({
            data: [
              {
                id: "ord_01JTESTORDER",
                display_id: 1045,
                email: "customer@example.com",
                total: 4500,
                subtotal: 4500,
                currency_code: "kes",
                items: [{ title: "iPhone 15 Case", quantity: 1, unit_price: 4500 }],
              },
            ],
          }),
        };
      }
      return null;
    },
  };

  await orderDocumentsSubscriber({
    event: { name: "order.placed", data: { id: "ord_01JTESTORDER" } },
    container: container as any,
  });

  assert.ok(generatedInput, "generateDocument should have been called");
  assert.strictEqual(generatedInput.display_id, "ST-1045", "Invoice display_id must use prefix ST-1045");
  assert.strictEqual(generatedInput.type, "invoice");
});

test("Requirement 2: orderDocumentsSubscriber respects customized store_invoice_prefix", async () => {
  let generatedInput: any = null;

  const mockDocService = {
    getSettings: async () => ({
      event_order_placed_enabled: true,
      store_invoice_prefix: "STORE-ORD-",
      company_name: "Urban Device Care Ltd",
    }),
    listDocumentRecords: async () => [],
    generateDocument: async (input: any) => {
      generatedInput = input;
      return { record: { id: "doc_order_2", display_id: input.display_id } };
    },
  };

  const container = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") {
        return {
          graph: async () => ({
            data: [
              {
                id: "ord_02JTESTORDER",
                display_id: 2050,
                email: "customer2@example.com",
                total: 12000,
                subtotal: 12000,
                currency_code: "kes",
                items: [{ title: "AirPods Pro 2", quantity: 1, unit_price: 12000 }],
              },
            ],
          }),
        };
      }
      return null;
    },
  };

  await orderDocumentsSubscriber({
    event: { name: "order.placed", data: { id: "ord_02JTESTORDER" } },
    container: container as any,
  });

  assert.ok(generatedInput, "generateDocument should have been called");
  assert.strictEqual(generatedInput.display_id, "STORE-ORD-2050", "Invoice display_id must use customized prefix");
});

test("Requirement 3: ZohoBooksService passes ignore_auto_number_generation=true and custom invoice_number for store invoice", async () => {
  let capturedUrl = "";
  let capturedPayload: any = null;

  const zoho = new ZohoBooksService({
    client_id: "test_cid",
    client_secret: "test_csec",
    refresh_token: "test_rtoken",
    organization_id: "test_org",
  });

  zoho.request = async (method: string, endpoint: string, body?: any) => {
    capturedUrl = endpoint;
    capturedPayload = body;
    return {
      invoice: {
        invoice_id: "zoho_inv_st_1045",
        invoice_number: body?.invoice_number || "ST-1045",
      },
    };
  };

  const res = await zoho.createInvoice("contact_test_123", {
    invoice_number: "ST-1045",
    reference_number: "ST-1045",
    ignore_auto_number_generation: true,
    line_items: [{ name: "iPhone 15 Case", rate: 4500, quantity: 1 }],
  });

  assert.ok(capturedUrl.includes("ignore_auto_number_generation=true"), "Must include ignore_auto_number_generation=true query parameter");
  assert.strictEqual(capturedPayload.invoice_number, "ST-1045");
  assert.strictEqual(capturedPayload.reference_number, "ST-1045");
  assert.strictEqual(res.invoice_number, "ST-1045");
});

test("Requirement 4: Idempotent pre-flight lookup: does not duplicate invoice if ST- invoice exists in Zoho", async () => {
  let getCalls = 0;
  let createCalls = 0;

  const zoho = new ZohoBooksService({
    client_id: "test_cid",
    client_secret: "test_csec",
    refresh_token: "test_rtoken",
    organization_id: "test_org",
  });

  zoho.request = async (method: string, endpoint: string, body?: any) => {
    if (method === "GET" && endpoint.includes("/invoices?invoice_number=")) {
      getCalls++;
      return {
        invoices: [
          { invoice_id: "zoho_existing_st_1045", invoice_number: "ST-1045" },
        ],
      };
    }
    if (method === "POST" && endpoint.includes("/invoices")) {
      createCalls++;
      return {
        invoice: { invoice_id: "zoho_new_inv", invoice_number: "ST-1045" },
      };
    }
    return {};
  };

  const existing = await zoho.getInvoiceByNumber("ST-1045");
  assert.ok(existing, "Pre-flight must locate the existing ST-1045 invoice");
  assert.strictEqual(existing?.invoice_id, "zoho_existing_st_1045");
  assert.strictEqual(existing?.invoice_number, "ST-1045");
  assert.strictEqual(getCalls, 1);
  assert.strictEqual(createCalls, 0, "No new invoice created if it already exists");
});

test("Requirement 4: Idempotent pre-flight lookup does not match unrelated RT- invoices when searching for ST- invoice", async () => {
  const zoho = new ZohoBooksService({
    client_id: "test_cid",
    client_secret: "test_csec",
    refresh_token: "test_rtoken",
    organization_id: "test_org",
  });

  zoho.request = async (method: string, endpoint: string) => {
    // Return empty for ST-1045, but suppose an RT-1045 existed
    if (endpoint.includes("invoice_number=ST-1045")) {
      return { invoices: [] };
    }
    if (endpoint.includes("invoice_number=1045")) {
      return {
        invoices: [{ invoice_id: "inv_rt_1045", invoice_number: "RT-1045" }],
      };
    }
    return { invoices: [] };
  };

  const found = await zoho.getInvoiceByNumber("ST-1045");
  // Should NOT falsely match RT-1045
  assert.strictEqual(found, null, "Searching for store order ST-1045 must not match repair invoice RT-1045");
});

test("document-grouper: extractBaseReference correctly strips ST- and STORE- prefixes", () => {
  assert.strictEqual(extractBaseReference("ST-1045"), "1045");
  assert.strictEqual(extractBaseReference("STORE-2050"), "2050");
  assert.strictEqual(extractBaseReference("RCPT-1045"), "1045");
  assert.strictEqual(extractBaseReference("PACK-1045"), "1045");
});

test("document-grouper: groups store order documents (ST- invoice and receipt and packing slip)", () => {
  const docs: any[] = [
    {
      id: "doc_1",
      display_id: "ST-1045",
      title: "Tax Invoice",
      type: "invoice",
      order_id: "ord_1045",
      created_at: "2026-10-15T10:00:00Z",
      total_amount: 5000,
    },
    {
      id: "doc_2",
      display_id: "RCPT-1045",
      title: "Payment Receipt",
      type: "receipt",
      order_id: "ord_1045",
      created_at: "2026-10-15T10:05:00Z",
      total_amount: 5000,
    },
    {
      id: "doc_3",
      display_id: "PACK-1045",
      title: "Packing Slip",
      type: "packing_slip",
      order_id: "ord_1045",
      created_at: "2026-10-15T11:00:00Z",
      total_amount: 0,
    },
  ];

  const groups = groupDocuments(docs);
  assert.strictEqual(groups.length, 1, "Must cluster all 3 documents into 1 order pack");
  assert.strictEqual(groups[0].primaryDoc.display_id, "ST-1045", "Invoice must be elected primary document");
  assert.strictEqual(groups[0].documents.length, 3);
  assert.strictEqual(groups[0].hasInvoice, true);
});
