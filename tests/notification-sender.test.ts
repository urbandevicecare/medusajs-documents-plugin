import assert from "node:assert";
import { test } from "node:test";
import { NotificationSender } from "../src/services/notification-sender";

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
