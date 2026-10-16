import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { handleShortlinkRedirect } from "../../../utils/shortlink-resolver";

// GET /r/:code (Universal public shortlink redirect)
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  return handleShortlinkRedirect(req, res, "Shortlink-Public");
}
