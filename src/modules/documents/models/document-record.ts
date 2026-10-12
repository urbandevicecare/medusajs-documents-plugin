import { model } from "@medusajs/framework/utils";

export const DocumentRecord = model.define("document_record", {
  id: model.id().primaryKey(),
  display_id: model.text(), // e.g. "INV-1001", "DOC-501", "RCPT-1001"
  title: model.text().default("Document"), // e.g. "Tax Invoice", "Packing Slip", "Warranty Certificate"
  type: model.text(), // "invoice" | "receipt" | "estimate" | "packing_slip" | "custom"
  source: model.text().default("pdfkit"), // "zoho" | "pdfkit"
  status: model.text().default("draft"), // "draft" | "sent" | "paid" | "unpaid" | "void"

  // Recipient details
  customer_name: model.text().nullable(),
  customer_email: model.text().nullable(),
  customer_phone: model.text().nullable(),

  // Relationships / references
  order_id: model.text().nullable(),
  repair_ticket_id: model.text().nullable(),
  zoho_document_id: model.text().nullable(), // ID from Zoho Books API

  // Financial fields
  total_amount: model.number().default(0),
  currency_code: model.text().default("usd"),
  payment_status: model.text().default("unpaid"), // "paid" | "unpaid" | "not_applicable"

  // Links
  payment_link: model.text().nullable(),
  short_payment_link: model.text().nullable(),
  pdf_url: model.text().nullable(),
  short_pdf_link: model.text().nullable(),

  // Structured custom data & line items
  metadata: model.json().nullable(),
});

export default DocumentRecord;
