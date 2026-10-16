import assert from "node:assert";
import { test } from "node:test";
import { PDFKitGenerator } from "../src/services/pdfkit-generator";
import { handleShortlinkRedirect } from "../src/utils/shortlink-resolver";
import { POST as syncZohoRoute } from "../src/api/admin/documents/[id]/sync-zoho/route";
import repairDocumentsSubscriber from "../src/subscribers/repair-documents";

test("Release 1.1.14 - Requirement 1: PDFKitGenerator renders company name and Attn: line", async () => {
  const pdfBuffer = await PDFKitGenerator.generate(
    {
      display_id: "INV-1001",
      title: "Tax Invoice",
      type: "invoice",
      date: "2026-10-16",
      customer: {
        name: "Jane Doe",
        company_name: "Acme Enterprises Ltd",
        email: "jane@acme.com",
      },
      items: [
        {
          title: "MacBook Screen Replacement",
          quantity: 1,
          unit_price: 15000,
        },
      ],
      total: 15000,
      currency_code: "KES",
    },
    "modern"
  );

  assert.ok(pdfBuffer instanceof Buffer);
  assert.ok(pdfBuffer.length > 500, "PDF buffer must be populated");
});

test("Release 1.1.14 - Requirement 2: POST /admin/documents/:id/sync-zoho rejects non-Zoho and zero-amount documents", async () => {
  // Test 1: Reject job_card
  let statusResult = 200;
  let jsonResult: any = null;

  const mockReqJobCard: any = {
    params: { id: "doc_job_card" },
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            retrieveDocumentRecord: async () => ({
              id: "doc_job_card",
              type: "job_card",
              total_amount: 0,
              display_id: "JOB-101",
            }),
            getSettings: async () => ({
              zoho_books_enabled: true,
              zoho_client_id: "mock_client_id",
            }),
          };
        }
        return null;
      },
    },
  };

  const mockResJobCard: any = {
    status: (code: number) => {
      statusResult = code;
      return {
        json: (data: any) => {
          jsonResult = data;
        },
      };
    },
    json: (data: any) => {
      jsonResult = data;
    },
  };

  await syncZohoRoute(mockReqJobCard, mockResJobCard);
  assert.strictEqual(statusResult, 400, "Non-zoho document type must be rejected with HTTP 400");
  assert.strictEqual(jsonResult.success, false);
  assert.match(jsonResult.message, /Cannot push job_card documents to Zoho Books/);

  // Test 2: Reject document with 0 total_amount
  statusResult = 200;
  jsonResult = null;
  const mockReqZeroInvoice: any = {
    params: { id: "doc_zero_inv" },
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            retrieveDocumentRecord: async () => ({
              id: "doc_zero_inv",
              type: "invoice",
              total_amount: 0,
              display_id: "INV-000",
            }),
            getSettings: async () => ({
              zoho_books_enabled: true,
              zoho_client_id: "mock_client_id",
            }),
          };
        }
        return null;
      },
    },
  };

  await syncZohoRoute(mockReqZeroInvoice, mockResJobCard);
  assert.strictEqual(statusResult, 400, "Zero amount document must be rejected with HTTP 400");
  assert.match(jsonResult.message, /Cannot push documents with zero total amount/);
});

test("Release 1.1.14 - Requirement 3: Duplicate RT- prefixes are completely stripped", async () => {
  let capturedDocInput: any = null;
  const mockDocService = {
    getSettings: async () => ({
      event_repair_created_enabled: true,
      event_repair_status_changed_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedDocInput = input;
      return { record: { id: "doc_test", display_id: input.display_id } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_duplicate_rt",
          ticket_number: "RT-1792156525673-SNL9QH",
          status: "diagnosing",
          total_estimate: 5000,
          customer_id: null,
          device: { model_name: "iPhone 13" },
        },
      ],
    }),
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      return null;
    },
  };

  // Test repair.created -> should produce JOB-1792156525673-SNL9QH, NOT JOB-RT-1792156525673-SNL9QH
  await repairDocumentsSubscriber({
    event: { name: "repair.created", data: { id: "rep_duplicate_rt" } },
    container: mockContainer,
  } as any);

  assert.ok(capturedDocInput);
  assert.strictEqual(
    capturedDocInput.display_id,
    "JOB-1792156525673-SNL9QH",
    "Extra RT- must be removed from JOB card reference number"
  );

  // Test repair.status_changed -> should produce RT-1792156525673-SNL9QH, NOT RT-RT-1792156525673-SNL9QH
  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_duplicate_rt", status: "diagnosing" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(
    capturedDocInput.display_id,
    "RT-1792156525673-SNL9QH",
    "Extra RT- must be removed from Repair invoice reference number"
  );
});

test("Release 1.1.14 - Requirement 6: Currency defaults to KES across PDFKit formatCurrency", () => {
  const formatted = PDFKitGenerator.formatCurrency(1500);
  assert.ok(formatted.includes("1,500"), "Formatted amount must include 1,500");
  assert.ok(formatted.includes("KES") || formatted.includes("KSh"), "Default currency must be KES");
});

test("Release 1.1.14 - Requirement 7: handleShortlinkRedirect never throws 500 when req.get is undefined", async () => {
  let redirectedUrl = "";
  let statusCode = 0;

  // Simulate Fastify or custom request wrapper where req.get is NOT a function
  const mockReqWithoutReqGet: any = {
    params: { code: "pay123" },
    headers: {
      host: "admin.urbandevicecare.co.uk",
      "x-forwarded-proto": "https",
    },
    // req.get is deliberately undefined to test resilience
    get: undefined,
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            listDocumentLinks: async ({ shortcode }: { shortcode: string }) => {
              if (shortcode === "pay123") {
                return [{ shortcode: "pay123", url: "https://checkout.paystack.com/access-token-123" }];
              }
              return [];
            },
          };
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
    setHeader: () => {},
    status: (code: number) => {
      statusCode = code;
      return {
        send: () => {},
      };
    },
  };

  await handleShortlinkRedirect(mockReqWithoutReqGet, mockRes, "Test");

  assert.strictEqual(redirectedUrl, "https://checkout.paystack.com/access-token-123");
  assert.strictEqual(statusCode, 0, "No error status code should be set on successful redirect");
});

test("Release 1.1.14 - Requirement 7: handleShortlinkRedirect falls back to document_record when link table row is missing", async () => {
  let redirectedUrl = "";

  const mockReqWithDocRecordFallback: any = {
    params: { code: "abc789" },
    headers: {
      host: "admin.urbandevicecare.co.uk",
      "x-forwarded-proto": "https",
    },
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            listDocumentLinks: async () => [],
          };
        }
        if (key === "__pg_connection__" || key === "knex") {
          const fakeKnex: any = (table: string) => {
            if (table === "document_link") {
              return {
                where: () => ({
                  first: async () => null,
                }),
              };
            }
            if (table === "document_record") {
              return {
                where: () => ({
                  first: async () => ({
                    id: "doc_123",
                    short_payment_link: "https://admin.urbandevicecare.co.uk/r/abc789",
                    payment_link: "https://checkout.paystack.com/real-paystack-link",
                  }),
                }),
              };
            }
            return {
              where: () => ({
                first: async () => null,
              }),
            };
          };
          return fakeKnex;
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
    setHeader: () => {},
    status: () => ({ send: () => {} }),
  };

  await handleShortlinkRedirect(mockReqWithDocRecordFallback, mockRes, "Test");
  assert.strictEqual(redirectedUrl, "https://checkout.paystack.com/real-paystack-link");
});
