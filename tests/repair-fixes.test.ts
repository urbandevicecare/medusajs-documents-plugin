import assert from "node:assert";
import { test } from "node:test";
import { NotificationSender } from "../src/services/notification-sender";
import repairDocumentsSubscriber from "../src/subscribers/repair-documents";
import orderDocumentsSubscriber from "../src/subscribers/order-documents";
import { ZohoBooksService } from "../src/services/zoho-books";

test("Fix 1: Repair documents subscriber sets auto_send: false on repair.status_changed to prevent duplicate spam", async () => {
  let capturedDocInput: any = null;
  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: true,
      event_repair_completed_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedDocInput = input;
      return { record: { id: "doc_test" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_1",
          ticket_number: 101,
          status: "in_progress",
          total_estimate: 80,
          customer_id: null,
          device: { model_name: "MacBook Pro" },
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

  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_1", status: "in_progress" } },
    container: mockContainer,
  } as any);

  assert.ok(capturedDocInput, "generateDocument should have been called");
  assert.strictEqual(
    capturedDocInput.auto_send,
    false,
    "Fix 1 failed: auto_send MUST be false on repair.status_changed to avoid double notifications"
  );
});

test("Fix 3: Order documents subscriber suppresses duplicate order receipt when order represents repair payment", async () => {
  let docGenerated = false;
  const mockDocService = {
    getSettings: async () => ({
      event_payment_captured_enabled: true,
      event_order_placed_enabled: true,
    }),
    generateDocument: async () => {
      docGenerated = true;
      return { record: { id: "doc_order" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "order_repair_pay_01",
          display_id: 2001,
          total: 150,
          metadata: {
            repair_ticket_id: "rep_ticket_99",
          },
          items: [{ title: "Repair Deposit", quantity: 1, unit_price: 150 }],
        },
      ],
    }),
  };

  let loggedInfo = "";
  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") {
        return {
          info: (msg: string) => {
            loggedInfo += msg + " ";
          },
          warn: () => {},
          error: () => {},
        };
      }
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      return null;
    },
  };

  await orderDocumentsSubscriber({
    event: { name: "payment.captured", data: { id: "order_repair_pay_01" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(
    docGenerated,
    false,
    "Fix 3 failed: Order receipt should be suppressed when metadata.repair_ticket_id is present"
  );
  assert.ok(
    loggedInfo.includes("Suppressing duplicate store receipt"),
    "Expected suppression log message not found"
  );
});

test("Fix 4: Repair subscriber correctly maps inventory parts from ticket.product_variants (SKU, title, price, quantity) and custom_parts", async () => {
  let capturedItems: any[] = [];
  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: true,
      event_repair_completed_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedItems = input.items;
      return { record: { id: "doc_test" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_parts_test",
          ticket_number: 102,
          status: "in_progress",
          total_estimate: 210,
          product_variants: [
            {
              id: "var_screen_1",
              title: "OEM OLED Display",
              sku: "SCR-OLED-01",
              unit_price: 120,
              quantity: 1,
            },
            {
              id: "var_battery_1",
              title: "OEM Battery Pack",
              sku: "BAT-OEM-02",
              price: 50,
              quantity: 1,
            },
          ],
          custom_parts: [
            {
              name: "Thermal Paste Application",
              sku: "SRV-THERM",
              price: 15,
              quantity: 1,
            },
          ],
          labor_estimate: 25,
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

  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_parts_test", status: "in_progress" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(capturedItems.length, 4, "Expected 4 line items (2 inventory parts + 1 custom service + 1 labor)");

  const oledPart = capturedItems.find((it) => it.title === "OEM OLED Display");
  assert.ok(oledPart, "OLED Display variant part not found in line items");
  assert.strictEqual(oledPart.description, "SKU: SCR-OLED-01");
  assert.strictEqual(oledPart.unit_price, 120);

  const batPart = capturedItems.find((it) => it.title === "OEM Battery Pack");
  assert.ok(batPart, "Battery variant part not found in line items");
  assert.strictEqual(batPart.unit_price, 50);

  const customPart = capturedItems.find((it) => it.title === "Thermal Paste Application");
  assert.ok(customPart, "Custom part not found in line items");
  assert.strictEqual(customPart.unit_price, 15);

  const laborPart = capturedItems.find((it) => it.title === "Labor Charge");
  assert.ok(laborPart, "Labor charge not found in line items");
  assert.strictEqual(laborPart.unit_price, 25);
});

test("Fix 5: Repair completion via repair.status_changed with status: 'completed' generates final repair invoice", async () => {
  let capturedDocInput: any = null;
  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: false, // Normal status change disabled
      event_repair_completed_enabled: true, // But completed is enabled!
    }),
    generateDocument: async (input: any) => {
      capturedDocInput = input;
      return { record: { id: "doc_test" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_completed_1",
          ticket_number: 103,
          status: "completed",
          total_actual: 180,
          payment_status: "unpaid",
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

  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_completed_1", status: "completed" } },
    container: mockContainer,
  } as any);

  assert.ok(capturedDocInput, "Fix 5 failed: document should be generated when status is completed");
  assert.strictEqual(capturedDocInput.type, "invoice");
  assert.strictEqual(capturedDocInput.title, "Final Repair Invoice");
});

test("Fix 6: WhatsApp dispatch fails gracefully without unhandled errors if no WhatsApp provider is registered", async () => {
  let loggedWarning = "";
  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      if (payload.channel === "whatsapp") {
        throw new Error("Could not find a notification provider for channel: whatsapp");
      }
      return { id: "notif_ok" };
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") {
        return {
          info: () => {},
          warn: (msg: string) => {
            loggedWarning += msg + " ";
          },
          error: () => {},
        };
      }
      if (key === "notification" || key === "@medusajs/notification") {
        return mockNotificationModule;
      }
      return null;
    },
  };

  const result = await NotificationSender.send({
    container: mockContainer,
    document: {
      id: "doc_wa_test",
      display_id: "DOC-9911",
      type: "invoice",
      customer_name: "Arthur Dent",
      customer_email: "arthur@galaxy.org",
      customer_phone: "+447123456789",
      total_amount: 42,
    },
    channels: ["email", "whatsapp"],
  });

  // Email succeeds, WhatsApp fails gracefully without crashing
  assert.deepStrictEqual(result.sent, ["email"]);
  assert.strictEqual(result.failed.length, 1);
  assert.ok(result.failed[0].includes("whatsapp"));
  assert.ok(loggedWarning.includes("WhatsApp provider is not registered"));
});

test("Fix 2: ZohoBooksService.registerPayment structures payload and registers payment correctly", async () => {
  const zoho = new ZohoBooksService({
    client_id: "dummy_client",
    client_secret: "dummy_secret",
    refresh_token: "dummy_token",
    organization_id: "dummy_org",
  });

  // Mock the request method to verify the request payload
  let interceptedMethod = "";
  let interceptedEndpoint = "";
  let interceptedBody: any = null;

  (zoho as any).request = async (method: string, endpoint: string, body?: any) => {
    interceptedMethod = method;
    interceptedEndpoint = endpoint;
    interceptedBody = body;
    return {
      code: 0,
      payment: {
        payment_id: "pay_zoho_12345",
      },
    };
  };

  const paymentId = await zoho.registerPayment("inv_zoho_99", 149.99, "contact_55", "Online", "RCPT-1001");

  assert.strictEqual(paymentId, "pay_zoho_12345");
  assert.strictEqual(interceptedMethod, "POST");
  assert.strictEqual(interceptedEndpoint, "/customerpayments");
  assert.strictEqual(interceptedBody.customer_id, "contact_55");
  assert.strictEqual(interceptedBody.amount, "149.99");
  assert.strictEqual(interceptedBody.reference_number, "RCPT-1001");
  assert.strictEqual(interceptedBody.invoices[0].invoice_id, "inv_zoho_99");
  assert.strictEqual(interceptedBody.invoices[0].amount_applied, "149.99");
});

test("Fix 1 Edge Case: repair.customer_reminder auto-sends document to notify customer", async () => {
  let capturedDocInput: any = null;
  const mockDocService = {
    getSettings: async () => ({
      event_repair_reminder_enabled: true,
      event_repair_status_changed_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedDocInput = input;
      return { record: { id: "doc_reminder" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_remind_01",
          ticket_number: 105,
          status: "awaiting_approval",
          total_estimate: 110,
          customer_id: null,
          device: { model_name: "iPad Air" },
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

  await repairDocumentsSubscriber({
    event: { name: "repair.customer_reminder", data: { id: "rep_remind_01" } },
    container: mockContainer,
  } as any);

  assert.ok(capturedDocInput, "generateDocument should be invoked");
  assert.strictEqual(
    capturedDocInput.auto_send,
    false,
    "repair.customer_reminder MUST have auto_send: false as repair plugin handles customer notifications"
  );
  assert.strictEqual(capturedDocInput.type, "estimate");
});

test("Fix 1 Handover: repair subscriber hands over generated document link and metadata to repair ticket", async () => {
  let updatedTicketId: string | null = null;
  let updatedTicketMetadata: any = null;

  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: true,
      event_repair_completed_enabled: true,
    }),
    generateDocument: async () => {
      return {
        record: {
          id: "doc_rec_123",
          title: "Repair Invoice",
          pdf_url: "http://localhost:3000/api/admin/documents/doc_rec_123/document",
          short_pdf_link: "http://localhost:3000/r/xyz123",
        },
      };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_handover_01",
          ticket_number: 999,
          status: "ready",
          customer_id: null,
          device: { model_name: "MacBook Air" },
          metadata: { initial_field: "value" },
        },
      ],
    }),
  };

  const mockRepairModule = {
    retrieveRepairTicket: async (id: string) => ({
      id,
      metadata: { initial_field: "value" },
    }),
    updateRepairTickets: async (payload: any) => {
      updatedTicketId = payload.id;
      updatedTicketMetadata = payload.metadata;
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      if (key === "repair") return mockRepairModule;
      return null;
    },
  };

  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_handover_01", status: "ready" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(updatedTicketId, "rep_handover_01");
  assert.strictEqual(updatedTicketMetadata.document_id, "doc_rec_123");
  assert.strictEqual(updatedTicketMetadata.pdf_url, "http://localhost:3000/api/admin/documents/doc_rec_123/document");
  assert.strictEqual(updatedTicketMetadata.short_pdf_link, "http://localhost:3000/r/xyz123");
  assert.strictEqual(updatedTicketMetadata.initial_field, "value");
});

test("Fix 4 Enhancement: variant title preserves product title when variant is Default Variant or option name", async () => {
  let capturedItems: any[] = [];
  const mockDocService = {
    getSettings: async () => ({
      event_repair_status_changed_enabled: true,
      event_repair_completed_enabled: true,
    }),
    generateDocument: async (input: any) => {
      capturedItems = input.items;
      return { record: { id: "doc_title_test" } };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "rep_titles_test",
          ticket_number: 106,
          status: "in_progress",
          product_variants: [
            {
              id: "var_def",
              title: "Default Variant",
              product: { title: "iPhone 14 Pro OLED Display" },
              sku: "IP14P-OLED",
              unit_price: 199,
              quantity: 1,
            },
            {
              id: "var_opt",
              title: "Midnight Black",
              product: { title: "Back Glass Panel" },
              sku: "GLS-MID-01",
              price: 45,
              quantity: 1,
            },
          ],
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

  await repairDocumentsSubscriber({
    event: { name: "repair.status_changed", data: { id: "rep_titles_test", status: "in_progress" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(capturedItems.length, 2);
  // Default Variant should not hide the product title!
  assert.strictEqual(capturedItems[0].title, "iPhone 14 Pro OLED Display");
  // Option name should be nicely appended
  assert.strictEqual(capturedItems[1].title, "Back Glass Panel (Midnight Black)");
});
