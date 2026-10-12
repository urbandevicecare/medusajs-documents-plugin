import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// GET /store/documents/r/:code
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  const code = req.params.code;
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  const links = await documentService.listDocumentLinks({ shortcode: code });

  if (links && links.length > 0) {
    res.setHeader("Location", links[0].url);
    return res.status(302).send("Redirecting...");
  }

  return res.status(404).send("Document link not found or expired.");
}
