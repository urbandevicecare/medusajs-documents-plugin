import { MedusaService, ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DocumentSettings } from "./models/document-settings";
import { DocumentRecord } from "./models/document-record";
import { DocumentLink } from "./models/document-link";
import { ZohoBooksService } from "../../services/zoho-books";
import { PDFKitGenerator, DocumentData, LineItem } from "../../services/pdfkit-generator";
import { postProcessPdf } from "../../services/pdf-post-processor";
import { NotificationSender } from "../../services/notification-sender";

export interface GenerateDocumentInput {
  display_id?: string;
  title?: string;
  type: "invoice" | "receipt" | "estimate" | "packing_slip" | "custom" | "job_card";
  customer?: {
    name: string;
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
  currency_code?: string;
  order_id?: string;
  repair_ticket_id?: string;
  payment_status?: string;
  payment_link?: string;
  notes?: string;
  body_text?: string;
  custom_fields?: Record<string, string>;
  force_source?: "zoho" | "pdfkit";
  auto_send?: boolean;
  notification_channels?: Array<"email" | "sms" | "whatsapp">;
  email_subject?: string;
  custom_email_message?: string;
}

export class DocumentModuleService extends MedusaService({
  DocumentSettings,
  DocumentRecord,
  DocumentLink,
}) {
  /**
   * Retrieves or initializes default plugin settings
   */
  async getSettings(): Promise<any> {
    const [settings] = await this.listDocumentSettings({});
    if (settings) {
      return settings;
    }
    return await this.createDocumentSettings({
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
      invoice_template: "modern",
      packing_slip_template: "modern",
      receipt_template: "modern",
      estimate_template: "modern",
      job_card_template: "modern",
      custom_doc_template: "modern",
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
    });
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
        return `${root}/api/store/documents/r/${existing[0].shortcode}`;
      }

      const shortcode = Math.random().toString(36).substring(2, 8);
      await this.createDocumentLinks({
        shortcode,
        url,
      });

      return `${root}/api/store/documents/r/${shortcode}`;
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
    const settings = await this.getSettings();
    const storeUrl = (settings.storefront_url || process.env.STORE_URL || "http://localhost:3000").replace(/\/$/, "");

    // 0. Auto-hydrate repair ticket data if needed
    if (input.repair_ticket_id && (!input.customer || !input.items || input.items.length === 0)) {
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
            const ticket = tickets[0];
            input.display_id = input.display_id || (input.type === "job_card" ? `JOB-${ticket.ticket_number}` : `RT-${ticket.ticket_number}`);
            input.title = input.title || (input.type === "job_card" ? "Repair Job Card" : "Repair Document");
            let customerName = "Valued Customer";
            let customerEmail: string | undefined = undefined;
            let customerPhone: string | undefined = undefined;
            if (ticket.customer_id) {
              const custMod = container.resolve("customer", { allowUnregistered: true });
              if (custMod) {
                const c = await custMod.retrieveCustomer(ticket.customer_id);
                if (c) {
                  customerName = c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.email || customerName;
                  customerEmail = c.email || undefined;
                  customerPhone = c.phone || undefined;
                }
              }
            }
            if (!input.customer) {
              input.customer = {
                name: customerName,
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
            if (input.type === "job_card" && ticket.approval_token) {
              input.payment_link = `${storeUrl}/repairs/track?token=${ticket.approval_token}`;
            }
          }
        }
      } catch (err) {}
    }

    if (!input.customer) {
      input.customer = { name: "Customer" };
    }
    if (!input.items) {
      input.items = [];
    }

    // Generate unique display ID if not given
    const prefix = input.type === "job_card" ? "JOB-" : (settings.zoho_invoice_prefix || "DOC-");
    const displayId = input.display_id || `${prefix}${Math.floor(100000 + Math.random() * 900000)}`;

    // Prepare short payment link if payment link is present
    let shortPaymentLink: string | undefined = undefined;
    if (input.payment_link) {
      shortPaymentLink = await this.getOrGenerateShortUrl(input.payment_link, storeUrl);
    }

    let source: "zoho" | "pdfkit" = "pdfkit";
    let zohoDocumentId: string | null = null;
    let pdfBuffer: Buffer | null = null;

    // Check if Zoho Books should be used
    const canUseZoho =
      input.force_source !== "pdfkit" &&
      settings.zoho_books_enabled &&
      settings.zoho_client_id &&
      settings.zoho_client_secret &&
      settings.zoho_refresh_token &&
      settings.zoho_organization_id &&
      (input.type === "invoice" || input.type === "estimate" || input.type === "receipt");

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

        // 1. Sync Contact in Zoho
        const contactId = await zoho.syncContact({
          first_name: input.customer.name,
          email: input.customer.email,
          phone: input.customer.phone,
        });

        // 2. Prepare Zoho Notes & Terms (including payment link if unpaid)
        let zohoNotes = input.notes || settings.zoho_invoice_notes || "Thank you for your business.";
        if (shortPaymentLink) {
          zohoNotes += `\n\nPay Online: ${shortPaymentLink}`;
        }
        const zohoTerms = settings.zoho_invoice_terms || "";

        const zohoLineItems = (input.items || []).map((it) => ({
          name: it.title,
          description: it.description || "",
          rate: Number(it.unit_price || 0).toFixed(2),
          quantity: it.quantity || 1,
        }));

        const customFields: Array<{ label: string; value: string }> = [];
        if (shortPaymentLink || input.payment_link) {
          customFields.push({
            label: settings.zoho_custom_field_payment_link || "Payment Link",
            value: (shortPaymentLink || input.payment_link) as string,
          });
        }

        if (input.type === "invoice") {
          const res = await zoho.createInvoice(contactId, {
            reference_number: displayId,
            line_items: zohoLineItems,
            notes: zohoNotes,
            terms: zohoTerms,
            payment_terms: settings.zoho_payment_terms_days || 0,
            is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
            custom_fields: customFields,
          });
          zohoDocumentId = res.invoice_id;
          source = "zoho";
          const rawBuffer = await zoho.getDocumentPdf(res.invoice_id, "invoice");
          const qrUrlToEmbed = settings.zoho_include_payment_qr !== false ? (shortPaymentLink || input.payment_link) : undefined;
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: qrUrlToEmbed,
            obscureZohoFooter: true,
          });
        } else if (input.type === "estimate") {
          const res = await zoho.createEstimate(contactId, {
            reference_number: displayId,
            line_items: zohoLineItems,
            notes: zohoNotes,
            terms: zohoTerms,
            is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
          });
          zohoDocumentId = res.estimate_id;
          source = "zoho";
          const rawBuffer = await zoho.getDocumentPdf(res.estimate_id, "estimate");
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: shortPaymentLink || input.payment_link,
            obscureZohoFooter: true,
          });
        } else if (input.type === "receipt") {
          // Fix 2: Implement Zoho Books payment registration in service.ts for input.type === "receipt" using zoho.registerPayment
          let targetInvoiceId: string | null = null;

          if (input.order_id) {
            const existingDocs = await this.listDocumentRecords({
              order_id: input.order_id,
              type: "invoice",
            });
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          } else if (input.repair_ticket_id) {
            const existingDocs = await this.listDocumentRecords({
              repair_ticket_id: input.repair_ticket_id,
              type: "invoice",
            });
            const inv = existingDocs.find((d: any) => d.zoho_document_id);
            if (inv) {
              targetInvoiceId = inv.zoho_document_id;
            }
          }

          // If no invoice was previously synchronized to Zoho, create one to attach the payment
          if (!targetInvoiceId) {
            const invRes = await zoho.createInvoice(contactId, {
              reference_number: displayId,
              line_items: zohoLineItems,
              notes: zohoNotes,
              terms: zohoTerms,
              payment_terms: 0,
              is_inclusive_tax: settings.zoho_tax_inclusive ?? false,
              custom_fields: customFields,
            });
            targetInvoiceId = invRes.invoice_id;
          }

          const paymentAmount = Number(input.total || 0);
          const paymentId = await zoho.registerPayment(
            targetInvoiceId,
            paymentAmount,
            contactId,
            "Online",
            displayId
          );

          zohoDocumentId = paymentId;
          source = "zoho";

          const rawBuffer = await zoho.getPaymentReceiptPdf(paymentId);
          pdfBuffer = await postProcessPdf(Buffer.from(rawBuffer), {
            qrUrl: shortPaymentLink || input.payment_link,
            obscureZohoFooter: true,
          });
        }
      } catch (zohoErr: any) {
        container?.resolve("logger")?.warn(`[Documents-Module] Zoho Books generation failed (${zohoErr.message}). Falling back to PDFKit.`);
        source = "pdfkit";
        zohoDocumentId = null;
        pdfBuffer = null;
      }
    }

    // -------------------------------------------------------------
    // PDFKit Fallback / Primary Generation
    // -------------------------------------------------------------
    if (!pdfBuffer) {
      source = "pdfkit";
      let templateName = settings.invoice_template || "modern";
      if (input.type === "packing_slip") templateName = settings.packing_slip_template || "modern";
      else if (input.type === "receipt") templateName = settings.receipt_template || "modern";
      else if (input.type === "estimate") templateName = settings.estimate_template || "modern";
      else if (input.type === "job_card") templateName = settings.job_card_template || "modern";
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
        currency_code: input.currency_code || "usd",
        payment_status: input.payment_status || "unpaid",
        payment_link: shortPaymentLink || input.payment_link,
        qr_url: shortPaymentLink || input.payment_link,
        notes: input.notes,
        body_text: input.body_text,
        custom_fields: input.custom_fields,
      };

      const rawBuffer = await PDFKitGenerator.generate(docData, templateName);
      pdfBuffer = await postProcessPdf(rawBuffer, {
        qrUrl: shortPaymentLink || input.payment_link,
      });
    }

    // Save Record to Database
    const initialPdfUrl = `${storeUrl}/api/admin/documents/temp/document`;
    const record = await this.createDocumentRecords({
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
      pdf_url: `${storeUrl}/api/admin/documents/${displayId}/document`,
      metadata: {
        items: input.items,
        notes: input.notes,
        body_text: input.body_text,
        custom_fields: input.custom_fields,
      },
    });

    // Update with real short URL for document
    const realPdfUrl = `${storeUrl}/api/admin/documents/${record.id}/document`;
    const shortPdfLink = await this.getOrGenerateShortUrl(realPdfUrl, storeUrl);

    await this.updateDocumentRecords({
      id: record.id,
      pdf_url: realPdfUrl,
      short_pdf_link: shortPdfLink,
    });
    record.pdf_url = realPdfUrl;
    record.short_pdf_link = shortPdfLink;

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
  async getPdfForRecord(recordId: string, container?: any): Promise<Buffer> {
    const record = await this.retrieveDocumentRecord(recordId);
    const settings = await this.getSettings();

    // If source is Zoho and zoho_document_id exists, fetch from Zoho API
    if (
      record.source === "zoho" &&
      record.zoho_document_id &&
      settings.zoho_books_enabled &&
      settings.zoho_client_id
    ) {
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

        let rawBuf: ArrayBuffer;
        if (record.type === "receipt") {
          rawBuf = await zoho.getPaymentReceiptPdf(record.zoho_document_id);
        } else {
          const docType = record.type === "estimate" ? "estimate" : "invoice";
          rawBuf = await zoho.getDocumentPdf(record.zoho_document_id, docType);
        }

        return await postProcessPdf(Buffer.from(rawBuf), {
          qrUrl: record.short_payment_link || record.payment_link,
          obscureZohoFooter: true,
        });
      } catch (err: any) {
        container?.resolve("logger")?.warn(`[Documents-Module] Failed to fetch PDF from Zoho (${err.message}). Regenerating via PDFKit.`);
      }
    }

    // PDFKit Fallback Generation
    let templateName = settings.invoice_template || "modern";
    if (record.type === "packing_slip") templateName = settings.packing_slip_template || "modern";
    else if (record.type === "receipt") templateName = settings.receipt_template || "modern";
    else if (record.type === "estimate") templateName = settings.estimate_template || "modern";
    else if (record.type === "job_card") templateName = settings.job_card_template || "modern";
    else if (record.type === "custom") templateName = settings.custom_doc_template || "modern";

    const meta = (record.metadata || {}) as any;
    const docData: DocumentData = {
      display_id: record.display_id,
      title: record.title,
      type: record.type as any,
      date: new Date().toISOString().split("T")[0],
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
      items: meta.items || [],
      total: record.total_amount || 0,
      currency_code: record.currency_code || "usd",
      payment_status: record.payment_status,
      payment_link: record.short_payment_link || record.payment_link,
      qr_url: record.short_payment_link || record.payment_link,
      notes: meta.notes,
      body_text: meta.body_text,
      custom_fields: meta.custom_fields,
    };

    const rawBuffer = await PDFKitGenerator.generate(docData, templateName);
    return await postProcessPdf(rawBuffer, {
      qrUrl: record.short_payment_link || record.payment_link,
    });
  }
}

export default DocumentModuleService;
