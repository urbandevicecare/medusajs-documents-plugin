import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { ZohoBooksService } from "../../../../../services/zoho-books";

// GET /admin/documents/zoho/list?type=invoices | estimates | payments
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE, { allowUnregistered: true });
  if (!documentService) {
    return res.json({
      enabled: false,
      message: "Documents service unavailable.",
      items: [],
    });
  }

  const settings = await documentService.getSettings();

  const hasCredentials = Boolean(settings.zoho_client_id && settings.zoho_client_secret);
  if (!settings.zoho_books_enabled && !hasCredentials) {
    return res.json({
      enabled: false,
      message: "Zoho Books integration is not configured or disabled.",
      items: [],
    });
  }

  try {
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

    const type = (req.query.type as string) || "invoices";
    const searchText = (req.query.search as string) || (req.query.search_text as string);
    const page = Math.max(Number(req.query.page || 1), 1);
    const rawPerPage = Number(req.query.per_page || 100);
    const per_page = Math.min(Math.max(rawPerPage, 1), 100);
    let items: any[] = [];

    if (type === "estimates") {
      items = await zoho.listEstimates({ page, per_page });
    } else if (type === "payments" || type === "receipts") {
      items = await zoho.listPayments({ page, per_page });
    } else {
      items = await zoho.listInvoices({ page, per_page, search_text: searchText });
    }

    if (searchText && typeof searchText === "string" && searchText.trim() !== "") {
      const q = searchText.toLowerCase();
      items = items.filter((it: any) =>
        (it.invoice_number && String(it.invoice_number).toLowerCase().includes(q)) ||
        (it.estimate_number && String(it.estimate_number).toLowerCase().includes(q)) ||
        (it.payment_number && String(it.payment_number).toLowerCase().includes(q)) ||
        (it.reference_number && String(it.reference_number).toLowerCase().includes(q)) ||
        (it.customer_name && String(it.customer_name).toLowerCase().includes(q))
      );
    }

    return res.json({
      enabled: true,
      type,
      items,
    });
  } catch (error: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[Documents-API] Failed to fetch Zoho documents: ${error.message}`);
    } catch (_) {}
    return res.json({
      enabled: true,
      error: error.message,
      items: [],
    });
  }
}
