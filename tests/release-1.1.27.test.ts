import test from "node:test";
import assert from "node:assert";
import { POST, GET } from "../src/api/admin/documents/sync/route";
import { GET as getTemplatePreview } from "../src/api/admin/documents/templates/preview/route";

test("Release 1.1.27 - Template preview handles specialized presets with custom titles and content", async () => {
  const presets = [
    { preset: "warranty", expectedTitle: "Limited Warranty Certificate" },
    { preset: "diagnostic", expectedTitle: "Diagnostic & Assessment Report" },
    { preset: "service_completion", expectedTitle: "Service Completion Certificate" },
    { preset: "handover", expectedTitle: "Device Handover Protocol" },
    { preset: "proforma", expectedTitle: "Proforma Invoice" },
    { preset: "trade_in", expectedTitle: "Trade-In & Buyback Agreement" },
    { preset: "destruction", expectedTitle: "Certificate of Data & Hardware Destruction" },
  ];

  for (const { preset, expectedTitle } of presets) {
    let capturedHeader: any = null;
    let capturedBuffer: Buffer | null = null;
    let statusCode: number = 200;

    const mockReq: any = {
      query: { preset, style: "modern" },
      scope: {
        resolve: (key: string) => {
          if (key === "documents") {
            return {
              getSettings: async () => ({ company_name: "Urban Device Care" }),
            };
          }
          return null;
        },
      },
    };

    const mockRes: any = {
      setHeader: (key: string, val: any) => {
        if (!capturedHeader) capturedHeader = {};
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
    assert.strictEqual(statusCode, 200, `Preset ${preset} preview should return 200`);
    assert.ok(capturedBuffer, `Preset ${preset} preview should return PDF buffer`);
    assert.ok(capturedBuffer.length > 500, `Preset ${preset} PDF buffer should be non-empty`);
    assert.strictEqual(capturedHeader["Content-Type"], "application/pdf");
  }
});

test("Release 1.1.27 - Sync endpoint processes repair tickets and creates missing job cards and links", async () => {
  const mockTickets = [
    {
      id: "rep_ticket_101",
      ticket_number: "RT-1793466012168-TS9RXZ",
      status: "diagnosing",
      total_estimate: 15000,
      customer_id: "cus_101",
      device: { brand: "Apple", model_name: "iPhone 13 Pro" },
      metadata: {},
    },
    {
      id: "rep_ticket_102",
      ticket_number: "RT-1793458753361-WUA3SX",
      status: "completed",
      total_estimate: 22500,
      total_actual: 22500,
      customer_id: "cus_102",
      device: { brand: "Samsung", model_name: "Galaxy S22" },
      metadata: {},
    },
  ];

  const generatedDocs: any[] = [];
  const updatedTickets: any[] = [];

  const mockDocService: any = {
    getSettings: async () => ({
      zoho_books_enabled: false,
      event_repair_created_enabled: true,
    }),
    generateDocument: async (input: any) => {
      generatedDocs.push(input);
      return {
        record: {
          id: `doc_${input.type}_${input.display_id}`,
          display_id: input.display_id,
          type: input.type,
          title: input.title,
          pdf_url: `http://localhost:9000/documents/${input.display_id}.pdf`,
          short_pdf_link: `http://localhost:9000/r/${input.display_id}`,
        },
      };
    },
  };

  let jsonResult: any = null;
  const mockReq: any = {
    query: {},
    body: {},
    scope: {
      resolve: (key: string) => {
        if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
        if (key === "documents") return mockDocService;
        if (key === "query") {
          return {
            graph: async () => ({ data: mockTickets }),
          };
        }
        if (key === "repair") {
          return {
            retrieveRepairTicket: async (id: string) => mockTickets.find((t) => t.id === id),
            updateRepairTickets: async (payload: any) => {
              updatedTickets.push(payload);
            },
          };
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    status: () => mockRes,
    json: (data: any) => {
      jsonResult = data;
      return mockRes;
    },
  };

  await POST(mockReq, mockRes);

  assert.ok(jsonResult, "Sync endpoint should return JSON response");
  assert.strictEqual(jsonResult.success, true);
  assert.strictEqual(jsonResult.synced_tickets, 2);
  assert.strictEqual(jsonResult.documents_created, 5, "Should create 2 job cards, 2 estimates, and 1 invoice");

  const jobCard101 = generatedDocs.find((d) => d.type === "job_card" && d.display_id === "JOB-1793466012168-TS9RXZ");
  assert.ok(jobCard101, "Should generate job card with JOB- prefix without duplicate RT-");

  const est101 = generatedDocs.find((d) => d.type === "estimate" && d.repair_ticket_id === "rep_ticket_101");
  assert.ok(est101, "Diagnosing repair ticket should get estimate accompanying doc");

  const inv102 = generatedDocs.find((d) => d.type === "invoice" && d.repair_ticket_id === "rep_ticket_102");
  assert.ok(inv102, "Completed repair ticket should get invoice accompanying doc");
});
