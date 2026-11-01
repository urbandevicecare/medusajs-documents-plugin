import assert from "node:assert";
import { test } from "node:test";
import { PDFKitGenerator, DocumentData } from "../src/services/pdfkit-generator";
import * as adminDocRoute from "../src/api/admin/documents/[id]/document/route";
import * as adminPreviewRoute from "../src/api/admin/documents/templates/preview/route";
import * as publicDocRoute from "../src/api/documents/[id]/document/route";
import * as publicPreviewRoute from "../src/api/documents/templates/preview/route";
import middlewaresConfig from "../src/api/middlewares";

test("Release 1.1.30 - Route files export AUTHENTICATE = false to prevent 401 on browser PDF loading", () => {
  assert.strictEqual(adminDocRoute.AUTHENTICATE, false, "adminDocRoute must export AUTHENTICATE = false");
  assert.strictEqual(adminPreviewRoute.AUTHENTICATE, false, "adminPreviewRoute must export AUTHENTICATE = false");
  assert.strictEqual(publicDocRoute.AUTHENTICATE, false, "publicDocRoute must export AUTHENTICATE = false");
  assert.strictEqual(publicPreviewRoute.AUTHENTICATE, false, "publicPreviewRoute must export AUTHENTICATE = false");
});

test("Release 1.1.30 - middlewares.ts registers unauthenticated allowlist for admin document & preview endpoints", () => {
  assert.ok(middlewaresConfig, "middlewaresConfig must be defined");
  const routes = (middlewaresConfig as any).routes || [];
  const matchers = routes.map((r: any) => r.matcher);
  assert.ok(matchers.includes("/admin/documents/:id/document"), "Must include /admin/documents/:id/document in middlewares");
  assert.ok(matchers.includes("/admin/documents/templates/preview"), "Must include /admin/documents/templates/preview in middlewares");
});

test("Release 1.1.30 - PDFKitGenerator.formatCurrency handles undefined, null, and NaN amounts without throwing", () => {
  assert.ok(PDFKitGenerator.formatCurrency(undefined, "KES").includes("0.00"));
  assert.ok(PDFKitGenerator.formatCurrency(null, "KES").includes("0.00"));
  assert.ok(PDFKitGenerator.formatCurrency(NaN, "KES").includes("0.00"));
  assert.ok(PDFKitGenerator.formatCurrency(3500, "KES").includes("3,500.00"));
});

test("Release 1.1.30 - PDFKitGenerator generates valid PDF with zero items across all templates", async () => {
  const emptyData: DocumentData = {
    display_id: "INV-EMPTY-001",
    title: "Empty Document",
    type: "invoice",
    date: "2026-11-01",
    customer: { name: "Test Customer" },
    company: { name: "Urban Device Care" },
    items: [],
    total: 0,
    currency_code: "kes",
  };

  const templates = ["zoho_exact", "modern", "classic", "minimal", "standard"] as const;
  for (const tmpl of templates) {
    const buf = await PDFKitGenerator.generate(emptyData, tmpl);
    assert.ok(buf instanceof Buffer, `${tmpl} output must be a Buffer`);
    assert.ok(buf.length > 500, `${tmpl} PDF must not be empty`);
    assert.strictEqual(buf.subarray(0, 4).toString(), "%PDF", `${tmpl} must have valid %PDF header`);
  }
});

test("Release 1.1.30 - PDFKitGenerator generates valid PDF with missing items and incomplete item fields", async () => {
  const missingItemsData: any = {
    display_id: "RT-1793466012168-TS9RXZ",
    title: "Repair Invoice",
    type: "invoice",
    customer: {},
    company: {},
    items: [
      { unit_price: 1500 }, // missing title & quantity
      { title: "", quantity: 2 }, // empty title & missing unit_price
      { description: "Diagnostic note only" }, // missing title, price, quantity
    ],
    total: 3000,
    currency_code: "kes",
  };

  const buf = await PDFKitGenerator.generate(missingItemsData, "zoho_exact");
  assert.ok(buf instanceof Buffer, "zoho_exact output must be a Buffer");
  assert.ok(buf.length > 1000, "PDF with incomplete items must not be empty");
  assert.strictEqual(buf.subarray(0, 4).toString(), "%PDF", "Must have valid %PDF header");

  const modernBuf = await PDFKitGenerator.generate(missingItemsData, "modern");
  assert.ok(modernBuf.length > 1000);
  assert.strictEqual(modernBuf.subarray(0, 4).toString(), "%PDF");

  const jobCardBuf = await PDFKitGenerator.generate({ ...missingItemsData, type: "job_card" }, "standard");
  assert.ok(jobCardBuf.length > 1000);
  assert.strictEqual(jobCardBuf.subarray(0, 4).toString(), "%PDF");
});
