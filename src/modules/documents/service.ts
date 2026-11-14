import { MedusaService, ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils";
import { DocumentSettings } from "./models/document-settings";
import { DocumentRecord } from "./models/document-record";
import { DocumentLink } from "./models/document-link";
import { ZohoBooksService } from "../../services/zoho-books";
import { PDFKitGenerator, DocumentData, LineItem } from "../../services/pdfkit-generator";
import { postProcessPdf } from "../../services/pdf-post-processor";
import { NotificationSender } from "../../services/notification-sender";
import { sanitizePhoneNumber } from "../../utils/phone-sanitizer";
import { generateOrderPaymentLink } from "../../utils/payment-link";

// In-memory cache for generated PDF buffers to avoid redundant Zoho Books API round-trips
// and ensure byte-identical responses across rapid consecutive requests (TTL: 60 seconds)
const pdfBufferCache = new Map<string, { buffer: Buffer; expiresAt: number }>();

export function invalidatePdfCache(documentId?: string) {
  if (documentId) {
    for (const key of pdfBufferCache.keys()) {
      if (key.startsWith(documentId)) {
        pdfBufferCache.delete(key);
      }
    }
  } else {
    pdfBufferCache.clear();
  }
}

export interface GenerateDocumentInput {
  display_id?: string;
  title?: string;
  type: "invoice" | "receipt" | "estimate" | "packing_slip" | "custom" | "job_card" | "service_report" | "handover";
  customer?: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items?: LineItem[];
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  total?: number;
  amount_paid?: number;
  currency_code?: string;
  order_id?: string;
  repair_ticket_id?: string;
  zoho_document_id?: string;
  payment_status?: string;
  payment_method?: string;
  payment_link?: string;
  payment_reference?: string;
  notes?: string;
  terms?: string;
  body_text?: string;
  custom_fields?: Record<string, string>;
  force_source?: "zoho" | "pdfkit";
  auto_send?: boolean;
  notification_channels?: Array<"email" | "sms" | "whatsapp">;
  email_subject?: string;
  custom_email_message?: string;
  date?: string;
  _skip_quote_creation?: boolean;
}

export interface UpdateDocumentInput {
  title?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer?: {
    name?: string;
    company_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items?: LineItem[];
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  total?: number;
  amount_paid?: number;
  currency_code?: string;
  payment_status?: string;
  payment_link?: string;
  payment_reference?: string;
  notes?: string;
  terms?: string;
  body_text?: string;
  custom_fields?: Record<string, string>;
  force_source?: "zoho" | "pdfkit";
}

/**
 * Safely resolves the Knex database connection from a Medusa container or scope.
 * Tries ContainerRegistrationKeys.PG_CONNECTION ("__pg_connection__") and fallback keys.
 * Never throws AwilixResolutionError.
 */
export function getDatabaseConnection(container: any): any {
  if (!container) {
    return undefined;
  }

  // If passed an object containing __container__ (like a service instance), extract it
  try {
    if (container.__container__) {
      const nested = getDatabaseConnection(container.__container__);
      if (nested) return nested;
    }
  } catch (_) {}

  // If passed an object containing scope (like MedusaRequest), extract it
  try {
    if (container.scope) {
      const nested = getDatabaseConnection(container.scope);
      if (nested) return nested;
    }
  } catch (_) {}

  // 1. Try resolve method on container / req.scope (guarded by try-catch because cradle proxies throw on unknown property access)
  try {
    if (typeof container.resolve === "function") {
      try {
        const conn = container.resolve(ContainerRegistrationKeys.PG_CONNECTION, { allowUnregistered: true });
        if (typeof conn === "function") return conn;
      } catch (_) {}

      try {
        const conn = container.resolve("__pg_connection__", { allowUnregistered: true });
        if (typeof conn === "function") return conn;
      } catch (_) {}

      try {
        const conn = container.resolve("pg_connection", { allowUnregistered: true });
        if (typeof conn === "function") return conn;
      } catch (_) {}
    }
  } catch (_) {}

  // 2. Try cradle proxy if available (each property access guarded)
  try {
    const cradle = container.cradle;
    if (cradle) {
      try {
        const conn = cradle[ContainerRegistrationKeys.PG_CONNECTION];
        if (typeof conn === "function") return conn;
      } catch (_) {}
      try {
        const conn = cradle["__pg_connection__"];
        if (typeof conn === "function") return conn;
      } catch (_) {}
      try {
        const conn = cradle["pg_connection"];
        if (typeof conn === "function") return conn;
      } catch (_) {}
    }
  } catch (_) {}

  // 3. Try direct property index on container (each property access guarded)
  try {
    const conn = container[ContainerRegistrationKeys.PG_CONNECTION];
    if (typeof conn === "function") return conn;
  } catch (_) {}
  try {
    const conn = container["__pg_connection__"];
    if (typeof conn === "function") return conn;
  } catch (_) {}
  try {
    const conn = container["pg_connection"];
    if (typeof conn === "function") return conn;
  } catch (_) {}

  return undefined;
}

/**
 * Detects whether a database error is PostgreSQL 42P01 (undefined_table)
 */
export function isUndefinedTableError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err.cause?.code || err.original?.code;
  if (code === "42P01") return true;

  const msg = String(err.message || err.detail || err.cause?.message || err.original?.message || "");
  if (msg.includes("42P01")) return true;
  if (/relation ["'].*?["'] does not exist/i.test(msg)) return true;
  if (/relation .*? does not exist/i.test(msg)) return true;
  if (/table .*? does not exist/i.test(msg)) return true;
  if (err.name === "TableNotFoundException") return true;

  return false;
}

export const DEFAULT_DOCUMENT_SETTINGS: Record<string, any> = {
  id: "default",
  company_name: "Store",
  email_notifications_enabled: true,
  sms_notifications_enabled: true,
  whatsapp_notifications_enabled: true,
  event_order_placed_enabled: true,
  event_order_completed_enabled: true,
  event_payment_captured_enabled: true,
  event_order_fulfillment_enabled: true,
  event_order_canceled_enabled: true,
  event_repair_status_changed_enabled: true,
  event_repair_compliance_enabled: true,
  event_repair_created_enabled: true,
  event_repair_completed_enabled: true,
  event_repair_reminder_enabled: true,
  invoice_template: "zoho_exact",
  packing_slip_template: "modern",
  receipt_template: "zoho_exact",
  estimate_template: "zoho_exact",
  job_card_template: "standard",
  custom_doc_template: "modern",
  zoho_books_enabled: true,
  zoho_client_id: null,
  zoho_client_secret: null,
  zoho_refresh_token: null,
  zoho_organization_id: null,
  zoho_domain: "com",
  zoho_invoice_terms: null,
  zoho_invoice_notes: null,
  zoho_estimate_terms: null,
  zoho_payment_terms_days: 0,
  zoho_tax_inclusive: false,
  zoho_invoice_prefix: "INV-",
  store_invoice_prefix: "ST-",
  zoho_include_payment_qr: true,
  zoho_custom_field_payment_link: null,
  storefront_url: null,
  pdf_logo_url: null,
  pdf_address: null,
  pdf_phone: null,
  pdf_email: null,
  pdf_website: null,
  pdf_payment_details: null,
  pdf_terms: null,
  email_subject_template: null,
  email_body_template: null,
  sms_body_template: null,
  whatsapp_body_template: null,
  order_placed_email_subject: null,
  order_placed_email_template: null,
  order_placed_sms_template: null,
  order_placed_whatsapp_template: null,
  order_payment_email_subject: null,
  order_payment_email_template: null,
  order_payment_sms_template: null,
  order_payment_whatsapp_template: null,
  order_fulfillment_email_subject: null,
  order_fulfillment_email_template: null,
  order_fulfillment_sms_template: null,
  order_fulfillment_whatsapp_template: null,
  order_canceled_email_subject: null,
  order_canceled_email_template: null,
  order_canceled_sms_template: null,
  order_canceled_whatsapp_template: null,
};

export class DocumentModuleService extends MedusaService({
  DocumentSettings,
  DocumentRecord,
  DocumentLink,
}) {
  /**
   * Helper to fetch repair_settings from module or directly via database
   */
  private async fetchRepairSettings(container?: any): Promise<any> {
    try {
      const repMod = (container || (this as any).__container__)?.resolve?.("repair", { allowUnregistered: true });
      if (repMod) {
        const [repSettings] = await repMod.listRepairSettings({});
        if (repSettings) return repSettings;
      }
    } catch (_) {}

    try {
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        const row = await conn("repair_settings").whereNull("deleted_at").first();
        if (row) return row;
      }
    } catch (_) {}
    return null;
  }

  /**
   * Applies inherited settings from repair_settings into target document_settings
   */
  private applyInheritedRepairSettings(targetSettings: any, repSettings: any): any {
    if (!targetSettings) return targetSettings;
    if (repSettings) {
      if (repSettings.zoho_client_id) {
        targetSettings.zoho_books_enabled = true;
        targetSettings.zoho_client_id = repSettings.zoho_client_id;
        targetSettings.zoho_client_secret = repSettings.zoho_client_secret;
        targetSettings.zoho_refresh_token = repSettings.zoho_refresh_token;
        targetSettings.zoho_organization_id = repSettings.zoho_organization_id;
        targetSettings.zoho_domain = repSettings.zoho_domain || targetSettings.zoho_domain || "com";
        if (repSettings.zoho_tax_inclusive != null) targetSettings.zoho_tax_inclusive = repSettings.zoho_tax_inclusive;
        if (repSettings.zoho_invoice_notes && !targetSettings.zoho_invoice_notes) targetSettings.zoho_invoice_notes = repSettings.zoho_invoice_notes;
        if (repSettings.zoho_invoice_terms && !targetSettings.zoho_invoice_terms) targetSettings.zoho_invoice_terms = repSettings.zoho_invoice_terms;
      }
      if (!targetSettings.pdf_logo_url && repSettings.pdf_logo_url) targetSettings.pdf_logo_url = repSettings.pdf_logo_url;
      if (!targetSettings.pdf_address && repSettings.pdf_address) targetSettings.pdf_address = repSettings.pdf_address;
      if (!targetSettings.pdf_phone && repSettings.pdf_phone) targetSettings.pdf_phone = repSettings.pdf_phone;
      if (!targetSettings.pdf_email && repSettings.pdf_email) targetSettings.pdf_email = repSettings.pdf_email;
      if (!targetSettings.pdf_website && repSettings.pdf_website) targetSettings.pdf_website = repSettings.pdf_website;
      if (!targetSettings.pdf_payment_details && repSettings.pdf_payment_details) targetSettings.pdf_payment_details = repSettings.pdf_payment_details;
      if (!targetSettings.pdf_terms && repSettings.pdf_terms) targetSettings.pdf_terms = repSettings.pdf_terms;
      if (!targetSettings.company_name || targetSettings.company_name === "Company Store" || targetSettings.company_name === "Store") {
        if (repSettings.company_name) targetSettings.company_name = repSettings.company_name;
      }
      if (repSettings.invoice_template && (!targetSettings.invoice_template || targetSettings.invoice_template === "modern")) {
        targetSettings.invoice_template = repSettings.invoice_template;
      }
      if (repSettings.estimate_template && (!targetSettings.estimate_template || targetSettings.estimate_template === "modern")) {
        targetSettings.estimate_template = repSettings.estimate_template;
      }
      if (repSettings.receipt_template && (!targetSettings.receipt_template || targetSettings.receipt_template === "modern")) {
        targetSettings.receipt_template = repSettings.receipt_template;
      }
      if (repSettings.job_card_template && (!targetSettings.job_card_template || targetSettings.job_card_template === "modern")) {
        targetSettings.job_card_template = repSettings.job_card_template;
      }
    }

    // Fall back to environment variables if Zoho Books credentials not yet in DB
    if (!targetSettings.zoho_client_id && process.env.ZOHO_CLIENT_ID) {
      targetSettings.zoho_client_id = process.env.ZOHO_CLIENT_ID;
      targetSettings.zoho_client_secret = targetSettings.zoho_client_secret || process.env.ZOHO_CLIENT_SECRET;
      targetSettings.zoho_refresh_token = targetSettings.zoho_refresh_token || process.env.ZOHO_REFRESH_TOKEN;
      targetSettings.zoho_organization_id = targetSettings.zoho_organization_id || process.env.ZOHO_ORGANIZATION_ID;
      targetSettings.zoho_domain = targetSettings.zoho_domain || process.env.ZOHO_DOMAIN || "com";
    }

    // When Zoho Books credentials exist, ensure zoho_books_enabled is always true (single source of truth)
    if (targetSettings.zoho_client_id && targetSettings.zoho_client_secret && targetSettings.zoho_refresh_token && targetSettings.zoho_organization_id) {
      targetSettings.zoho_books_enabled = true;
    }

    if (targetSettings.pdf_phone) {
      targetSettings.pdf_phone = sanitizePhoneNumber(targetSettings.pdf_phone);
    }
    return targetSettings;
  }

  /**
   * Retrieves or initializes default plugin settings
   */
  async getSettings(sharedContext?: any, container?: any): Promise<any> {
    try {
      const [settings] = await this.listDocumentSettings({}, {}, sharedContext);
      if (settings) {
        const repSettings = await this.fetchRepairSettings(container);
        this.applyInheritedRepairSettings(settings, repSettings);
        return settings;
      }
      const created = await this.createDocumentSettings({
        ...DEFAULT_DOCUMENT_SETTINGS,
      }, sharedContext);
      const repSettings = await this.fetchRepairSettings(container);
      return this.applyInheritedRepairSettings(created, repSettings);
    } catch (err: any) {
      if (isUndefinedTableError(err)) {
        const repSettings = await this.fetchRepairSettings(container);
        return this.applyInheritedRepairSettings({ ...DEFAULT_DOCUMENT_SETTINGS }, repSettings);
      }
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        try {
          let row = await conn("document_settings").whereNull("deleted_at").first();
          if (row) {
            const repSettings = await this.fetchRepairSettings(container);
            return this.applyInheritedRepairSettings(row, repSettings);
          }
          const { id: _ignoreId, ...restDefaults } = DEFAULT_DOCUMENT_SETTINGS;
          const createdResult = await conn("document_settings").insert({
            ...restDefaults,
            id: generateEntityId(undefined, "docset"),
            created_at: new Date(),
            updated_at: new Date(),
          }).returning("*");
          const created = Array.isArray(createdResult) ? createdResult[0] : createdResult;
          const repSettings = await this.fetchRepairSettings(container);
          return this.applyInheritedRepairSettings(created, repSettings);
        } catch (knexErr: any) {
          if (isUndefinedTableError(knexErr)) {
            const repSettings = await this.fetchRepairSettings(container);
            return this.applyInheritedRepairSettings({ ...DEFAULT_DOCUMENT_SETTINGS }, repSettings);
          }
          throw knexErr;
        }
      }
      throw err;
    }
  }

  /**
   * Creates or returns an existing short URL
   */
  async getOrGenerateShortUrl(url: string, baseUrl?: string): Promise<string> {
    if (!url) return url;
    try {
      const existing = await this.listDocumentLinks({ url });
      let root = (baseUrl || process.env.STORE_URL || "http://localhost:3000").replace(/\/$/, "");

      if (existing && existing.length > 0) {
        return `${root}/r/${existing[0].shortcode}`;
      }

      const shortcode = Math.random().toString(36).substring(2, 8);
      await this.createDocumentLinks({
        shortcode,
        url,
      });

      return `${root}/r/${shortcode}`;
    } catch (e) {
      return url;
    }
  }

  /**
   * High-level document generation engine:
   * Handles Zoho Books routing, PDFKit fallback, QR code embedding, shortlinks, and auto-notification.
   */
  async generateDocument(input: GenerateDocumentInput, container?: any): Promise<{
    record: any;
    pdfBuffer: Buffer;
  }> {
    const manager = container?.resolve?.("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};
    const settings = await this.getSettings(sharedContext, container);
    const storeUrl = (settings.storefront_url || process.env.STORE_URL || "http://localhost:3000").replace(/\/$/, "");

    if ((input.type as string) === "quote") {
      input.type = "estimate";
    }

    let repairTicket: any = null;
    // 0. Auto-hydrate repair ticket data if needed
    if (input.repair_ticket_id) {
      try {
        const query = container?.resolve?.(ContainerRegistrationKeys.QUERY);
        if (query) {
          const { data: tickets } = await query.graph({
            entity: "repair_ticket",
            fields: [
              "*",
              "device.*",
              "product_variants.*",
              "product_variants.prices.*",
              "product_variants.product.*",
            ],
            filters: { id: input.repair_ticket_id },
          });
          if (tickets && tickets.length > 0) {
            repairTicket = tickets[0];
            const ticket = tickets[0];
            const cleanTicketNumber = String(ticket.ticket_number || "").replace(/^(JOB-|RT-|CERT-|SRV-|HO-)+/i, "");
            input.display_id = input.display_id || (
              input.type === "job_card" ? `JOB-${cleanTicketNumber}` :
              input.type === "service_report" ? `SRV-${cleanTicketNumber}` :
              input.type === "handover" ? `HO-${cleanTicketNumber}` :
              input.type === "custom" ? `CERT-${cleanTicketNumber}` : `RT-${cleanTicketNumber}`
            );
            input.title = input.title || (
              input.type === "job_card" ? "Repair Job Card" :
              input.type === "service_report" ? "Service & Diagnostic Report" :
              input.type === "handover" ? "Equipment Handover & Inspection" :
              input.type === "custom" ? "Warranty Certificate" : "Repair Document"
            );
            let customerCompanyName: string | undefined =
              ticket.company_name ||
              ticket.customer?.company_name ||
              (ticket.metadata as any)?.company_name;
            let customerName = "Valued Customer";
            let customerEmail: string | undefined = undefined;
            let customerPhone: string | undefined = undefined;
            if (ticket.customer_id) {
              const custMod = container.resolve("customer", { allowUnregistered: true });
              if (custMod) {
                const c = await custMod.retrieveCustomer(ticket.customer_id);
                if (c) {
                  customerCompanyName = customerCompanyName || c.company_name || (c.metadata as any)?.company_name;
                  const personalName = c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : "";
                  customerName = customerCompanyName || personalName || c.email || customerName;
                  customerEmail = c.email || undefined;
                  customerPhone = c.phone || undefined;
                }
              }
            } else if (ticket.customer_name || customerCompanyName) {
              customerName = customerCompanyName || ticket.customer_name;
            }
            if (!input.customer) {
              input.customer = {
                name: customerName,
                company_name: customerCompanyName || undefined,
                email: customerEmail,
                phone: customerPhone,
              };
            }
            if (!input.items || input.items.length === 0) {
              input.items = [];
              // Fix 4: Map inventory parts from product_variants (SKU, title, unit price, quantity)
              if (ticket.product_variants) {
                for (const pv of ticket.product_variants) {
                  const qty = Number(pv.quantity || (pv as any).pivot?.quantity || 1);
                  const unitPrice = Number(pv.unit_price ?? pv.price ?? pv.prices?.[0]?.amount ?? 0);
                  const partTitle = pv.product?.title
                    ? `${pv.product.title}${pv.title && pv.title !== "Default Variant" ? ` (${pv.title})` : ""}`
                    : pv.title || pv.product?.title || "Inventory Part";
                  input.items.push({
                    title: partTitle,
                    description: pv.sku ? `SKU: ${pv.sku}` : (pv.product?.title ? `${pv.title || ""}`.trim() : ""),
                    quantity: qty,
                    unit_price: unitPrice,
                    total: qty * unitPrice,
                  });
                }
              }
              // Map parts from device.parts_used
              if (ticket.device?.parts_used) {
                for (const part of ticket.device.parts_used) {
                  const qty = Number(part.quantity || 1);
                  const unitPrice = Number(part.price || part.unit_price || 0);
                  input.items.push({
                    title: part.name || part.title || "Replacement Part",
                    description: part.sku ? `SKU: ${part.sku}` : "",
                    quantity: qty,
                    unit_price: unitPrice,
                    total: qty * unitPrice,
                  });
                }
              }
              // Map custom parts
              if (ticket.custom_parts) {
                for (const cp of ticket.custom_parts) {
                  const qty = Number(cp.quantity || 1);
                  const unitPrice = Number(cp.price || cp.unit_price || 0);
                  input.items.push({
                    title: cp.name || cp.title || "Custom Service / Part",
                    description: cp.description || (cp.sku ? `SKU: ${cp.sku}` : ""),
                    quantity: qty,
                    unit_price: unitPrice,
                    total: qty * unitPrice,
                  });
                }
              }
              // Labor estimate
              if (Number(ticket.labor_estimate || 0) > 0) {
                input.items.push({
                  title: "Labor Charge",
                  quantity: 1,
                  unit_price: Number(ticket.labor_estimate),
                  total: Number(ticket.labor_estimate),
                });
              }
              if (input.items.length === 0) {
                const tot = Number(ticket.total_actual && ticket.total_actual > 0 ? ticket.total_actual : ticket.total_estimate || 0);
                input.items.push({
                  title: `Diagnostic / Repair Inspection (#${ticket.ticket_number})`,
                  description: ticket.issue_description || "Standard device repair service",
                  quantity: 1,
                  unit_price: tot,
                  total: tot,
                });
              }
            }
            input.custom_fields = {
              "Device Model": ticket.device?.model_name || "N/A",
              "Brand": ticket.device?.brand || "N/A",
              "Serial / IMEI": ticket.device?.serial_number || ticket.device?.imei || "N/A",
              "Condition": ticket.device?.condition || "Not specified",
              "Accessories": ticket.accessories || "None",
              "Technician": ticket.technician_name || "Unassigned",
              "Reported Issue": ticket.issue_description || "Standard Repair",
              ...(input.custom_fields || {}),
            };
            if (input.type === "invoice" && !input.payment_link) {
              const paystackLink =
                (ticket.metadata as any)?.paystack_payment_link ||
                (ticket.metadata as any)?.paystack_url ||
                (ticket.metadata as any)?.payment_link;
              if (paystackLink) {
                input.payment_link = paystackLink;
              } else if (ticket.approval_token) {
                input.payment_link = `${storeUrl}/repairs/track?token=${ticket.approval_token}`;
              }
            }
            if (
              (ticket.payment_status === "captured" || ticket.payment_status === "paid") &&
              !input.payment_status
            ) {
              input.payment_status = "paid";
            }
          }
        }
      } catch (err) {}
    }

    if (!input.customer) {
      const topName = (input as any).customer_name;
      const topEmail = (input as any).customer_email;
      const topPhone = (input as any).customer_phone;
      if (topName || topEmail || topPhone) {
        input.customer = {
          name: topName || "Customer",
          email: topEmail,
          phone: topPhone,
        };
      } else {
        input.customer = { name: "Customer" };
      }
    }
    if (!input.items) {
      input.items = [];
    }

    // Generate unique display ID if not given
    const isRepairTicket = Boolean(input.repair_ticket_id);
    const isStoreOrder = Boolean(input.order_id && !input.repair_ticket_id);

    let defaultPrefix = "DOC-";
    if (input.type === "job_card") {
      defaultPrefix = "JOB-";
    } else if (input.type === "service_report") {
      defaultPrefix = "SRV-";
    } else if (input.type === "handover") {
      defaultPrefix = "HO-";
    } else if (input.type === "receipt") {
      defaultPrefix = "RCPT-";
    } else if (input.type === "packing_slip") {
      defaultPrefix = "PACK-";
    } else if (input.type === "estimate") {
      defaultPrefix = "EST-";
    } else if (input.type === "invoice") {
      if (isRepairTicket) {
        defaultPrefix = "RT-";
      } else if (isStoreOrder) {
        defaultPrefix = settings.store_invoice_prefix || "ST-";
      } else {
        defaultPrefix = settings.zoho_invoice_prefix || "INV-";
      }
    } else if (input.type === "custom") {
      defaultPrefix = isRepairTicket ? "CERT-" : "DOC-";
    } else {
      defaultPrefix = isStoreOrder
        ? (settings.store_invoice_prefix || "ST-")
        : "DOC-";
    }

    let displayId = input.display_id || `${defaultPrefix}${Math.floor(100000 + Math.random() * 900000)}`;
    if (displayId.startsWith("JOB-RT-")) {
      displayId = displayId.replace(/^JOB-RT-/, "JOB-");
    } else if (displayId.startsWith("SRV-RT-")) {
      displayId = displayId.replace(/^SRV-RT-/, "SRV-");
    } else if (displayId.startsWith("HO-RT-")) {
      displayId = displayId.replace(/^HO-RT-/, "HO-");
    } else if (displayId.startsWith("RT-RT-")) {
      displayId = displayId.replace(/^RT-RT-/, "RT-");
    } else if (displayId.startsWith("CERT-RT-")) {
      displayId = displayId.replace(/^CERT-RT-/, "CERT-");
    }

    // Prepare short payment link ONLY for invoice documents
    let shortPaymentLink: string | undefined = undefined;
    if (input.type === "invoice") {
      if (!input.payment_link && isStoreOrder && input.order_id) {
        try {
          const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
          if (conn) {
            const order = await conn("order").where({ id: input.order_id }).first();
            if (order) {
              const orderInfo = generateOrderPaymentLink(order, storeUrl);
              if (orderInfo.paymentLink) {
                input.payment_link = orderInfo.paymentLink;
              }
            }
          }
        } catch (_) {}
      }
      if (input.payment_link) {
        shortPaymentLink = await this.getOrGenerateShortUrl(input.payment_link, storeUrl);
      }
    } else {
      // For all non-invoices, leave payment_link undefined so they use online document shortlink
      input.payment_link = undefined;
    }

    const backendUrl = (process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || process.env.MEDUSA_URL || "http://localhost:9000").replace(/\/$/, "");
    const documentPublicUrl = `${backendUrl}/documents/${displayId}/document`;
    let shortPdfLink: string | undefined = undefined;
    try {
      shortPdfLink = await this.getOrGenerateShortUrl(documentPublicUrl, storeUrl);
    } catch (_) {}

    // Requirement: Always create a quote (estimate) when creating invoices
    if (input.type === "invoice" && !input._skip_quote_creation) {
      try {
        let existingEstimate: any = null;
        if (input.repair_ticket_id) {
          const docs = await this.listDocumentRecords(
            { repair_ticket_id: input.repair_ticket_id, type: "estimate" },
            {},
            sharedContext
          ).catch(() => []);
          if (docs && docs.length > 0) existingEstimate = docs[0];
        } else if (input.order_id) {
          const docs = await this.listDocumentRecords(
            { order_id: input.order_id, type: "estimate" },
            {},
            sharedContext
          ).catch(() => []);
          if (docs && docs.length > 0) existingEstimate = docs[0];
        }

        if (!existingEstimate) {
          const cleanRef = String(displayId || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
          const quoteDisplayId = isRepairTicket
            ? `EST-${cleanRef}`
            : isStoreOrder
            ? `EST-${cleanRef}`
            : `EST-${cleanRef || Math.floor(100000 + Math.random() * 900000)}`;

          await this.generateDocument(
            {
              ...input,
              type: "estimate",
              display_id: quoteDisplayId,
              title: isRepairTicket ? "Repair Estimate / Quote" : "Quotation",
              auto_send: false,
              _skip_quote_creation: true,
            },
            container
          );
        }
      } catch (quoteErr: any) {
        container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(
          `[Documents-Module] Auto quote creation for invoice failed: ${quoteErr?.message || quoteErr}`
        );
      }
    }

    let source: "zoho" | "pdfkit" = "pdfkit";
    let zohoDocumentId: string | null = null;
    let pdfBuffer: Buffer | null = null;
    let targetInvoiceId: string | null = null;

    // Check if Zoho Books should be used - Zoho Books is single source of truth unless PDFKit is manually selected or Zoho is unavailable
    const canUseZoho =
      input.force_source !== "pdfkit" &&
      settings.zoho_books_enabled !== false &&
      Boolean(settings.zoho_client_id) &&
      Boolean(settings.zoho_client_secret) &&
      Boolean(settings.zoho_refresh_token) &&
      Boolean(settings.zoho_organization_id) &&
      (input.type === "invoice" || input.type === "estimate" || input.type === "receipt" || input.type === "packing_slip");

    if (canUseZoho) {
      try {
        const logger = container?.resolve("logger");
        const zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          logger
        );

        let contactId: string | null = null;
        const ensureContactId = async (): Promise<string> => {
          if (!contactId && input.customer) {
            contactId = await zoho.syncContact({
              first_name: input.customer.name,
              email: input.customer.email,
              phone: sanitizePhoneNumber(input.customer.phone),
              company_name: input.customer.company_name,
              address: input.customer.address,
            });
          }
          return contactId || "";
        };

        // 2. Prepare Zoho Notes & Terms (including Paystack payment link if unpaid)
        let zohoNotes = settings.zoho_invoice_notes || settings.pdf_payment_details || input.notes || "Thank you for your business.";
        const pLink = shortPaymentLink || input.payment_link;
        if (pLink) {
          if (!zohoNotes.includes("Pay Online:") && !zohoNotes.includes("Paystack Payment Link:")) {
            zohoNotes += `\n\nPaystack Payment Link: ${pLink}\nPay Online (Paystack): ${pLink}`;
          }
        }
        const zohoTerms = settings.zoho_invoice_terms || settings.pdf_terms || "";

        const zohoLineItems = (input.items || []).map((it) => ({
          name: it.title,
          description: it.description || "",
          rate: Number(it.unit_price || 0).toFixed(2),
          quantity: it.quantity || 1,
        }));

        const customFields: Array<{ label: string; value: string }> = [];
        if (settings.zoho_custom_field_payment_link && settings.zoho_custom_field_payment_link.trim() !== "" && (shortPaymentLink || input.payment_link)) {
          customFields.push({
            label: settings.zoho_custom_field_payment_link,
            value: (shortPaymentLink || input.payment_link) as string,
          });
        }

        if (input.type === "invoice") {
          targetInvoiceId = input.zoho_document_id || (repairTicket?.metadata as any)?.zoho_invoice_id || null;
          if (!targetInvoiceId && isRepairTicket) {
            const existingDocs = await this.listDocumentRecords({
              repair_ticket_id: input.repair_ticket_id,
              type: "invoice",
            }).catch(() => []);
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          } else if (!targetInvoiceId && isStoreOrder) {
            const existingDocs = await this.listDocumentRecords({
              order_id: input.order_id,
              type: "invoice",
            }).catch(() => []);
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          }
          if (!targetInvoiceId) {
            let existingInZoho = await zoho.getInvoiceByNumber(displayId);
            if (!existingInZoho && isRepairTicket) {
              if (displayId.startsWith("RT-")) {
                existingInZoho = await zoho.getInvoiceByNumber(displayId.replace(/^RT-/, ""));
              } else {
                existingInZoho = await zoho.getInvoiceByNumber(`RT-${displayId}`);
              }
            }
            if (existingInZoho) {
              targetInvoiceId = existingInZoho.invoice_id;
            }
          }

          if (targetInvoiceId) {
            try {
              await zoho.updateInvoice(targetInvoiceId, {
                line_items: zohoLineItems.length > 0 ? zohoLineItems : undefined,
                notes: zohoNotes,
                terms: zohoTerms,
                custom_fields: customFields.length > 0 ? customFields : undefined,
              });
            } catch (err: any) {
              try {
                container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[documents-service] Failed to update existing Zoho invoice ${targetInvoiceId}: ${err?.message || err}`);
              } catch (_) {}
            }
          } else {
            const cid = await ensureContactId();
            const res = await zoho.createInvoice(cid, {
              reference_number: displayId,
              invoice_number: displayId,
              ignore_auto_number_generation: true,
              date: input.date,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              payment_terms: settings.zoho_payment_terms_days || 0,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields,
            });
            targetInvoiceId = res.invoice_id;
          }

          if (targetInvoiceId) {
            await zoho.markInvoiceAsSent(targetInvoiceId);
          }

          const actualAmountPaid = Number(
            input.amount_paid ??
            repairTicket?.amount_paid ??
            0
          );

          const isRepairPaid =
            actualAmountPaid > 0 &&
            (input.payment_status === "paid" ||
              repairTicket?.payment_status === "captured" ||
              repairTicket?.payment_status === "paid");

          if (isRepairPaid && targetInvoiceId && actualAmountPaid > 0) {
            try {
              let alreadyRegistered = false;
              try {
                const invDetails = await zoho.getInvoice(targetInvoiceId);
                if (invDetails?.payments && Array.isArray(invDetails.payments) && invDetails.payments.length > 0) {
                  const paySum = invDetails.payments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
                  if (paySum >= actualAmountPaid) {
                    alreadyRegistered = true;
                  }
                }
              } catch (_) {}

              if (!alreadyRegistered) {
                const cid = await ensureContactId();
                const payRef = input.payment_reference || (repairTicket?.metadata as any)?.paystack_reference || (repairTicket?.metadata as any)?.payment_reference || displayId;
                await zoho.registerPayment(
                  targetInvoiceId,
                  actualAmountPaid,
                  cid,
                  "Paystack",
                  payRef,
                  `Repair Ticket #${repairTicket?.ticket_number || displayId} Payment`
                );
              }
            } catch (payErr: any) {
              container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[documents-service] Failed to register payment on invoice ${targetInvoiceId}: ${payErr?.message || payErr}`);
            }
          }

          zohoDocumentId = targetInvoiceId;
          source = "zoho";
          const rawBuffer = await zoho.getDocumentPdf(targetInvoiceId, "invoice");
          const qrUrlToEmbed = settings.zoho_include_payment_qr !== false ? (shortPaymentLink || input.payment_link) : undefined;
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: qrUrlToEmbed,
            obscureZohoFooter: true,
            isInvoice: true,
            paymentLink: shortPaymentLink || input.payment_link,
          });
        } else if (input.type === "estimate") {
          let targetEstId: string | null = input.zoho_document_id || (repairTicket?.metadata as any)?.zoho_estimate_id || null;
          if (!targetEstId && input.repair_ticket_id) {
            const existingDocs = await this.listDocumentRecords({
              repair_ticket_id: input.repair_ticket_id,
              type: "estimate",
            }).catch(() => []);
            const est = existingDocs.find((d: any) => d.zoho_document_id);
            if (est) {
              targetEstId = est.zoho_document_id;
            }
          }
          if (!targetEstId) {
            let existingInZoho = await zoho.getEstimateByNumber(displayId);
            if (!existingInZoho && displayId.startsWith("EST-")) {
              existingInZoho = await zoho.getEstimateByNumber(displayId.replace(/^EST-/, ""));
            }
            if (!existingInZoho && !displayId.startsWith("EST-")) {
              existingInZoho = await zoho.getEstimateByNumber(`EST-${displayId}`);
            }
            if (existingInZoho) {
              targetEstId = existingInZoho.estimate_id;
            }
          }

          if (targetEstId) {
            try {
              await zoho.updateEstimate(targetEstId, {
                line_items: zohoLineItems.length > 0 ? zohoLineItems : undefined,
                notes: zohoNotes,
                terms: zohoTerms,
                custom_fields: customFields.length > 0 ? customFields : undefined,
              });
            } catch (err: any) {
              try {
                container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[documents-service] Failed to update existing Zoho estimate ${targetEstId}: ${err?.message || err}`);
              } catch (_) {}
            }
          } else {
            const cid = await ensureContactId();
            const res = await zoho.createEstimate(cid, {
              reference_number: displayId,
              estimate_number: displayId,
              date: input.date,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields,
            });
            targetEstId = res.estimate_id;
          }

          if (targetEstId) {
            await zoho.markEstimateAsSent(targetEstId);
          }

          zohoDocumentId = targetEstId;
          source = "zoho";
          const rawBuffer = await zoho.getDocumentPdf(targetEstId, "estimate");
          const quoteDocUrl = shortPdfLink || documentPublicUrl;
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: quoteDocUrl,
            obscureZohoFooter: true,
            isInvoice: false,
          });
        } else if (input.type === "receipt") {
          const paymentAmount = Number(
            input.amount_paid ??
            (isRepairTicket
              ? (repairTicket
                  ? (Number(repairTicket.amount_paid || 0) > 0 ? repairTicket.amount_paid : 0)
                  : (input.payment_status === "paid" ? input.total : 0))
              : (input.amount_paid ?? input.total)) ??
            0
          );

          const isTicketUnpaid = isRepairTicket
            ? paymentAmount <= 0 ||
              (!["captured", "paid", "partially_paid"].includes(String(repairTicket?.payment_status)) &&
               !["paid", "partially_paid"].includes(String(input.payment_status)))
            : paymentAmount <= 0;

          if (paymentAmount <= 0 || isTicketUnpaid) {
            throw new Error(
              `Cannot generate payment receipt: No payment has been received (amount: ${paymentAmount}). Repair tickets and orders must have a recorded payment before a receipt can be issued.`
            );
          }

          input.total = paymentAmount;
          input.payment_status = "paid";

          // Implement Zoho Books payment registration in service.ts for input.type === "receipt" using zoho.registerPayment
          targetInvoiceId = null;
          let correspondingInvoiceDoc: any = null;

          if (isRepairTicket) {
            const existingDocs = await this.listDocumentRecords({
              repair_ticket_id: input.repair_ticket_id,
              type: "invoice",
            }).catch(() => []);
            correspondingInvoiceDoc = existingDocs[0] || null;
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          } else if (isStoreOrder) {
            const existingDocs = await this.listDocumentRecords({
              order_id: input.order_id,
              type: "invoice",
            }).catch(() => []);
            correspondingInvoiceDoc = existingDocs[0] || null;
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          }

          // Determine the correct invoice number to look up or create in Zoho (never use RCPT- for an invoice)
          const cleanRef = String(displayId || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
          const expectedInvoiceNumber =
            correspondingInvoiceDoc?.display_id ||
            (isRepairTicket
              ? (cleanRef.startsWith("RT-") ? cleanRef : `RT-${cleanRef}`)
              : isStoreOrder
              ? `${settings.store_invoice_prefix || "ST-"}${cleanRef}`
              : displayId);

          // If no invoice was previously synchronized to Zoho, check if it exists in Zoho or create one to attach the payment
          if (!targetInvoiceId) {
            let existingInZoho = await zoho.getInvoiceByNumber(expectedInvoiceNumber);
            if (!existingInZoho && isRepairTicket) {
              if (expectedInvoiceNumber.startsWith("RT-")) {
                existingInZoho = await zoho.getInvoiceByNumber(expectedInvoiceNumber.replace(/^RT-/, ""));
              } else {
                existingInZoho = await zoho.getInvoiceByNumber(`RT-${expectedInvoiceNumber}`);
              }
            }
            if (existingInZoho) {
              targetInvoiceId = existingInZoho.invoice_id;
            }
          }

          if (!targetInvoiceId) {
            const cid = await ensureContactId();
            const invRes = await zoho.createInvoice(cid, {
              reference_number: expectedInvoiceNumber,
              invoice_number: expectedInvoiceNumber,
              ignore_auto_number_generation: true,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              payment_terms: 0,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields,
            });
            targetInvoiceId = invRes.invoice_id;
          }

          if (correspondingInvoiceDoc && !correspondingInvoiceDoc.zoho_document_id && targetInvoiceId) {
            try {
              await this.updateDocumentRecords({
                id: correspondingInvoiceDoc.id,
                zoho_document_id: targetInvoiceId,
                source: "zoho",
              });
            } catch (_) {}
          }

          const cid = await ensureContactId();
          const paystackReference =
            input.payment_reference ||
            (repairTicket?.metadata as any)?.paystack_reference ||
            (repairTicket?.metadata as any)?.payment_reference ||
            (input.custom_fields && (input.custom_fields["Payment Reference"] || input.custom_fields["paystack_reference"])) ||
            displayId;

          let paymentId: string | null = null;
          try {
            const invDetails = await zoho.getInvoice(targetInvoiceId);
            if (invDetails?.payments && Array.isArray(invDetails.payments)) {
              const existingPayment = invDetails.payments.find(
                (p: any) =>
                  (paystackReference && p.reference_number === paystackReference) ||
                  (Math.abs(Number(p.amount) - paymentAmount) < 0.01 && p.payment_id)
              );
              if (existingPayment?.payment_id) {
                paymentId = existingPayment.payment_id;
              }
            }
          } catch (_) {}

          const paymentMode =
            (input as any).payment_method ||
            (repairTicket?.metadata as any)?.last_payment_method ||
            "Online";

          if (!paymentId) {
            paymentId = await zoho.registerPayment(
              targetInvoiceId,
              paymentAmount,
              cid,
              paymentMode,
              paystackReference,
              paystackReference !== displayId ? `Payment via ${paymentMode}: ${paystackReference}` : undefined
            );
          }

          zohoDocumentId = paymentId;
          source = "zoho";

          const rawBuffer = await zoho.getPaymentReceiptPdf(paymentId);
          const receiptDocUrl = shortPdfLink || documentPublicUrl;
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: receiptDocUrl,
            obscureZohoFooter: true,
          });
        } else if (input.type === "packing_slip") {
          let targetInvoiceId: string | null = input.zoho_document_id || null;
          if (!targetInvoiceId && isStoreOrder) {
            const existingDocs = await this.listDocumentRecords({
              order_id: input.order_id,
              type: "invoice",
            }).catch(() => []);
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          }
          if (!targetInvoiceId && isRepairTicket) {
            const existingDocs = await this.listDocumentRecords({
              repair_ticket_id: input.repair_ticket_id,
              type: "invoice",
            }).catch(() => []);
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          }
          if (!targetInvoiceId) {
            const cleanRef = String(displayId || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
            const expectedInvoiceNumber = isRepairTicket
              ? (cleanRef.startsWith("RT-") ? cleanRef : `RT-${cleanRef}`)
              : isStoreOrder
              ? `${settings.store_invoice_prefix || "ST-"}${cleanRef}`
              : displayId;
            let existingInZoho = await zoho.getInvoiceByNumber(expectedInvoiceNumber);
            if (existingInZoho) {
              targetInvoiceId = existingInZoho.invoice_id;
            }
          }
          if (!targetInvoiceId) {
            const cid = await ensureContactId();
            const invRes = await zoho.createInvoice(cid, {
              reference_number: displayId,
              invoice_number: displayId,
              ignore_auto_number_generation: true,
              date: input.date,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              payment_terms: settings.zoho_payment_terms_days || 0,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields,
            });
            targetInvoiceId = invRes.invoice_id;
            await zoho.markInvoiceAsSent(targetInvoiceId);
          }

          zohoDocumentId = targetInvoiceId;
          source = "zoho";
          const rawBuffer = await zoho.getInvoiceDeliveryNotePdf(targetInvoiceId);
          const packingDocUrl = shortPdfLink || documentPublicUrl;
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: packingDocUrl,
            obscureZohoFooter: true,
            isInvoice: false,
          });
        }
      } catch (zohoErr: any) {
        if (["invoice", "estimate", "receipt", "packing_slip"].includes(input.type) && input.force_source !== "pdfkit" && settings.zoho_books_enabled) {
          throw new Error(`[Documents-Module] Zoho Books is required for ${input.type}s: ${zohoErr.message}`);
        }
        container?.resolve("logger")?.warn(`[Documents-Module] Zoho Books is unavailable (${zohoErr.message}). Falling back to PDFKit.`);
        source = "pdfkit";
        zohoDocumentId = null;
        pdfBuffer = null;
      }
    }

    // -------------------------------------------------------------
    // PDFKit Fallback / Primary Generation
    // -------------------------------------------------------------
    if (!pdfBuffer) {
      if (["invoice", "estimate", "receipt", "packing_slip"].includes(input.type) && input.force_source !== "pdfkit" && settings.zoho_books_enabled) {
        throw new Error(`Invoices, receipts, quotes, and packing slips are only to be created by Zoho Books.`);
      }
      source = "pdfkit";
      let templateName = settings.invoice_template || "zoho_exact";
      if (input.type === "packing_slip") templateName = settings.packing_slip_template || "modern";
      else if (input.type === "receipt") templateName = settings.receipt_template || "zoho_exact";
      else if (input.type === "estimate") templateName = settings.estimate_template || "zoho_exact";
      else if (input.type === "job_card") templateName = settings.job_card_template || "standard";
      else if (input.type === "service_report") templateName = (settings as any).service_report_template || "standard";
      else if (input.type === "handover") templateName = (settings as any).handover_template || "standard";
      else if (input.type === "custom") templateName = settings.custom_doc_template || "modern";

      const docData: DocumentData = {
        display_id: displayId,
        title: input.title,
        type: input.type,
        date: new Date().toISOString().split("T")[0],
        customer: {
          name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone,
          address: input.customer.address,
        },
        company: {
          name: settings.company_name || "Store",
          logo_url: settings.pdf_logo_url,
          address: settings.pdf_address,
          phone: settings.pdf_phone,
          email: settings.pdf_email,
          website: settings.pdf_website,
          payment_details: settings.pdf_payment_details,
          terms: settings.pdf_terms,
        },
        items: input.items,
        subtotal: input.subtotal,
        tax_total: input.tax_total,
        shipping_total: input.shipping_total,
        discount_total: input.discount_total,
        total: input.total != null ? input.total : 0,
        currency_code: input.currency_code || "kes",
        payment_status: input.payment_status || "unpaid",
        payment_link: input.type === "invoice" ? (shortPaymentLink || input.payment_link || null) : null,
        qr_url: input.type === "invoice"
          ? (shortPaymentLink || input.payment_link || null)
          : (shortPdfLink || documentPublicUrl),
        notes: input.notes,
        body_text: input.body_text,
        custom_fields: input.custom_fields,
      };

      const rawBuffer = await PDFKitGenerator.generate(docData, templateName);
      pdfBuffer = rawBuffer;
    }

    // Save Record to Database (update existing if present for repair ticket to avoid duplicates)
    let record: any = null;
    let existingRecord: any = null;

    if (input.repair_ticket_id) {
      try {
        const existingDocs = await this.listDocumentRecords(
          {
            repair_ticket_id: input.repair_ticket_id,
            type: input.type,
          },
          {},
          sharedContext
        ).catch(() => []);
        if (existingDocs && existingDocs.length > 0) {
          existingRecord = existingDocs[0];
        }
      } catch (_) {}
    }

    if (existingRecord) {
      try {
        record = await this.updateDocumentRecords({
          id: existingRecord.id,
          display_id: displayId,
          title: input.title || existingRecord.title,
          source: source,
          status: input.payment_status === "paid" ? "paid" : "sent",
          customer_name: input.customer.name,
          customer_email: input.customer.email,
          customer_phone: input.customer.phone,
          zoho_document_id: zohoDocumentId || existingRecord.zoho_document_id,
          total_amount: input.total,
          currency_code: input.currency_code,
          payment_status: input.payment_status || "unpaid",
          payment_link: input.payment_link,
          short_payment_link: shortPaymentLink,
          pdf_url: `${(process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || process.env.MEDUSA_URL || "http://localhost:9000").replace(/\/$/, "")}/documents/${displayId}/document`,
          metadata: {
            ...(existingRecord.metadata || {}),
            items: input.items,
            notes: input.notes,
            body_text: input.body_text,
            custom_fields: input.custom_fields,
          },
        }, sharedContext);
      } catch (upErr: any) {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          await conn("document_record").where({ id: existingRecord.id }).update({
            display_id: displayId,
            title: input.title || existingRecord.title,
            source: source,
            status: input.payment_status === "paid" ? "paid" : "sent",
            customer_name: input.customer.name,
            customer_email: input.customer.email,
            customer_phone: input.customer.phone,
            zoho_document_id: zohoDocumentId || existingRecord.zoho_document_id,
            total_amount: input.total,
            currency_code: input.currency_code,
            payment_status: input.payment_status || "unpaid",
            payment_link: input.payment_link,
            short_payment_link: shortPaymentLink,
            pdf_url: `${(process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || process.env.MEDUSA_URL || "http://localhost:9000").replace(/\/$/, "")}/documents/${displayId}/document`,
            metadata: JSON.stringify({
              items: input.items,
              notes: input.notes,
              body_text: input.body_text,
              custom_fields: input.custom_fields,
            }),
            updated_at: new Date(),
          });
          record = await conn("document_record").where({ id: existingRecord.id }).first();
        }
      }
    }

    if (!record) {
      try {
        record = await this.createDocumentRecords({
          display_id: displayId,
          title: input.title || (
            input.type === "invoice" ? "Tax Invoice" :
            input.type === "receipt" ? "Payment Receipt" :
            input.type === "packing_slip" ? "Packing Slip" :
            input.type === "estimate" ? "Quotation" : "Document"
          ),
          type: input.type,
          source: source,
          status: input.payment_status === "paid" ? "paid" : "sent",
          customer_name: input.customer.name,
          customer_email: input.customer.email,
          customer_phone: input.customer.phone,
          order_id: input.order_id,
          repair_ticket_id: input.repair_ticket_id,
          zoho_document_id: zohoDocumentId,
          total_amount: input.total,
          currency_code: input.currency_code,
          payment_status: input.payment_status || "unpaid",
          payment_link: input.payment_link,
          short_payment_link: shortPaymentLink,
          pdf_url: `${(process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || process.env.MEDUSA_URL || "http://localhost:9000").replace(/\/$/, "")}/documents/${displayId}/document`,
          metadata: {
            items: input.items,
            notes: input.notes,
            body_text: input.body_text,
            custom_fields: input.custom_fields,
          },
        }, sharedContext);
      } catch (err: any) {
        if (isUndefinedTableError(err)) {
          throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
        }
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          try {
            const [inserted] = await conn("document_record").insert({
              id: generateEntityId(undefined, "doc"),
              display_id: displayId,
              title: input.title || (
                input.type === "invoice" ? "Tax Invoice" :
                input.type === "receipt" ? "Payment Receipt" :
                input.type === "packing_slip" ? "Packing Slip" :
                input.type === "estimate" ? "Quotation" : "Document"
              ),
              type: input.type,
              source: source,
              status: input.payment_status === "paid" ? "paid" : "sent",
              customer_name: input.customer.name,
              customer_email: input.customer.email,
              customer_phone: input.customer.phone,
              order_id: input.order_id,
              repair_ticket_id: input.repair_ticket_id,
              zoho_document_id: zohoDocumentId,
              total_amount: input.total,
              currency_code: input.currency_code,
              payment_status: input.payment_status || "unpaid",
              payment_link: input.payment_link,
              short_payment_link: shortPaymentLink,
              pdf_url: `${(process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || process.env.MEDUSA_URL || "http://localhost:9000").replace(/\/$/, "")}/documents/${displayId}/document`,
              metadata: JSON.stringify({
                items: input.items,
                notes: input.notes,
                body_text: input.body_text,
                custom_fields: input.custom_fields,
              }),
              created_at: new Date(),
              updated_at: new Date(),
            }).returning("*");
            record = inserted;
          } catch (knexErr: any) {
            if (isUndefinedTableError(knexErr)) {
              throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
            }
            throw knexErr;
          }
        } else {
          throw err;
        }
      }
    }

    // Update with real public URL and short URL for document
    const realPdfUrl = `${backendUrl}/documents/${record.id}/document`;
    shortPdfLink = await this.getOrGenerateShortUrl(realPdfUrl, storeUrl);

    try {
      await this.updateDocumentRecords({
        id: record.id,
        pdf_url: realPdfUrl,
        short_pdf_link: shortPdfLink,
      }, sharedContext);
    } catch (err: any) {
      if (isUndefinedTableError(err)) {
        throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
      }
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        try {
          await conn("document_record").where({ id: record.id }).update({
            pdf_url: realPdfUrl,
            short_pdf_link: shortPdfLink,
            updated_at: new Date(),
          });
        } catch (knexErr: any) {
          if (isUndefinedTableError(knexErr)) {
            throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
          }
          throw knexErr;
        }
      }
    }
    record.pdf_url = realPdfUrl;
    record.short_pdf_link = shortPdfLink;

    // If generating a receipt, ensure corresponding invoice(s) for the ticket or order have their payment_status and status updated
    if (input.type === "receipt" && (input.repair_ticket_id || input.order_id)) {
      try {
        const isRepair = Boolean(input.repair_ticket_id);
        const invFilter: any = { type: "invoice" };
        if (input.repair_ticket_id) invFilter.repair_ticket_id = input.repair_ticket_id;
        if (input.order_id) invFilter.order_id = input.order_id;

        const invRecords = await this.listDocumentRecords(invFilter, {}, sharedContext).catch(() => []);

        let isFullyPaid = true;
        let isPartiallyPaid = false;
        if (isRepair && repairTicket) {
          const totalTarget = Number(repairTicket.total_actual > 0 ? repairTicket.total_actual : repairTicket.total_estimate || 0);
          const currentPaid = Number(repairTicket.amount_paid || 0);
          isFullyPaid =
            repairTicket.payment_status === "captured" ||
            repairTicket.payment_status === "paid" ||
            (totalTarget > 0 && currentPaid >= totalTarget) ||
            (totalTarget === 0 && currentPaid >= 0);
          isPartiallyPaid = !isFullyPaid && currentPaid > 0;
        } else if (input.payment_status === "partially_paid") {
          isFullyPaid = false;
          isPartiallyPaid = true;
        }

        const newPayStatus = isFullyPaid ? "paid" : (isPartiallyPaid ? "partially_paid" : "unpaid");
        const newDocStatus = isFullyPaid ? "paid" : (isPartiallyPaid ? "partially_paid" : "sent");

        for (const inv of invRecords) {
          if (inv.payment_status !== newPayStatus || inv.status !== newDocStatus || (targetInvoiceId && !inv.zoho_document_id)) {
            try {
              await this.updateDocumentRecords(
                {
                  id: inv.id,
                  payment_status: newPayStatus,
                  status: newDocStatus,
                  ...(targetInvoiceId ? { zoho_document_id: targetInvoiceId, source: "zoho" } : {}),
                },
                sharedContext
              );
            } catch (_) {
              const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
              if (conn) {
                await conn("document_record")
                  .where({ id: inv.id })
                  .update({
                    payment_status: newPayStatus,
                    status: newDocStatus,
                    ...(targetInvoiceId ? { zoho_document_id: targetInvoiceId, source: "zoho" } : {}),
                    updated_at: new Date(),
                  });
              }
            }
            invalidatePdfCache(inv.id);
          }
        }
      } catch (invSyncErr: any) {
        container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(
          `[Documents-Module] Failed to update corresponding invoice payment_status: ${invSyncErr?.message || invSyncErr}`
        );
      }
    }

    // Multi-channel notification auto-dispatch
    if (input.auto_send && container) {
      await NotificationSender.send({
        container,
        document: {
          id: record.id,
          display_id: record.display_id,
          title: record.title,
          type: record.type,
          customer_name: record.customer_name,
          customer_email: record.customer_email,
          customer_phone: record.customer_phone,
          total_amount: record.total_amount,
          currency_code: record.currency_code,
          payment_status: record.payment_status,
          payment_link: record.payment_link,
          short_payment_link: record.short_payment_link,
          pdf_url: record.pdf_url,
          short_pdf_link: record.short_pdf_link,
          custom_message: input.custom_email_message,
          subject: input.email_subject,
          order_id: record.order_id,
          repair_ticket_id: record.repair_ticket_id,
        },
        channels: input.notification_channels,
        settings,
      });
    }

    return { record, pdfBuffer };
  }

  /**
   * Fetches or regenerates the PDF buffer for an existing DocumentRecord
   */
  async getPdfForRecord(recordId: string, container?: any, sharedContext?: any): Promise<Buffer> {
    let record: any = null;
    try {
      record = await this.retrieveDocumentRecord(recordId, {}, sharedContext);
    } catch (e: any) {
      if (isUndefinedTableError(e)) {
        throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
      }
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        try {
          record = await conn("document_record")
            .whereNull("deleted_at")
            .where((builder: any) => {
              builder.where({ id: recordId }).orWhere({ display_id: recordId });
            })
            .first();
        } catch (knexErr: any) {
          if (isUndefinedTableError(knexErr)) {
            throw new Error("Database table document_record does not exist. Please run npx medusa db:migrate.");
          }
          throw knexErr;
        }
      }
      if (!record) throw e;
    }

    // 0. In-memory buffer cache check (TTL: 60 seconds) to ensure byte-identical responses and avoid redundant Zoho API calls
    const cacheKey = `${record.id}_${record.updated_at ? new Date(record.updated_at).getTime() : ""}`;
    const cached = pdfBufferCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.buffer;
    }

    const settings = await this.getSettings(sharedContext, container).catch(() => ({} as any));
    const storeUrl = (settings?.storefront_url || process.env.STORE_URL || "https://urbandevicecare.co.uk").replace(/\/$/, "");

    // 1. For invoices ONLY: resolve payment_link & short_payment_link dynamically if missing
    if (record.type === "invoice" && (!record.payment_link || !record.short_payment_link)) {
      try {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (record.repair_ticket_id) {
          let ticket: any = null;
          if (conn) {
            ticket = await conn("repair_ticket").where({ id: record.repair_ticket_id }).first();
          }
          if (ticket?.approval_token) {
            const rawLink = `${storeUrl}/repairs/track?token=${ticket.approval_token}`;
            const shortLink = await this.getOrGenerateShortUrl(rawLink, storeUrl);
            record.payment_link = rawLink;
            record.short_payment_link = shortLink;
            if (conn) {
              await conn("document_record")
                .where({ id: record.id })
                .update({
                  payment_link: rawLink,
                  short_payment_link: shortLink,
                  updated_at: new Date(),
                });
            }
          }
        } else if (record.order_id) {
          let order: any = null;
          if (conn) {
            order = await conn("order").where({ id: record.order_id }).first();
          }
          if (order) {
            const orderInfo = generateOrderPaymentLink(order, storeUrl);
            if (orderInfo.paymentLink) {
              const shortLink = await this.getOrGenerateShortUrl(orderInfo.paymentLink, storeUrl);
              record.payment_link = orderInfo.paymentLink;
              record.short_payment_link = shortLink;
              if (conn) {
                await conn("document_record")
                  .where({ id: record.id })
                  .update({
                    payment_link: orderInfo.paymentLink,
                    short_payment_link: shortLink,
                    updated_at: new Date(),
                  });
              }
            }
          }
        }
      } catch (_) {}
    }

    const isInvoice = record.type === "invoice";
    const effectivePayLink = isInvoice ? (record.short_payment_link || record.payment_link || null) : null;
    const effectiveQrUrl = isInvoice
      ? (effectivePayLink || record.short_pdf_link || record.pdf_url)
      : (record.short_pdf_link || record.pdf_url);

    let meta = (record.metadata || {}) as any;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch (_) {
        meta = {};
      }
    }

    // Zoho Books is single source of truth unless PDFKit is explicitly selected or Zoho is unavailable
    const canUseZohoInPdf =
      meta.force_source !== "pdfkit" &&
      settings.zoho_books_enabled !== false &&
      Boolean(settings.zoho_client_id) &&
      Boolean(settings.zoho_client_secret) &&
      Boolean(settings.zoho_refresh_token) &&
      Boolean(settings.zoho_organization_id) &&
      (record.type === "invoice" || record.type === "estimate" || record.type === "receipt");

    if (canUseZohoInPdf) {
      try {
        const logger = container?.resolve?.("logger", { allowUnregistered: true });
        const zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          logger
        );

        // Self-heal: If document is not yet linked to Zoho Books, look up by number
        if (!record.zoho_document_id) {
          if (record.type === "invoice") {
            const existingInZoho = await zoho.getInvoiceByNumber(record.display_id);
            if (existingInZoho) {
              record.zoho_document_id = existingInZoho.invoice_id;
              record.source = "zoho";
            }
          } else if (record.type === "estimate") {
            const existingInZoho = await zoho.getEstimateByNumber(record.display_id);
            if (existingInZoho) {
              record.zoho_document_id = existingInZoho.estimate_id;
              record.source = "zoho";
            }
          }
          if (record.zoho_document_id) {
            try {
              const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
              if (conn) {
                await conn("document_record").where({ id: record.id }).update({
                  zoho_document_id: record.zoho_document_id,
                  source: "zoho",
                  updated_at: new Date(),
                });
              }
            } catch (_) {}
          }
        }

        if (record.zoho_document_id) {
          let rawBuf: ArrayBuffer | null = null;
          if (record.type === "receipt") {
            rawBuf = await zoho.getPaymentReceiptPdf(record.zoho_document_id);
          } else {
            const docType = record.type === "estimate" ? "estimate" : "invoice";
            rawBuf = await zoho.getDocumentPdf(record.zoho_document_id, docType);
          }

          if (rawBuf && rawBuf.byteLength >= 4) {
            const buf = Buffer.from(rawBuf);
            if (buf.subarray(0, 4).toString() === "%PDF") {
              const processedBuf = await postProcessPdf(buf, {
                qrUrl: effectiveQrUrl,
                obscureZohoFooter: true,
                isInvoice,
                paymentLink: effectivePayLink,
                docType: record.type,
              });
              pdfBufferCache.set(cacheKey, { buffer: processedBuf, expiresAt: Date.now() + 60000 });
              return processedBuf;
            }
          }
        }
      } catch (err: any) {
        try {
          container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[Documents-Module] Failed to fetch PDF from Zoho (${err.message}). Regenerating via PDFKit.`);
        } catch (_) {}
      }
    }

    // PDFKit Fallback Generation
    let templateName = settings.invoice_template || "zoho_exact";
    if (record.type === "packing_slip") templateName = settings.packing_slip_template || "modern";
    else if (record.type === "receipt") templateName = settings.receipt_template || "zoho_exact";
    else if (record.type === "estimate") templateName = settings.estimate_template || "zoho_exact";
    else if (record.type === "job_card") templateName = settings.job_card_template || "standard";
    else if (record.type === "custom") templateName = settings.custom_doc_template || "modern";
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch (_) {
        meta = {};
      }
    }

    const docData: DocumentData = {
      display_id: record.display_id || record.id || "DOC",
      title: record.title || "Document",
      type: record.type as any,
      date: record.created_at ? new Date(record.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      customer: {
        name: record.customer_name || "Valued Customer",
        email: record.customer_email || undefined,
        phone: record.customer_phone || undefined,
      },
      company: {
        name: settings.company_name || "Store",
        logo_url: settings.pdf_logo_url,
        address: settings.pdf_address,
        phone: settings.pdf_phone,
        email: settings.pdf_email,
        website: settings.pdf_website,
        payment_details: settings.pdf_payment_details,
        terms: settings.pdf_terms,
      },
      items: Array.isArray(meta?.items) ? meta.items : [],
      total: Number(record.total_amount || 0) || 0,
      currency_code: record.currency_code || "kes",
      payment_status: record.payment_status,
      payment_link: effectivePayLink,
      qr_url: effectiveQrUrl,
      notes: meta?.notes,
      body_text: meta?.body_text,
      custom_fields: meta?.custom_fields,
    };

    let rawBuffer: Buffer;
    try {
      rawBuffer = await PDFKitGenerator.generate(docData, templateName);
    } catch (tmplErr: any) {
      try {
        container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(
          `[Documents-Module] Error generating ${templateName} template: ${tmplErr.message}. Falling back to modern.`
        );
      } catch (_) {}
      rawBuffer = await PDFKitGenerator.generate(docData, "modern");
    }

    pdfBufferCache.set(cacheKey, { buffer: rawBuffer, expiresAt: Date.now() + 60000 });
    return rawBuffer;
  }

  /**
   * Deletes all generated documents (in database and in Zoho Books) for a repair ticket
   * so they can be regenerated cleanly with updated information.
   */
  async deleteDocumentsForRepairTicket(repairTicketId: string, container?: any): Promise<{
    deleted_records: number;
    deleted_zoho_invoices: string[];
    deleted_zoho_estimates: string[];
    deleted_zoho_payments: string[];
  }> {
    const deletedInvoices: string[] = [];
    const deletedEstimates: string[] = [];
    const deletedPayments: string[] = [];

    const manager = container?.resolve?.("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};

    // 1. Fetch all documents for this repair ticket
    let records: any[] = [];
    try {
      records = await this.listDocumentRecords({ repair_ticket_id: repairTicketId }, {}, sharedContext);
    } catch (_) {
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        records = await conn("document_record").where({ repair_ticket_id: repairTicketId }).whereNull("deleted_at");
      }
    }
    for (const r of records) {
      invalidatePdfCache(r.id);
    }

    // 2. Resolve ZohoBooksService if credentials exist
    let zoho: ZohoBooksService | null = null;
    try {
      const settings = await this.getSettings(sharedContext, container);
      if (
        settings?.zoho_books_enabled &&
        settings.zoho_client_id &&
        settings.zoho_client_secret &&
        settings.zoho_refresh_token &&
        settings.zoho_organization_id
      ) {
        zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          container?.resolve?.("logger", { allowUnregistered: true })
        );
      }
    } catch (_) {}

    // 3. Delete each document in Zoho Books if zoho_document_id exists
    // Crucial order: payments/receipts MUST be deleted before invoices, otherwise Zoho rejects invoice deletion
    const paymentRecords = records.filter((r) => r.type === "receipt");
    const invoiceRecords = records.filter((r) => r.type === "invoice");
    const otherRecords = records.filter((r) => r.type !== "receipt" && r.type !== "invoice");

    for (const record of paymentRecords) {
      if (zoho && record.zoho_document_id) {
        try {
          await zoho.deletePayment(record.zoho_document_id);
          deletedPayments.push(record.zoho_document_id);
        } catch (e: any) {
          container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[Documents-Module] Could not delete Zoho payment ${record.zoho_document_id}: ${e.message}`);
        }
      }
    }

    for (const record of invoiceRecords) {
      if (zoho && record.zoho_document_id) {
        try {
          await zoho.deleteInvoice(record.zoho_document_id);
          deletedInvoices.push(record.zoho_document_id);
        } catch (e: any) {
          container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[Documents-Module] Could not delete Zoho invoice ${record.zoho_document_id}: ${e.message}`);
        }
      }
    }

    for (const record of otherRecords) {
      if (zoho && record.zoho_document_id) {
        try {
          if (record.type === "estimate") {
            await zoho.deleteEstimate(record.zoho_document_id);
            deletedEstimates.push(record.zoho_document_id);
          }
        } catch (e: any) {
          container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(`[Documents-Module] Could not delete Zoho estimate ${record.zoho_document_id}: ${e.message}`);
        }
      }
    }

    // 4. Also check repair ticket metadata directly in case zoho_invoice_id or zoho_estimate_id was stored there
    try {
      const repairModule: any = container?.resolve?.("repair", { allowUnregistered: true });
      if (repairModule) {
        const ticket = await repairModule.retrieveRepairTicket(repairTicketId).catch(() => null);
        if (ticket && ticket.metadata && zoho) {
          const meta = ticket.metadata;
          if (meta.zoho_payment_id && !deletedPayments.includes(meta.zoho_payment_id)) {
            await zoho.deletePayment(meta.zoho_payment_id).catch(() => {});
            deletedPayments.push(meta.zoho_payment_id);
          }
          if (meta.zoho_invoice_id && !deletedInvoices.includes(meta.zoho_invoice_id)) {
            await zoho.deleteInvoice(meta.zoho_invoice_id).catch(() => {});
            deletedInvoices.push(meta.zoho_invoice_id);
          }
          if (meta.zoho_estimate_id && !deletedEstimates.includes(meta.zoho_estimate_id)) {
            await zoho.deleteEstimate(meta.zoho_estimate_id).catch(() => {});
            deletedEstimates.push(meta.zoho_estimate_id);
          }
        }

        // Clean ticket metadata
        if (ticket) {
          const cleanMeta = { ...(ticket.metadata || {}) };
          delete cleanMeta.document_id;
          delete cleanMeta.pdf_url;
          delete cleanMeta.short_pdf_link;
          delete cleanMeta.zoho_invoice_id;
          delete cleanMeta.zoho_estimate_id;
          delete cleanMeta.zoho_payment_id;
          delete cleanMeta.last_document_type;
          delete cleanMeta.last_document_title;

          await repairModule.updateRepairTickets({
            id: repairTicketId,
            metadata: cleanMeta,
          }).catch(() => {});
        }
      } else {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          const ticket = await conn("repair_ticket").where({ id: repairTicketId }).first();
          if (ticket) {
            const meta = typeof ticket.metadata === "string" ? JSON.parse(ticket.metadata || "{}") : (ticket.metadata || {});
            if (zoho) {
              if (meta.zoho_payment_id && !deletedPayments.includes(meta.zoho_payment_id)) {
                await zoho.deletePayment(meta.zoho_payment_id).catch(() => {});
                deletedPayments.push(meta.zoho_payment_id);
              }
              if (meta.zoho_invoice_id && !deletedInvoices.includes(meta.zoho_invoice_id)) {
                await zoho.deleteInvoice(meta.zoho_invoice_id).catch(() => {});
                deletedInvoices.push(meta.zoho_invoice_id);
              }
              if (meta.zoho_estimate_id && !deletedEstimates.includes(meta.zoho_estimate_id)) {
                await zoho.deleteEstimate(meta.zoho_estimate_id).catch(() => {});
                deletedEstimates.push(meta.zoho_estimate_id);
              }
            }
            delete meta.document_id;
            delete meta.pdf_url;
            delete meta.short_pdf_link;
            delete meta.zoho_invoice_id;
            delete meta.zoho_estimate_id;
            delete meta.zoho_payment_id;
            delete meta.last_document_type;
            delete meta.last_document_title;

            await conn("repair_ticket").where({ id: repairTicketId }).update({
              metadata: JSON.stringify(meta),
              updated_at: new Date(),
            });
          }
        }
      }
    } catch (_) {}

    // 5. Delete document records in database
    let deletedCount = 0;
    for (const record of records) {
      try {
        await this.deleteDocumentRecords(record.id, sharedContext);
        deletedCount++;
      } catch (_) {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          await conn("document_record").where({ id: record.id }).delete();
          deletedCount++;
        }
      }
    }

    return {
      deleted_records: deletedCount,
      deleted_zoho_invoices: deletedInvoices,
      deleted_zoho_estimates: deletedEstimates,
      deleted_zoho_payments: deletedPayments,
    };
  }

  /**
   * Deletes only payment receipts (in Zoho Books and in database) for a repair ticket
   * restoring the invoice balance and resetting the ticket metadata link back to the unpaid invoice.
   */
  async deleteReceiptsForRepairTicket(repairTicketId: string, container?: any): Promise<{
    deleted_records: number;
    deleted_zoho_payments: string[];
  }> {
    const deletedPayments: string[] = [];
    const manager = container?.resolve?.("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};

    // 1. Fetch receipt documents for this repair ticket
    let records: any[] = [];
    try {
      records = await this.listDocumentRecords(
        { repair_ticket_id: repairTicketId, type: "receipt" },
        {},
        sharedContext
      );
    } catch (_) {
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        records = await conn("document_record")
          .where({ repair_ticket_id: repairTicketId, type: "receipt" })
          .whereNull("deleted_at");
      }
    }
    for (const r of records) {
      invalidatePdfCache(r.id);
    }

    // 2. Resolve ZohoBooksService if credentials exist
    let zoho: ZohoBooksService | null = null;
    try {
      const settings = await this.getSettings(sharedContext, container);
      if (
        settings?.zoho_books_enabled &&
        settings.zoho_client_id &&
        settings.zoho_client_secret &&
        settings.zoho_refresh_token &&
        settings.zoho_organization_id
      ) {
        zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          container?.resolve?.("logger", { allowUnregistered: true })
        );
      }
    } catch (_) {}

    // 3. Delete payments in Zoho
    for (const record of records) {
      if (zoho && record.zoho_document_id) {
        try {
          await zoho.deletePayment(record.zoho_document_id);
          deletedPayments.push(record.zoho_document_id);
        } catch (e: any) {
          container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(
            `[Documents-Module] Could not delete Zoho payment ${record.zoho_document_id}: ${e.message}`
          );
        }
      }
    }

    // 4. Also check repair ticket metadata directly in case zoho_payment_id was stored there
    try {
      const repairModule: any = container?.resolve?.("repair", { allowUnregistered: true });
      if (repairModule) {
        const ticket = await repairModule.retrieveRepairTicket(repairTicketId).catch(() => null);
        if (ticket && ticket.metadata && zoho) {
          const meta = ticket.metadata;
          if (meta.zoho_payment_id && !deletedPayments.includes(meta.zoho_payment_id)) {
            await zoho.deletePayment(meta.zoho_payment_id).catch(() => {});
            deletedPayments.push(meta.zoho_payment_id);
          }
        }

        // Clean ticket metadata: clear receipt details and restore invoice link if available
        if (ticket) {
          const cleanMeta = { ...(ticket.metadata || {}) };
          delete cleanMeta.zoho_payment_id;

          let invoices: any[] = [];
          try {
            invoices = await this.listDocumentRecords(
              { repair_ticket_id: repairTicketId, type: "invoice" },
              {},
              sharedContext
            );
          } catch (_) {}
          for (const inv of invoices) {
            try {
              await this.updateDocumentRecords({
                id: inv.id,
                payment_status: "unpaid",
                status: "sent",
              }, sharedContext);
            } catch (_) {}
            invalidatePdfCache(inv.id);
          }
          const invoice = invoices?.[0];
          if (invoice) {
            cleanMeta.document_id = invoice.id;
            cleanMeta.pdf_url = invoice.pdf_url;
            cleanMeta.short_pdf_link = invoice.short_pdf_link || invoice.pdf_url;
            cleanMeta.last_document_type = "invoice";
            cleanMeta.last_document_title = invoice.title || "Repair Invoice";
          } else if (cleanMeta.last_document_type === "receipt") {
            delete cleanMeta.document_id;
            delete cleanMeta.pdf_url;
            delete cleanMeta.short_pdf_link;
            delete cleanMeta.last_document_type;
            delete cleanMeta.last_document_title;
          }

          await repairModule.updateRepairTickets({
            id: repairTicketId,
            metadata: cleanMeta,
          }).catch(() => {});
        }
      } else {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          const ticket = await conn("repair_ticket").where({ id: repairTicketId }).first();
          if (ticket && ticket.metadata) {
            const meta = typeof ticket.metadata === "string" ? JSON.parse(ticket.metadata) : { ...ticket.metadata };
            if (zoho && meta.zoho_payment_id && !deletedPayments.includes(meta.zoho_payment_id)) {
              await zoho.deletePayment(meta.zoho_payment_id).catch(() => {});
              deletedPayments.push(meta.zoho_payment_id);
            }
            delete meta.zoho_payment_id;

            await conn("document_record")
              .where({ repair_ticket_id: repairTicketId, type: "invoice" })
              .update({
                payment_status: "unpaid",
                status: "sent",
                updated_at: new Date(),
              });

            const invoice = await conn("document_record")
              .where({ repair_ticket_id: repairTicketId, type: "invoice" })
              .whereNull("deleted_at")
              .first();
            if (invoice) {
              invalidatePdfCache(invoice.id);
              meta.document_id = invoice.id;
              meta.pdf_url = invoice.pdf_url;
              meta.short_pdf_link = invoice.short_pdf_link || invoice.pdf_url;
              meta.last_document_type = "invoice";
              meta.last_document_title = invoice.title || "Repair Invoice";
            } else if (meta.last_document_type === "receipt") {
              delete meta.document_id;
              delete meta.pdf_url;
              delete meta.short_pdf_link;
              delete meta.last_document_type;
              delete meta.last_document_title;
            }

            await conn("repair_ticket").where({ id: repairTicketId }).update({
              metadata: JSON.stringify(meta),
              updated_at: new Date(),
            });
          }
        }
      }
    } catch (_) {}

    // 5. Delete receipt records in database
    let deletedCount = 0;
    for (const record of records) {
      try {
        await this.deleteDocumentRecords(record.id, sharedContext);
        deletedCount++;
      } catch (_) {
        const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
        if (conn) {
          await conn("document_record").where({ id: record.id }).delete();
          deletedCount++;
        }
      }
    }

    return {
      deleted_records: deletedCount,
      deleted_zoho_payments: deletedPayments,
    };
  }

  /**
   * Updates an existing document record (title, customer details, line items, notes, terms)
   * and synchronizes the updates with Zoho Books if the document is an invoice or estimate.
   */
  async updateDocument(id: string, updateData: UpdateDocumentInput, container?: any): Promise<any> {
    const manager = container?.resolve?.("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};
    const settings = await this.getSettings(sharedContext, container);

    let record: any = null;
    try {
      record = await this.retrieveDocumentRecord(id, {}, sharedContext);
    } catch (_) {
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        record = await conn("document_record").where({ id }).first();
      }
    }

    if (!record) {
      throw new Error(`Document record '${id}' not found`);
    }

    let meta = (record.metadata || {}) as any;
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch (_) {
        meta = {};
      }
    }

    // 1. Process line items and recalculate total
    const newItems = updateData.items !== undefined ? updateData.items : (meta.items || []);
    let newTotal = updateData.total;
    if (newTotal === undefined && updateData.items !== undefined) {
      newTotal = newItems.reduce((acc: number, it: any) => {
        const qty = Number(it.quantity || 1);
        const rate = Number(it.unit_price || 0);
        return acc + qty * rate;
      }, 0);
    }
    if (newTotal === undefined) {
      newTotal = Number(record.total_amount || 0);
    }

    const newCustomerName = updateData.customer?.name || updateData.customer_name || record.customer_name;
    const newCustomerEmail = updateData.customer?.email !== undefined ? updateData.customer.email : (updateData.customer_email !== undefined ? updateData.customer_email : record.customer_email);
    const newCustomerPhone = updateData.customer?.phone !== undefined ? updateData.customer.phone : (updateData.customer_phone !== undefined ? updateData.customer_phone : record.customer_phone);
    const newTitle = updateData.title || record.title;
    const newNotes = updateData.notes !== undefined ? updateData.notes : meta.notes;
    const newTerms = updateData.terms !== undefined ? updateData.terms : meta.terms;
    const newCustomFields = { ...(meta.custom_fields || {}), ...(updateData.custom_fields || {}) };
    const newPaymentStatus = updateData.payment_status || record.payment_status;

    // Invalidate PDF cache for this document
    invalidatePdfCache(record.id);

    // 2. Synchronize updates to Zoho Books if credentials exist and document is invoice or estimate
    let zohoDocId = record.zoho_document_id;
    const canUseZoho =
      updateData.force_source !== "pdfkit" &&
      settings.zoho_books_enabled !== false &&
      Boolean(settings.zoho_client_id) &&
      Boolean(settings.zoho_client_secret) &&
      Boolean(settings.zoho_refresh_token) &&
      Boolean(settings.zoho_organization_id) &&
      (record.type === "invoice" || record.type === "estimate");

    if (canUseZoho) {
      try {
        const logger = container?.resolve?.("logger", { allowUnregistered: true });
        const zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          logger
        );

        const zohoLineItems = newItems.map((it: any) => ({
          name: it.title || it.name || "Item",
          description: it.description || "",
          rate: Number(it.unit_price || it.rate || 0).toFixed(2),
          quantity: Number(it.quantity || 1),
        }));

        if (zohoLineItems.length === 0 && Number(newTotal || 0) > 0) {
          zohoLineItems.push({
            name: newTitle || record.title || "Item",
            description: "",
            rate: Number(newTotal).toFixed(2),
            quantity: 1,
          });
        }

        let zohoNotes = newNotes || settings.zoho_invoice_notes || settings.pdf_payment_details || "Thank you for your business.";
        const pLink = record.short_payment_link || record.payment_link;
        if (pLink && !zohoNotes.includes("Pay Online:") && !zohoNotes.includes("Paystack Payment Link:")) {
          zohoNotes += `\n\nPaystack Payment Link: ${pLink}\nPay Online (Paystack): ${pLink}`;
        }
        const zohoTerms = newTerms || settings.zoho_invoice_terms || settings.pdf_terms || "";

        const customFields: Array<{ label: string; value: string }> = [];
        if (settings.zoho_custom_field_payment_link && settings.zoho_custom_field_payment_link.trim() !== "" && (record.short_payment_link || record.payment_link)) {
          customFields.push({
            label: settings.zoho_custom_field_payment_link,
            value: (record.short_payment_link || record.payment_link) as string,
          });
        }

        const contactId = await zoho.syncContact({
          first_name: newCustomerName,
          email: newCustomerEmail,
          phone: sanitizePhoneNumber(newCustomerPhone),
        });

        if (record.type === "invoice") {
          if (!zohoDocId) {
            const existingInZoho = await zoho.getInvoiceByNumber(record.display_id);
            if (existingInZoho) {
              zohoDocId = existingInZoho.invoice_id;
            }
          }

          if (zohoDocId) {
            await zoho.updateInvoice(zohoDocId, {
              customer_id: contactId,
              reason: "Updated via Admin Dashboard",
              line_items: zohoLineItems.length > 0 ? zohoLineItems : undefined,
              notes: zohoNotes,
              terms: zohoTerms,
              custom_fields: customFields.length > 0 ? customFields : undefined,
            });
          } else {
            const res = await zoho.createInvoice(contactId, {
              reference_number: record.display_id,
              invoice_number: record.display_id,
              ignore_auto_number_generation: true,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              payment_terms: settings.zoho_payment_terms_days || 0,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields.length > 0 ? customFields : undefined,
            });
            zohoDocId = res.invoice_id;
          }
        } else if (record.type === "estimate") {
          if (!zohoDocId) {
            const existingInZoho = await zoho.getEstimateByNumber(record.display_id);
            if (existingInZoho) {
              zohoDocId = existingInZoho.estimate_id;
            }
          }

          if (zohoDocId) {
            await zoho.updateEstimate(zohoDocId, {
              customer_id: contactId,
              line_items: zohoLineItems.length > 0 ? zohoLineItems : undefined,
              notes: zohoNotes,
              terms: zohoTerms,
              custom_fields: customFields.length > 0 ? customFields : undefined,
            });
          } else {
            const res = await zoho.createEstimate(contactId, {
              reference_number: record.display_id,
              estimate_number: record.display_id,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields.length > 0 ? customFields : undefined,
            });
            zohoDocId = res.estimate_id;
          }
        }
        record.source = "zoho";
      } catch (zohoErr: any) {
        container?.resolve?.("logger", { allowUnregistered: true })?.warn?.(
          `[Documents-Module] Failed to update document in Zoho Books (${zohoErr.message}). Saving changes locally.`
        );
      }
    }

    // 3. Update database record
    const updatedMeta = {
      ...meta,
      items: newItems,
      notes: newNotes,
      terms: newTerms,
      custom_fields: newCustomFields,
    };

    let updatedRecord: any = null;
    try {
      updatedRecord = await this.updateDocumentRecords(
        {
          id: record.id,
          title: newTitle,
          customer_name: newCustomerName,
          customer_email: newCustomerEmail,
          customer_phone: newCustomerPhone,
          total_amount: newTotal,
          payment_status: newPaymentStatus,
          zoho_document_id: zohoDocId,
          source: zohoDocId ? "zoho" : record.source,
          metadata: updatedMeta,
        },
        sharedContext
      );
    } catch (_) {
      const conn = getDatabaseConnection(container) || getDatabaseConnection((this as any).__container__);
      if (conn) {
        await conn("document_record")
          .where({ id: record.id })
          .update({
            title: newTitle,
            customer_name: newCustomerName,
            customer_email: newCustomerEmail,
            customer_phone: newCustomerPhone,
            total_amount: newTotal,
            payment_status: newPaymentStatus,
            zoho_document_id: zohoDocId,
            source: zohoDocId ? "zoho" : record.source,
            metadata: JSON.stringify(updatedMeta),
            updated_at: new Date(),
          });
        updatedRecord = await conn("document_record").where({ id: record.id }).first();
      }
    }

    invalidatePdfCache(record.id);
    return updatedRecord || record;
  }
}

export default DocumentModuleService;
