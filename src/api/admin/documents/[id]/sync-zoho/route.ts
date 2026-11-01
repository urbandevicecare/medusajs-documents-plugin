import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { ZohoBooksService } from "../../../../../services/zoho-books";
import { sanitizePhoneNumber } from "../../../../../utils/phone-sanitizer";

// POST /admin/documents/:id/sync-zoho
export async function POST(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const id = req.params.id;

  const record = await documentService.retrieveDocumentRecord(id);
  const settings = await documentService.getSettings();

  if (!settings.zoho_books_enabled || !settings.zoho_client_id) {
    return res.status(400).json({
      message: "Zoho Books integration is not enabled or credentials are missing.",
      success: false,
    });
  }

  // Reject non-Zoho document types (only invoice and estimate documents are supported)
  if (record.type !== "invoice" && record.type !== "estimate") {
    return res.status(400).json({
      message: `Cannot push ${record.type} documents to Zoho Books. Only invoice and estimate documents are supported.`,
      success: false,
    });
  }

  // Reject documents with zero or negative total amount
  if (Number(record.total_amount || 0) <= 0) {
    return res.status(400).json({
      message: "Cannot push documents with zero total amount to Zoho Books.",
      success: false,
    });
  }

  const zoho = new ZohoBooksService(
    {
      client_id: settings.zoho_client_id,
      client_secret: settings.zoho_client_secret,
      refresh_token: settings.zoho_refresh_token,
      organization_id: settings.zoho_organization_id,
      domain: settings.zoho_domain || "com",
    },
    req.scope.resolve("logger", { allowUnregistered: true })
  );

  const meta = (record.metadata || {}) as any;
  const companyName = meta.customer_company_name || meta.company_name;

  // 1. Sync contact (prioritize company name)
  const contactId = await zoho.syncContact({
    first_name: record.customer_name || "Customer",
    company_name: companyName || undefined,
    email: record.customer_email || undefined,
    phone: sanitizePhoneNumber(record.customer_phone) || undefined,
  });

  const items = (meta.items || []).map((it: any) => ({
    name: it.title,
    description: it.description || "",
    rate: Number(it.unit_price || 0).toFixed(2),
    quantity: it.quantity || 1,
  }));

  // Prepare custom notes including payment link if applicable
  let zohoNotes = settings.zoho_invoice_notes || settings.pdf_payment_details || meta.notes || "Thank you for your business.";
  const pLink = record.short_payment_link || record.payment_link;
  if (pLink && !zohoNotes.includes("Pay Online:")) {
    zohoNotes += `\n\nPay Online: ${pLink}`;
  }
  const zohoTerms = settings.zoho_invoice_terms || settings.pdf_terms || "";

  let zohoDocId: string;
  if (record.type === "estimate") {
    const existingEst = await zoho.getEstimateByNumber(record.display_id);
    if (existingEst) {
      zohoDocId = existingEst.estimate_id;
      try {
        await zoho.updateEstimate(zohoDocId, {
          line_items: items.length > 0 ? items : undefined,
          notes: zohoNotes,
          terms: zohoTerms,
        });
      } catch (err: any) {
        req.scope.resolve("logger", { allowUnregistered: true })?.warn?.(`[sync-zoho] Failed to update existing Zoho estimate ${zohoDocId}: ${err?.message || err}`);
      }
    } else {
      const est = await zoho.createEstimate(contactId, {
        reference_number: record.display_id,
        line_items: items,
        notes: zohoNotes,
        terms: zohoTerms,
      });
      zohoDocId = est.estimate_id;
    }
  } else {
    const existingInv = await zoho.getInvoiceByNumber(record.display_id);
    if (existingInv) {
      zohoDocId = existingInv.invoice_id;
      try {
        await zoho.updateInvoice(zohoDocId, {
          line_items: items.length > 0 ? items : undefined,
          notes: zohoNotes,
          terms: zohoTerms,
          payment_terms: settings.zoho_payment_terms_days,
          is_inclusive_tax: settings.zoho_tax_inclusive,
        });
      } catch (err: any) {
        req.scope.resolve("logger", { allowUnregistered: true })?.warn?.(`[sync-zoho] Failed to update existing Zoho invoice ${zohoDocId}: ${err?.message || err}`);
      }
    } else {
      const inv = await zoho.createInvoice(contactId, {
        reference_number: record.display_id,
        invoice_number: record.display_id,
        ignore_auto_number_generation: true,
        line_items: items,
        notes: zohoNotes,
        terms: zohoTerms,
        payment_terms: settings.zoho_payment_terms_days,
        is_inclusive_tax: settings.zoho_tax_inclusive,
      });
      zohoDocId = inv.invoice_id;
    }
  }

  const updated = await documentService.updateDocumentRecords({
    id: record.id,
    source: "zoho",
    zoho_document_id: zohoDocId,
  });

  res.json({
    document: updated,
    zoho_document_id: zohoDocId,
    success: true,
  });
}
