import { MedusaService } from "@medusajs/framework/utils";
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
  type: "invoice" | "receipt" | "estimate" | "packing_slip" | "custom";
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: LineItem[];
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  total: number;
  currency_code: string;
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
      invoice_template: "modern",
      packing_slip_template: "modern",
      receipt_template: "modern",
      estimate_template: "modern",
      custom_doc_template: "modern",
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

    // Generate unique display ID if not given
    const prefix = settings.zoho_invoice_prefix || "DOC-";
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
        total: input.total,
        currency_code: input.currency_code,
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

        const docType = record.type === "estimate" ? "estimate" : "invoice";
        const rawBuf = await zoho.getDocumentPdf(record.zoho_document_id, docType);
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
