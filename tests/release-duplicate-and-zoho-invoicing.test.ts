import test from "node:test";
import assert from "node:assert";
import ZohoBooksService from "../src/services/zoho-books";
import DocumentModuleService from "../src/modules/documents/service";
import repairDocumentsSubscriber from "../src/subscribers/repair-documents";

test("Requirement 4: ZohoBooksService appends ignore_auto_number_generation=true and payload contains invoice_number", async () => {
  let requestedUrl = "";
  let requestedBody: any = null;

  const zoho = new ZohoBooksService({
    client_id: "test_client",
    client_secret: "test_secret",
    refresh_token: "test_refresh",
    organization_id: "org_12345",
  });

  // Mock request method
  zoho.request = async (method: string, endpoint: string, body?: any) => {
    requestedUrl = endpoint;
    requestedBody = body;
    return {
      invoice: {
        invoice_id: "inv_9999",
        invoice_number: body.invoice_number,
      },
    };
  };

  const res = await zoho.createInvoice("contact_123", {
    invoice_number: "RT-1793458753361-WUA3SX",
    reference_number: "RT-1793458753361-WUA3SX",
    line_items: [{ name: "Screen Replacement", rate: 5000, quantity: 1 }],
  });

  assert.ok(requestedUrl.includes("ignore_auto_number_generation=true"), "URL must have ignore_auto_number_generation=true query parameter");
  assert.strictEqual(requestedBody.invoice_number, "RT-1793458753361-WUA3SX", "Payload must contain invoice_number matching repair ticket number");
  assert.strictEqual(res.invoice_id, "inv_9999");
});

test("Requirement 4: ZohoBooksService.getInvoiceByNumber queries Zoho by invoice_number and returns matching invoice", async () => {
  let requestedUrl = "";
  const zoho = new ZohoBooksService({
    client_id: "test_client",
    client_secret: "test_secret",
    refresh_token: "test_refresh",
    organization_id: "org_12345",
  });

  zoho.request = async (method: string, endpoint: string) => {
    requestedUrl = endpoint;
    return {
      invoices: [
        { invoice_id: "inv_existing_01", invoice_number: "RT-1793458753361-WUA3SX" },
      ],
    };
  };

  const found = await zoho.getInvoiceByNumber("RT-1793458753361-WUA3SX");
  assert.ok(found, "Must return existing invoice");
  assert.strictEqual(found?.invoice_id, "inv_existing_01");
  assert.strictEqual(found?.invoice_number, "RT-1793458753361-WUA3SX");
  assert.ok(requestedUrl.includes("invoice_number=RT-1793458753361-WUA3SX"), "Query must filter by invoice_number");
});

test("Requirement 3: Repair subscriber only creates invoice for repairing/ready/completed/collected statuses and estimate for pre-repair", async () => {
  const capturedCalls: Array<{ type: string; title: string; display_id: string }> = [];

  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: true,
      event_repair_completed_enabled: true,
      zoho_books_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedCalls.push({ type: input.type, title: input.title, display_id: input.display_id });
      return { record: { id: "doc_test_1", display_id: input.display_id, zoho_document_id: "inv_zoho_1" } };
    },
  };

  const makeContainer = (status: string) => ({
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") {
        return {
          graph: async () => ({
            data: [
              {
                id: "rep_ticket_test",
                ticket_number: "RT-1793458753361-WUA3SX",
                status: status,
                total_estimate: 7500,
                customer_id: null,
                device: { model_name: "MacBook Pro" },
              },
            ],
          }),
        };
      }
      return null;
    },
  });

  // 1. Diagnosing -> estimate (quote)
  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_ticket_test", status: "diagnosing" } },
    container: makeContainer("diagnosing") as any,
  } as any);

  assert.strictEqual(capturedCalls[0].type, "estimate");
  assert.strictEqual(capturedCalls[0].display_id, "RT-1793458753361-WUA3SX");

  // 2. Repairing -> invoice
  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_ticket_test", status: "repairing" } },
    container: makeContainer("repairing") as any,
  } as any);

  assert.strictEqual(capturedCalls[1].type, "invoice");
  assert.strictEqual(capturedCalls[1].display_id, "RT-1793458753361-WUA3SX");

  // 3. Ready -> invoice
  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_ticket_test", status: "ready" } },
    container: makeContainer("ready") as any,
  } as any);

  assert.strictEqual(capturedCalls[2].type, "invoice");

  // 4. Completed -> final repair invoice
  await repairDocumentsSubscriber({
    event: { name: "repair.completed", data: { id: "rep_ticket_test" } },
    container: makeContainer("completed") as any,
  } as any);

  assert.strictEqual(capturedCalls[3].type, "invoice");
  assert.strictEqual(capturedCalls[3].title, "Final Repair Invoice");

  // 5. Cancelled -> no document generated
  const beforeLen = capturedCalls.length;
  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_ticket_test", status: "cancelled" } },
    container: makeContainer("cancelled") as any,
  } as any);

  assert.strictEqual(capturedCalls.length, beforeLen, "Cancelled ticket must not trigger document generation");
});

test("Requirement 4 & 5: DocumentModuleService.deleteDocumentsForRepairTicket cleans Zoho, DB, and metadata", async () => {
  const deletedZohoInvoices: string[] = [];
  const deletedZohoEstimates: string[] = [];
  const deletedDbRecordIds: string[] = [];
  let updatedTicketMetadata: any = null;

  const mockService: any = Object.create(DocumentModuleService.prototype);

  // Mock DB list and delete
  mockService.listDocumentRecords = async () => [
    { id: "doc_rec_01", type: "invoice", zoho_document_id: "zoho_inv_01" },
    { id: "doc_rec_02", type: "estimate", zoho_document_id: "zoho_est_01" },
  ];
  mockService.deleteDocumentRecords = async (id: string) => {
    deletedDbRecordIds.push(id);
  };
  mockService.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "c_id",
    zoho_client_secret: "c_sec",
    zoho_refresh_token: "r_tok",
    zoho_organization_id: "org_id",
  });

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "repair") {
        return {
          retrieveRepairTicket: async () => ({
            id: "ticket_123",
            metadata: {
              document_id: "doc_rec_01",
              pdf_url: "https://example.com/doc.pdf",
              zoho_invoice_id: "zoho_inv_01",
              custom_data: "keep_me",
            },
          }),
          updateRepairTickets: async ({ id, metadata }: any) => {
            updatedTicketMetadata = metadata;
          },
        };
      }
      return null;
    },
  };

  // Mock ZohoBooksService
  const origZohoDeleteInvoice = ZohoBooksService.prototype.deleteInvoice;
  const origZohoDeleteEstimate = ZohoBooksService.prototype.deleteEstimate;
  ZohoBooksService.prototype.deleteInvoice = async function (id: string) {
    deletedZohoInvoices.push(id);
  };
  ZohoBooksService.prototype.deleteEstimate = async function (id: string) {
    deletedZohoEstimates.push(id);
  };

  try {
    const result = await mockService.deleteDocumentsForRepairTicket("ticket_123", mockContainer);

    assert.strictEqual(result.deleted_records, 2, "Must delete 2 database records");
    assert.deepStrictEqual(result.deleted_zoho_invoices, ["zoho_inv_01"]);
    assert.deepStrictEqual(result.deleted_zoho_estimates, ["zoho_est_01"]);
    assert.deepStrictEqual(deletedDbRecordIds, ["doc_rec_01", "doc_rec_02"]);

    // Verify metadata was cleaned
    assert.strictEqual(updatedTicketMetadata.document_id, undefined);
    assert.strictEqual(updatedTicketMetadata.pdf_url, undefined);
    assert.strictEqual(updatedTicketMetadata.zoho_invoice_id, undefined);
    assert.strictEqual(updatedTicketMetadata.custom_data, "keep_me", "Non-document metadata must be preserved");
  } finally {
    ZohoBooksService.prototype.deleteInvoice = origZohoDeleteInvoice;
    ZohoBooksService.prototype.deleteEstimate = origZohoDeleteEstimate;
  }
});
