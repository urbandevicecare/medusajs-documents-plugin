import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService from "../../../../modules/documents/service";

// POST /admin/documents/manual
export async function POST(req: MedusaRequest<any>, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);

    const {
      display_id,
      title,
      type = "invoice",
      customer,
      items = [],
      currency_code = "usd",
      notes,
      terms,
      force_source,
      auto_send = false,
      send_email_now = false,
      notification_channels,
      email_subject,
      custom_email_message,
    } = req.body || {};

    let total = 0;
    for (const item of items) {
      const qty = Number(item.quantity || 1);
      const rate = Number(item.unit_price || 0);
      total += qty * rate;
    }

    const result = await documentService.generateDocument(
      {
        display_id,
        title: title || (type === "invoice" ? "Tax Invoice" : "Quotation"),
        type: type as any,
        customer: {
          name: customer?.name || "Customer",
          email: customer?.email,
          phone: customer?.phone,
          address: customer?.address,
        },
        items,
        total,
        currency_code,
        notes,
        force_source,
        auto_send: auto_send || send_email_now,
        notification_channels,
        email_subject,
        custom_email_message,
      },
      req.scope
    );

    return res.json({
      document: result.record,
      success: true,
    });
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error creating manual document: ${err.message}`);
    return res.status(500).json({ message: err.message, success: false });
  }
}
