import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export interface LineItem {
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  tax?: number;
}

export interface DocumentData {
  display_id: string;
  title?: string;
  type: "invoice" | "receipt" | "estimate" | "packing_slip" | "custom" | "job_card" | "service_report" | "handover";
  date?: string;
  due_date?: string;
  customer: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  company: {
    name: string;
    logo_url?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    payment_details?: string;
    terms?: string;
    kra_pin?: string;
  };
  items: LineItem[];
  subtotal?: number;
  tax_total?: number;
  shipping_total?: number;
  discount_total?: number;
  total: number;
  currency_code: string;
  payment_status?: string;
  payment_link?: string | null;
  qr_url?: string | null;
  notes?: string;
  body_text?: string;
  custom_fields?: Record<string, string>;
}

export class PDFKitGenerator {
  static formatCurrency(amount?: number | null, currency: string = "KES"): string {
    const num = typeof amount === "number" && !isNaN(amount) ? amount : (Number(amount || 0) || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "KES").toUpperCase(),
      minimumFractionDigits: 2,
    }).format(num);
  }

  static formatDate(dateString?: string | Date): string {
    if (!dateString) return new Date().toLocaleDateString("en-GB");
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return new Date().toLocaleDateString("en-GB");
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  }

  static async generateBarcode(text: string): Promise<Buffer | null> {
    try {
      let bwipjs: any = null;
      try {
        bwipjs = require("bwip-js");
      } catch (_) {
        return null;
      }
      if (!bwipjs || typeof bwipjs.toBuffer !== "function") return null;

      return await bwipjs.toBuffer({
        bcid: "code128",
        text: String(text).trim(),
        scale: 2,
        height: 10,
        includetext: false,
      });
    } catch {
      return null;
    }
  }

  static async resolveLogoBuffer(logoUrl?: string | null): Promise<Buffer | null> {
    if (logoUrl && typeof logoUrl === "string" && logoUrl.trim().length > 0) {
      const cleanUrl = logoUrl.trim();
      try {
        if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          try {
            const res = await fetch(cleanUrl, { signal: controller.signal });
            if (res.ok) {
              const ab = await res.arrayBuffer();
              return Buffer.from(ab);
            }
          } finally {
            clearTimeout(timeoutId);
          }
        } else if (cleanUrl.startsWith("data:image/")) {
          const commaIdx = cleanUrl.indexOf(",");
          if (commaIdx !== -1) {
            const base64Data = cleanUrl.slice(commaIdx + 1);
            return Buffer.from(base64Data, "base64");
          }
        } else if (fs.existsSync(cleanUrl)) {
          return fs.readFileSync(cleanUrl);
        } else {
          const relCandidates = [
            path.resolve(process.cwd(), cleanUrl.replace(/^\//, "")),
            path.resolve(process.cwd(), "public", cleanUrl.replace(/^\//, "")),
            path.resolve(process.cwd(), "uploads", cleanUrl.replace(/^\//, "")),
            path.resolve(process.cwd(), "static", cleanUrl.replace(/^\//, "")),
          ];
          for (const rc of relCandidates) {
            if (fs.existsSync(rc)) {
              return fs.readFileSync(rc);
            }
          }
        }
      } catch (e) {}
    }

    const candidates = [
      path.resolve(__dirname, "../assets/logo.png"),
      path.resolve(__dirname, "../../assets/logo.png"),
      path.resolve(__dirname, "../../../src/assets/logo.png"),
      path.resolve(process.cwd(), "src/assets/logo.png"),
      path.resolve(process.cwd(), "src/utils/assets/logo.png"),
      path.resolve(process.cwd(), "node_modules/medusajs-documents-plugin/.medusa/server/src/assets/logo.png"),
      path.resolve(process.cwd(), "node_modules/medusajs-documents-plugin/src/assets/logo.png"),
      path.resolve(process.cwd(), "node_modules/medusajs-repairshop-plugin/src/utils/assets/logo.png"),
      path.resolve("/var/www/vhosts/urbandevicecare.co.uk/admin.urbandevicecare.co.uk/node_modules/medusajs-documents-plugin/.medusa/server/src/assets/logo.png"),
      path.resolve("/Users/slyb./Documents/Nelly/Medusajs Projects/Meduajs-repair-plugin/src/utils/assets/logo.png"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          return fs.readFileSync(c);
        } catch (_) {}
      }
    }
    return null;
  }

  static mapDataToTicket(data: DocumentData): any {
    const cleanTicketNumber = String(data.display_id || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
    return {
      ticket_number: cleanTicketNumber || data.display_id,
      created_at: data.date || new Date().toISOString().split("T")[0],
      status: data.payment_status === "paid" ? "completed" : "in_progress",
      payment_status: data.payment_status || "unpaid",
      customer: {
        email: data.customer?.email,
        phone: data.customer?.phone,
      },
      device: {
        brand: data.custom_fields?.["Brand"] || "",
        model_name: data.custom_fields?.["Device Model"] || data.custom_fields?.["Model"] || "Device",
        serial_number: data.custom_fields?.["Serial / IMEI"] || data.custom_fields?.["Serial Number"] || "N/A",
        condition: data.custom_fields?.["Condition"] || "Not specified",
      },
      accessories: data.custom_fields?.["Accessories"] || "None",
      issue_description: data.custom_fields?.["Reported Issue"] || data.custom_fields?.["Issue"] || data.notes || "Standard Service",
      technician_name: data.custom_fields?.["Technician"] || "Bonifencia A.",
    };
  }

  static mapDataToSettings(data: DocumentData): any {
    return {
      company_name: data.company?.name || "URBAN DEVICE CARE LTD",
      pdf_logo_url: data.company?.logo_url,
      pdf_address: data.company?.address || "Bekim House, Westlands Crossway Road\nNairobi 00800, Kenya",
      pdf_phone: data.company?.phone || "0729436660 / 0794700241",
      pdf_email: data.company?.email || "info@urbandevicecare.co.uk",
      pdf_website: data.company?.website || "www.urbandevicecare.co.uk",
      pdf_payment_details: data.company?.payment_details,
      pdf_terms: data.company?.terms,
      kra_pin: data.company?.kra_pin || data.custom_fields?.["KRA PIN"] || "P052534849N",
    };
  }

  // ---------------------------------------------------------------------------------
  // CONSISTENT COMPANY HEADER DRAWING HELPER (FROM REPAIR PLUGIN)
  // ---------------------------------------------------------------------------------
  private static drawConsistentHeader(
    doc: PDFKit.PDFDocument,
    logoBuffer: Buffer | null,
    settings: any,
    titleConfig: {
      title: string;
      subtitle?: string;
      docNumber?: string;
      dateLabel?: string;
      dateValue?: string;
      badgeText?: string;
      badgeColor?: string;
      amountLabel?: string;
      amountValue?: string;
      amountColor?: string;
    }
  ): number {
    const leftX = 45;
    const rightX = 330;
    const rightW = 220;
    let topY = 40;

    // 1. Logo or Brand Name on Top-Left
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, leftX, topY, { fit: [155, 54] });
      } catch (e) {
        doc.fontSize(16).font("Helvetica-Bold").fillColor("#111827").text(settings?.company_name || "URBAN DEVICE CARE LTD", leftX, topY);
      }
    } else {
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#111827").text(settings?.company_name || "URBAN DEVICE CARE LTD", leftX, topY);
    }

    // 2. Company Details below Logo
    let detailsY = topY + 58;
    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#111827").text((settings?.company_name || "Urban Device Care Ltd").toUpperCase(), leftX, detailsY);
    detailsY += 12;

    doc.fontSize(8).font("Helvetica").fillColor("#4b5563");
    const address = settings?.pdf_address || "Bekim House, Westlands Crossway Road\nNairobi 00800, Kenya";
    doc.text(address, leftX, detailsY, { width: 230 });
    detailsY += doc.heightOfString(address, { width: 230 }) + 2;

    const phone = settings?.pdf_phone || "0729436660 / 0794700241";
    doc.text(`Tel: ${phone}`, leftX, detailsY);
    detailsY += 11;

    const email = settings?.pdf_email || "info@urbandevicecare.co.uk";
    doc.text(`Email: ${email}`, leftX, detailsY);
    detailsY += 11;

    if (settings?.pdf_website) {
      doc.text(`Web: ${settings.pdf_website}`, leftX, detailsY);
      detailsY += 11;
    }

    const kraPin = settings?.kra_pin || "P052534849N";
    doc.font("Helvetica-Bold").fillColor("#111827").text(`KRA PIN: ${kraPin}`, leftX, detailsY);
    detailsY += 14;

    // 3. Right Header Block (Document title, number, date, badges)
    let rightY = topY;
    if (titleConfig.subtitle) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#6b7280").text(titleConfig.subtitle, rightX, rightY, { width: rightW, align: "right" });
      rightY += 13;
    }

    const titleFontSize = titleConfig.title.length > 25 ? 13 : titleConfig.title.length > 16 ? 15 : 20;
    doc.fontSize(titleFontSize).font("Helvetica-Bold").fillColor("#111827");
    const titleHeight = doc.heightOfString(titleConfig.title, { width: rightW });
    doc.text(titleConfig.title, rightX, rightY, { width: rightW, align: "right" });
    rightY += titleHeight + 4;

    if (titleConfig.docNumber) {
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text(titleConfig.docNumber, rightX, rightY, { width: rightW, align: "right" });
      rightY += 13;
    }

    if (titleConfig.badgeText) {
      doc.fontSize(10).font("Helvetica-Bold").fillColor(titleConfig.badgeColor || "#dc2626").text(titleConfig.badgeText, rightX, rightY, { width: rightW, align: "right" });
      rightY += 14;
    }

    if (titleConfig.amountLabel && titleConfig.amountValue) {
      doc.fontSize(8.5).font("Helvetica").fillColor("#6b7280").text(titleConfig.amountLabel, rightX, rightY, { width: rightW, align: "right" });
      rightY += 11;
      doc.fontSize(13.5).font("Helvetica-Bold").fillColor(titleConfig.amountColor || "#111827").text(titleConfig.amountValue, rightX, rightY, { width: rightW, align: "right" });
      rightY += 18;
    }

    if (titleConfig.dateLabel && titleConfig.dateValue) {
      doc.fontSize(8.5).font("Helvetica").fillColor("#4b5563").text(`${titleConfig.dateLabel}:  ${titleConfig.dateValue}`, rightX, rightY, { width: rightW, align: "right" });
      rightY += 13;
    }

    return Math.max(detailsY, rightY) + 10;
  }

  // ---------------------------------------------------------------------------------
  // TEMPLATE: ZOHO-EXACT LAYOUT (INVOICE, QUOTE / ESTIMATE, RECEIPT)
  // ---------------------------------------------------------------------------------
  private static renderZohoExactDocument(data: DocumentData, logoBuffer: Buffer | null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 35, bottom: 25, left: 45, right: 45 },
          size: "A4",
        });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, {
              errorCorrectionLevel: "H",
              type: "png",
              margin: 1,
              width: 55,
            });
          } catch (_) {}
        }

        const ticket = PDFKitGenerator.mapDataToTicket(data);
        const settings = PDFKitGenerator.mapDataToSettings(data);
        const customerName = data.customer.company_name
          ? `${data.customer.company_name} (Attn: ${data.customer.name})`
          : data.customer.name;

        const isInvoice = data.type === "invoice";
        const isReceipt = data.type === "receipt";
        const isPaid = data.payment_status === "paid" || isReceipt;

        const amountPaid = isPaid ? Number(data.total || 0) : 0;
        const balanceDue = isPaid ? 0 : Number(data.total || 0);
        const totals = {
          totalEstimate: Number(data.total || 0),
          amountPaid,
          balanceDue,
        };

        const title = isReceipt ? "PAYMENT RECEIPT" : isInvoice ? "INVOICE" : "ESTIMATE";
        const docNumber = `#${data.display_id}`;
        const badgeText = isReceipt ? "PAID" : isInvoice ? (isPaid ? "PAID" : "UNPAID") : undefined;
        const badgeColor = isPaid ? "#16a34a" : "#dc2626";

        const amountLabel = isReceipt ? "Amount Paid" : isInvoice ? "Balance Due" : "Estimated Total";
        const amountValue = `KES ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(isReceipt ? totals.amountPaid : totals.balanceDue)}`;

        const nextY = PDFKitGenerator.drawConsistentHeader(doc, logoBuffer, settings, {
          title,
          docNumber,
          badgeText,
          badgeColor,
          amountLabel,
          amountValue,
          amountColor: isReceipt ? "#16a34a" : "#111827",
        });

        // Thin separator
        let currentY = nextY;
        doc.rect(45, currentY, 505, 1).fill("#e5e7eb");
        currentY += 12;

        // Bill To & Meta Data
        const metaY = currentY;
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#9ca3af").text(isReceipt ? "PAID BY" : "BILL TO", 45, metaY);
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#111827").text(customerName || "Customer", 45, metaY + 11);

        let cY = metaY + 24;
        doc.fontSize(8.5).font("Helvetica").fillColor("#4b5563");
        if (data.customer?.email) { doc.text(data.customer.email, 45, cY); cY += 11; }
        if (data.customer?.phone) { doc.text(data.customer.phone, 45, cY); cY += 11; }
        if (data.customer?.address) { doc.text(data.customer.address, 45, cY); cY += 11; }

        // Right Meta
        const rightMetaX = 330;
        const rightMetaW = 220;
        let rmY = metaY;

        const addMetaRow = (label: string, value: string) => {
          doc.fontSize(8.5).font("Helvetica").fillColor("#6b7280").text(label, rightMetaX, rmY, { width: 90, align: "left" });
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#111827").text(value, rightMetaX + 90, rmY, { width: rightMetaW - 90, align: "right" });
          rmY += 14;
        };

        addMetaRow("Reference No :", data.display_id);
        addMetaRow(isReceipt ? "Payment Date :" : isInvoice ? "Invoice Date :" : "Estimate Date :", PDFKitGenerator.formatDate(data.date));
        addMetaRow("Terms :", isReceipt ? "Paid in Full" : isInvoice ? "Due on Receipt" : "Valid for 14 Days");

        currentY = Math.max(cY, rmY) + 16;

        // Table Header
        doc.rect(45, currentY, 505, 20).fill("#374151");
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
        doc.text("#", 50, currentY + 5, { width: 25 });
        doc.text("Description", 78, currentY + 5, { width: 255 });
        doc.text("Qty", 335, currentY + 5, { width: 35, align: "center" });
        doc.text("Rate", 375, currentY + 5, { width: 70, align: "right" });
        doc.text("Amount", 455, currentY + 5, { width: 90, align: "right" });

        currentY += 26;

        // Items
        doc.fillColor("#111827").font("Helvetica").fontSize(8.5);
        let idx = 1;
        const items = data.items || [];
        if (items.length === 0) {
          doc.font("Helvetica-Oblique").fillColor("#9ca3af").fontSize(8.5).text("No itemized charges listed", 78, currentY, { width: 255 });
          currentY += 20;
          doc.rect(45, currentY - 3, 505, 0.5).fill("#f3f4f6");
        } else {
          for (const item of items) {
            if (currentY > doc.page.height - 130) {
              doc.addPage();
              currentY = 45;
            }

            const itemTitle = item?.title ? String(item.title) : "Item";
            doc.font("Helvetica").fillColor("#6b7280").text(idx.toString(), 50, currentY, { width: 25 });
            doc.font("Helvetica-Bold").fillColor("#111827").text(itemTitle, 78, currentY, { width: 255 });
            const titleH = doc.heightOfString(itemTitle, { width: 255 });

            let descH = 0;
            if (item?.description) {
              const itemDesc = String(item.description);
              doc.font("Helvetica").fillColor("#6b7280").fontSize(7.5).text(itemDesc, 78, currentY + titleH + 2, { width: 255 });
              descH = doc.heightOfString(itemDesc, { width: 255 }) + 2;
            }

            const unitP = Number(item?.unit_price || 0);
            const totalP = Number(item?.total != null ? item.total : unitP * Number(item?.quantity || 1));

            doc.font("Helvetica").fillColor("#111827").fontSize(8.5);
            doc.text(Number(item?.quantity || 1).toFixed(2), 335, currentY, { width: 35, align: "center" });
            doc.text(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(unitP), 375, currentY, { width: 70, align: "right" });
            doc.text(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalP), 455, currentY, { width: 90, align: "right" });

            currentY += Math.max(16, titleH + descH + 4);
            doc.rect(45, currentY - 3, 505, 0.5).fill("#f3f4f6");
            idx++;
          }
        }

        currentY += 8;

        // Summary Table
        const sumW = 220;
        const sumX = 330;

        const addSummaryRow = (label: string, value: string, isBold: boolean = false, isBg: boolean = false, valColor: string = "#111827") => {
          if (isBg) {
            doc.rect(sumX - 10, currentY - 3, sumW + 10, 20).fill("#f3f4f6");
          }
          doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fillColor("#4b5563").fontSize(8.5);
          doc.text(label, sumX, currentY + 1, { width: 100, align: "left" });
          doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fillColor(valColor).text(value, sumX + 100, currentY + 1, { width: sumW - 100, align: "right" });
          currentY += 18;
        };

        const fmtTot = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totals.totalEstimate);
        addSummaryRow("Sub Total", fmtTot);
        addSummaryRow("Total", `KES ${fmtTot}`, true);
        if (isInvoice || isReceipt) {
          const fmtPaid = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totals.amountPaid);
          const fmtDue = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totals.balanceDue);
          addSummaryRow("Payment Made", `(-) ${fmtPaid}`, false, false, totals.amountPaid > 0 ? "#16a34a" : "#6b7280");
          addSummaryRow("Balance Due", `KES ${fmtDue}`, true, true, "#111827");
        }

        // Terms and conditions
        if (settings?.pdf_terms) {
          currentY += 16;
          if (currentY > doc.page.height - 110) { doc.addPage(); currentY = 45; }
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#111827").text("Terms & Conditions", 45, currentY);
          currentY += 11;
          doc.fontSize(7.5).font("Helvetica").fillColor("#6b7280").text(settings.pdf_terms, 45, currentY, { width: 505 });
        }

        // Watermark
        let watermarkText = "";
        let watermarkColor = "#e5e7eb";
        if (ticket.status === "cancelled") {
          watermarkText = "CANCELLED";
          watermarkColor = "#fca5a5";
        } else if (isInvoice || isReceipt) {
          watermarkText = isPaid ? "PAID" : "UNPAID";
          watermarkColor = isPaid ? "#86efac" : "#fca5a5";
        } else {
          watermarkText = "QUOTATION";
          watermarkColor = "#e5e7eb";
        }

        if (watermarkText) {
          doc.save()
             .translate(doc.page.width / 2, doc.page.height / 2)
             .rotate(-45, { origin: [0, 0] })
             .fontSize(90)
             .font("Helvetica-Bold")
             .fillColor(watermarkColor)
             .fillOpacity(0.18)
             .text(watermarkText, -250, -45, { align: "center", width: 500 })
             .restore();
        }

        // Footer
        doc.page.margins.bottom = 0;
        const footerDividerY = doc.page.height - 75;
        doc.rect(45, footerDividerY, 505, 0.5).fill("#e5e7eb");

        const footerY = footerDividerY + 8;
        const paymentLinkText = isInvoice && data.payment_link ? `Pay Online: ${data.payment_link}\n` : "";
        const payInstructions = isInvoice
          ? (settings?.pdf_payment_details ? settings.pdf_payment_details.replace(/\n/g, " | ") : "Paybill: 880100 - Acc: PAYURBANDEVICE")
          : isReceipt
          ? "Thank you for your payment. Official receipt for your records."
          : "Thank you for your business. For inquiries, contact support@urbandevicecare.co.uk";

        doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#1f2937");
        if (paymentLinkText) {
          doc.text(paymentLinkText, 45, footerY, { width: 440, lineBreak: false });
        }
        const payInstrY = footerY + (paymentLinkText ? 11 : 0);
        doc.fontSize(7).font("Helvetica").fillColor("#4b5563").text(payInstructions, 45, payInstrY, { width: 440, lineBreak: false });

        doc.fontSize(7).font("Helvetica").fillColor("#9ca3af");
        doc.text(`POWERED BY ${(settings?.company_name || "URBAN DEVICE CARE LTD").toUpperCase()}  •  #${data.display_id}`, 45, footerDividerY + 54, { width: 440, lineBreak: false });

        if (qrBuffer) {
          try {
            const qrSize = 48;
            const qrX = 502;
            const qrY = footerDividerY + 6;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            const qrLabel = isInvoice ? "Scan to Pay Online" : isReceipt ? "Scan to Verify" : "Scan to View Quote";
            doc.fontSize(5.5).font("Helvetica-Bold").fillColor("#4b5563").text(qrLabel, qrX - 8, qrY + qrSize + 2, { width: qrSize + 16, align: "center" });
          } catch (e) {}
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // TEMPLATE: REPAIR JOB CARD LAYOUT (WORKSHOP INTAKE & ASSET DETAILS)
  // ---------------------------------------------------------------------------------
  private static renderJobCardDocument(data: DocumentData, logoBuffer: Buffer | null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 35, bottom: 25, left: 45, right: 45 },
          size: "A4",
        });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, {
              errorCorrectionLevel: "H",
              type: "png",
              margin: 1,
              width: 45,
            });
          } catch (_) {}
        }

        const ticket = PDFKitGenerator.mapDataToTicket(data);
        const settings = PDFKitGenerator.mapDataToSettings(data);
        const customerName = data.customer.company_name
          ? `${data.customer.company_name} (Attn: ${data.customer.name})`
          : data.customer.name;

        const nextY = PDFKitGenerator.drawConsistentHeader(doc, logoBuffer, settings, {
          title: "JOB CARD",
          subtitle: "Service & Repair Details",
          docNumber: `NO: ${data.display_id}`,
          dateLabel: "Date",
          dateValue: PDFKitGenerator.formatDate(data.date),
        });

        let currentY = nextY;
        doc.rect(45, currentY, 505, 1).fill("#e2e8f0");
        currentY += 15;

        // SECTION 1: CLIENT & ASSET DETAILS
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("CLIENT & ASSET DETAILS", 45, currentY);
        currentY += 14;

        const col1X = 45;
        const col2X = 300;
        const boxTop = currentY;

        // Left Column
        let leftY = boxTop;
        const drawField = (label: string, value: string, xPos: number, yPos: number, isRight: boolean = false) => {
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#334155").text(`${label}:`, xPos, yPos);
          doc.font("Helvetica").fillColor("#0f172a").text(value || "N/A", xPos + (isRight ? 95 : 85), yPos, { width: isRight ? 150 : 160 });
        };

        drawField("Client Name", customerName, col1X, leftY); leftY += 15;
        drawField("Phone", data.customer?.phone || "N/A", col1X, leftY); leftY += 15;
        drawField("Email", data.customer?.email || "N/A", col1X, leftY); leftY += 15;

        // Right Column
        let rightY = boxTop;
        const brandModel = `${ticket.device?.brand || ""} ${ticket.device?.model_name || "General Device"}`.trim();
        drawField("Item / Asset", brandModel, col2X, rightY, true); rightY += 15;
        drawField("Serial/Model", ticket.device?.serial_number || "N/A", col2X, rightY, true); rightY += 15;
        drawField("Status", String(ticket.status || "In Progress").replace(/_/g, " ").toUpperCase(), col2X, rightY, true); rightY += 15;
        drawField("Accessories", ticket.accessories || "None", col2X, rightY, true); rightY += 15;

        currentY = Math.max(leftY, rightY) + 12;

        // SECTION 2: JOB DESCRIPTION & DIAGNOSTICS
        doc.rect(45, currentY, 505, 0.5).fill("#e2e8f0");
        currentY += 10;
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("JOB DESCRIPTION & DIAGNOSTICS", 45, currentY);
        currentY += 14;

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#334155").text("Reported Issue:", 45, currentY);
        doc.font("Helvetica").fillColor("#0f172a").text(ticket.issue_description || "Customer reported hardware failure / service required.", 140, currentY, { width: 410 });
        currentY += doc.heightOfString(ticket.issue_description || "Customer reported hardware failure.", { width: 410 }) + 8;

        if (ticket.device?.condition) {
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#334155").text("Intake Condition:", 45, currentY);
          doc.font("Helvetica").fillColor("#0f172a").text(ticket.device.condition, 140, currentY, { width: 410 });
          currentY += doc.heightOfString(ticket.device.condition, { width: 410 }) + 10;
        }

        // SECTION 3: SERVICE WORK & PARTS
        doc.rect(45, currentY, 505, 0.5).fill("#e2e8f0");
        currentY += 10;
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("SERVICE WORK & PARTS", 45, currentY);
        currentY += 14;

        doc.rect(45, currentY, 505, 1.5).fill("#334155");
        currentY += 4;
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
        doc.text("Task / Service / Part Description", 48, currentY, { width: 440 });
        doc.text("Qty", 495, currentY, { width: 50, align: "center" });
        currentY += 14;
        doc.rect(45, currentY, 505, 0.5).fill("#94a3b8");
        currentY += 6;

        const items = data.items || [];
        if (items.length === 0) {
          doc.font("Helvetica-Oblique").fillColor("#64748b").fontSize(8.5).text("No itemized intake tasks listed", 48, currentY, { width: 440 });
          currentY += 20;
          doc.rect(45, currentY - 3, 505, 0.5).fill("#f1f5f9");
        } else {
          for (const item of items) {
            if (currentY > doc.page.height - 120) {
              doc.addPage();
              currentY = 50;
            }

            const itemTitle = item?.title ? String(item.title) : "Intake Item";

            doc.font("Helvetica").fillColor("#0f172a").fontSize(8.5);
            doc.text(itemTitle, 48, currentY, { width: 440 });
            doc.text(Number(item?.quantity || 1).toString(), 495, currentY, { width: 50, align: "center" });
            const titleH = doc.heightOfString(itemTitle, { width: 440 });
            const rowH = Math.max(16, titleH + 4);
            currentY += rowH;
            doc.rect(45, currentY - 3, 505, 0.5).fill("#f1f5f9");
          }
        }

        currentY += 10;

        // SECTION 4: DUAL SIGNATURES
        if (currentY > doc.page.height - 135) { doc.addPage(); currentY = 50; }
        const sigY = currentY + 25;
        doc.rect(45, sigY, 190, 0.75).fill("#0f172a");
        doc.rect(265, sigY, 190, 0.75).fill("#0f172a");

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("Technician Signature", 45, sigY + 5);
        doc.text("Customer Signature", 265, sigY + 5);

        doc.page.margins.bottom = 0;
        const footerY = doc.page.height - 48;
        doc.rect(45, footerY - 6, 505, 0.5).fill("#e2e8f0");
        doc.fontSize(7).font("Helvetica").fillColor("#64748b");
        doc.text("Intake Agreement: Diagnostics & component repairs carry standard 90-day warranty coverage. Customer accepts custody release terms.", 45, footerY, { width: 440, lineBreak: false });

        if (qrBuffer) {
          try {
            const qrSize = 42;
            const qrX = 504;
            const qrY = footerY - 2;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            doc.fontSize(5.5).font("Helvetica-Bold").fillColor("#4b5563").text("Scan to Track", qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (e) {}
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // TEMPLATE: SERVICE & DIAGNOSTIC REPORT
  // ---------------------------------------------------------------------------------
  private static renderServiceReportDocument(data: DocumentData, logoBuffer: Buffer | null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 35, bottom: 25, left: 45, right: 45 },
          size: "A4",
        });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, {
              errorCorrectionLevel: "H",
              type: "png",
              margin: 1,
              width: 50,
            });
          } catch (_) {}
        }

        const ticket = PDFKitGenerator.mapDataToTicket(data);
        const settings = PDFKitGenerator.mapDataToSettings(data);
        const customerName = data.customer.company_name
          ? `${data.customer.company_name} (Attn: ${data.customer.name})`
          : data.customer.name;

        const nextY = PDFKitGenerator.drawConsistentHeader(doc, logoBuffer, settings, {
          subtitle: "SERVICE &",
          title: "DIAGNOSTIC REPORT",
          dateLabel: "Report Date",
          dateValue: PDFKitGenerator.formatDate(data.date),
          docNumber: `Reference: #${data.display_id}`,
        });

        let currentY = nextY;

        // Target Device Box
        doc.rect(45, currentY, 505, 40).fill("#f8fafc");
        doc.rect(45, currentY, 3.5, 40).fill("#1e293b");

        const brandModel = `${ticket.device?.brand || ""} ${ticket.device?.model_name || "General Device"}`.trim();
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text(customerName ? `${customerName} — Hardware Diagnostic Proposal` : "Device Diagnostic Proposal", 55, currentY + 7);
        doc.fontSize(8.5).font("Helvetica").fillColor("#475569").text(`Model: ${brandModel}  •  Serial Number: ${ticket.device?.serial_number || "N/A"}  •  Status: ${String(ticket.status || "Diagnosed").replace(/_/g, " ").toUpperCase()}`, 55, currentY + 22);

        currentY += 50;

        // Table Header
        doc.rect(45, currentY, 505, 20).fill("#1e293b");
        doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
        doc.text("QTY", 48, currentY + 6, { width: 30, align: "center" });
        doc.text("SERVICE / ITEM", 85, currentY + 6, { width: 145 });
        doc.text("SCOPE & SPECIFICATIONS", 235, currentY + 6, { width: 195 });
        doc.text("AMOUNT (KES)", 435, currentY + 6, { width: 110, align: "right" });

        currentY += 25;

        const items = data.items || [];
        if (items.length === 0) {
          doc.font("Helvetica-Oblique").fillColor("#64748b").fontSize(8.5).text("No itemized items listed", 85, currentY, { width: 145 });
          currentY += 20;
          doc.rect(45, currentY - 3, 505, 0.5).fill("#e2e8f0");
        } else {
          for (const item of items) {
            if (currentY > doc.page.height - 180) { doc.addPage(); currentY = 45; }

            const totalP = Number(item?.total != null ? item.total : Number(item?.unit_price || 0) * Number(item?.quantity || 1));
            const itemTitle = item?.title ? String(item.title) : "Service Item";

            doc.font("Helvetica").fillColor("#0f172a").fontSize(8.5);
            doc.text(Number(item?.quantity || 1).toString(), 48, currentY, { width: 30, align: "center" });

            doc.font("Helvetica-Bold").text(itemTitle, 85, currentY, { width: 145 });
            const titleHeight = doc.heightOfString(itemTitle, { width: 145 });

            const specText = item?.description || "Full OEM disassembly, component replacement, thermal validation, adhesive resealing, and stress testing.";
            doc.font("Helvetica").fillColor("#475569").fontSize(7.5).text(specText, 235, currentY, { width: 195 });
            const specHeight = doc.heightOfString(specText, { width: 195 });

            doc.font("Helvetica").fillColor("#0f172a").fontSize(8.5).text(new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalP), 435, currentY, { width: 110, align: "right" });

            const rowHeight = Math.max(18, titleHeight + 8, specHeight + 8);
            currentY += rowHeight;
            doc.rect(45, currentY - 3, 505, 0.5).fill("#e2e8f0");
          }
        }

        // Total Box
        doc.rect(45, currentY + 2, 505, 20).fill("#f8fafc");
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a");
        doc.text("Total Estimated Cost:", 300, currentY + 7, { width: 120, align: "right" });
        doc.text(`KES ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(data.total || 0))}`, 435, currentY + 7, { width: 110, align: "right" });

        currentY += 34;

        // DIAGNOSTICS & TECHNICAL SUMMARY CARD
        if (currentY > doc.page.height - 160) { doc.addPage(); currentY = 45; }
        const diagCardY = currentY;
        const diagH = 75;
        doc.rect(45, diagCardY, 505, diagH).fill("#f8fafc");
        doc.rect(45, diagCardY, 3.5, diagH).fill("#1e3a8a");

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#1e3a8a").text("DIAGNOSTICS & TECHNICAL SUMMARY", 55, diagCardY + 8);

        let bY = diagCardY + 22;
        const drawBullet = (titleText: string, bodyText: string) => {
          doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0f172a").text(`• ${titleText}: `, 55, bY, { continued: true });
          doc.font("Helvetica").fillColor("#475569").text(bodyText, { width: 480 });
          bY += 16;
        };

        drawBullet("Hardware Assessment", ticket.issue_description || "Inspection confirmed hardware malfunction requiring bench service.");
        drawBullet("Bench & Component Measurements", "Thermal dissipation profile, logic rail voltages, and sub-assembly continuity verified.");
        drawBullet("Clearance Plan", "Component replacement and workshop clean-room installation under 90-day warranty.");

        currentY += diagH + 12;

        // LONG-TERM RECOMMENDATION CARD
        if (currentY > doc.page.height - 120) { doc.addPage(); currentY = 45; }
        const recCardY = currentY;
        const recH = 65;
        doc.rect(45, recCardY, 505, recH).fill("#f0f7ff");
        doc.rect(45, recCardY, 3.5, recH).fill("#2563eb");

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#2563eb").text("LONG-TERM INFRASTRUCTURE RECOMMENDATION", 55, recCardY + 8);
        const recText = "While scheduled maintenance and OEM component replacement restores peak stability and operational hygiene, older hardware architectures face natural component obsolescence. We recommend periodic thermal de-dusting and evaluating phased upgrades to modern platforms.";
        doc.fontSize(7.5).font("Helvetica").fillColor("#1e293b").text(recText, 55, recCardY + 22, { width: 485, lineGap: 2 });

        currentY += recH + 14;

        doc.page.margins.bottom = 0;
        const footerY = doc.page.height - 48;
        doc.rect(45, footerY - 6, 505, 0.5).fill("#e2e8f0");
        doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
        doc.text(`Official Diagnostic & Scope Report — ${(settings?.company_name || "Urban Device Care Ltd")}  •  Page 1 of 1`, 45, footerY, { width: 440, lineBreak: false });

        if (qrBuffer) {
          try {
            const qrSize = 42;
            const qrX = 504;
            const qrY = footerY - 2;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            doc.fontSize(5.5).font("Helvetica-Bold").fillColor("#4b5563").text("Scan to View", qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (e) {}
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // TEMPLATE: IT ASSET HANDOVER & INSPECTION REPORT
  // ---------------------------------------------------------------------------------
  private static renderHandoverReportDocument(data: DocumentData, logoBuffer: Buffer | null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 35, bottom: 25, left: 45, right: 45 },
          size: "A4",
        });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, {
              errorCorrectionLevel: "H",
              type: "png",
              margin: 1,
              width: 50,
            });
          } catch (_) {}
        }

        const ticket = PDFKitGenerator.mapDataToTicket(data);
        const settings = PDFKitGenerator.mapDataToSettings(data);
        const customerName = data.customer.company_name
          ? `${data.customer.company_name} (Attn: ${data.customer.name})`
          : data.customer.name;

        const nextY = PDFKitGenerator.drawConsistentHeader(doc, logoBuffer, settings, {
          title: "IT ASSET HANDOVER",
          subtitle: "CUSTODY RELEASE &",
          docNumber: `Reference: #${data.display_id}`,
          dateLabel: "Handover Date",
          dateValue: PDFKitGenerator.formatDate(data.date),
        });

        let currentY = nextY;
        doc.rect(45, currentY, 505, 1.5).fill("#0f172a");
        currentY += 12;

        // Centered Header Banner Box
        doc.rect(45, currentY, 505, 24).fill("#f1f5f9");
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("IT ASSET HANDOVER & INSPECTION REPORT", 45, currentY + 7, { width: 505, align: "center", characterSpacing: 0.5 });
        currentY += 34;

        // Metadata: To, Subject, Date
        const drawMeta = (lbl: string, val: string) => {
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a").text(lbl, 45, currentY, { width: 60 });
          doc.font("Helvetica").fillColor("#334155").text(val, 110, currentY, { width: 440 });
          currentY += 13;
        };

        drawMeta("To:", customerName || "Company Administration / IT Department");
        drawMeta("Subject:", "End-of-Service / Custody Release Clearance");
        drawMeta("Date:", PDFKitGenerator.formatDate(data.date));
        currentY += 10;

        // 1. DEVICE INFORMATION (2x2 Cards Grid)
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("1. DEVICE INFORMATION", 45, currentY);
        currentY += 14;

        const cardW = 247;
        const cardH = 38;
        const cardRow1Y = currentY;
        const cardRow2Y = currentY + cardH + 8;
        const col2CardX = 45 + cardW + 11;

        const drawCard = (x: number, y: number, label: string, val: string) => {
          doc.roundedRect(x, y, cardW, cardH, 4).fillAndStroke("#f8fafc", "#e2e8f0");
          doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#64748b").text(label, x + 10, y + 6);
          doc.fontSize(8.5).font("Helvetica").fillColor("#0f172a").text(val || "N/A", x + 10, y + 19, { width: cardW - 20, ellipsis: true });
        };

        const brandModel = `${ticket.device?.brand || ""} ${ticket.device?.model_name || "General Device"}`.trim();
        drawCard(45, cardRow1Y, "MODEL", brandModel);
        drawCard(col2CardX, cardRow1Y, "SERIAL NUMBER (SN)", ticket.device?.serial_number || "N/A");
        drawCard(45, cardRow2Y, "ACCESSORIES", ticket.accessories || "Standard power adapter and accessories");
        drawCard(col2CardX, cardRow2Y, "STORAGE & CONDITION", ticket.device?.condition || "Inspected & fully functional");

        currentY = cardRow2Y + cardH + 16;

        // 2. INSPECTION DETAILS
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("2. INSPECTION DETAILS", 45, currentY);
        currentY += 14;

        drawCard(45, currentY, "ASSESSED BY (TECHNICIAN)", ticket.technician_name || "Bonifencia A.");
        drawCard(col2CardX, currentY, "TICKET / WORK ORDER", data.display_id);
        currentY += cardH + 16;

        // 3. HARDWARE & SYSTEM DIAGNOSTIC
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("3. HARDWARE & SYSTEM DIAGNOSTIC", 45, currentY);
        currentY += 12;

        const drawCheckBullet = (title: string, desc: string) => {
          doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#0f172a").text(`•  ${title}: `, 45, currentY, { continued: true });
          doc.font("Helvetica").fillColor("#475569").text(desc, { width: 505 });
          currentY += 13;
        };

        drawCheckBullet("Physical Condition", "Excellent. No structural damage, dents, or deep scratches observed on the chassis.");
        drawCheckBullet("Display", "Optimal. No dead pixels, discoloration, or cracks on the screen.");
        drawCheckBullet("Keyboard & Trackpad", "Fully functional. All keys respond correctly, and the trackpad is responsive with no lag.");
        drawCheckBullet("Ports & Connectivity", "All USB, HDMI, audio, and power delivery ports have been tested and are working correctly.");
        drawCheckBullet("Battery Health", "The battery holds normal charge and passes standard diagnostic health checks.");
        drawCheckBullet("Storage Drive", "Fully operational with no read/write errors detected.");

        currentY += 8;

        // 4. TECHNICIAN'S VERDICT
        doc.fontSize(9.5).font("Helvetica-Bold").fillColor("#0f172a").text("4. TECHNICIAN'S VERDICT", 45, currentY);
        currentY += 10;

        const verdictText = `I have thoroughly inspected the ${brandModel} listed above. The equipment is in complete working order, possesses no hardware faults, and is physically sound. It is officially cleared and deemed 'okay' for employee handover and custody release.`;
        const vH = doc.heightOfString(verdictText, { width: 485 }) + 16;

        doc.rect(45, currentY, 505, vH).fill("#f0fdf4");
        doc.rect(45, currentY, 3.5, vH).fill("#22c55e");
        doc.fontSize(7.5).font("Helvetica").fillColor("#166534").text(verdictText, 55, currentY + 8, { width: 485, lineGap: 2 });

        currentY += vH + 24;

        // Dual Signatures
        doc.rect(45, currentY, 190, 0.75).fill("#0f172a");
        doc.rect(265, currentY, 190, 0.75).fill("#0f172a");

        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text(ticket.technician_name || "Bonifencia A.", 45, currentY + 5);
        doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text("Hardware Technician  •  Urban Device Care Ltd", 45, currentY + 16);

        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("IT Admin / Receiving Officer", 265, currentY + 5);
        doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text("Date & Official Stamp", 265, currentY + 16);

        doc.page.margins.bottom = 0;
        const footerY = doc.page.height - 48;
        doc.rect(45, footerY - 6, 505, 0.5).fill("#e2e8f0");
        doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
        doc.text(`${(settings?.company_name || "Urban Device Care Ltd")} — Device Clearance Report  •  Page 1 of 1`, 45, footerY, { width: 440, lineBreak: false });

        if (qrBuffer) {
          try {
            const qrSize = 42;
            const qrX = 504;
            const qrY = footerY - 2;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            doc.fontSize(5.5).font("Helvetica-Bold").fillColor("#4b5563").text("Scan to View", qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (e) {}
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------------------------
  // TEMPLATE: CERTIFICATES & CUSTOM DOCUMENTS (WARRANTY, COMPLETION, DESTRUCTION, ETC.)
  // ---------------------------------------------------------------------------------
  private static renderCertificateDocument(data: DocumentData, logoBuffer: Buffer | null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margins: { top: 35, bottom: 25, left: 45, right: 45 },
          size: "A4",
          bufferPages: true,
        });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const settings = PDFKitGenerator.mapDataToSettings(data);
        const customerName = data.customer.company_name
          ? `${data.customer.company_name} (Attn: ${data.customer.name})`
          : data.customer.name;

        // Top Accent Stripe
        doc.rect(0, 0, doc.page.width, 4).fill("#0f172a");

        const docTitle = (data.title || "WARRANTY CERTIFICATE").toUpperCase();
        const hasCharges = Number(data.total || 0) > 0;
        const cleanDocNumber = data.display_id ? (data.display_id.startsWith("#") ? data.display_id : `#${data.display_id}`) : undefined;

        const nextY = PDFKitGenerator.drawConsistentHeader(doc, logoBuffer, settings, {
          title: docTitle,
          docNumber: cleanDocNumber,
          dateLabel: "Date",
          dateValue: PDFKitGenerator.formatDate(data.date),
          badgeText: hasCharges ? (data.payment_status === "paid" ? "PAID" : "AMOUNT DUE") : "OFFICIAL CERTIFICATE",
          badgeColor: hasCharges ? (data.payment_status === "paid" ? "#16a34a" : "#dc2626") : "#16a34a",
          amountLabel: hasCharges ? (data.payment_status === "paid" ? "Amount Paid" : "Balance Due") : undefined,
          amountValue: hasCharges ? PDFKitGenerator.formatCurrency(data.total, data.currency_code) : undefined,
          amountColor: "#0f172a",
        });

        let currentY = nextY;

        // Divider
        doc.strokeColor("#cbd5e1").lineWidth(0.75).moveTo(45, currentY).lineTo(550, currentY).stroke();
        currentY += 12;

        // Two-column metadata block: Recipient (Left) & Specifications (Right)
        const startMetaY = currentY;
        const leftColWidth = 235;
        const rightColLeft = 295;
        const rightColWidth = 255;

        // Left Column: Recipient
        doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#475569").text("CERTIFICATE ISSUED TO / BILLED TO:", 45, startMetaY);
        let leftY = startMetaY + 13;
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#0f172a").text(customerName || "Valued Client", 45, leftY, { width: leftColWidth });
        leftY += doc.heightOfString(customerName || "Valued Client", { width: leftColWidth }) + 3;

        doc.fontSize(8).font("Helvetica").fillColor("#475569");
        if (data.customer?.company_name && data.customer.name && data.customer.name !== data.customer.company_name) {
          doc.text(`Contact: ${data.customer.name}`, 45, leftY, { width: leftColWidth });
          leftY += 11;
        }
        if (data.customer?.address) {
          doc.text(data.customer.address, 45, leftY, { width: leftColWidth });
          leftY += doc.heightOfString(data.customer.address, { width: leftColWidth }) + 2;
        }
        const clientContacts = [data.customer?.phone, data.customer?.email].filter(Boolean).join("  •  ");
        if (clientContacts) {
          doc.text(clientContacts, 45, leftY, { width: leftColWidth });
          leftY += 12;
        }

        // Right Column: Specifications / Asset Details
        let rightY = startMetaY;
        const customFields = data.custom_fields || {};
        const fieldEntries = Object.entries(customFields);

        if (fieldEntries.length > 0) {
          doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#475569").text("EQUIPMENT & ASSET SPECIFICATIONS:", rightColLeft, rightY);
          rightY += 13;

          const boxTop = rightY;
          let totalFieldHeight = 8;
          for (const [k, v] of fieldEntries) {
            totalFieldHeight += 12;
          }
          const boxH = Math.max(totalFieldHeight, 46);

          doc.rect(rightColLeft, boxTop, rightColWidth, boxH).fill("#f8fafc");
          doc.rect(rightColLeft, boxTop, 3, boxH).fill("#0f172a");
          doc.strokeColor("#e2e8f0").lineWidth(0.5).rect(rightColLeft, boxTop, rightColWidth, boxH).stroke();

          let fY = boxTop + 6;
          for (const [k, v] of fieldEntries) {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#334155").text(`${k}: `, rightColLeft + 8, fY, { continued: true });
            doc.font("Helvetica").fillColor("#0f172a").text(String(v), { width: rightColWidth - 16, ellipsis: true });
            fY += 12;
          }
          rightY = boxTop + boxH;
        }

        currentY = Math.max(leftY, rightY) + 12;

        // Certificate Statement / Body Text
        if (data.body_text && data.body_text.trim().length > 0) {
          const bodyW = 495;
          const bodyText = data.body_text.trim();
          doc.fontSize(8.5).font("Helvetica");
          const textHeight = doc.heightOfString(bodyText, { width: bodyW, lineGap: 3 });
          const cardHeight = textHeight + 16;

          doc.rect(45, currentY, 505, cardHeight).fill("#f8fafc");
          doc.rect(45, currentY, 3.5, cardHeight).fill("#2563eb");
          doc.strokeColor("#e2e8f0").lineWidth(0.5).rect(45, currentY, 505, cardHeight).stroke();

          doc.fontSize(8.5).font("Helvetica").fillColor("#1e293b").text(bodyText, 55, currentY + 8, {
            width: bodyW,
            lineGap: 3,
          });

          currentY += cardHeight + 14;
        }

        // Line Items Table
        const certItems = data.items || [];
        if (certItems.length > 0) {
          doc.rect(45, currentY, 505, 20).fill("#0f172a");
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
          doc.text("ITEM / SPECIFICATION & SCOPE", 55, currentY + 6, { width: hasCharges ? 275 : 400 });
          doc.text("QTY", hasCharges ? 335 : 460, currentY + 6, { width: 35, align: "center" });
          if (hasCharges) {
            doc.text("RATE", 380, currentY + 6, { width: 75, align: "right" });
            doc.text("AMOUNT", 465, currentY + 6, { width: 75, align: "right" });
          }

          currentY += 20;

          let isAlt = false;
          for (const item of certItems) {
            if (currentY > 680) {
              doc.addPage();
              currentY = 40;
              doc.rect(45, currentY, 505, 20).fill("#0f172a");
              doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
              doc.text("ITEM / SPECIFICATION & SCOPE", 55, currentY + 6, { width: hasCharges ? 275 : 400 });
              doc.text("QTY", hasCharges ? 335 : 460, currentY + 6, { width: 35, align: "center" });
              if (hasCharges) {
                doc.text("RATE", 380, currentY + 6, { width: 75, align: "right" });
                doc.text("AMOUNT", 465, currentY + 6, { width: 75, align: "right" });
              }
              currentY += 20;
            }

            const itemTitle = item.title || "Service Specification";
            const itemDesc = item.description || "";
            doc.font("Helvetica").fontSize(7.5);
            const descHeight = itemDesc ? doc.heightOfString(itemDesc, { width: hasCharges ? 275 : 400 }) : 0;
            const rowH = Math.max(22, 12 + descHeight + 6);

            if (isAlt) {
              doc.rect(45, currentY, 505, rowH).fill("#f8fafc");
            }
            doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(45, currentY + rowH).lineTo(550, currentY + rowH).stroke();

            doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text(itemTitle, 55, currentY + 4, { width: hasCharges ? 275 : 400 });
            if (itemDesc) {
              doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text(itemDesc, 55, currentY + 15, { width: hasCharges ? 275 : 400 });
            }

            doc.font("Helvetica").fontSize(8).fillColor("#0f172a").text(String(item.quantity || 1), hasCharges ? 335 : 460, currentY + 5, { width: 35, align: "center" });

            if (hasCharges) {
              doc.text(PDFKitGenerator.formatCurrency(item.unit_price, data.currency_code), 380, currentY + 5, { width: 75, align: "right" });
              const lineTotal = item.total != null ? item.total : (Number(item.quantity || 1) * Number(item.unit_price || 0));
              doc.font("Helvetica-Bold").text(PDFKitGenerator.formatCurrency(lineTotal, data.currency_code), 465, currentY + 5, { width: 75, align: "right" });
            }

            currentY += rowH;
            isAlt = !isAlt;
          }

          if (hasCharges) {
            currentY += 8;
            const sumLeft = 360;
            doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a");
            doc.text("TOTAL:", sumLeft, currentY, { width: 95, align: "right" });
            doc.text(PDFKitGenerator.formatCurrency(data.total, data.currency_code), 465, currentY, { width: 75, align: "right" });
            currentY += 16;
          } else {
            currentY += 6;
          }
        }

        // Notes & Terms
        if (data.notes && data.notes.trim().length > 0) {
          if (currentY > 660) {
            doc.addPage();
            currentY = 40;
          }
          currentY += 4;
          doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569").text("TERMS & CONDITIONS / IMPORTANT NOTES:", 45, currentY);
          currentY += 10;
          doc.fontSize(7.5).font("Helvetica").fillColor("#64748b").text(data.notes.trim(), 45, currentY, { width: 505, lineGap: 2 });
          currentY += doc.heightOfString(data.notes.trim(), { width: 505, lineGap: 2 }) + 10;
        }

        // Signatures Block
        const minSigSpace = 65;
        if (currentY + minSigSpace > doc.page.height - 45) {
          doc.addPage();
          currentY = 50;
        } else {
          currentY = Math.max(currentY + 12, doc.page.height - 110);
        }

        doc.strokeColor("#94a3b8").lineWidth(0.75).moveTo(45, currentY).lineTo(235, currentY).stroke();
        doc.strokeColor("#94a3b8").lineWidth(0.75).moveTo(360, currentY).lineTo(550, currentY).stroke();

        doc.fontSize(8).font("Helvetica-Bold").fillColor("#0f172a");
        doc.text(settings?.company_name ? `${settings.company_name} — Authorized Signatory` : "Urban Device Care Ltd — Authorized Signatory", 45, currentY + 4);
        doc.font("Helvetica").fontSize(7).fillColor("#64748b").text("Certified Hardware Specialist  •  Official Seal", 45, currentY + 14);

        doc.font("Helvetica-Bold").fontSize(8).fillColor("#0f172a").text("Customer / Authorized Representative", 360, currentY + 4);
        doc.font("Helvetica").fontSize(7).fillColor("#64748b").text("Signature & Acceptance Date", 360, currentY + 14);

        // Bottom Page Footer across all pages
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0;
          const footerY = doc.page.height - 24;
          doc.fontSize(7).font("Helvetica").fillColor("#94a3b8");
          doc.text(`${settings?.company_name || "Urban Device Care Ltd"}  •  Official Compliance & Service Documentation`, 45, footerY, { lineBreak: false });
          doc.text(`Page ${i + 1} of ${pages.count}`, 45, footerY, { width: 505, align: "right", lineBreak: false });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // -------------------------------------------------------------
  // TEMPLATE 1: MODERN
  // -------------------------------------------------------------
  private static async generateModern(data: DocumentData, logoBuffer: Buffer | null = null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const primaryColor = "#2563eb";
        const darkColor = "#0f172a";
        const subtleColor = "#64748b";
        const lightBg = "#f8fafc";
        const borderColor = "#e2e8f0";

        // Top Accent Bar
        doc.rect(0, 0, doc.page.width, 6).fill(primaryColor);

        // Header
        const headerY = 35;
        const compName = data.company?.name || "Company Store";

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 40, headerY - 5, { fit: [155, 52] });
          } catch (_) {
            doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(20).text(compName, 40, headerY);
          }
        } else {
          doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(20).text(compName, 40, headerY);
        }

        let subY = headerY + (logoBuffer ? 48 : 26);
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);
        if (data.company?.address) {
          doc.text(data.company.address, 40, subY);
          subY += 12;
        }
        const contactLine = [data.company?.phone, data.company?.email, data.company?.website].filter(Boolean).join("  •  ");
        if (contactLine) {
          doc.text(contactLine, 40, subY);
        }

        // Document Badge & Details (Right side)
        const docTitle = data.title || (
          data.type === "job_card" ? "REPAIR JOB CARD" :
          data.type === "invoice" ? "TAX INVOICE" :
          data.type === "receipt" ? "PAYMENT RECEIPT" :
          data.type === "packing_slip" ? "PACKING SLIP" :
          data.type === "estimate" ? "QUOTATION" : "DOCUMENT"
        );

        doc.fontSize(16).font("Helvetica-Bold").fillColor(primaryColor).text(docTitle, 350, headerY, { align: "right" });
        doc.fontSize(9).font("Helvetica-Bold").fillColor(darkColor).text(`#${data.display_id}`, 350, headerY + 22, { align: "right" });
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);
        doc.text(`Date: ${data.date || new Date().toISOString().split("T")[0]}`, 350, headerY + 36, { align: "right" });
        if (data.due_date && data.type === "invoice") {
          doc.text(`Due Date: ${data.due_date}`, 350, headerY + 48, { align: "right" });
        }

        // 1D Barcode (Code 128)
        if (data.display_id) {
          try {
            const barcodeBuf = await PDFKitGenerator.generateBarcode(String(data.display_id));
            if (barcodeBuf) {
              doc.image(barcodeBuf, 440, headerY + 62, { width: 115, height: 22 });
            }
          } catch (e) {}
        }

        // Horizontal Divider
        const dividerY = Math.max(130, subY + 10);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, dividerY).lineTo(555, dividerY).stroke();

        // Bill To / Customer details block
        const billToY = dividerY + 15;
        const recipientLabel = data.type === "job_card" ? "CUSTOMER INTAKE DETAILS:" : "RECIPIENT / BILLED TO:";
        doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(recipientLabel, 40, billToY);
        const customerDisplayName = data.customer.company_name || data.customer.name;
        doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(11).text(customerDisplayName, 40, billToY + 14);

        let cY = billToY + 28;
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);
        if (data.customer.company_name && data.customer.name && data.customer.name !== data.customer.company_name) {
          doc.text(`Attn: ${data.customer.name}`, 40, cY);
          cY += 12;
        }
        if (data.customer.address) {
          doc.text(data.customer.address, 40, cY);
          cY += 12;
        }
        const custContact = [data.customer.phone, data.customer.email].filter(Boolean).join("  •  ");
        if (custContact) {
          doc.text(custContact, 40, cY);
          cY += 12;
        }

        // Payment status badge
        const badgeText = data.payment_status === "paid" ? "PAID IN FULL" : "PAYMENT PENDING";
        const badgeColor = data.payment_status === "paid" ? "#16a34a" : "#ca8a04";
        doc.rect(400, billToY, 155, 24).fill(lightBg);
        doc.rect(400, billToY, 3, 24).fill(badgeColor);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(badgeColor).text(badgeText, 412, billToY + 7);

        // Custom Fields
        let customY = Math.max(cY + 10, billToY + 36);
        if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
          doc.rect(40, customY, 515, 22).fill(lightBg);
          doc.font("Helvetica-Bold").fontSize(8).fillColor(subtleColor).text("SPECIFICATIONS / SERVICE ASSET:", 46, customY + 6);
          let fieldText = Object.entries(data.custom_fields)
            .map(([k, v]) => `${k}: ${v}`)
            .join("   |   ");
          doc.font("Helvetica").fontSize(8).fillColor(darkColor).text(fieldText, 210, customY + 6, { width: 335, ellipsis: true });
          customY += 30;
        }

        // Line Items Table
        let tableTop = customY + 5;
        doc.rect(40, tableTop, 515, 24).fill(darkColor);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        doc.text("ITEM & DESCRIPTION", 50, tableTop + 8);
        doc.text("QTY", 340, tableTop + 8, { width: 40, align: "center" });
        doc.text("UNIT PRICE", 390, tableTop + 8, { width: 70, align: "right" });
        doc.text("AMOUNT", 470, tableTop + 8, { width: 75, align: "right" });

        let itemY = tableTop + 24;
        let isAlt = false;

        const modernItems = data.items || [];
        if (modernItems.length === 0) {
          doc.font("Helvetica-Oblique").fontSize(8).fillColor(subtleColor).text("No itemized charges listed", 50, itemY + 6, { width: 280 });
          itemY += 24;
        } else {
          for (const item of modernItems) {
            if (itemY > 680) {
              doc.addPage();
              itemY = 50;
            }
            if (isAlt) {
              doc.rect(40, itemY, 515, 28).fill(lightBg);
            }

            const itemTitle = item?.title ? String(item.title) : "Item";
            doc.font("Helvetica-Bold").fontSize(8).fillColor(darkColor).text(itemTitle, 50, itemY + 6, { width: 280 });
            if (item?.description) {
              doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text(String(item.description), 50, itemY + 16, { width: 280, ellipsis: true });
            }

            doc.font("Helvetica").fontSize(8).fillColor(darkColor);
            doc.text(String(item?.quantity || 1), 340, itemY + 8, { width: 40, align: "center" });
            doc.text(PDFKitGenerator.formatCurrency(item?.unit_price, data.currency_code), 390, itemY + 8, { width: 70, align: "right" });
            const lineTotal = item?.total != null ? item.total : (Number(item?.quantity || 1) * Number(item?.unit_price || 0));
            doc.font("Helvetica-Bold").text(PDFKitGenerator.formatCurrency(lineTotal, data.currency_code), 470, itemY + 8, { width: 75, align: "right" });

            itemY += 28;
            isAlt = !isAlt;
          }
        }

        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, itemY).lineTo(555, itemY).stroke();

        // Totals & Notes Section
        let totalsY = itemY + 15;
        const notesWidth = 260;

        if (data.notes) {
          doc.font("Helvetica-Bold").fontSize(8).fillColor(subtleColor).text("SPECIAL NOTES & INSTRUCTIONS:", 40, totalsY);
          doc.font("Helvetica").fontSize(8).fillColor(darkColor).text(data.notes, 40, totalsY + 12, { width: notesWidth });
        }
        if (data.body_text) {
          doc.font("Helvetica").fontSize(8).fillColor(darkColor).text(data.body_text, 40, totalsY + 45, { width: notesWidth });
        }

        // Totals Box
        const totalsLeft = 350;
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);

        if (data.subtotal != null) {
          doc.text("Subtotal:", totalsLeft, totalsY);
          doc.text(PDFKitGenerator.formatCurrency(data.subtotal, data.currency_code), 470, totalsY, { width: 75, align: "right" });
          totalsY += 15;
        }
        if (data.tax_total != null && data.tax_total > 0) {
          doc.text("Tax (VAT):", totalsLeft, totalsY);
          doc.text(PDFKitGenerator.formatCurrency(data.tax_total, data.currency_code), 470, totalsY, { width: 75, align: "right" });
          totalsY += 15;
        }
        if (data.discount_total != null && data.discount_total > 0) {
          doc.text("Discount:", totalsLeft, totalsY);
          doc.text(`-${PDFKitGenerator.formatCurrency(data.discount_total, data.currency_code)}`, 470, totalsY, { width: 75, align: "right" });
          totalsY += 15;
        }

        doc.rect(totalsLeft - 10, totalsY, 215, 26).fill(primaryColor);
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
        doc.text("TOTAL DUE", totalsLeft, totalsY + 8);
        doc.text(PDFKitGenerator.formatCurrency(data.total, data.currency_code), 440, totalsY + 8, { width: 95, align: "right" });

        // Footer & Payment Information
        if (totalsY > 670) {
          doc.addPage();
        }
        const footerY = doc.page.height - 85;
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();

        const isInvoice = data.type === "invoice";
        const isReceipt = data.type === "receipt";

        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, { errorCorrectionLevel: "H", type: "png", margin: 1, width: 50 });
          } catch (_) {}
        }

        const payLink = isInvoice && data.payment_link ? `Pay Online: ${data.payment_link}\n` : "";
        const payDetails = isInvoice
          ? `${payLink}${data.company.payment_details || "Bank Transfer: M-Pesa / Card / Bank Wire"}`
          : isReceipt
          ? "Payment received in full. Thank you for your business."
          : "Thank you for choosing Urban Device Care.";

        doc.font("Helvetica-Bold").fontSize(8).fillColor(subtleColor).text(isInvoice ? "PAYMENT & BANKING DETAILS" : "NOTES & DETAILS", 40, footerY + 8);
        doc.font("Helvetica").fontSize(7.5).fillColor(darkColor).text(payDetails, 40, footerY + 20, { width: 280 });

        if (data.company.terms) {
          doc.font("Helvetica-Bold").fontSize(8).fillColor(subtleColor).text("TERMS & CONDITIONS", 330, footerY + 8);
          doc.font("Helvetica").fontSize(7).fillColor(darkColor).text(data.company.terms, 330, footerY + 20, { width: 155 });
        }

        if (qrBuffer) {
          try {
            const qrSize = 46;
            const qrX = 502;
            const qrY = footerY + 6;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            const qrLabel = isInvoice ? "Scan to Pay Online" : isReceipt ? "Scan to Verify" : data.type === "job_card" ? "Scan to Track" : "Scan to View";
            doc.fontSize(5.5).font("Helvetica-Bold").fillColor(subtleColor).text(qrLabel, qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (_) {}
        }

        doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text(`Generated by Urban Device Care Document Hub  •  #${data.display_id}`, 40, footerY + 66, { width: 440 });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // -------------------------------------------------------------
  // TEMPLATE 2: CLASSIC
  // -------------------------------------------------------------
  private static async generateClassic(data: DocumentData, logoBuffer: Buffer | null = null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const compName = data.company?.name || "Company Store";

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 40, 40, { fit: [140, 45] });
          } catch (_) {
            doc.fontSize(20).font("Times-Bold").fillColor("#111827").text(compName, 40, 45);
          }
        } else {
          doc.fontSize(20).font("Times-Bold").fillColor("#111827").text(compName, 40, 45);
        }

        const topSubY = logoBuffer ? 92 : 70;
        doc.fontSize(8.5).font("Times-Roman").fillColor("#4b5563");
        if (data.company?.address) doc.text(data.company.address, 40, topSubY);
        const contact = [data.company?.phone, data.company?.email, data.company?.website].filter(Boolean).join(" | ");
        if (contact) doc.text(contact, 40, topSubY + 12);

        // Document Details (Right side)
        const docTitle = data.title || (
          data.type === "job_card" ? "JOB CARD" :
          data.type === "invoice" ? "INVOICE" :
          data.type === "receipt" ? "RECEIPT" :
          data.type === "packing_slip" ? "PACKING SLIP" :
          data.type === "estimate" ? "ESTIMATE" : "DOCUMENT"
        );
        doc.fontSize(18).font("Times-Bold").fillColor("#1e3a8a").text(docTitle, 350, 45, { align: "right" });
        doc.fontSize(9).font("Times-Bold").fillColor("#111827").text(`No. ${data.display_id}`, 350, 70, { align: "right" });
        doc.fontSize(8.5).font("Times-Roman").fillColor("#4b5563").text(`Date: ${data.date || new Date().toISOString().split("T")[0]}`, 350, 83, { align: "right" });
        if (data.due_date && data.type === "invoice") {
          doc.text(`Due Date: ${data.due_date}`, 350, 96, { align: "right" });
        }

        // 1D Barcode
        if (data.display_id) {
          try {
            const barcodeBuf = await PDFKitGenerator.generateBarcode(String(data.display_id));
            if (barcodeBuf) {
              doc.image(barcodeBuf, 440, 115, { width: 115, height: 22 });
            }
          } catch (e) {}
        }

        // Double Horizontal Line Separator
        doc.strokeColor("#94a3b8").lineWidth(1).moveTo(40, 168).lineTo(555, 168).stroke();
        doc.strokeColor("#cbd5e1").lineWidth(0.5).moveTo(40, 171).lineTo(555, 171).stroke();

        // Client Details
        doc.font("Times-Bold").fontSize(10).fillColor("#1e3a8a").text(data.type === "job_card" ? "CLIENT / ASSET REGISTRATION" : "BILLED TO:", 40, 185);
        const customerDisplayName = data.customer.company_name || data.customer.name;
        doc.font("Times-Bold").fontSize(11).fillColor("#111827").text(customerDisplayName, 40, 198);

        let curY = 211;
        doc.font("Times-Roman").fontSize(8.5).fillColor("#374151");
        if (data.customer.company_name && data.customer.name && data.customer.name !== data.customer.company_name) {
          doc.text(`Attn: ${data.customer.name}`, 40, curY);
          curY += 12;
        }
        if (data.customer.address) { doc.text(data.customer.address, 40, curY); curY += 12; }
        const cPhoneMail = [data.customer.phone, data.customer.email].filter(Boolean).join("  •  ");
        if (cPhoneMail) { doc.text(cPhoneMail, 40, curY); curY += 12; }

        // Custom Fields
        if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
          curY += 6;
          doc.font("Times-Bold").fontSize(8.5).fillColor("#1e3a8a").text("Device & Repair Specifications:", 40, curY);
          curY += 12;
          for (const [k, v] of Object.entries(data.custom_fields)) {
            doc.font("Times-Bold").fontSize(8).fillColor("#374151").text(`${k}: `, 45, curY, { continued: true });
            doc.font("Times-Roman").fillColor("#111827").text(String(v));
            curY += 11;
          }
        }

        // Line Items Table
        let tableTop = Math.max(curY + 12, 260);
        doc.rect(40, tableTop, 515, 20).fill("#1e3a8a");
        doc.font("Times-Bold").fontSize(8.5).fillColor("#ffffff");
        doc.text("Description", 50, tableTop + 5);
        doc.text("Qty", 350, tableTop + 5, { width: 35, align: "center" });
        doc.text("Unit Price", 400, tableTop + 5, { width: 65, align: "right" });
        doc.text("Total", 480, tableTop + 5, { width: 65, align: "right" });

        let rowY = tableTop + 20;
        doc.font("Times-Roman").fontSize(8.5).fillColor("#111827");

        const classicItems = data.items || [];
        if (classicItems.length === 0) {
          doc.font("Times-Italic").fontSize(8.5).fillColor("#64748b").text("No itemized charges listed", 50, rowY + 5, { width: 285 });
          rowY += 26;
        } else {
          for (const item of classicItems) {
            if (rowY > 680) {
              doc.addPage();
              rowY = 50;
            }
            const itemTitle = item?.title ? String(item.title) : "Item";
            doc.font("Times-Bold").text(itemTitle, 50, rowY + 5, { width: 285 });
            if (item?.description) {
              doc.font("Times-Italic").fontSize(7.5).fillColor("#64748b").text(String(item.description), 50, rowY + 15, { width: 285, ellipsis: true });
              doc.font("Times-Roman").fontSize(8.5).fillColor("#111827");
            }

            doc.text(String(item?.quantity || 1), 350, rowY + 6, { width: 35, align: "center" });
            doc.text(PDFKitGenerator.formatCurrency(item?.unit_price, data.currency_code), 400, rowY + 6, { width: 65, align: "right" });
            const lineTotal = item?.total != null ? item.total : (Number(item?.quantity || 1) * Number(item?.unit_price || 0));
            doc.text(PDFKitGenerator.formatCurrency(lineTotal, data.currency_code), 480, rowY + 6, { width: 65, align: "right" });

            rowY += 26;
            doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(40, rowY).lineTo(555, rowY).stroke();
          }
        }

        // Summary Rows
        let sumY = rowY + 10;
        const sumLeft = 360;

        if (data.notes) {
          doc.font("Times-Bold").fontSize(8.5).fillColor("#1e3a8a").text("Remarks / Notes:", 40, sumY);
          doc.font("Times-Roman").fontSize(8).fillColor("#374151").text(data.notes, 40, sumY + 12, { width: 280 });
        }
        if (data.body_text) {
          doc.font("Times-Roman").fontSize(8).fillColor("#374151").text(data.body_text, 40, sumY + 40, { width: 280 });
        }

        if (data.subtotal != null) {
          doc.font("Times-Roman").text("Subtotal:", sumLeft, sumY);
          doc.text(PDFKitGenerator.formatCurrency(data.subtotal, data.currency_code), 480, sumY, { width: 65, align: "right" });
          sumY += 14;
        }
        if (data.tax_total != null && data.tax_total > 0) {
          doc.font("Times-Roman").text("VAT:", sumLeft, sumY);
          doc.text(PDFKitGenerator.formatCurrency(data.tax_total, data.currency_code), 480, sumY, { width: 65, align: "right" });
          sumY += 14;
        }

        doc.strokeColor("#1e3a8a").lineWidth(1).moveTo(sumLeft, sumY + 2).lineTo(555, sumY + 2).stroke();
        doc.font("Times-Bold").fontSize(10).fillColor("#1e3a8a").text("Grand Total:", sumLeft, sumY + 7);
        doc.text(PDFKitGenerator.formatCurrency(data.total, data.currency_code), 460, sumY + 7, { width: 85, align: "right" });

        // Footer
        const footerY = 740;
        doc.strokeColor("#94a3b8").lineWidth(0.5).moveTo(40, footerY).lineTo(555, footerY).stroke();
        const isInvoice = data.type === "invoice";
        const isReceipt = data.type === "receipt";

        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, { errorCorrectionLevel: "H", type: "png", margin: 1, width: 50 });
          } catch (_) {}
        }

        const payLink = isInvoice && data.payment_link ? `Pay Online: ${data.payment_link}\n` : "";
        const payDetails = isInvoice
          ? `${payLink}${data.company.payment_details || "Bank Transfer: M-Pesa / Card / Bank Wire"}`
          : isReceipt
          ? "Payment received in full. Thank you for your business."
          : "Thank you for choosing Urban Device Care.";

        doc.font("Times-Bold").fontSize(8).fillColor("#1e3a8a").text(isInvoice ? "Payment Instructions:" : "Notes & Details:", 40, footerY + 8);
        doc.font("Times-Roman").fontSize(7.5).fillColor("#374151").text(payDetails, 40, footerY + 18, { width: 280 });

        if (data.company.terms) {
          doc.font("Times-Bold").fontSize(8).fillColor("#1e3a8a").text("Terms & Conditions:", 330, footerY + 8);
          doc.font("Times-Roman").fontSize(7).fillColor("#374151").text(data.company.terms, 330, footerY + 18, { width: 155 });
        }

        if (qrBuffer) {
          try {
            const qrSize = 46;
            const qrX = 502;
            const qrY = footerY + 6;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            const qrLabel = isInvoice ? "Scan to Pay Online" : isReceipt ? "Scan to Verify" : data.type === "job_card" ? "Scan to Track" : "Scan to View";
            doc.fontSize(5.5).font("Times-Bold").fillColor("#1e3a8a").text(qrLabel, qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (_) {}
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // -------------------------------------------------------------
  // TEMPLATE 3: MINIMAL
  // -------------------------------------------------------------
  private static async generateMinimal(data: DocumentData, logoBuffer: Buffer | null = null): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const compName = data.company?.name || "Company Store";

        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 40, 40, { fit: [120, 35] });
          } catch (_) {
            doc.fontSize(14).font("Courier-Bold").fillColor("#111827").text(compName.toUpperCase(), 40, 40);
          }
        } else {
          doc.fontSize(14).font("Courier-Bold").fillColor("#111827").text(compName.toUpperCase(), 40, 40);
        }

        const topSubY = logoBuffer ? 82 : 58;
        doc.fontSize(8).font("Courier").fillColor("#64748b");
        if (data.company?.address) doc.text(data.company.address, 40, topSubY);
        const contact = [data.company?.phone, data.company?.email].filter(Boolean).join(" | ");
        if (contact) doc.text(contact, 40, topSubY + 10);

        // Document Details (Right)
        const docTitle = data.title || (
          data.type === "job_card" ? "JOB CARD" :
          data.type === "invoice" ? "INVOICE" :
          data.type === "receipt" ? "RECEIPT" :
          data.type === "packing_slip" ? "PACKING SLIP" :
          data.type === "estimate" ? "ESTIMATE" : "DOCUMENT"
        );
        doc.fontSize(14).font("Courier-Bold").fillColor("#111827").text(docTitle, 350, 40, { align: "right" });
        doc.fontSize(8.5).font("Courier").fillColor("#64748b").text(`ID: #${data.display_id}`, 350, 58, { align: "right" });
        doc.text(`DATE: ${data.date || new Date().toISOString().split("T")[0]}`, 350, 70, { align: "right" });

        // 1D Barcode
        if (data.display_id) {
          try {
            const barcodeBuf = await PDFKitGenerator.generateBarcode(String(data.display_id));
            if (barcodeBuf) {
              doc.image(barcodeBuf, 445, 88, { width: 110, height: 20 });
            }
          } catch (e) {}
        }

        // Minimal Rule
        doc.strokeColor("#111827").lineWidth(0.75).moveTo(40, 140).lineTo(555, 140).stroke();

        // Customer
        doc.font("Courier-Bold").fontSize(8.5).fillColor("#111827").text(data.type === "job_card" ? "INTAKE / CLIENT:" : "CUSTOMER:", 40, 150);
        const customerDisplayName = data.customer.company_name || data.customer.name;
        doc.font("Courier").fontSize(9).text(customerDisplayName, 40, 162);
        let custY = 174;
        if (data.customer.company_name && data.customer.name && data.customer.name !== data.customer.company_name) {
          doc.text(`ATTN: ${data.customer.name}`, 40, custY);
          custY += 10;
        }
        if (data.customer.address) { doc.text(data.customer.address, 40, custY); custY += 10; }
        const cDetails = [data.customer.phone, data.customer.email].filter(Boolean).join("  •  ");
        if (cDetails) { doc.text(cDetails, 40, custY); custY += 10; }

        // Custom Fields
        if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
          custY += 4;
          for (const [k, v] of Object.entries(data.custom_fields)) {
            doc.font("Courier-Bold").fontSize(7.5).text(`${k.toUpperCase()}: `, 40, custY, { continued: true });
            doc.font("Courier").text(String(v));
            custY += 9;
          }
        }

        // Table
        let tableTop = Math.max(custY + 10, 220);
        doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(40, tableTop).lineTo(555, tableTop).stroke();
        doc.font("Courier-Bold").fontSize(8).fillColor("#111827");
        doc.text("ITEM", 45, tableTop + 5);
        doc.text("QTY", 360, tableTop + 5, { width: 30, align: "center" });
        doc.text("PRICE", 410, tableTop + 5, { width: 60, align: "right" });
        doc.text("TOTAL", 485, tableTop + 5, { width: 65, align: "right" });
        doc.strokeColor("#111827").lineWidth(0.5).moveTo(40, tableTop + 18).lineTo(555, tableTop + 18).stroke();

        let rowY = tableTop + 24;
        doc.font("Courier").fontSize(8).fillColor("#111827");

        const minimalItems = data.items || [];
        if (minimalItems.length === 0) {
          doc.font("Courier-Oblique").fontSize(8).fillColor("#64748b").text("No itemized charges listed", 45, rowY, { width: 300 });
          rowY += 18;
        } else {
          for (const item of minimalItems) {
            if (rowY > 700) {
              doc.addPage();
              rowY = 50;
            }
            const itemTitle = item?.title ? String(item.title) : "Item";
            doc.text(itemTitle, 45, rowY, { width: 300 });
            doc.text(String(item?.quantity || 1), 360, rowY, { width: 30, align: "center" });
            doc.text(PDFKitGenerator.formatCurrency(item?.unit_price, data.currency_code), 410, rowY, { width: 60, align: "right" });
            const lineTotal = item?.total != null ? item.total : (Number(item?.quantity || 1) * Number(item?.unit_price || 0));
            doc.text(PDFKitGenerator.formatCurrency(lineTotal, data.currency_code), 485, rowY, { width: 65, align: "right" });
            rowY += 18;
          }
        }

        doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(40, rowY).lineTo(555, rowY).stroke();

        // Totals
        let sumY = rowY + 10;
        doc.font("Courier-Bold").fontSize(9);
        doc.text("TOTAL:", 410, sumY, { width: 60, align: "right" });
        doc.text(PDFKitGenerator.formatCurrency(data.total, data.currency_code), 485, sumY, { width: 65, align: "right" });

        const isInvoice = data.type === "invoice";
        const isReceipt = data.type === "receipt";

        let qrBuffer: Buffer | null = null;
        if (data.qr_url) {
          try {
            qrBuffer = await QRCode.toBuffer(data.qr_url, { errorCorrectionLevel: "H", type: "png", margin: 1, width: 45 });
          } catch (_) {}
        }

        let noteY = sumY + 22;
        if (isInvoice && data.payment_link) {
          doc.font("Courier-Bold").fontSize(8).fillColor("#111827").text(`PAY ONLINE: ${data.payment_link}`, 40, noteY, { width: 440 });
          noteY += 14;
        }

        if (data.notes) {
          doc.font("Courier").fontSize(7.5).fillColor("#64748b").text(`NOTE: ${data.notes}`, 40, noteY, { width: 440 });
          noteY += 12;
        }
        if (data.body_text) {
          doc.font("Courier").fontSize(7.5).fillColor("#64748b").text(data.body_text, 40, noteY, { width: 440 });
        }

        if (qrBuffer) {
          try {
            const qrSize = 44;
            const qrX = 505;
            const qrY = doc.page.height - 65;
            doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
            const qrLabel = isInvoice ? "SCAN TO PAY" : isReceipt ? "SCAN TO VERIFY" : "SCAN TO VIEW";
            doc.fontSize(5).font("Courier-Bold").fillColor("#111827").text(qrLabel, qrX - 6, qrY + qrSize + 2, { width: qrSize + 12, align: "center" });
          } catch (_) {}
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // -------------------------------------------------------------
  // CENTRAL DISPATCHER
  // -------------------------------------------------------------
  static async generate(data: DocumentData, templateStyle: string = "modern"): Promise<Buffer> {
    const rawItems = Array.isArray(data?.items) ? data.items : [];
    const normalizedItems = rawItems.map((it: any) => ({
      ...it,
      title: it?.title != null && String(it.title).trim().length > 0 ? String(it.title) : "Item",
      description: it?.description != null ? String(it.description) : undefined,
      quantity: Number(it?.quantity ?? 1) || 1,
      unit_price: typeof it?.unit_price === "number" && !isNaN(it.unit_price) ? it.unit_price : (Number(it?.unit_price || 0) || 0),
      total: it?.total != null ? (Number(it.total) || 0) : undefined,
    }));

    const normalizedData: DocumentData = {
      ...data,
      display_id: String(data?.display_id || "DOC-001"),
      title: data?.title || "Document",
      type: data?.type || "invoice",
      total: typeof data?.total === "number" && !isNaN(data.total) ? data.total : (Number(data?.total || 0) || 0),
      currency_code: data?.currency_code || "KES",
      items: normalizedItems,
      company: {
        name: data?.company?.name || "Company Store",
        logo_url: data?.company?.logo_url,
        address: data?.company?.address,
        phone: data?.company?.phone,
        email: data?.company?.email,
        website: data?.company?.website,
        payment_details: data?.company?.payment_details,
        terms: data?.company?.terms,
        kra_pin: data?.company?.kra_pin,
      },
      customer: {
        name: data?.customer?.name || "Valued Customer",
        company_name: data?.customer?.company_name,
        email: data?.customer?.email,
        phone: data?.customer?.phone,
        address: data?.customer?.address,
      },
    };

    const logoBuffer = await PDFKitGenerator.resolveLogoBuffer(normalizedData.company.logo_url);
    const style = (templateStyle || "modern").toLowerCase().trim();

    if (normalizedData.type === "job_card") {
      return await this.renderJobCardDocument(normalizedData, logoBuffer);
    }

    if (normalizedData.type === "service_report" || (normalizedData.type as string) === "diagnostic") {
      return await this.renderServiceReportDocument(normalizedData, logoBuffer);
    }

    if (normalizedData.type === "handover") {
      return await this.renderHandoverReportDocument(normalizedData, logoBuffer);
    }

    if (
      normalizedData.type === "custom" ||
      (normalizedData.type as string) === "certificate" ||
      /certificate|destruction|warranty|completion|clearance|trade[-_ ]?in/i.test(normalizedData.title || "")
    ) {
      return await this.renderCertificateDocument(normalizedData, logoBuffer);
    }

    if (
      style === "zoho_exact" ||
      (style === "standard" && (normalizedData.type === "invoice" || normalizedData.type === "estimate" || normalizedData.type === "receipt"))
    ) {
      return await this.renderZohoExactDocument(normalizedData, logoBuffer);
    }

    switch (style) {
      case "classic":
        return await this.generateClassic(normalizedData, logoBuffer);
      case "minimal":
        return await this.generateMinimal(normalizedData, logoBuffer);
      case "modern":
      default:
        return await this.generateModern(normalizedData, logoBuffer);
    }
  }
}

export default PDFKitGenerator;
