import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { PDFKitGenerator, DocumentData } from "../../../../../services/pdfkit-generator";
import { postProcessPdf } from "../../../../../services/pdf-post-processor";

// GET /admin/documents/templates/preview?style=modern | classic | minimal&type=invoice | receipt | packing_slip | estimate | custom | job_card
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const settings = (await documentService.getSettings().catch(() => ({}))) || {};

    const style = (req.query.style as string) || "modern";
    const type = (req.query.type as any) || "invoice";

    const isJobCard = type === "job_card";

    const sampleData: DocumentData = {
      display_id: isJobCard ? "JOB-1042" : "PREVIEW-001",
      title: isJobCard
        ? "Repair Job Card"
        : type === "invoice"
        ? "Sample Tax Invoice"
        : type === "receipt"
        ? "Sample Payment Receipt"
        : type === "packing_slip"
        ? "Sample Packing Slip"
        : type === "estimate"
        ? "Sample Quotation"
        : "Sample Custom Certificate",
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
        email: settings.pdf_email || "support@urbandevicecare.co.uk",
        website: settings.pdf_website || "www.urbandevicecare.co.uk",
        payment_details: settings.pdf_payment_details || "Bank: Barclays | Acct: 12345678 | Sort: 20-00-00",
        terms: settings.pdf_terms || "Payment is due within 14 days of invoice date. Thank you for your business.",
      },
      items: isJobCard
        ? [
            { title: "Initial Physical Inspection & Safety Boot Test", quantity: 1, unit_price: 0, total: 0 },
            { title: "OEM OLED Display Replacement & Digitizer Calibration", quantity: 1, unit_price: 0, total: 0 },
            { title: "TrueTone & Ambient Light Sensor Transfer", quantity: 1, unit_price: 0, total: 0 },
            { title: "Battery Health Diagnostic & Load Testing", quantity: 1, unit_price: 0, total: 0 },
            { title: "Final Multi-Point Bench Clearance & Sanitization", quantity: 1, unit_price: 0, total: 0 },
          ]
        : [
            {
              title: "Apple iPhone 14 Screen Replacement",
              description: "OEM Grade OLED Assembly with TrueTone restoration",
              quantity: 1,
              unit_price: 189.0,
              total: 189.0,
            },
            {
              title: "Diagnostic & Workshop Labor Fee",
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
      subtotal: isJobCard ? undefined : 249.0,
      tax_total: isJobCard ? undefined : 24.9,
      discount_total: isJobCard ? undefined : 10.0,
      total: isJobCard ? 0 : 263.9,
      currency_code: "usd",
      payment_status: isJobCard ? "unpaid" : "unpaid",
      payment_link: "https://store.example.com/pay/sample-token",
      qr_url: "https://store.example.com/pay/sample-token",
      notes: isJobCard
        ? "Customer acknowledges device physical intake condition and workshop repair terms."
        : "Please scan the QR code to complete payment securely via Paystack.",
      custom_fields: isJobCard
        ? {
            "Device Model": "Apple iPhone 14 Pro Max",
            "Serial / IMEI": "F2LZ90K8MD6R",
            "Technician": "Alex Morgan",
            "Reported Fault": "Cracked front glass, intermittent touch on upper quadrant",
            "Cosmetic Condition": "Light casing scuffs; screen fractured",
            "Accessories Left": "None (Unit only)",
          }
        : undefined,
    };

    const rawBuffer = await PDFKitGenerator.generate(sampleData, style);
    const pdfBuffer = await postProcessPdf(rawBuffer, {
      qrUrl: sampleData.qr_url,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-${style}-${type}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error generating preview: ${err.message}`);
    return res.status(500).send(`Failed to generate preview: ${err.message}`);
  }
}
