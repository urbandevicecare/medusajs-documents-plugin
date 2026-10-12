import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService from "../../../../modules/documents/service";

// GET /admin/documents/settings
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const settings = await documentService.getSettings();
  res.json({ settings });
}

// POST /admin/documents/settings
export async function POST(req: MedusaRequest<any>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  let [settings] = await documentService.listDocumentSettings({});

  if (!settings) {
    settings = await documentService.createDocumentSettings(req.body);
  } else {
    settings = await documentService.updateDocumentSettings({
      id: settings.id,
      ...req.body,
    });
  }

  res.json({ settings });
}
