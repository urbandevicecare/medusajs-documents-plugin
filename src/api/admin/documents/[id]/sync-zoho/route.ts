import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { ZohoBooksService } from "../../../../../services/zoho-books";

// POST /admin/documents/:id/sync-zoho
export async function POST(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const id = req.params.id;

  const record = await documentService.retrieveDocumentRecord(id);
  const settings = await documentService.getSettings();

  if (!settings.zoho_books_enabled || !settings.zoho_client_id) {
    return res.status(400).json({
      message: "Zoho Books integration is not enabled or credentials are missing.",
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
    req.scope.resolve("logger")
  );

  // 1. Sync contact
  const contactId = await zoho.syncContact({
    first_name: record.customer_name || "Customer",
    email: record.customer_email || undefined,
    phone: record.customer_phone || undefined,
  });

  const meta = (record.metadata || {}) as any;
  const items = (meta.items || []).map((it: any) => ({
    name: it.title,
    description: it.description || "",
    rate: Number(it.unit_price || 0).toFixed(2),
    quantity: it.quantity || 1,
  }));

  let zohoDocId: string;
  if (record.type === "estimate") {
    const est = await zoho.createEstimate(contactId, {
      reference_number: record.display_id,
      line_items: items,
      notes: meta.notes || settings.zoho_invoice_notes,
    });
    zohoDocId = est.estimate_id;
  } else {
    const inv = await zoho.createInvoice(contactId, {
      reference_number: record.display_id,
      line_items: items,
      notes: meta.notes || settings.zoho_invoice_notes,
      terms: settings.zoho_invoice_terms,
      payment_terms: settings.zoho_payment_terms_days,
      is_inclusive_tax: settings.zoho_tax_inclusive,
    });
    zohoDocId = inv.invoice_id;
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
