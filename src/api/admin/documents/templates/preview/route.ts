import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { PDFKitGenerator, DocumentData } from "../../../../../services/pdfkit-generator";
import { postProcessPdf } from "../../../../../services/pdf-post-processor";

// GET /admin/documents/templates/preview?style=modern | classic | minimal&type=invoice | receipt | packing_slip | estimate | custom
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
  const settings = await documentService.getSettings();

  const style = (req.query.style as string) || "modern";
  const type = (req.query.type as any) || "invoice";

  const sampleData: DocumentData = {
    display_id: "PREVIEW-001",
    title: type === "invoice" ? "Sample Tax Invoice" : (type === "receipt" ? "Sample Receipt" : (type === "packing_slip" ? "Sample Packing Slip" : "Sample Document")),
    type: type,
    date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    customer: {
      name: "Jane Doe",
      email: "jane.doe@example.com",
      phone: "+44 7911 123456",
      address: "221B Baker Street, London, UK",
    },
    company: {
      name: settings.company_name || "Urban Device Care Ltd",
      logo_url: settings.pdf_logo_url,
      address: settings.pdf_address || "123 High Street, Tech Park, London",
      phone: settings.pdf_phone || "+44 20 7946 0991",
      email: settings.pdf_email || "support@example.com",
      website: settings.pdf_website || "www.example.com",
      payment_details: settings.pdf_payment_details || "Bank: Barclays | Acct: 12345678 | Sort: 20-00-00 | MPESA: 987654",
      terms: settings.pdf_terms || "Payment is due within 14 days of invoice date. Thank you for your business.",
    },
    items: [
      {
        title: "Apple iPhone 14 Screen Replacement",
        description: "OEM Grade OLED Assembly with TrueTone restoration",
        quantity: 1,
        unit_price: 189.0,
        total: 189.0,
      },
      {
        title: "Diagnostic & Labor Fee",
        description: "Full device diagnostic and multi-point hardware inspection",
        quantity: 1,
        unit_price: 45.0,
        total: 45.0,
      },
      {
        title: "Tempered Glass Screen Protector",
        description: "9H Hardness Edge-to-Edge protection",
        quantity: 1,
        unit_price: 15.0,
        total: 15.0,
      },
    ],
    subtotal: 249.0,
    tax_total: 24.9,
    discount_total: 10.0,
    total: 263.9,
    currency_code: "usd",
    payment_status: "unpaid",
    payment_link: "https://store.example.com/pay/sample-token",
    qr_url: "https://store.example.com/pay/sample-token",
    notes: "Please scan the QR code to complete payment via Paystack or Cards.",
  };

  const rawBuffer = await PDFKitGenerator.generate(sampleData, style);
  const pdfBuffer = await postProcessPdf(rawBuffer, {
    qrUrl: sampleData.qr_url,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="preview-${style}-${type}.pdf"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.send(pdfBuffer);
}
