import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../../../modules/documents/service";

// GET /admin/documents/:id/document
export async function GET(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const manager = req.scope.resolve("manager", { allowUnregistered: true });
  const sharedContext = manager ? { manager } : {};
  const cleanId = (req.params.id || "").replace(/\.pdf$/i, "");

  try {
    let record: any = null;
    // Check by ID or display_id
    try {
      record = await documentService.retrieveDocumentRecord(cleanId, {}, sharedContext);
    } catch (e) {}

    if (!record) {
      try {
        const records = await documentService.listDocumentRecords({ display_id: cleanId }, {}, sharedContext);
        if (records && records.length > 0) {
          record = records[0];
        }
      } catch (_) {}
    }

    if (!record) {
      try {
        const records = await documentService.listDocumentRecords({ repair_ticket_id: cleanId }, {}, sharedContext);
        if (records && records.length > 0) {
          record = records[0];
        }
      } catch (_) {}
    }

    if (!record) {
      const pg: any = getDatabaseConnection(req.scope);
      if (pg) {
        record = await pg("document_record")
          .whereNull("deleted_at")
          .where((builder: any) => {
            builder
              .where({ id: cleanId })
              .orWhere({ display_id: cleanId })
              .orWhere({ repair_ticket_id: cleanId });
          })
          .first();
      }
    }

    if (!record) {
      return res.status(404).send("Document not found");
    }

    const pdfBuffer = await documentService.getPdfForRecord(record.id, req.scope, sharedContext);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${record.display_id}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(pdfBuffer);
  } catch (err: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[Documents-API] Error streaming PDF: ${err.message}`);
    } catch (_) {}
    return res.status(500).send(`Failed to generate document: ${err.message}`);
  }
}
