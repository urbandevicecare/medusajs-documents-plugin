import assert from "node:assert";
import { test } from "node:test";
import { NotificationSender } from "../src/services/notification-sender";
import { OrderNotificationTemplates, OrderNotificationVariables } from "../src/services/order-notification-templates";

test("OrderNotificationTemplates generates professional content for all 4 store events", () => {
  const vars: OrderNotificationVariables = {
    order_id: "order_123456",
    display_id: "10042",
    customer_name: "James Bond",
    customer_email: "james@mi6.gov.uk",
    customer_phone: "+447007007007",
    company_name: "Urban Device Care Ltd",
    storefront_url: "https://urbandevicecare.co.uk",
    items_summary: "iPhone 15 Screen Protector (x1), MagSafe Case (x2)",
    items_html: "<table><tr><td>iPhone 15 Case</td><td>2</td><td>$40.00</td></tr></table>",
    total_amount: "$85.00",
    total: "$85.00",
    subtotal: "$75.00",
    tax_total: "$10.00",
    currency: "USD",
    shipping_address: "007 Secret St, London, SW1A 1AA, UK",
    document_link: "https://store.example.com/r/doc10042",
    tracking_number: "TRK-998877",
    tracking_url: "https://courier.example.com/track/TRK-998877",
    carrier: "Royal Mail Special Delivery",
    amount_paid: "$85.00",
    remaining_balance: "$0.00",
    cancellation_reason: "Customer requested alternative model",
  };

  // 1. order.placed
  const placed = OrderNotificationTemplates.resolveNotificationContent("order.placed", vars);
  assert.ok(placed.subject.includes("#10042"));
  assert.ok(placed.subject.includes("Urban Device Care Ltd"));
  assert.ok(placed.emailHtml.includes("Order Confirmed"));
  assert.ok(placed.emailHtml.includes("James Bond"));
  assert.ok(placed.emailHtml.includes("https://store.example.com/r/doc10042"));
  assert.ok(placed.smsText.includes("order #10042 confirmed"));
  assert.ok(placed.smsText.includes("$85.00"));
  assert.ok(placed.whatsappText.includes("*Order Confirmation - Urban Device Care Ltd*"));
  assert.ok(placed.whatsappText.includes("TRK-998877") === false); // No tracking on order placed

  // 2. order.payment_captured
  const paid = OrderNotificationTemplates.resolveNotificationContent("order.payment_captured", vars);
  assert.ok(paid.subject.includes("Payment Receipt"));
  assert.ok(paid.subject.includes("#10042"));
  assert.ok(paid.emailHtml.includes("Payment Confirmed"));
  assert.ok(paid.emailHtml.includes("$85.00"));
  assert.ok(paid.smsText.includes("payment of $85.00 received"));
  assert.ok(paid.whatsappText.includes("*Payment Received"));

  // 3. order.fulfillment_created
  const fulfilled = OrderNotificationTemplates.resolveNotificationContent("order.fulfillment_created", vars);
  assert.ok(fulfilled.subject.includes("Has Shipped"));
  assert.ok(fulfilled.emailHtml.includes("TRK-998877"));
  assert.ok(fulfilled.emailHtml.includes("Royal Mail Special Delivery"));
  assert.ok(fulfilled.smsText.includes("TRK-998877") || fulfilled.smsText.includes("https://courier.example.com"));
  assert.ok(fulfilled.whatsappText.includes("Royal Mail Special Delivery"));
  assert.ok(fulfilled.whatsappText.includes("TRK-998877"));

  // 4. order.canceled
  const canceled = OrderNotificationTemplates.resolveNotificationContent("order.canceled", vars);
  assert.ok(canceled.subject.includes("Canceled"));
  assert.ok(canceled.emailHtml.includes("Customer requested alternative model"));
  assert.ok(canceled.emailHtml.includes("refund of <strong>$85.00</strong>"));
  assert.ok(canceled.smsText.includes("refund of $85.00"));
  assert.ok(canceled.whatsappText.includes("*Order Canceled"));
});

test("OrderNotificationTemplates respects custom settings template overrides", () => {
  const vars: OrderNotificationVariables = {
    order_id: "ord_custom",
    display_id: "5555",
    customer_name: "Bruce Wayne",
    company_name: "Wayne Enterprises",
    storefront_url: "https://wayne.com",
    items_summary: "Batmobile Part (x1)",
    items_html: "",
    total_amount: "$5,000.00",
    total: "$5,000.00",
    currency: "USD",
    document_link: "https://wayne.com/r/inv5555",
  };

  const customSettings = {
    order_placed_email_subject: "Custom Confirmation: Order #{display_id} for {customer_name}",
    order_placed_email_template: "<h1>Thank you {customer_name}</h1><p>Your order #{display_id} is total {total_amount}. View: {document_link}</p>",
    order_placed_sms_template: "Wayne: Order #{display_id} confirmed for {customer_name}. {document_link}",
    order_placed_whatsapp_template: "*Wayne Alert*: {customer_name}, order #{display_id} is {total_amount}.",
  };

  const res = OrderNotificationTemplates.resolveNotificationContent("order.placed", vars, customSettings);
  assert.strictEqual(res.subject, "Custom Confirmation: Order #5555 for Bruce Wayne");
  assert.ok(res.emailHtml.includes("Thank you Bruce Wayne"));
  assert.ok(res.emailHtml.includes("https://wayne.com/r/inv5555"));
  assert.strictEqual(res.smsText, "Wayne: Order #5555 confirmed for Bruce Wayne. https://wayne.com/r/inv5555");
  assert.strictEqual(res.whatsappText, "*Wayne Alert*: Bruce Wayne, order #5555 is $5,000.00.");
});

test("NotificationSender.sendOrderNotification executes multi-channel dispatches correctly", async () => {
  const captured: any[] = [];
  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      captured.push(payload);
      return { id: "notif_" + Math.random().toString(36).substring(7) };
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") {
        return { info: () => {}, warn: () => {}, error: () => {} };
      }
      if (key === "notification" || key === "@medusajs/notification") {
        return mockNotificationModule;
      }
      return null;
    },
  };

  const mockOrder = {
    id: "ord_test_01",
    display_id: 1089,
    email: "customer@example.com",
    currency_code: "usd",
    total: 120,
    subtotal: 100,
    tax_total: 20,
    shipping_total: 0,
    customer: { first_name: "Diana", last_name: "Prince" },
    shipping_address: { phone: "+1234567890", address_1: "Gateway City" },
    items: [{ title: "Lasso of Truth", quantity: 1, unit_price: 120 }],
  };

  const mockDoc = {
    id: "doc_test_01",
    display_id: "INV-1089",
    short_pdf_link: "https://store.example.com/r/inv1089",
  };

  const result = await NotificationSender.sendOrderNotification({
    container: mockContainer,
    event: "order.placed",
    order: mockOrder,
    documentRecord: mockDoc,
    settings: { company_name: "Themyscira Goods" },
    channels: ["email", "sms", "whatsapp"],
  });

  assert.deepStrictEqual(result.sent, ["email", "sms", "whatsapp"]);
  assert.strictEqual(result.failed.length, 0);

  const email = captured.find((c) => c.channel === "email");
  assert.ok(email);
  assert.strictEqual(email.to, "customer@example.com");
  assert.ok(email.content.subject.includes("#1089"));

  const sms = captured.find((c) => c.channel === "sms");
  assert.ok(sms);
  assert.strictEqual(sms.to, "+1234567890");
  assert.ok(sms.data.body.includes("1089"));

  const wa = captured.find((c) => c.channel === "whatsapp");
  assert.ok(wa);
  assert.strictEqual(wa.to, "+1234567890");
  assert.ok(wa.data.body.includes("1089"));
});

test("OrderNotificationTemplates renders payment button and remaining balance in partial payment captured event", () => {
  const vars: OrderNotificationVariables = {
    order_id: "ord_partial_01",
    display_id: "7788",
    customer_name: "Clark Kent",
    customer_email: "clark@dailyplanet.com",
    customer_phone: "+15551234567",
    company_name: "Metropolis Electronics",
    storefront_url: "https://metropolis.com",
    items_summary: "Solar Cell (x1)",
    items_html: "",
    total_amount: "$500.00",
    total: "$500.00",
    currency: "USD",
    amount_paid: "$200.00",
    remaining_balance: "$300.00",
    payment_method: "Credit Card",
    payment_reference: "tx_998811",
    payment_link: "https://metropolis.com/pay/hmac/ord_partial_01",
    payment_button: '<a href="https://metropolis.com/pay/hmac/ord_partial_01">Pay Balance Online</a>',
    document_link: "https://metropolis.com/r/rcpt7788",
  };

  const res = OrderNotificationTemplates.resolveNotificationContent("order.payment_captured", vars);
  assert.ok(res.emailHtml.includes("Amount Paid:"));
  assert.ok(res.emailHtml.includes("$200.00"));
  assert.ok(res.emailHtml.includes("Remaining Balance:"));
  assert.ok(res.emailHtml.includes("$300.00"));
  assert.ok(res.emailHtml.includes("Pay Balance Online"));
  assert.ok(res.emailHtml.includes("Payment Method:"));
  assert.ok(res.emailHtml.includes("Credit Card"));

  // Check SMS has balance and link
  assert.ok(res.smsText.includes("Bal: $300.00"));
  assert.ok(res.smsText.includes("https://metropolis.com/pay/hmac/ord_partial_01"));

  // Check WhatsApp has method, balance and link
  assert.ok(res.whatsappText.includes("Credit Card"));
  assert.ok(res.whatsappText.includes("Remaining Balance:* $300.00"));
  assert.ok(res.whatsappText.includes("Pay Balance:* https://metropolis.com/pay/hmac/ord_partial_01"));
});

test("orderDocumentsSubscriber resolves order from Medusa v2 payment.captured event (data.id = pay_101)", async () => {
  const capturedDocs: any[] = [];
  const capturedNotifs: any[] = [];

  const mockDocService = {
    getSettings: async () => ({
      event_payment_captured_enabled: true,
      company_name: "Urban Device Care Ltd",
    }),
    listDocumentRecords: async () => [],
    generateDocument: async (input: any) => {
      capturedDocs.push(input);
      return { record: { id: "rcpt_rec_01", display_id: input.display_id, short_pdf_link: "https://store/rcpt" } };
    },
  };

  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      capturedNotifs.push(payload);
      return { id: "notif_p" };
    },
  };

  const mockQuery = {
    graph: async (req: any) => {
      if (req.entity === "payment") {
        return {
          data: [
            {
              id: "pay_101",
              amount: 75,
              currency_code: "usd",
              provider_id: "stripe",
              payment_collection: {
                id: "pay_col_101",
                order: { id: "order_resolved_from_pay" },
              },
            },
          ],
        };
      }
      if (req.entity === "order") {
        return {
          data: [
            {
              id: "order_resolved_from_pay",
              display_id: 3001,
              email: "barry@starlabs.gov",
              currency_code: "usd",
              total: 150,
              subtotal: 150,
              items: [{ title: "Tachyon Enhancer", quantity: 1, unit_price: 150 }],
            },
          ],
        };
      }
      return { data: [] };
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      if (key === "notification" || key === "@medusajs/notification") return mockNotificationModule;
      return null;
    },
  };

  const orderDocumentsSubscriber = (await import("../src/subscribers/order-documents")).default;

  await orderDocumentsSubscriber({
    event: { name: "payment.captured", data: { id: "pay_101" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(capturedDocs.length, 1, "Receipt document should be generated");
  assert.strictEqual(capturedDocs[0].type, "receipt");
  assert.strictEqual(capturedDocs[0].total, 75, "Receipt total should reflect the captured payment amount");
  assert.strictEqual(capturedDocs[0].order_id, "order_resolved_from_pay");

  const emailNotif = capturedNotifs.find((n) => n.channel === "email");
  assert.ok(emailNotif, "Email notification should be dispatched");
  assert.strictEqual(emailNotif.to, "barry@starlabs.gov");
  assert.ok(emailNotif.content.subject.includes("#3001"));
});

test("orderDocumentsSubscriber resolves order from Medusa v2 fulfillment.created (data.id = ful_202) and suppresses duplicate on repeat", async () => {
  const capturedDocs: any[] = [];
  let existingRecords: any[] = [];

  const mockDocService = {
    getSettings: async () => ({
      event_order_fulfillment_enabled: true,
      company_name: "Urban Device Care Ltd",
    }),
    listDocumentRecords: async () => existingRecords,
    generateDocument: async (input: any) => {
      capturedDocs.push(input);
      const rec = { id: "pack_rec_01", display_id: input.display_id, short_pdf_link: "https://store/pack" };
      existingRecords = [rec];
      return { record: rec };
    },
  };

  const capturedNotifs: any[] = [];
  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      capturedNotifs.push(payload);
      return { id: "notif_f" };
    },
  };

  const mockQuery = {
    graph: async (req: any) => {
      if (req.entity === "fulfillment") {
        return {
          data: [
            {
              id: "ful_202",
              order: { id: "order_resolved_from_ful" },
              provider_id: "dhl",
              labels: [{ tracking_number: "DHL-889900", tracking_url: "https://dhl.com/track/889900" }],
            },
          ],
        };
      }
      if (req.entity === "order") {
        return {
          data: [
            {
              id: "order_resolved_from_ful",
              display_id: 4002,
              email: "hal@greenlantern.org",
              currency_code: "usd",
              total: 250,
              items: [{ title: "Power Battery", quantity: 1, unit_price: 250 }],
            },
          ],
        };
      }
      return { data: [] };
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      if (key === "notification" || key === "@medusajs/notification") return mockNotificationModule;
      return null;
    },
  };

  const orderDocumentsSubscriber = (await import("../src/subscribers/order-documents")).default;

  // 1. First trigger: fulfillment.created
  await orderDocumentsSubscriber({
    event: { name: "fulfillment.created", data: { id: "ful_202" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(capturedDocs.length, 1, "Packing slip should be generated on first fulfillment event");
  assert.strictEqual(capturedDocs[0].type, "packing_slip");

  const email = capturedNotifs.find((n) => n.channel === "email");
  assert.ok(email, "Fulfillment email should be sent");
  assert.strictEqual(email.to, "hal@greenlantern.org");
  assert.ok(email.content.html.includes("DHL-889900"));

  // 2. Duplicate trigger: order.fulfillment_created for same fulfillment without new tracking info
  await orderDocumentsSubscriber({
    event: { name: "order.fulfillment_created", data: { id: "ful_202" } },
    container: mockContainer,
  } as any);

  // capturedDocs should remain 1 because duplicate was suppressed!
  assert.strictEqual(capturedDocs.length, 1, "Duplicate fulfillment event should not regenerate packing slip");
});

test("orderDocumentsSubscriber voids unpaid invoice on order.canceled", async () => {
  let voidedDocId = "";
  let voidedStatus = "";

  const mockDocService = {
    getSettings: async () => ({
      event_order_canceled_enabled: true,
      company_name: "Urban Device Care Ltd",
    }),
    listDocumentRecords: async () => [
      { id: "inv_to_void", type: "invoice", status: "unpaid" },
    ],
    updateDocumentRecords: async (payload: any) => {
      voidedDocId = payload.id;
      voidedStatus = payload.status;
      return { id: payload.id, status: payload.status };
    },
  };

  const capturedNotifs: any[] = [];
  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      capturedNotifs.push(payload);
      return { id: "notif_c" };
    },
  };

  const mockQuery = {
    graph: async () => ({
      data: [
        {
          id: "ord_cancel_01",
          display_id: 5005,
          email: "arthur@curry.org",
          total: 99,
          items: [{ title: "Trident Polish", quantity: 1, unit_price: 99 }],
        },
      ],
    }),
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      if (key === "documents") return mockDocService;
      if (key === "query") return mockQuery;
      if (key === "notification" || key === "@medusajs/notification") return mockNotificationModule;
      return null;
    },
  };

  const orderDocumentsSubscriber = (await import("../src/subscribers/order-documents")).default;

  await orderDocumentsSubscriber({
    event: { name: "order.canceled", data: { id: "ord_cancel_01", reason: "Found alternative" } },
    container: mockContainer,
  } as any);

  assert.strictEqual(voidedDocId, "inv_to_void", "Unpaid invoice should be targeted for voiding");
  assert.strictEqual(voidedStatus, "void", "Invoice status should be set to void");

  const email = capturedNotifs.find((n) => n.channel === "email");
  assert.ok(email, "Cancellation notification should be dispatched");
  assert.ok(email.content.html.includes("Found alternative"));
});
