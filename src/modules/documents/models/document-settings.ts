import { model } from "@medusajs/framework/utils";

export const DocumentSettings = model.define("document_settings", {
  id: model.id().primaryKey(),

  // Notification channels
  email_notifications_enabled: model.boolean().default(true),
  sms_notifications_enabled: model.boolean().default(true),
  whatsapp_notifications_enabled: model.boolean().default(true),

  // Automation / Event Subscribers on/off toggles
  event_order_placed_enabled: model.boolean().default(true),
  event_order_completed_enabled: model.boolean().default(true),
  event_payment_captured_enabled: model.boolean().default(true),
  event_order_fulfillment_enabled: model.boolean().default(true),
  event_repair_status_changed_enabled: model.boolean().default(true),
  event_repair_compliance_enabled: model.boolean().default(true),
  event_repair_created_enabled: model.boolean().default(true),
  event_repair_completed_enabled: model.boolean().default(true),
  event_repair_reminder_enabled: model.boolean().default(true),

  // Zoho Books Credentials
  zoho_books_enabled: model.boolean().default(false),
  zoho_client_id: model.text().nullable(),
  zoho_client_secret: model.text().nullable(),
  zoho_refresh_token: model.text().nullable(),
  zoho_organization_id: model.text().nullable(),
  zoho_domain: model.text().default("com"),

  // Exposed Zoho Customizations
  zoho_invoice_terms: model.text().nullable(),
  zoho_invoice_notes: model.text().nullable(),
  zoho_estimate_terms: model.text().nullable(),
  zoho_payment_terms_days: model.number().default(0),
  zoho_tax_inclusive: model.boolean().default(false),
  zoho_invoice_prefix: model.text().default("INV-"),
  zoho_include_payment_qr: model.boolean().default(true),
  zoho_custom_field_payment_link: model.text().nullable(),

  // Company Details & PDF Branding
  company_name: model.text().default("Company Store"),
  storefront_url: model.text().nullable(),
  pdf_logo_url: model.text().nullable(),
  pdf_address: model.text().nullable(),
  pdf_phone: model.text().nullable(),
  pdf_email: model.text().nullable(),
  pdf_website: model.text().nullable(),
  pdf_payment_details: model.text().nullable(),
  pdf_terms: model.text().nullable(),

  // PDFKit Template Selections
  invoice_template: model.text().default("modern"),
  packing_slip_template: model.text().default("modern"),
  receipt_template: model.text().default("modern"),
  estimate_template: model.text().default("modern"),
  custom_doc_template: model.text().default("modern"),
});

export default DocumentSettings;
