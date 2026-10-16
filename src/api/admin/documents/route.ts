import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../modules/documents/service";

// GET /admin/documents
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  const manager = req.scope.resolve("manager", { allowUnregistered: true });
  const sharedContext = manager ? { manager } : {};

  const { type, source, status, search, take = 50, skip = 0 } = req.query as any;

  const filters: Record<string, any> = {};
  if (type && type !== "all") filters.type = type;
  if (source && source !== "all") filters.source = source;
  if (status && status !== "all") filters.status = status;

  let records: any[] = [];
  let count = 0;

  try {
    const [fetchedRecords, fetchedCount] = await documentService.listAndCountDocumentRecords(
      filters,
      {
        take: Number(take),
        skip: Number(skip),
        order: { created_at: "DESC" },
      },
      sharedContext
    );
    records = fetchedRecords;
    count = fetchedCount;
  } catch (err: any) {
    // Fallback: If MikroORM fork error occurs, query pg_connection directly
    const pgConnection: any = getDatabaseConnection(req.scope);
    if (pgConnection) {
      let query = pgConnection("document_record");
      if (filters.type) query = query.where({ type: filters.type });
      if (filters.source) query = query.where({ source: filters.source });
      if (filters.status) query = query.where({ status: filters.status });

      const countResult = await query.clone().count("id as count").first();
      count = Number(countResult?.count || 0);

      records = await query
        .orderBy("created_at", "desc")
        .limit(Number(take))
        .offset(Number(skip));
    } else {
      req.scope.resolve("logger")?.error(`[Documents-API] Error listing documents: ${err.message}`);
      return res.status(500).json({ message: err.message, error: true });
    }
  }

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
