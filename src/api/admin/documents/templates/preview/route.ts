import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../../../../../modules/documents";
import DocumentModuleService from "../../../../../modules/documents/service";
import { PDFKitGenerator, DocumentData } from "../../../../../services/pdfkit-generator";
import { sanitizePhoneNumber } from "../../../../../utils/phone-sanitizer";

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
    const isCertRequest = rawType === "certificate";
    const validTypes = ["invoice", "receipt", "packing_slip", "estimate", "custom", "job_card", "service_report", "handover", "certificate"];
    const resolvedType = isCertRequest ? "custom" : (validTypes.includes(rawType) ? rawType : "invoice");
    const type = resolvedType as DocumentData["type"];

    const isJobCard = type === "job_card";
    const isCustom = type === "custom";
    const isReceipt = type === "receipt";
    const isPackingSlip = type === "packing_slip";
    const isEstimate = type === "estimate";

    const companyName = settings.company_name || "Urban Device Care Ltd";
    const rawPreset = String(req.query.preset || "").trim().toLowerCase();

    // Preset dictionary for custom documents
    const PRESETS: Record<string, { title: string; body_text: string; items: any[]; custom_fields?: Record<string, string>; notes?: string }> = {
      warranty: {
        title: "Warranty Certificate",
        body_text: "This official Warranty Certificate certifies that the serviced hardware specified below has undergone complete technical overhaul, component replacement, and bench testing in accordance with manufacturer specifications.\n\nAll genuine replacement components and associated technical workshop labor are guaranteed against functional defects for a period of 90 days from the date of issue. Urban Device Care warrants that all installed modules have passed rigorous electrical load and multi-point quality assurance protocols.",
        items: [
          { title: "OEM Screen Assembly & Digitizer Replacement", description: "90-Day Comprehensive Warranty Coverage against touch and display anomalies", quantity: 1, unit_price: 0, total: 0 },
          { title: "Internal Power Management & Battery Calibration", description: "Warranty against capacity degradation and voltage fluctuations", quantity: 1, unit_price: 0, total: 0 },
          { title: "Clean-Room Workshop Installation & Bench Clearance", description: "Certified labor coverage and water/dust ingress seal integrity", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Apple iPhone 15 Pro Max (256GB - Natural Titanium)",
          "Serial / IMEI": "F2LZ90K8MD6R",
          "Ticket Reference": "RT-2024-8841",
          "Technician": "Bonifencia A. (Lead Certified Engineer)",
          "Coverage Period": "90 Days from Date of Collection",
          "Warranty Status": "Active & Validated",
        },
        notes: "Warranty excludes accidental damage, liquid ingress, unauthorized third-party tampering, or software jailbreaking. Please retain this document and quote your ticket reference number for any warranty claims.",
      },
      service_completion: {
        title: "Certificate of Service Completion",
        body_text: "This Certificate of Service Completion verifies that all diagnostic, repair, and maintenance procedures authorized under the referenced work order have been satisfactorily executed in full adherence to ISO/IPC hardware rework standards.\n\nThe equipment has successfully cleared all pre-delivery functional verifications, thermal load evaluations, and electrical safety diagnostics, and is officially released as fully operational.",
        items: [
          { title: "Hardware Overhaul & Micro-Soldering Service", description: "Replaced degraded SMD power filtering capacitors and restored logic board rails", quantity: 1, unit_price: 0, total: 0 },
          { title: "Firmware Diagnostics & Peripheral Bench Testing", description: "100% operational clearance on audio codecs, cameras, biometric sensors, and radios", quantity: 1, unit_price: 0, total: 0 },
          { title: "Acoustic Chamber & Thermal Stress Verification", description: "Pass: Maximum load temperature maintained within normal threshold (38°C)", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "MacBook Pro 16-inch (M2 Max - Space Grey)",
          "Serial / IMEI": "C02G8027MD6T",
          "Ticket Reference": "RT-2024-9104",
          "Technician": "Bonifencia A. (Lead Certified Engineer)",
          "Quality Control Inspector": "Kevin M. (Senior QA Specialist)",
          "Final Testing Result": "PASSED - All Benchmarks Satisfied",
        },
        notes: "All original customer data was preserved intact. Device firmware updated to current stable release. The client has 7 days from collection to report any cosmetic or configuration discrepancies.",
      },
      destruction: {
        title: "Certificate of Destruction & Eco-Disposal",
        body_text: "This Certificate of Destruction legally certifies that the decommissioned computing equipment and electronic media detailed herein have been securely and irrevocably destroyed in compliance with NIST SP 800-88 Rev. 1 guidelines and WEEE environmental disposal regulations.\n\nAll storage media have undergone physical de-manufacturing, mechanical shredding, and complete demagnetization, ensuring zero residual data retrievability. Non-hazardous materials have been transferred to certified green-reclamation facilities.",
        items: [
          { title: "Physical Demanufacturing & High-Torque Shredding", description: "Particle size reduced below DIN 66399 Level H-5 security standards", quantity: 1, unit_price: 0, total: 0 },
          { title: "Certified NIST 800-88 Cryptographic & Magnetic Sanitization", description: "Complete data eradication across all solid-state and magnetic platters", quantity: 1, unit_price: 0, total: 0 },
          { title: "Hazardous Materials & Lithium Battery Eco-Reclamation", description: "Zero-landfill certified chemical neutralization and precious metal recovery", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Dell PowerEdge R740 Server / 4x 1.92TB NVMe",
          "Serial / IMEI": "SN-DELL-882194-X",
          "Ticket Reference": "RT-2024-7712",
          "Destruction Method": "Physical Shear Shredding & Degaussing",
          "Compliance Standard": "NIST SP 800-88 Rev. 1 & WEEE Directive",
          "Authorized Disposal Officer": "Bonifencia A. (Certified Waste Handler)",
        },
        notes: "Urban Device Care Ltd indemnifies the client against data breach liabilities originating from the specified serialized assets following the verified execution of destruction protocols.",
      },
      diagnostic: {
        title: "Diagnostic & Hardware Inspection Report",
        body_text: "Our certified repair specialists have concluded an in-depth hardware, firmware, and electrical diagnostic examination of your device. The comprehensive technical findings, voltage line readings, and component health metrics are detailed below alongside our certified remediation roadmap.",
        items: [
          { title: "Logic Board Primary Power Rail Diagnostic", description: "PP_VDD_MAIN measured at 3.82V (Nominal). No ground short-circuits detected on primary PMIC", quantity: 1, unit_price: 0, total: 0 },
          { title: "Display Digitizer & Touch Array Profiling", description: "Matrix micro-fracture identified in bottom-left corner causing erratic capacitive touch feedback", quantity: 1, unit_price: 0, total: 0 },
          { title: "Battery Health & Internal Impedance Evaluation", description: "Current capacity: 74% of design capacity (842 cycles). Service battery recommended", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Samsung Galaxy S23 Ultra (512GB - Phantom Black)",
          "Serial / IMEI": "358941092847120",
          "Ticket Reference": "RT-2024-6523",
          "Technician": "Bonifencia A. (Lead Certified Engineer)",
          "Diagnostic Verdict": "Component Replacement Feasible",
          "Estimated Labor Time": "2.5 Workshop Hours",
        },
        notes: "Diagnostic findings remain valid for 14 calendar days. Internal safety seals have been inspected and logged.",
      },
      handover: {
        title: "Equipment Handover & Custody Release Agreement",
        body_text: "This Handover Agreement legally documents the transfer of custody of the repaired equipment and accessories listed below from Urban Device Care to the client or authorized corporate representative.\n\nThe recipient confirms that the device has been inspected, tested in their presence (including display, camera, audio, and network connectivity), and accepted in verified good working condition.",
        items: [
          { title: "Primary Computing Device Release", description: "Serial verified, cosmetic inspection performed, customer account signed in", quantity: 1, unit_price: 0, total: 0 },
          { title: "OEM 96W USB-C Power Adapter & Braided Cable", description: "Tested and verified delivering 20V/4.8A under load", quantity: 1, unit_price: 0, total: 0 },
          { title: "Protective Hard Case & Accessories", description: "Returned in clean, intact custody state", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Lenovo ThinkPad X1 Carbon Gen 10",
          "Serial / IMEI": "PF-29X810-22",
          "Ticket Reference": "RT-2024-5390",
          "Released By": "Bonifencia A. (Urban Device Care)",
          "Received By": "Authorized Client Representative",
          "Handover Condition": "Inspected & Approved in Workshop",
        },
        notes: "By accepting handover, the client acknowledges satisfactory return of all custody items and confirms device operability.",
      },
      proforma: {
        title: "Commercial Quotation (Proforma)",
        body_text: "Thank you for choosing Urban Device Care. Below is an itemized commercial quotation detailing required OEM components, workshop labor, precision calibration, and expected turnaround schedule for your equipment overhaul.\n\nThis quotation is valid for 14 calendar days from the date of issue. Upon formal approval, component procurement and bench allocation will commence immediately.",
        items: [
          { title: "OEM Liquid Retina XDR Display Assembly", description: "Brand new original factory panel with factory color calibration", quantity: 1, unit_price: 42000, total: 42000 },
          { title: "Clean-Room Workshop Installation & Sensor Alignment", description: "Certified clean-room installation, gasket replacement & TrueTone calibration", quantity: 1, unit_price: 6500, total: 6500 },
          { title: "Hydrophobic Dust & Water Ingress Seal Restoration", description: "OEM adhesive barrier pressure cured to IP68 rating", quantity: 1, unit_price: 2500, total: 2500 },
        ],
        custom_fields: {
          "Device Model": "Apple iPad Pro 12.9-inch (6th Gen - Wi-Fi + Cellular)",
          "Serial / IMEI": "DLXW9201M93K",
          "Ticket Reference": "RT-2024-4190",
          "Estimator / Technician": "Bonifencia A.",
          "Validity Period": "14 Calendar Days",
          "Estimated Turnaround": "24 - 48 Hours",
        },
        notes: "All replaced hardware carries our standard 90-day warranty coverage. Payment accepted via M-Pesa, Bank Transfer, or Credit/Debit Card.",
      },
      trade_in: {
        title: "Device Trade-In & Buyback Agreement",
        body_text: "This Agreement formalizes the title transfer, functional evaluation, and agreed trade-in credit valuation for the customer-owned equipment listed below.\n\nThe seller warrants that they are the sole lawful owner of the equipment, that it is free of all liens, financial encumbrances, iCloud/Google activation locks, and corporate MDM profiles. Urban Device Care agrees to apply the confirmed credit towards service fees or disbursement.",
        items: [
          { title: "Trade-In Device Valuation Allowance (Grade A)", description: "Full functional clearance: battery health 91%, minor bezel wear, pristine screen", quantity: 1, unit_price: 35000, total: 35000 },
          { title: "NIST 800-88 Cryptographic Data Sanitation Protocol", description: "Certified factory reset and firmware wipe with zero data retention guarantee", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Apple iPhone 13 Pro (128GB - Sierra Blue)",
          "Serial / IMEI": "G6TD9021ML8R",
          "Ticket Reference": "RT-2024-3829",
          "Activation Lock": "Removed & Verified Off",
          "Assessed Grade": "Grade A (Excellent)",
          "Evaluation Specialist": "Bonifencia A.",
        },
        notes: "Ownership transfers immediately upon document execution. Valuation is binding and irrevocable once trade-in payout or store credit is issued.",
      },
      blank: {
        title: "Official Document",
        body_text: "This official technical document confirms the specifications, service terms, and verified conditions documented by Urban Device Care for the specified customer asset.",
        items: [
          { title: "Professional Hardware Inspection & Maintenance Service", description: "Certified technical evaluation and service clearance", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Computing Asset / Hardware Module",
          "Serial / IMEI": "SN-XXXX-XXXX",
          "Ticket Reference": "RT-2024-0001",
          "Technician": "Bonifencia A.",
        },
        notes: "Standard terms and conditions apply. For inquiries, contact info@urbandevicecare.co.uk.",
      },
      generic: {
        title: "Official Document",
        body_text: "This official technical document confirms the specifications, service terms, and verified conditions documented by Urban Device Care for the specified customer asset.",
        items: [
          { title: "Professional Hardware Inspection & Maintenance Service", description: "Certified technical evaluation and service clearance", quantity: 1, unit_price: 0, total: 0 },
        ],
        custom_fields: {
          "Device Model": "Computing Asset / Hardware Module",
          "Serial / IMEI": "SN-XXXX-XXXX",
          "Ticket Reference": "RT-2024-0001",
          "Technician": "Bonifencia A.",
        },
        notes: "Standard terms and conditions apply. For inquiries, contact info@urbandevicecare.co.uk.",
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
        phone: sanitizePhoneNumber(settings.pdf_phone) || "0729 436 660 / 0794 700 241",
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
      payment_link: type === "invoice" ? "https://urbandevicecare.co.uk/r/sample-preview-pay" : undefined,
      qr_url: type === "invoice"
        ? "https://urbandevicecare.co.uk/r/sample-preview-pay"
        : isJobCard
        ? "https://urbandevicecare.co.uk/r/sample-preview-job-card"
        : isEstimate
        ? "https://urbandevicecare.co.uk/r/sample-preview-quote"
        : "https://urbandevicecare.co.uk/r/sample-preview-document",
      notes: isJobCard
        ? "Customer acknowledges device physical intake condition and workshop repair terms."
        : isReceipt
        ? "Payment received in full. Thank you for your business!"
        : isPackingSlip
        ? "Please inspect contents immediately upon receipt. Keep this slip for your delivery records."
        : isEstimate
        ? "This quotation is valid for 14 calendar days from the date of issue."
        : isCustom
        ? (activePreset?.notes || "Please retain this official document for your records and compliance.")
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
        : isCustom && activePreset?.custom_fields
        ? activePreset.custom_fields
        : undefined,
    };

    const pdfBuffer = await PDFKitGenerator.generate(sampleData, style);

    const totalLength = pdfBuffer.length;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="preview-${style}-${type}.pdf"`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    const range = req.headers?.range;
    if (range && req.method !== "HEAD") {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

      if (!isNaN(start) && start < totalLength) {
        const chunkEnd = Math.min(end, totalLength - 1);
        const chunk = pdfBuffer.subarray(start, chunkEnd + 1);
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${chunkEnd}/${totalLength}`);
        res.setHeader("Content-Length", String(chunk.length));
        return res.send(chunk);
      }
    }

    res.setHeader("Content-Length", String(totalLength));
    return res.send(pdfBuffer);
  } catch (err: any) {
    req.scope.resolve("logger")?.error(`[Documents-API] Error generating preview: ${err.message}`);
    return res.status(500).send(`Failed to generate preview: ${err.message}`);
  }
}

// HEAD /admin/documents/templates/preview
export const HEAD = GET;
