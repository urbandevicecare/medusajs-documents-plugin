import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../modules/documents";
import DocumentModuleService from "../../../modules/documents/service";

// GET /admin/documents
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  const { type, source, status, search, take = 50, skip = 0 } = req.query as any;

  const filters: Record<string, any> = {};
  if (type && type !== "all") filters.type = type;
  if (source && source !== "all") filters.source = source;
  if (status && status !== "all") filters.status = status;

  const [records, count] = await documentService.listAndCountDocumentRecords(
    filters,
    {
      take: Number(take),
      skip: Number(skip),
      order: { created_at: "DESC" },
    }
  );

  let filteredRecords = records;
  if (search && typeof search === "string" && search.trim() !== "") {
    const q = search.toLowerCase();
    filteredRecords = records.filter(
      (r: any) =>
        r.display_id?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_email?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q)
    );
  }

  res.json({
    documents: filteredRecords,
    count: count || filteredRecords.length,
    take: Number(take),
    skip: Number(skip),
  });
}
