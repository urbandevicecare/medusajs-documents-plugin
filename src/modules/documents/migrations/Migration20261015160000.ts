import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261015160000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" add column if not exists "event_order_canceled_enabled" boolean not null default true;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_placed_email_subject" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_placed_email_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_placed_sms_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_placed_whatsapp_template" text null;`);

    this.addSql(`alter table if exists "document_settings" add column if not exists "order_payment_email_subject" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_payment_email_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_payment_sms_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_payment_whatsapp_template" text null;`);

    this.addSql(`alter table if exists "document_settings" add column if not exists "order_fulfillment_email_subject" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_fulfillment_email_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_fulfillment_sms_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_fulfillment_whatsapp_template" text null;`);

    this.addSql(`alter table if exists "document_settings" add column if not exists "order_canceled_email_subject" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_canceled_email_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_canceled_sms_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "order_canceled_whatsapp_template" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" drop column if exists "event_order_canceled_enabled";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_placed_email_subject";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_placed_email_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_placed_sms_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_placed_whatsapp_template";`);

    this.addSql(`alter table if exists "document_settings" drop column if exists "order_payment_email_subject";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_payment_email_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_payment_sms_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_payment_whatsapp_template";`);

    this.addSql(`alter table if exists "document_settings" drop column if exists "order_fulfillment_email_subject";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_fulfillment_email_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_fulfillment_sms_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_fulfillment_whatsapp_template";`);

    this.addSql(`alter table if exists "document_settings" drop column if exists "order_canceled_email_subject";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_canceled_email_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_canceled_sms_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "order_canceled_whatsapp_template";`);
  }

}
