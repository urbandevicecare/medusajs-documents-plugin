import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261101100000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" add column if not exists "store_invoice_prefix" text not null default 'ST-';`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "document_settings" drop column if exists "store_invoice_prefix";`);
  }

}
