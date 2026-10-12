import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService from "../modules/documents/service";
import { NotificationSender } from "../services/notification-sender";

export interface SendDocumentNotificationInput {
  documentId: string;
  channels?: Array<"email" | "sms" | "whatsapp">;
  custom_message?: string;
  subject?: string;
}

export const sendDocumentNotificationStep = createStep(
  "send-document-notification-step",
  async (input: SendDocumentNotificationInput, { container }) => {
    const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE);
    const record = await documentService.retrieveDocumentRecord(input.documentId);
    const settings = await documentService.getSettings();

    const dispatchResult = await NotificationSender.send({
      container,
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
        custom_message: input.custom_message,
        subject: input.subject,
      },
      channels: input.channels,
      settings,
    });

    return new StepResponse(dispatchResult);
  }
);

export const sendDocumentNotificationWorkflow = createWorkflow(
  "send-document-notification-workflow",
  (input: SendDocumentNotificationInput) => {
    const result = sendDocumentNotificationStep(input);
    return new WorkflowResponse(result);
  }
);

export default sendDocumentNotificationWorkflow;
