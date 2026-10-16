import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { generateEntityId } from "@medusajs/framework/utils";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../../modules/documents/service";

// GET /admin/documents/settings
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const manager = req.scope.resolve("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};

    try {
      const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
      const settings = await documentService.getSettings(sharedContext, req.scope);
      return res.json({ settings, success: true });
    } catch (err: any) {
      // Fallback: If MikroORM fork error occurs, query pg_connection directly
      const pgConnection: any = getDatabaseConnection(req.scope);
      if (pgConnection) {
        let settings = await pgConnection("document_settings").whereNull("deleted_at").first();
        if (!settings) {
          const createdResult = await pgConnection("document_settings")
            .insert({
              id: generateEntityId(undefined, "docset"),
              company_name: "Store",
              email_notifications_enabled: true,
              sms_notifications_enabled: true,
              whatsapp_notifications_enabled: true,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning("*");
          settings = Array.isArray(createdResult) ? createdResult[0] : createdResult;
        }
        return res.json({ settings, success: true });
      }
      throw err;
    }
  } catch (err: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[Documents-API] Error fetching settings: ${err.message}`);
    } catch (_) {}
    return res.status(500).json({ message: err.message, error: true });
  }
}

// POST /admin/documents/settings
export async function POST(req: MedusaRequest<any>, res: MedusaResponse) {
  try {
    const manager = req.scope.resolve("manager", { allowUnregistered: true });
    const sharedContext = manager ? { manager } : {};

    // Filter out read-only / metadata columns that cause MikroORM update errors
    const { id, created_at, updated_at, deleted_at, ...cleanData } = req.body || {};

    if (cleanData.zoho_payment_terms_days !== undefined) {
      cleanData.zoho_payment_terms_days = Number(cleanData.zoho_payment_terms_days || 0);
    }

    let settings: any = null;

    try {
      const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
      let [existingSettings] = await documentService.listDocumentSettings({}, {}, sharedContext);

      if (!existingSettings) {
        settings = await documentService.createDocumentSettings(cleanData, sharedContext);
      } else {
        settings = await documentService.updateDocumentSettings({
          id: existingSettings.id,
          ...cleanData,
        }, sharedContext);
      }
    } catch (err: any) {
      // Fallback: If MikroORM fork error occurs, update via pg_connection directly
      const pgConnection: any = getDatabaseConnection(req.scope);
      if (pgConnection) {
        const existing = await pgConnection("document_settings").whereNull("deleted_at").first();
        if (existing) {
          const updatedResult = await pgConnection("document_settings")
            .where({ id: existing.id })
            .update({
              ...cleanData,
              updated_at: new Date(),
            })
            .returning("*");
          settings = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult;
        } else {
          const createdResult = await pgConnection("document_settings")
            .insert({
              id: generateEntityId(undefined, "docset"),
              ...cleanData,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning("*");
          settings = Array.isArray(createdResult) ? createdResult[0] : createdResult;
        }
      } else {
        throw err;
      }
    }

    return res.json({ settings, success: true });
  } catch (err: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[Documents-API] Error updating settings: ${err.message}`);
    } catch (_) {}
    return res.status(500).json({ message: err.message, error: true });
  }
}
