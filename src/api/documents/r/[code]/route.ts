import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { handleShortlinkRedirect } from "../../../../utils/shortlink-resolver";

// GET /documents/r/:code (Public shortlink redirect - no publishable API key or admin auth required)
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  return handleShortlinkRedirect(req, res, "Documents-Public");
}
