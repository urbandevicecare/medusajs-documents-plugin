import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261014150000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" add column if not exists "email_subject_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "email_body_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "sms_body_template" text null;`);
    this.addSql(`alter table if exists "document_settings" add column if not exists "whatsapp_body_template" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" drop column if exists "email_subject_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "email_body_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "sms_body_template";`);
    this.addSql(`alter table if exists "document_settings" drop column if exists "whatsapp_body_template";`);
  }

}
