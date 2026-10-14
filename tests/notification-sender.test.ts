import assert from "node:assert";
import { test } from "node:test";
import { NotificationSender, renderTemplatePlaceholders } from "../src/services/notification-sender";

test("renderTemplatePlaceholders replaces all placeholders correctly", () => {
  const template = "Hello {customer_name}, your {document_title} #{display_id} of {total_amount} is ready from {company_name}. Pay: {payment_link}";
  const vars = {
    customer_name: "Alice Smith",
    document_title: "Tax Invoice",
    display_id: "INV-2045",
    total_amount: "$150.00",
    company_name: "Urban Device Care Ltd",
    payment_link: "https://pay.example.com/123",
  };

  const rendered = renderTemplatePlaceholders(template, vars);
  assert.strictEqual(
    rendered,
    "Hello Alice Smith, your Tax Invoice #INV-2045 of $150.00 is ready from Urban Device Care Ltd. Pay: https://pay.example.com/123"
  );

  // Test case-insensitive placeholders
  const renderedUpper = renderTemplatePlaceholders("Hi {CUSTOMER_NAME} at {COMPANY_NAME}", vars);
  assert.strictEqual(renderedUpper, "Hi Alice Smith at Urban Device Care Ltd");

  // Test missing keys are emptied
  const renderedMissing = renderTemplatePlaceholders("Hi {customer_name}, notes: {non_existent}", vars);
  assert.strictEqual(renderedMissing, "Hi Alice Smith, notes: ");
});

test("NotificationSender skips when notification module is not registered without crashing", async () => {
  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") {
        return {
          info: () => {},
          warn: () => {},
          error: () => {},
        };
      }
      return null;
    },
  };

  const result = await NotificationSender.send({
    container: mockContainer,
    document: {
      id: "doc_1",
      display_id: "INV-1001",
      title: "Tax Invoice",
      type: "invoice",
      customer_name: "Test Customer",
      customer_email: "test@example.com",
      customer_phone: "+447123456789",
      total_amount: 150,
      currency_code: "usd",
      payment_status: "unpaid",
      short_payment_link: "https://store.example.com/r/abc123",
      short_pdf_link: "https://store.example.com/r/doc456",
    },
    channels: ["email", "sms", "whatsapp"],
    settings: {
      company_name: "Urban Device Care Ltd",
    },
  });

  assert.ok(result);
  assert.strictEqual(result.sent.length, 0);
  assert.ok(result.failed.length > 0);
});

test("NotificationSender uses custom email, sms, and whatsapp templates when provided", async () => {
  const capturedNotifications: any[] = [];
  const mockNotificationModule = {
    createNotifications: async (payload: any) => {
      capturedNotifications.push(payload);
      return { id: "notif_1" };
    },
  };

  const mockContainer: any = {
    resolve: (key: string) => {
      if (key === "logger") {
        return {
          info: () => {},
          warn: () => {},
          error: () => {},
        };
      }
      if (key === "notification" || key === "@medusajs/notification") {
        return mockNotificationModule;
      }
      return null;
    },
  };

  const settings = {
    company_name: "Urban Device Care",
    email_subject_template: "Important: {document_title} #{display_id} for {customer_name}",
    email_body_template: "<p>Dear {customer_name}, please review {document_title} #{display_id}. Amount: {total_amount}.</p>",
    sms_body_template: "{company_name}: Hi {customer_name}, {document_title} #{display_id} ({total_amount}) is ready.",
    whatsapp_body_template: "*{company_name}*\nHi *{customer_name}*, your *{document_title}* #{display_id} is ready to view.",
  };

  const doc = {
    id: "doc_42",
    display_id: "INV-9900",
    title: "Tax Invoice",
    type: "invoice",
    customer_name: "Sarah Connor",
    customer_email: "sarah@example.com",
    customer_phone: "+447911999888",
    total_amount: 250,
    currency_code: "usd",
    payment_status: "unpaid",
    short_payment_link: "https://store.example.com/pay/sarah",
    short_pdf_link: "https://store.example.com/doc/sarah",
  };

  const res = await NotificationSender.send({
    container: mockContainer,
    document: doc,
    channels: ["email", "sms", "whatsapp"],
    settings,
  });

  assert.deepStrictEqual(res.sent, ["email", "sms", "whatsapp"]);
  assert.strictEqual(res.failed.length, 0);

  // Validate Email
  const emailNotif = capturedNotifications.find((n) => n.channel === "email");
  assert.ok(emailNotif);
  assert.strictEqual(emailNotif.content.subject, "Important: Tax Invoice #INV-9900 for Sarah Connor");
  assert.ok(emailNotif.content.html.includes("Dear Sarah Connor, please review Tax Invoice #INV-9900."));

  // Validate SMS
  const smsNotif = capturedNotifications.find((n) => n.channel === "sms");
  assert.ok(smsNotif);
  assert.strictEqual(smsNotif.data.body, "Urban Device Care: Hi Sarah Connor, Tax Invoice #INV-9900 ($250.00) is ready.");

  // Validate WhatsApp
  const waNotif = capturedNotifications.find((n) => n.channel === "whatsapp");
  assert.ok(waNotif);
  assert.strictEqual(
    waNotif.data.body,
    "*Urban Device Care*\nHi *Sarah Connor*, your *Tax Invoice* #INV-9900 is ready to view."
  );
});
