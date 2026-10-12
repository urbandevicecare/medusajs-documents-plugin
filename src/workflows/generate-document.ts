import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService, { GenerateDocumentInput } from "../modules/documents/service";

export const generateDocumentStep = createStep(
  "generate-document-step",
  async (input: GenerateDocumentInput, { container }) => {
    const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE);
    const result = await documentService.generateDocument(input, container);
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

export const generateDocumentWorkflow = createWorkflow(
  "generate-document-workflow",
  (input: GenerateDocumentInput) => {
    const result = generateDocumentStep(input);
    return new WorkflowResponse(result);
  }
);

export default generateDocumentWorkflow;
