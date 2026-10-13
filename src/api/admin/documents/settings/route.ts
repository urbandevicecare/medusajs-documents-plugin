import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService from "../../../../modules/documents/service";

// GET /admin/documents/settings
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const settings = await documentService.getSettings();
    return res.json({ settings, success: true });
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error fetching settings: ${err.message}`);
    return res.status(500).json({ message: err.message, error: true });
  }
}

// POST /admin/documents/settings
export async function POST(req: MedusaRequest<any>, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    let [settings] = await documentService.listDocumentSettings({});

    // Filter out read-only / metadata columns that cause MikroORM update errors
    const { id, created_at, updated_at, deleted_at, ...cleanData } = req.body || {};

    if (cleanData.zoho_payment_terms_days !== undefined) {
      cleanData.zoho_payment_terms_days = Number(cleanData.zoho_payment_terms_days || 0);
    }

    if (!settings) {
      settings = await documentService.createDocumentSettings(cleanData);
    } else {
      settings = await documentService.updateDocumentSettings({
        id: settings.id,
        ...cleanData,
      });
    }

    return res.json({ settings, success: true });
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error updating settings: ${err.message}`);
    return res.status(500).json({ message: err.message, error: true });
  }
}
