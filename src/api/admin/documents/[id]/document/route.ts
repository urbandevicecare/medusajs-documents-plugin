import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// GET /admin/documents/:id/document
export async function GET(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const id = req.params.id;

  try {
    let record: any = null;
    // Check by ID or display_id
    try {
      record = await documentService.retrieveDocumentRecord(id);
    } catch (e) {
      const records = await documentService.listDocumentRecords({ display_id: id });
      if (records && records.length > 0) {
        record = records[0];
      }
    }

    if (!record) {
      return res.status(404).send("Document not found");
    }

    const pdfBuffer = await documentService.getPdfForRecord(record.id, req.scope);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${record.display_id}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(pdfBuffer);
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error streaming PDF: ${err.message}`);
    return res.status(500).send(`Failed to generate document: ${err.message}`);
  }
}
