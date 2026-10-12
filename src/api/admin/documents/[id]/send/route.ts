import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { NotificationSender } from "../../../../../services/notification-sender";

// POST /admin/documents/:id/send
export async function POST(req: MedusaRequest<{ id: string }>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const id = req.params.id;
  const { channels, custom_message, subject } = req.body as any;

  const record = await documentService.retrieveDocumentRecord(id);
  const settings = await documentService.getSettings();

  const dispatchResult = await NotificationSender.send({
    container: req.scope,
    document: {
      id: record.id,
      display_id: record.display_id,
      title: record.title,
      type: record.type,
      customer_name: record.customer_name,
      customer_email: record.customer_email,
      customer_phone: record.customer_phone,
      total_amount: record.total_amount,
      currency_code: record.currency_code,
      payment_status: record.payment_status,
      payment_link: record.payment_link,
      short_payment_link: record.short_payment_link,
      pdf_url: record.pdf_url,
      short_pdf_link: record.short_pdf_link,
      custom_message,
      subject,
    },
    channels: channels || ["email"],
    settings,
  });

  res.json({
    success: true,
    result: dispatchResult,
  });
}
