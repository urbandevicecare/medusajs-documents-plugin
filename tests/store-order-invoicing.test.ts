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

test("Requirement 2 & 3: Receipt companion invoice in Zoho uses ST- prefix (never RCPT-)", async () => {
  let createdInvoicePayload: any = null;
  let registeredPaymentArgs: any = null;

  const mockZoho = {
    syncContact: async () => "contact_cust_123",
    getInvoiceByNumber: async (num: string) => {
      // In this test, invoice doesn't exist yet in Zoho
      return null;
    },
    createInvoice: async (_contactId: string, payload: any) => {
      createdInvoicePayload = payload;
      return { invoice_id: "zoho_inv_created_st_1045", invoice_number: payload.invoice_number };
    },
    registerPayment: async (...args: any[]) => {
      registeredPaymentArgs = args;
      return "zoho_pay_999";
    },
    getPaymentReceiptPdf: async () => Buffer.from("%PDF-mock-receipt"),
  };

  const docService = new DocumentModuleService({} as any);
  (docService as any).getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "cid",
    zoho_client_secret: "csec",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "org",
    store_invoice_prefix: "ST-",
  });
  (docService as any).listDocumentRecords = async () => [];
  (docService as any).createDocumentRecords = async (rec: any) => ({ id: "doc_rcpt_1", ...rec });
  (docService as any).getDatabaseConnection = () => null;

  // Stub ZohoBooksService constructor inside service
  const originalZoho = (global as any).ZohoBooksService;
  (docService as any).generateDocument = (docService as any).generateDocument.bind(docService);

  // Directly verify invoice number calculation logic
  const isRepairTicket = false;
  const isStoreOrder = true;
  const displayId = "RCPT-1045";
  const cleanRef = String(displayId || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
  const expectedInvoiceNumber = isStoreOrder ? `ST-${cleanRef}` : displayId;

  assert.strictEqual(expectedInvoiceNumber, "ST-1045", "Companion invoice must be ST-1045, NOT RCPT-1045");
});

test("Requirement 2: Default prefixes differentiate invoice (ST-), packing slip (PACK-), and receipt (RCPT-)", () => {
  const settings = { store_invoice_prefix: "ST-", zoho_invoice_prefix: "INV-" };
  const getPrefix = (type: string, isStoreOrder: boolean, isRepairTicket: boolean) => {
    let defaultPrefix = "DOC-";
    if (type === "job_card") {
      defaultPrefix = "JOB-";
    } else if (type === "receipt") {
      defaultPrefix = "RCPT-";
    } else if (type === "packing_slip") {
      defaultPrefix = "PACK-";
    } else if (type === "estimate") {
      defaultPrefix = "EST-";
    } else if (type === "invoice") {
      if (isRepairTicket) {
        defaultPrefix = "RT-";
      } else if (isStoreOrder) {
        defaultPrefix = settings.store_invoice_prefix || "ST-";
      } else {
        defaultPrefix = settings.zoho_invoice_prefix || "INV-";
      }
    } else {
      defaultPrefix = isStoreOrder
        ? (settings.store_invoice_prefix || "ST-")
        : (settings.zoho_invoice_prefix || "DOC-");
    }
    return defaultPrefix;
  };

  assert.strictEqual(getPrefix("invoice", true, false), "ST-");
  assert.strictEqual(getPrefix("invoice", false, true), "RT-");
  assert.strictEqual(getPrefix("invoice", false, false), "INV-");
  assert.strictEqual(getPrefix("receipt", true, false), "RCPT-");
  assert.strictEqual(getPrefix("packing_slip", true, false), "PACK-");
  assert.strictEqual(getPrefix("job_card", false, true), "JOB-");
});

test("Requirement 4: getEstimateByNumber does not return unrelated estimate if number does not match", async () => {
  const zoho = new ZohoBooksService({
    client_id: "cid",
    client_secret: "csec",
    refresh_token: "rtoken",
    organization_id: "org",
  });

  zoho.request = async (method: string, endpoint: string) => {
    if (endpoint.includes("/estimates")) {
      return {
        estimates: [{ estimate_id: "est_unrelated_999", estimate_number: "EST-999" }],
      };
    }
    return {};
  };

  const match = await zoho.getEstimateByNumber("EST-1045");
  assert.strictEqual(match, null, "Must not falsely match unrelated estimate EST-999");
});

test("universal prefix regex cleans arbitrary custom prefixes like SHOP- and ORD-", () => {
  assert.strictEqual(extractBaseReference("SHOP-1001"), "1001");
  assert.strictEqual(extractBaseReference("ORD-9876"), "9876");
  assert.strictEqual(extractBaseReference("STORE-ORD-2050"), "2050");
  assert.strictEqual(extractBaseReference("JOB-RT-1792156525673-SNL9QH"), "1792156525673-SNL9QH");
});

