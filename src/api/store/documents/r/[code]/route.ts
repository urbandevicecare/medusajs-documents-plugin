import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// GET /store/documents/r/:code
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  const code = req.params.code;
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  const links = await documentService.listDocumentLinks({ shortcode: code });

  if (links && links.length > 0) {
    let targetUrl = links[0].url;
    if (targetUrl.startsWith("/")) {
      const host = req.get("host") || "localhost:9000";
      const protocol = req.protocol || "http";
      targetUrl = `${protocol}://${host}${targetUrl}`;
    }
    res.setHeader("Location", targetUrl);
    return res.status(302).send("Redirecting...");
  }

  return res.status(404).send("Document link not found or expired.");
}
