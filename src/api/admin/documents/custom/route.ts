import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService from "../../../../modules/documents/service";

// POST /admin/documents/custom
export async function POST(req: MedusaRequest<any>, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

  const {
    title = "Custom Document",
    customer,
    body_text,
    items = [],
    total = 0,
    currency_code = "usd",
    notes,
    custom_fields,
    send_email_now = true,
    email_subject,
    custom_email_message,
  } = req.body;

  let computedTotal = Number(total || 0);
  if (items.length > 0 && computedTotal === 0) {
    for (const item of items) {
      computedTotal += Number(item.quantity || 1) * Number(item.unit_price || 0);
    }
  }

  const result = await documentService.generateDocument(
    {
      title: title,
      type: "custom",
      customer: {
        name: customer?.name || "Customer",
        email: customer?.email,
        phone: customer?.phone,
        address: customer?.address,
      },
      items,
      total: computedTotal,
      currency_code,
      body_text,
      notes,
      custom_fields,
      force_source: "pdfkit",
      auto_send: send_email_now,
      notification_channels: ["email"],
      email_subject: email_subject || `${title} from ${req.body.company_name || "Store"}`,
      custom_email_message: custom_email_message || body_text,
    },
    req.scope
  );

  res.json({
    document: result.record,
    sent_via_email: send_email_now,
    success: true,
  });
}
