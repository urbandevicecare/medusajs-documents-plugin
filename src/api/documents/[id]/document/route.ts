import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../../modules/documents/service";

// GET /documents/:id/document (Public PDF download & view for recipients)
export async function GET(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const cleanId = (req.params.id || "").replace(/\.pdf$/i, "");

  const manager = req.scope.resolve("manager", { allowUnregistered: true });
  const sharedContext = manager ? { manager } : {};

  try {
    let record: any = null;
    // Check by primary ID or human display_id (e.g. INV-1092, JOB-101, RCPT-101)
    try {
      record = await documentService.retrieveDocumentRecord(cleanId, {}, sharedContext);
    } catch (e) {}

    if (!record) {
      const records = await documentService.listDocumentRecords({ display_id: cleanId }, {}, sharedContext).catch(() => []);
      if (records && records.length > 0) {
        record = records[0];
      }
    }

    if (!record) {
      const records = await documentService.listDocumentRecords({ repair_ticket_id: cleanId }, {}, sharedContext).catch(() => []);
      if (records && records.length > 0) {
        record = records[0];
      }
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

    // Fallback: If not in documents table, check if cleanId is an approval token or ID in repair module
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

    const pdfBuffer = await documentService.getPdfForRecord(record.id, req.scope, sharedContext);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${record.display_id}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(pdfBuffer);
  } catch (err: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[Documents-Public] Error streaming PDF: ${err.message}`);
    } catch (_) {}
    return res.status(500).send(`Failed to generate document: ${err.message}`);
  }
}
