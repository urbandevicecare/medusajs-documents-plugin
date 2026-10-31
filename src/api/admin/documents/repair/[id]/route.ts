import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";

// DELETE /admin/documents/repair/:id - Delete all documents for a repair ticket (including in Zoho Books) so they can be regenerated
export async function DELETE(
  req: MedusaRequest<{ id: string }>,
  res: MedusaResponse
) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const repairTicketId = req.params.id;

    if (!repairTicketId) {
      return res.status(400).json({
        message: "Missing repair ticket ID",
        error: true,
      });
    }

    const result = await documentService.deleteDocumentsForRepairTicket(
      repairTicketId,
      req.scope
    );

    return res.json({
      success: true,
      message: "Successfully deleted all documents for repair ticket",
      repair_ticket_id: repairTicketId,
      ...result,
    });
  } catch (error: any) {
    req.scope.resolve("logger", { allowUnregistered: true })?.error?.(
      `[Documents-API] Failed to delete documents for repair ticket ${req.params.id}: ${error.message}`
    );
    return res.status(500).json({
      message: error.message || "Failed to delete repair documents",
      error: true,
    });
  }
}

// POST /admin/documents/repair/:id - Regenerate document for a repair ticket
export async function POST(
  req: MedusaRequest<{ id: string }>,
  res: MedusaResponse
) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const repairTicketId = req.params.id;

    const body = (req.body as any) || {};
    const docType = body.type || "invoice";

    const result = await documentService.generateDocument(
      {
        repair_ticket_id: repairTicketId,
        type: docType,
        force_source: body.force_source,
      },
      req.scope
    );

    return res.json({
      success: true,
      document: result.record,
    });
  } catch (error: any) {
    req.scope.resolve("logger", { allowUnregistered: true })?.error?.(
      `[Documents-API] Failed to regenerate document for repair ticket ${req.params.id}: ${error.message}`
    );
    return res.status(500).json({
      message: error.message || "Failed to regenerate document",
      error: true,
    });
  }
}
