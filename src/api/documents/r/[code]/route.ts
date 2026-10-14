import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService from "../../../../modules/documents/service";

// GET /documents/r/:code (Public shortlink redirect - no publishable API key or admin auth required)
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  const code = req.params.code;
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const links = await documentService.listDocumentLinks({ shortcode: code });

    if (links && links.length > 0) {
      let targetUrl = links[0].url;
      // If relative URL, prepend backend origin
      if (targetUrl.startsWith("/")) {
        const host = req.get("host") || "localhost:9000";
        const protocol = req.protocol || "http";
        targetUrl = `${protocol}://${host}${targetUrl}`;
      }
      res.setHeader("Location", targetUrl);
      return res.status(302).send("Redirecting...");
    }

    return res.status(404).send("Document link not found or expired.");
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-Public] Error resolving shortlink ${code}: ${err.message}`);
    return res.status(500).send("Error resolving document link");
  }
}
