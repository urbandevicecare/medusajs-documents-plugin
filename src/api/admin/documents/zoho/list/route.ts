import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { ZohoBooksService } from "../../../../../services/zoho-books";

// GET /admin/documents/zoho/list?type=invoices | estimates | payments
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const settings = await documentService.getSettings();

  if (!settings.zoho_books_enabled || !settings.zoho_client_id) {
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
      req.scope.resolve("logger")
    );

    const type = (req.query.type as string) || "invoices";
    let items: any[] = [];

    if (type === "estimates") {
      items = await zoho.listEstimates();
    } else if (type === "payments") {
      items = await zoho.listPayments();
    } else {
      items = await zoho.listInvoices();
    }

    res.json({
      enabled: true,
      type,
      items,
    });
  } catch (error: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Failed to fetch Zoho documents: ${error.message}`);
    res.status(500).json({
      enabled: true,
      error: error.message,
      items: [],
    });
  }
}
