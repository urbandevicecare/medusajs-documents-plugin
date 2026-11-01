import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { PDFKitGenerator, DocumentData } from "../../../../../services/pdfkit-generator";

export const AUTHENTICATE = false;

// GET /admin/documents/templates/preview?style=modern | classic | minimal&type=invoice | receipt | packing_slip | estimate | custom | job_card
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const settings = (await documentService.getSettings({}, req.scope).catch(() => ({}))) || {};

    const rawStyle = String(req.query.style || "").trim().toLowerCase();
    const validStyles = ["modern", "classic", "minimal", "zoho_exact", "standard"];
    const style = validStyles.includes(rawStyle) ? rawStyle : "modern";

    const rawType = String(req.query.type || "").trim().toLowerCase();
    const validTypes = ["invoice", "receipt", "packing_slip", "estimate", "custom", "job_card"];
    const type = (validTypes.includes(rawType) ? rawType : "invoice") as DocumentData["type"];

    const isJobCard = type === "job_card";
    const isCustom = type === "custom";
    const isReceipt = type === "receipt";
    const isPackingSlip = type === "packing_slip";
    const isEstimate = type === "estimate";

    const companyName = settings.company_name || "Urban Device Care Ltd";
    const rawPreset = String(req.query.preset || "").trim().toLowerCase();

    // Preset dictionary for custom documents
    const PRESETS: Record<string, { title: string; body_text: string; items: any[] }> = {
      warranty: {
        title: "Warranty Certificate",
        body_text: "This official certificate verifies that the aforementioned device has undergone professional repairs with genuine OEM-specification components and has passed our multi-point quality assurance inspection.\n\nAll hardware replacements and associated workshop labor are covered under our comprehensive 90-day warranty against defects in parts and workmanship. Please retain this document for warranty verification.",
        items: [
          { title: "OEM Component & Hardware Warranty", description: "90-Day Comprehensive Hardware Protection", quantity: 1, unit_price: 0, total: 0 },
          { title: "Workshop Quality Clearance", description: "Multi-Point Hardware Bench Certification", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
      diagnostic: {
        title: "Diagnostic & Hardware Inspection Report",
        body_text: "Our certified repair specialists have completed a hardware and firmware inspection of your equipment. Below are the confirmed technical findings, component test measurements, and technician notes regarding the state of your device.",
        items: [
          { title: "Logic Board & Power Rail Inspection", description: "Voltage drop and circuit continuity tested", quantity: 1, unit_price: 0, total: 0 },
          { title: "Display & Touch Digitizer Diagnostic", description: "Digitizer touch grid, TrueTone, and Ambient Sensor test", quantity: 1, unit_price: 0, total: 0 },
          { title: "Battery Health & Thermal Profiling", description: "Cycle count, capacity retention, and charge testing", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
      service_completion: {
        title: "Certificate of Service Completion",
        body_text: "This document certifies that the requested overhaul, maintenance, and repair services have been executed in full accordance with industry service standards. The device has cleared bench testing and is ready for customer collection.",
        items: [
          { title: "Hardware Servicing & Component Replacement", description: "Executed per work order specifications", quantity: 1, unit_price: 0, total: 0 },
          { title: "Final Bench Testing & Quality Control", description: "Passed 100% functional test criteria", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
      handover: {
        title: "Equipment Handover & Custody Release Agreement",
        body_text: "This handover document certifies the return and physical custody release of customer equipment and associated accessories from Urban Device Care. The customer acknowledges receipt of equipment in verified working order.",
        items: [
          { title: "Device Handover & Physical Release", description: "Customer custody confirmed", quantity: 1, unit_price: 0, total: 0 },
          { title: "Accessories Handover", description: "Chargers, cases, and cables returned in verified condition", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
      proforma: {
        title: "Commercial Quotation (Proforma)",
        body_text: "Thank you for choosing Urban Device Care. Below is an itemized breakdown of estimated hardware parts, workshop labor, and turnaround schedule for your project. This quote is valid for 14 calendar days.",
        items: [
          { title: "OEM Replacement Hardware Assembly", description: "Brand new replacement module", quantity: 1, unit_price: 15000, total: 15000 },
          { title: "Workshop Labor & Clean-Room Installation", description: "Certified technician installation & calibration", quantity: 1, unit_price: 4500, total: 4500 },
        ],
      },
      trade_in: {
        title: "Device Trade-In & Buyback Agreement",
        body_text: "This agreement confirms the valuation, transfer of title, and trade-in credit for the listed customer hardware. Customer verifies legal ownership and consents to complete data sanitation and ownership transfer.",
        items: [
          { title: "Trade-In Device Valuation & Credit", description: "Assessed Grade A condition allowance", quantity: 1, unit_price: 25000, total: 25000 },
          { title: "Data Sanitization & Ownership Transfer", description: "Certified NIST 800-88 cryptographic wipe", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
      destruction: {
        title: "Certificate of Destruction & Eco-Disposal",
        body_text: "This certificate confirms that the decommissioned hardware listed below has been safely demanufactured, shredded, or recycled in full compliance with WEEE and data destruction standards.",
        items: [
          { title: "Hardware Demanufacturing & Shredding", description: "Certified environmental destruction", quantity: 1, unit_price: 0, total: 0 },
          { title: "Hazardous Materials Recycling", description: "Zero-landfill lithium battery reclamation", quantity: 1, unit_price: 0, total: 0 },
        ],
      },
    };

    const activePreset = isCustom ? (PRESETS[rawPreset] || PRESETS.warranty) : null;

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
        ? `DOC-${(rawPreset || "CERT").toUpperCase().slice(0, 4)}-7701`
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
        : (activePreset?.title || "Warranty Certificate"),
      type: type,
      date: new Date().toISOString().split("T")[0],
      due_date: (type === "invoice" || isEstimate)
        ? new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
        : undefined,
      customer: {
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "+254 712 345 678",
        address: "Bekim House, Westlands Crossway Rd, Nairobi",
      },
      company: {
        name: companyName,
        logo_url: settings.pdf_logo_url,
        address: settings.pdf_address || "Bekim House, 04 Westlands Crossway Rd, Westlands, Nairobi, Kenya",
        phone: settings.pdf_phone || "0729 436 660 / 0794 700 241",
        email: settings.pdf_email || "urbandevice.care@gmail.com",
        website: settings.pdf_website || "www.urbandevicecare.co.uk",
        payment_details: settings.pdf_payment_details || "Paybill: 400200 | Acc: 1039764",
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
        ? activePreset!.items
        : [
            {
              title: "Apple iPhone 14 Screen Replacement",
              description: "OEM Grade OLED Assembly with TrueTone restoration",
              quantity: 1,
              unit_price: 18500.0,
              total: 18500.0,
            },
            {
              title: "Diagnostic & Workshop Labor Fee",
              description: "Full device diagnostic and multi-point hardware inspection",
              quantity: 1,
              unit_price: 4500.0,
              total: 4500.0,
            },
            {
              title: "Tempered Glass Screen Protector",
              description: "9H Hardness Edge-to-Edge protection",
              quantity: 1,
              unit_price: 1500.0,
              total: 1500.0,
            },
          ],
      subtotal: (isJobCard || isPackingSlip || (isCustom && !activePreset?.items.some((i: any) => i.unit_price > 0))) ? undefined : 24500.0,
      tax_total: (isJobCard || isPackingSlip || isCustom) ? undefined : 0,
      discount_total: (isJobCard || isPackingSlip || isCustom) ? undefined : 0,
      total: (isJobCard || isPackingSlip || (isCustom && !activePreset?.items.some((i: any) => i.unit_price > 0))) ? 0 : 24500.0,
      currency_code: "kes",
      payment_status: isReceipt ? "paid" : "unpaid",
      payment_link: (type === "invoice" || isEstimate) ? "https://urbandevicecare.co.uk/r/sample-preview" : undefined,
      qr_url: (type === "invoice" || isEstimate || isJobCard) ? "https://urbandevicecare.co.uk/r/sample-preview" : undefined,
      notes: isJobCard
        ? "Customer acknowledges device physical intake condition and workshop repair terms."
        : isReceipt
        ? "Payment received in full. Thank you for your business!"
        : isPackingSlip
        ? "Please inspect contents immediately upon receipt. Keep this slip for your delivery records."
        : isEstimate
        ? "This quotation is valid for 14 calendar days from the date of issue."
        : isCustom
        ? "Please retain this official document for your records and compliance."
        : "Thank you for choosing Urban Device Care. Payment details above.",
      body_text: isCustom
        ? activePreset!.body_text
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
