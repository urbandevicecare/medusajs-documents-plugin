import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { handleShortlinkRedirect } from "../../../../../utils/shortlink-resolver";

// GET /store/documents/r/:code (Public storefront shortlink redirect)
export async function GET(req: MedusaRequest<{ code: string }>, res: MedusaResponse) {
  return handleShortlinkRedirect(req, res, "Store-Documents-Shortlink");
}
