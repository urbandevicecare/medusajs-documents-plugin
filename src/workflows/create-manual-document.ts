import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService, { GenerateDocumentInput } from "../modules/documents/service";

export interface CreateManualDocumentInput extends GenerateDocumentInput {
  send_email_now?: boolean;
}

export const createManualDocumentStep = createStep(
  "create-manual-document-step",
  async (input: CreateManualDocumentInput, { container }) => {
    const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE);
    const result = await documentService.generateDocument({
      ...input,
      auto_send: input.send_email_now || input.auto_send,
    }, container);

    return new StepResponse(result, { id: result.record.id });
  },
  async (compensationData, { container }) => {
    if (compensationData?.id) {
      try {
        const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE);
        await documentService.deleteDocumentRecords(compensationData.id);
      } catch (e) {}
    }
  }
);

export const createManualDocumentWorkflow = createWorkflow(
  "create-manual-document-workflow",
  (input: CreateManualDocumentInput) => {
    const result = createManualDocumentStep(input);
    return new WorkflowResponse(result);
  }
);

export default createManualDocumentWorkflow;
