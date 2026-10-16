import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { PDFKitGenerator, DocumentData } from "../../../../../services/pdfkit-generator";

// GET /admin/documents/templates/preview?style=modern | classic | minimal&type=invoice | receipt | packing_slip | estimate | custom | job_card
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const settings = (await documentService.getSettings().catch(() => ({}))) || {};

    const rawStyle = String(req.query.style || "").trim().toLowerCase();
    const style = ["modern", "classic", "minimal"].includes(rawStyle) ? rawStyle : "modern";

    const rawType = String(req.query.type || "").trim().toLowerCase();
    const validTypes = ["invoice", "receipt", "packing_slip", "estimate", "custom", "job_card"];
    const type = (validTypes.includes(rawType) ? rawType : "invoice") as DocumentData["type"];

    const isJobCard = type === "job_card";
    const isCustom = type === "custom";
    const isReceipt = type === "receipt";
    const isPackingSlip = type === "packing_slip";
    const isEstimate = type === "estimate";

    const companyName = settings.company_name || "Urban Device Care Ltd";

    const sampleData: DocumentData = {
      display_id: isJobCard
        ? "JOB-1042"
        : isReceipt
        ? "REC-4019"
        : isPackingSlip
        ? "PKG-8821"
        : isEstimate
        ? "EST-3091"
        : isCustom
        ? "CERT-7701"
        : "INV-1092",
      title: isJobCard
        ? "Repair Job Card"
        : type === "invoice"
        ? "Tax Invoice"
        : isReceipt
        ? "Payment Receipt"
        : isPackingSlip
        ? "Packing Slip"
        : isEstimate
        ? "Quotation / Estimate"
        : "Warranty Certificate",
      type: type,
      date: new Date().toISOString().split("T")[0],
      due_date: (type === "invoice" || isEstimate)
        ? new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
        : undefined,
      customer: {
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "+44 7911 123456",
        address: "221B Baker Street, Marylebone, London, NW1 6XE",
      },
      company: {
        name: companyName,
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
        : isCustom
        ? [
            {
              title: "OEM Component & Hardware Warranty",
              description: "90-Day Comprehensive Hardware Protection",
              quantity: 1,
              unit_price: 0,
              total: 0,
            },
            {
              title: "Workshop Quality Clearance",
              description: "Multi-Point Hardware Bench Certification",
              quantity: 1,
              unit_price: 0,
              total: 0,
            },
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
      subtotal: (isJobCard || isPackingSlip || isCustom) ? undefined : 249.0,
      tax_total: (isJobCard || isPackingSlip || isCustom) ? undefined : 24.9,
      discount_total: (isJobCard || isPackingSlip || isCustom) ? undefined : 10.0,
      total: (isJobCard || isPackingSlip || isCustom) ? 0 : 263.9,
      currency_code: "kes",
      payment_status: isReceipt ? "paid" : "unpaid",
      payment_link: (type === "invoice" || isEstimate) ? "https://store.urbandevicecare.co.uk/pay/sample-preview-token" : undefined,
      qr_url: (type === "invoice" || isEstimate || isJobCard) ? "https://store.urbandevicecare.co.uk/track/JOB-1042" : undefined,
      notes: isJobCard
        ? "Customer acknowledges device physical intake condition and workshop repair terms."
        : isReceipt
        ? "Payment received in full via Paystack. Thank you for your custom!"
        : isPackingSlip
        ? "Please inspect contents immediately upon receipt. Keep this slip for your delivery records."
        : isEstimate
        ? "This quotation is valid for 30 calendar days from the date of issue."
        : isCustom
        ? "Retain this warranty certificate for official warranty claim verification."
        : "Please scan the QR code to complete payment securely via Paystack.",
      body_text: isCustom
        ? "This official certificate verifies that the aforementioned device has undergone professional repairs with genuine OEM-specification components and has passed our multi-point quality assurance inspection.\n\nAll hardware replacements and associated workshop labor are covered under our comprehensive 90-day warranty against defects in parts and workmanship."
        : undefined,
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

    const pdfBuffer = await PDFKitGenerator.generate(sampleData, style);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-${style}-${type}.pdf"`);
    res.setHeader("Content-Length", String(pdfBuffer.length));
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    return res.send(pdfBuffer);
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error generating preview: ${err.message}`);
    return res.status(500).send(`Failed to generate preview: ${err.message}`);
  }
}
