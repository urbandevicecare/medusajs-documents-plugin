import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// GET /api/documents/:id/document (Public PDF download & view for recipients)
export async function GET(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const cleanId = (req.params.id || "").replace(/\.pdf$/i, "");

  try {
    let record: any = null;
    try {
      record = await documentService.retrieveDocumentRecord(cleanId);
    } catch (e) {}

    if (!record) {
      const records = await documentService.listDocumentRecords({ display_id: cleanId }).catch(() => []);
      if (records && records.length > 0) {
        record = records[0];
      }
    }

    if (!record) {
      const records = await documentService.listDocumentRecords({ repair_ticket_id: cleanId }).catch(() => []);
      if (records && records.length > 0) {
        record = records[0];
      }
    }

    if (!record) {
      try {
        const repairModule: any = req.scope.resolve("repair", { allowUnregistered: true });
        if (repairModule) {
          let tickets = await repairModule.listRepairTickets({ approval_token: cleanId }).catch(() => []);
          if (!tickets || tickets.length === 0) {
            tickets = await repairModule.listRepairTickets({ id: cleanId }).catch(() => []);
          }
          if (tickets && tickets.length > 0) {
            const ticket = tickets[0];
            const metaDocId = (ticket.metadata as any)?.document_id;
            if (metaDocId) {
              record = await documentService.retrieveDocumentRecord(metaDocId).catch(() => null);
            }
          }
        }
      } catch (e) {}
    }

    if (!record) {
      return res.status(404).send("Document not found");
    }

    const pdfBuffer = await documentService.getPdfForRecord(record.id, req.scope);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${record.display_id}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(pdfBuffer);
  } catch (err: any) {
    req.scope.resolve("logger")?.error?.(`[Documents-API] Error streaming PDF: ${err.message}`);
    return res.status(500).send(`Failed to generate document: ${err.message}`);
  }
}
