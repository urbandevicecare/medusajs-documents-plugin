import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../../modules/documents/service";
import ZohoBooksService from "../../../../services/zoho-books";

// GET /admin/documents/:id - Retrieve single document record
export async function GET(
  req: MedusaRequest<{ id: string }>,
  res: MedusaResponse
) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const docId = req.params.id;

    let record: any = null;
    try {
      record = await documentService.retrieveDocumentRecord(docId);
    } catch (_) {
      const conn = getDatabaseConnection(req.scope);
      if (conn) {
        record = await conn("document_record").where({ id: docId }).first();
      }
    }

    if (!record) {
      return res.status(404).json({ message: "Document record not found", error: true });
    }

    return res.json({ document: record });
  } catch (error: any) {
    return res.status(500).json({ message: error.message, error: true });
  }
}

// DELETE /admin/documents/:id - Delete a document record (and in Zoho Books if applicable)
export async function DELETE(
  req: MedusaRequest<{ id: string }>,
  res: MedusaResponse
) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const docId = req.params.id;

    let record: any = null;
    try {
      record = await documentService.retrieveDocumentRecord(docId);
    } catch (_) {
      const conn = getDatabaseConnection(req.scope);
      if (conn) {
        record = await conn("document_record").where({ id: docId }).first();
      }
    }

    if (!record) {
      return res.status(404).json({ message: "Document record not found", error: true });
    }

    // If Zoho document exists, try deleting it from Zoho Books as well
    if (record.zoho_document_id) {
      try {
        const settings = await documentService.getSettings(undefined, req.scope);
        if (
          settings?.zoho_books_enabled &&
          settings.zoho_client_id &&
          settings.zoho_client_secret &&
          settings.zoho_refresh_token &&
          settings.zoho_organization_id
        ) {
          const zoho = new ZohoBooksService(
            {
              client_id: settings.zoho_client_id,
              client_secret: settings.zoho_client_secret,
              refresh_token: settings.zoho_refresh_token,
              organization_id: settings.zoho_organization_id,
              domain: settings.zoho_domain || "com",
            },
            req.scope.resolve("logger", { allowUnregistered: true })
          );

          if (record.type === "invoice") {
            await zoho.deleteInvoice(record.zoho_document_id).catch(() => {});
          } else if (record.type === "estimate") {
            await zoho.deleteEstimate(record.zoho_document_id).catch(() => {});
          } else if (record.type === "receipt") {
            await zoho.deletePayment(record.zoho_document_id).catch(() => {});
          }
        }
      } catch (_) {}
    }

    try {
      await documentService.deleteDocumentRecords(docId);
    } catch (_) {
      const conn = getDatabaseConnection(req.scope);
      if (conn) {
        await conn("document_record").where({ id: docId }).delete();
      }
    }

    return res.json({
      success: true,
      message: "Document deleted successfully",
      id: docId,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message, error: true });
  }
}
