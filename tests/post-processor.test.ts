import assert from "node:assert";
import { test } from "node:test";
import { PDFKitGenerator } from "../src/services/pdfkit-generator";
import { postProcessPdf } from "../src/services/pdf-post-processor";

test("postProcessPdf embeds QR code and keeps PDF valid without watermarks", async () => {
  const baseBuf = await PDFKitGenerator.generate({
    display_id: "TEST-01",
    type: "invoice",
    customer: { name: "Test" },
    company: { name: "Company" },
    items: [{ title: "Item 1", quantity: 1, unit_price: 100 }],
    total: 100,
    currency_code: "usd",
  });

  const processed = await postProcessPdf(baseBuf, {
    qrUrl: "https://store.example.com/pay/secure-hash-token",
    obscureZohoFooter: true,
  });

  assert.ok(processed instanceof Buffer, "Processed output must be Buffer");
  assert.ok(processed.length > baseBuf.length, "Processed PDF should be larger due to embedded QR PNG");
  assert.strictEqual(processed.subarray(0, 4).toString(), "%PDF", "Must remain valid PDF");
});
