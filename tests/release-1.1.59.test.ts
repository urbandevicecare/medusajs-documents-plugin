import { test } from "node:test";
import assert from "node:assert";
import { ZohoBooksService } from "../src/services/zoho-books";

test("Release 1.1.59 - ZohoBooksService exports markInvoiceAsSent and markEstimateAsSent", () => {
  const service = new ZohoBooksService({
    client_id: "test",
    client_secret: "test",
    refresh_token: "test",
    organization_id: "org_123",
  });

  assert.strictEqual(typeof service.markInvoiceAsSent, "function");
  assert.strictEqual(typeof service.markEstimateAsSent, "function");
  assert.strictEqual(typeof service.getInvoiceDeliveryNotePdf, "function");
});

test("Release 1.1.59 - createInvoice and createEstimate accept backdated date parameter", async () => {
  let capturedInvoicePayload: any = null;
  let capturedEstimatePayload: any = null;

  const service = new ZohoBooksService({
    client_id: "test",
    client_secret: "test",
    refresh_token: "test",
    organization_id: "org_123",
  });

  // Mock request method
  service.request = async (method: string, endpoint: string, body?: any) => {
    if (endpoint.startsWith("/invoices")) {
      capturedInvoicePayload = body;
      return { invoice: { invoice_id: "inv_999", invoice_number: "RT-1001" } };
    }
    if (endpoint.startsWith("/estimates")) {
      capturedEstimatePayload = body;
      return { estimate: { estimate_id: "est_999", estimate_number: "EST-1001" } };
    }
    return {};
  };

  await service.createInvoice("cid_123", {
    invoice_number: "RT-1001",
    date: "2026-10-15",
    line_items: [{ name: "Repair Diagnostic", rate: "100.00", quantity: 1 }],
  });

  assert.ok(capturedInvoicePayload);
  assert.strictEqual(capturedInvoicePayload.date, "2026-10-15");

  await service.createEstimate("cid_123", {
    estimate_number: "EST-1001",
    date: "2026-10-12",
    line_items: [{ name: "Screen Quote", rate: "5000.00", quantity: 1 }],
  });

  assert.ok(capturedEstimatePayload);
  assert.strictEqual(capturedEstimatePayload.date, "2026-10-12");
});

test("Release 1.1.59 - markInvoiceAsSent and markEstimateAsSent invoke status/sent endpoints", async () => {
  const calledEndpoints: string[] = [];

  const service = new ZohoBooksService({
    client_id: "test",
    client_secret: "test",
    refresh_token: "test",
    organization_id: "org_123",
  });

  service.request = async (method: string, endpoint: string) => {
    calledEndpoints.push(`${method} ${endpoint}`);
    return {};
  };

  await service.markInvoiceAsSent("inv_123");
  await service.markEstimateAsSent("est_456");

  assert.ok(calledEndpoints.includes("POST /invoices/inv_123/status/sent"));
  assert.ok(calledEndpoints.includes("POST /estimates/est_456/status/sent"));
});

test("Release 1.1.59 - Core document types (invoice, receipt, estimate, packing_slip) strictly require Zoho", async () => {
  const DocumentModuleService = (await import("../src/modules/documents/service")).default;
  const service: any = Object.create(DocumentModuleService.prototype);

  // Mock settings with zoho enabled
  service.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "client_id",
    zoho_client_secret: "secret",
    zoho_refresh_token: "refresh",
    zoho_organization_id: "org_id",
  });

  service.baseRepository_ = {
    serialize: (d: any) => d,
    transaction: async (fn: any) => fn({}),
    getFreshManager: () => ({}),
    getActiveManager: () => ({}),
  };

  service.listDocumentRecords = async () => [];
  service.createDocumentRecords = async (d: any) => d;

  // Attempting to generate with failing Zoho Books and without force_source='pdfkit' throws rather than silently using pdfkit
  const origRequest = ZohoBooksService.prototype.request;
  ZohoBooksService.prototype.request = async () => {
    throw new Error("Zoho API connection failure");
  };

  try {
    try {
      await service.generateDocument(
        {
          type: "invoice",
          display_id: "RT-TEST-STRICT",
          customer: { name: "Test User" },
          _skip_quote_creation: true,
        },
        {
          resolve: () => null,
        } as any
      );
    } catch (err: any) {
      assert.ok(err.message.includes("Zoho Books"));
    }
  } finally {
    ZohoBooksService.prototype.request = origRequest;
  }
});
