import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261012164601 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "document_link" drop constraint if exists "document_link_shortcode_unique";`);
    this.addSql(`create table if not exists "document_link" ("id" text not null, "shortcode" text not null, "url" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "document_link_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_document_link_shortcode_unique" ON "document_link" ("shortcode") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_link_deleted_at" ON "document_link" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "document_record" ("id" text not null, "display_id" text not null, "title" text not null default 'Document', "type" text not null, "source" text not null default 'pdfkit', "status" text not null default 'draft', "customer_name" text null, "customer_email" text null, "customer_phone" text null, "order_id" text null, "repair_ticket_id" text null, "zoho_document_id" text null, "total_amount" integer not null default 0, "currency_code" text not null default 'usd', "payment_status" text not null default 'unpaid', "payment_link" text null, "short_payment_link" text null, "pdf_url" text null, "short_pdf_link" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "document_record_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_record_deleted_at" ON "document_record" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "document_settings" ("id" text not null, "email_notifications_enabled" boolean not null default true, "sms_notifications_enabled" boolean not null default true, "whatsapp_notifications_enabled" boolean not null default true, "event_order_placed_enabled" boolean not null default true, "event_order_completed_enabled" boolean not null default true, "event_payment_captured_enabled" boolean not null default true, "event_order_fulfillment_enabled" boolean not null default true, "event_repair_status_changed_enabled" boolean not null default true, "event_repair_compliance_enabled" boolean not null default true, "event_repair_created_enabled" boolean not null default true, "event_repair_completed_enabled" boolean not null default true, "event_repair_reminder_enabled" boolean not null default true, "zoho_books_enabled" boolean not null default false, "zoho_client_id" text null, "zoho_client_secret" text null, "zoho_refresh_token" text null, "zoho_organization_id" text null, "zoho_domain" text not null default 'com', "zoho_invoice_terms" text null, "zoho_invoice_notes" text null, "zoho_estimate_terms" text null, "zoho_payment_terms_days" integer not null default 0, "zoho_tax_inclusive" boolean not null default false, "zoho_invoice_prefix" text not null default 'INV-', "zoho_include_payment_qr" boolean not null default true, "zoho_custom_field_payment_link" text null, "company_name" text not null default 'Company Store', "storefront_url" text null, "pdf_logo_url" text null, "pdf_address" text null, "pdf_phone" text null, "pdf_email" text null, "pdf_website" text null, "pdf_payment_details" text null, "pdf_terms" text null, "invoice_template" text not null default 'modern', "packing_slip_template" text not null default 'modern', "receipt_template" text not null default 'modern', "estimate_template" text not null default 'modern', "job_card_template" text not null default 'modern', "custom_doc_template" text not null default 'modern', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "document_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_document_settings_deleted_at" ON "document_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "document_link" cascade;`);
    this.addSql(`drop table if exists "document_record" cascade;`);
    this.addSql(`drop table if exists "document_settings" cascade;`);
  }

}
