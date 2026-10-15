import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// GET /store/documents/r/:code
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  const code = req.params.code;
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  let links = await documentService.listDocumentLinks({ shortcode: code });

  if (!links || links.length === 0) {
    try {
      const repairModule: any = req.scope.resolve("repair", { allowUnregistered: true });
      if (repairModule) {
        links = await repairModule.listRepairLinks({ shortcode: code });
      }
    } catch (e) {}
  }

  if (links && links.length > 0) {
    let targetUrl = links[0].url;
    const host = req.get("host") || "localhost:9000";
    const forwarded = typeof req.get === "function" ? req.get("x-forwarded-proto") : undefined;
    const protocol = (forwarded === "http" || forwarded === "https") ? forwarded : (req.protocol || "http");

    if (targetUrl.includes("/documents/")) {
      const docSubpath = targetUrl.slice(targetUrl.indexOf("/documents/")).replace(/\/admin\/documents\//, "/documents/");
      targetUrl = `${protocol}://${host}${docSubpath}`;
    } else if (targetUrl.startsWith("/")) {
      targetUrl = `${protocol}://${host}${targetUrl}`;
    }
    res.setHeader("Location", targetUrl);
    return res.status(302).send("Redirecting...");
  }

  return res.status(404).send("Document link not found or expired.");
}
