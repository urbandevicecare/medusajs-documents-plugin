import { MedusaContainer } from "@medusajs/framework/types";
import { GenerateDocumentInput } from "../modules/documents/service";

/**
 * Universal helper for third-party plugins (e.g. medusajs-repairshop-plugin, custom checkout)
 * to delegate document generation to the Documents Plugin when installed.
 *
 * Usage in another plugin:
 * ```ts
 * import { delegateDocumentGeneration } from "medusajs-documents-plugin";
 *
 * const result = await delegateDocumentGeneration(container, {
 *   display_id: "RT-1001",
 *   title: "Repair Invoice",
 *   type: "invoice",
 *   customer: { name: "John Doe", email: "john@example.com" },
 *   items: [{ title: "Screen Repair", quantity: 1, unit_price: 120 }],
 *   total: 120,
 *   currency_code: "usd",
 *   auto_send: true
 * });
 * ```
 */
export async function delegateDocumentGeneration(
  container: MedusaContainer,
  input: GenerateDocumentInput
): Promise<{ record: any; pdfBuffer: Buffer } | null> {
  try {
    const documentService: any = container.resolve("documents", { allowUnregistered: true });
    if (documentService) {
      return await documentService.generateDocument(input, container);
    }
  } catch (err) {
    console.warn("[Documents-Integration] Failed to resolve documents module:", err);
  }
  return null;
}

export default delegateDocumentGeneration;
