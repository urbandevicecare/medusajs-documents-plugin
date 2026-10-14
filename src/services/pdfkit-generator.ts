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
  type: "invoice" | "receipt" | "estimate" | "packing_slip" | "custom" | "job_card";
  date?: string;
  due_date?: string;
  customer: {
    name: string;
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
  body_text?: string; // For custom documents (e.g. warranty text, contract terms, etc.)
  custom_fields?: Record<string, string>;
}

export class PDFKitGenerator {
  static formatCurrency(amount: number, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount);
  }

  static async generate(data: DocumentData, templateStyle: string = "modern"): Promise<Buffer> {
    switch (templateStyle) {
      case "classic":
        return await this.generateClassic(data);
      case "minimal":
        return await this.generateMinimal(data);
      case "modern":
      default:
        return await this.generateModern(data);
    }
  }

  // -------------------------------------------------------------
  // TEMPLATE 1: MODERN
  // -------------------------------------------------------------
  private static async generateModern(data: DocumentData): Promise<Buffer> {
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
        doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(22).text(data.company.name, 40, headerY);
        
        let subY = headerY + 26;
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);
        if (data.company.address) {
          doc.text(data.company.address, 40, subY);
          subY += 12;
        }
        const contactLine = [data.company.phone, data.company.email, data.company.website].filter(Boolean).join("  •  ");
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

        // QR Code (Top right if provided)
        if (data.qr_url) {
          try {
            const qrBuf = await QRCode.toBuffer(data.qr_url, { width: 55, margin: 0 });
            doc.image(qrBuf, 500, headerY + 62, { width: 55, height: 55 });
            if (data.type === "job_card") {
              doc.fontSize(6).fillColor(subtleColor).text("Scan to Track", 500, headerY + 120, { width: 55, align: "center" });
            }
          } catch (e) {}
        }

        // Horizontal Divider
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, 130).lineTo(555, 130).stroke();

        // Bill To / Customer details block
        const billToY = 145;
        const recipientLabel = data.type === "job_card" ? "CUSTOMER INTAKE DETAILS:" : "RECIPIENT / BILLED TO:";
        doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(recipientLabel, 40, billToY);
        doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(11).text(data.customer.name, 40, billToY + 14);
        
        let cY = billToY + 28;
        doc.font("Helvetica").fontSize(8).fillColor(subtleColor);
        if (data.customer.email) {
          doc.text(`Email: ${data.customer.email}`, 40, cY);
          cY += 12;
        }
        if (data.customer.phone) {
          doc.text(`Phone: ${data.customer.phone}`, 40, cY);
          cY += 12;
        }
        if (data.customer.address) {
          doc.text(`Address: ${data.customer.address}`, 40, cY);
          cY += 12;
        }

        // Custom fields (if any)
        if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
          let cfX = 300;
          let cfY = billToY;
          const refLabel = data.type === "job_card" ? "DEVICE & WORKSHOP DETAILS:" : "REFERENCE DETAILS:";
          doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9).text(refLabel, cfX, cfY);
          cfY += 14;
          for (const [k, v] of Object.entries(data.custom_fields)) {
            doc.font("Helvetica-Bold").fontSize(8).fillColor(darkColor).text(`${k}: `, cfX, cfY, { continued: true });
            doc.font("Helvetica").fillColor(subtleColor).text(v);
            cfY += 12;
          }
        }

        // If custom body text is present (e.g. for custom documents)
        let tableStartY = 220;
        if (data.body_text) {
          doc.rect(40, tableStartY, 515, 60).fill(lightBg);
          doc.fillColor(darkColor).font("Helvetica").fontSize(9).text(data.body_text, 50, tableStartY + 10, { width: 495, lineGap: 3 });
          tableStartY += 75;
        }

        // Table Header
        const showPricing = data.type !== "packing_slip" && data.type !== "job_card";
        doc.rect(40, tableStartY, 515, 22).fill(lightBg);
        doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(8);
        doc.text(data.type === "job_card" ? "DIAGNOSTIC / REPAIR SERVICE TASK" : "ITEM & DESCRIPTION", 50, tableStartY + 7);
        doc.text(data.type === "job_card" ? "CHECK" : "QTY", 340, tableStartY + 7, { width: 40, align: "center" });
        if (showPricing) {
          doc.text("RATE", 400, tableStartY + 7, { width: 60, align: "right" });
          doc.text("AMOUNT", 480, tableStartY + 7, { width: 65, align: "right" });
        } else if (data.type === "job_card") {
          doc.text("STATUS", 480, tableStartY + 7, { width: 65, align: "right" });
        }

        // Items Rows
        let rowY = tableStartY + 26;
        for (const item of data.items || []) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(darkColor).text(data.type === "job_card" ? `[  ]  ${item.title}` : item.title, 50, rowY);
          if (item.description) {
            doc.font("Helvetica").fontSize(8).fillColor(subtleColor).text(item.description, 50, rowY + 11, { width: 280 });
          }

          doc.font("Helvetica").fontSize(8).fillColor(darkColor).text(data.type === "job_card" ? `[  ]` : String(item.quantity), 340, rowY, { width: 40, align: "center" });

          if (showPricing) {
            doc.text(this.formatCurrency(item.unit_price, data.currency_code), 400, rowY, { width: 60, align: "right" });
            const itemTotal = item.total != null ? item.total : item.quantity * item.unit_price;
            doc.font("Helvetica-Bold").text(this.formatCurrency(itemTotal, data.currency_code), 480, rowY, { width: 65, align: "right" });
          } else if (data.type === "job_card") {
            doc.font("Helvetica").fontSize(8).fillColor(subtleColor).text("PENDING", 480, rowY, { width: 65, align: "right" });
          }

          const rowHeight = item.description ? 28 : 20;
          doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, rowY + rowHeight).lineTo(555, rowY + rowHeight).stroke();
          rowY += rowHeight + 6;
        }

        // Totals Section (if pricing shown)
        if (showPricing) {
          const totX = 360;
          let totY = rowY + 10;

          if (data.subtotal != null && data.subtotal > 0) {
            doc.font("Helvetica").fontSize(8).fillColor(subtleColor).text("Subtotal:", totX, totY);
            doc.font("Helvetica").text(this.formatCurrency(data.subtotal, data.currency_code), 455, totY, { width: 90, align: "right" });
            totY += 14;
          }
          if (data.tax_total != null && data.tax_total > 0) {
            doc.font("Helvetica").fontSize(8).fillColor(subtleColor).text("Tax:", totX, totY);
            doc.font("Helvetica").text(this.formatCurrency(data.tax_total, data.currency_code), 455, totY, { width: 90, align: "right" });
            totY += 14;
          }
          if (data.discount_total != null && data.discount_total > 0) {
            doc.font("Helvetica").fontSize(8).fillColor(subtleColor).text("Discount:", totX, totY);
            doc.font("Helvetica").text(`-${this.formatCurrency(data.discount_total, data.currency_code)}`, 455, totY, { width: 90, align: "right" });
            totY += 14;
          }

          // Total Bar
          doc.rect(totX - 5, totY, 195, 24).fill(primaryColor);
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text("TOTAL DUE:", totX + 5, totY + 7);
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text(this.formatCurrency(data.total, data.currency_code), 450, totY + 7, { width: 90, align: "right" });

          rowY = totY + 35;
        }

        // Job Card Signatures Block
        if (data.type === "job_card") {
          const sigY = Math.min(Math.max(rowY + 25, 610), 650);
          doc.strokeColor(borderColor).lineWidth(1).moveTo(40, sigY).lineTo(240, sigY).stroke();
          doc.font("Helvetica-Bold").fontSize(8).fillColor(darkColor).text("CUSTOMER SIGNATURE", 40, sigY + 5);
          doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text("I authorize inspection & accept diagnostic terms.", 40, sigY + 16);

          doc.strokeColor(borderColor).lineWidth(1).moveTo(355, sigY).lineTo(555, sigY).stroke();
          doc.font("Helvetica-Bold").fontSize(8).fillColor(darkColor).text("WORKSHOP TECHNICIAN SIGNATURE", 355, sigY + 5);
          doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text("Device intake verified & inspection logged.", 355, sigY + 16);
          rowY = sigY + 35;
        }

        // Notes & Payment Instructions Box
        if (data.company.payment_details || data.payment_link || data.notes) {
          const infoBoxY = Math.max(rowY + 10, 680);
          doc.rect(40, infoBoxY, 515, 45).fill(lightBg);

          let curY = infoBoxY + 6;
          if (data.type !== "job_card" && data.company.payment_details) {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor(primaryColor).text("PAYMENT INSTRUCTIONS:", 50, curY);
            doc.font("Helvetica").fontSize(7).fillColor(darkColor).text(data.company.payment_details, 50, curY + 9, { width: 500 });
            curY += 20;
          }
          if (data.type !== "job_card" && data.payment_link) {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor(primaryColor).text("PAY ONLINE LINK:", 50, curY);
            doc.font("Helvetica").fontSize(7).fillColor("#2563eb").text(data.payment_link, 50, curY + 9, { width: 500 });
            curY += 16;
          }
          if (data.notes) {
            doc.font("Helvetica-Bold").fontSize(7.5).fillColor(darkColor).text(`Notes / Terms: `, 50, curY, { continued: true });
            doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text(data.notes, { width: 490 });
          }
        }

        // Terms Footer
        const footerY = 745;
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, footerY).lineTo(555, footerY).stroke();
        if (data.company.terms) {
          doc.font("Helvetica").fontSize(6.5).fillColor(subtleColor).text(data.company.terms, 40, footerY + 6, { width: 515, align: "center" });
        }
        doc.font("Helvetica").fontSize(7).fillColor(subtleColor).text(`Generated by ${data.company.name} • Thank you for choosing us!`, 40, footerY + 20, { width: 515, align: "center" });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // -------------------------------------------------------------
  // TEMPLATE 2: CLASSIC CORPORATE
  // -------------------------------------------------------------
  private static async generateClassic(data: DocumentData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers: Buffer[] = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        const fontHeader = "Times-Bold";
        const fontRegular = "Times-Roman";
        const primaryColor = "#1e293b";

        // Double header rules
        doc.strokeColor("#000000").lineWidth(1.5).moveTo(40, 35).lineTo(555, 35).stroke();
        doc.strokeColor("#000000").lineWidth(0.5).moveTo(40, 38).lineTo(555, 38).stroke();

        // Header Title
        const docTitle = data.title || (
          data.type === "job_card" ? "REPAIR JOB CARD" :
          data.type === "invoice" ? "INVOICE" :
          data.type === "receipt" ? "OFFICIAL RECEIPT" :
          data.type === "packing_slip" ? "PACKING LIST" :
          data.type === "estimate" ? "ESTIMATE" : "DOCUMENT"
        );

        doc.font(fontHeader).fontSize(20).fillColor(primaryColor).text(data.company.name, 40, 48);
        doc.font(fontRegular).fontSize(8.5).fillColor("#333333");
        let subY = 70;
        if (data.company.address) { doc.text(data.company.address, 40, subY); subY += 12; }
        if (data.company.phone || data.company.email) {
          doc.text([data.company.phone, data.company.email].filter(Boolean).join(" | "), 40, subY);
        }

        doc.font(fontHeader).fontSize(16).text(docTitle, 350, 48, { align: "right" });
        doc.font(fontRegular).fontSize(9).text(`Reference: ${data.display_id}`, 350, 68, { align: "right" });
        doc.text(`Date: ${data.date || new Date().toISOString().split("T")[0]}`, 350, 80, { align: "right" });

        // QR Code if provided
        if (data.qr_url) {
          try {
            const qrBuf = await QRCode.toBuffer(data.qr_url, { width: 50, margin: 0 });
            doc.image(qrBuf, 505, 95, { width: 50, height: 50 });
          } catch (e) {}
        }

        // Double Box Bill To
        doc.rect(40, 110, 455, 65).strokeColor("#000000").lineWidth(0.5).stroke();
        const clientLabel = data.type === "job_card" ? "CUSTOMER & INTAKE INFORMATION:" : "CLIENT INFORMATION:";
        doc.font(fontHeader).fontSize(9).text(clientLabel, 48, 116);
        doc.font(fontHeader).fontSize(10).text(data.customer.name, 48, 128);
        doc.font(fontRegular).fontSize(8.5).text(`Email: ${data.customer.email || "N/A"}  |  Phone: ${data.customer.phone || "N/A"}`, 48, 142);
        if (data.customer.address) doc.text(`Address: ${data.customer.address}`, 48, 154);

        // Custom fields / Device info for Classic
        let tableStartY = 190;
        if (data.custom_fields && Object.keys(data.custom_fields).length > 0) {
          doc.rect(40, tableStartY, 515, 38).fillAndStroke("#f8fafc", "#000000");
          let cfX = 48;
          let cfY = tableStartY + 6;
          doc.font(fontHeader).fontSize(8).fillColor("#000000").text("DEVICE & WORKSHOP DETAILS:", cfX, cfY);
          cfY += 12;
          const entries = Object.entries(data.custom_fields);
          for (let i = 0; i < Math.min(entries.length, 4); i++) {
            const [k, v] = entries[i];
            doc.font(fontHeader).fontSize(7.5).text(`${k}: `, cfX, cfY, { continued: true });
            doc.font(fontRegular).text(v, { continued: false });
            cfX += 120;
          }
          tableStartY += 48;
        }

        if (data.body_text) {
          doc.rect(40, tableStartY, 515, 45).stroke();
          doc.font(fontRegular).fontSize(8.5).text(data.body_text, 48, tableStartY + 8, { width: 500 });
          tableStartY += 55;
        }

        // Table Grid
        const showPricing = data.type !== "packing_slip" && data.type !== "job_card";
        doc.rect(40, tableStartY, 515, 20).fillAndStroke("#f1f5f9", "#000000");
        doc.font(fontHeader).fontSize(8.5).fillColor("#000000");
        doc.text(data.type === "job_card" ? "DIAGNOSTIC / REPAIR SERVICE TASK" : "DESCRIPTION", 50, tableStartY + 6);
        doc.text(data.type === "job_card" ? "CHECK" : "QTY", 340, tableStartY + 6, { width: 40, align: "center" });
        if (showPricing) {
          doc.text("UNIT PRICE", 400, tableStartY + 6, { width: 60, align: "right" });
          doc.text("AMOUNT", 480, tableStartY + 6, { width: 65, align: "right" });
        } else if (data.type === "job_card") {
          doc.text("STATUS", 480, tableStartY + 6, { width: 65, align: "right" });
        }

        let rowY = tableStartY + 24;
        for (const item of data.items || []) {
          doc.font(fontHeader).fontSize(8.5).text(data.type === "job_card" ? `[  ]  ${item.title}` : item.title, 50, rowY);
          if (item.description) {
            doc.font(fontRegular).fontSize(7.5).text(item.description, 50, rowY + 10, { width: 280 });
          }
          doc.font(fontRegular).fontSize(8.5).text(data.type === "job_card" ? `[  ]` : String(item.quantity), 340, rowY, { width: 40, align: "center" });
          if (showPricing) {
            doc.text(this.formatCurrency(item.unit_price, data.currency_code), 400, rowY, { width: 60, align: "right" });
            const itemTotal = item.total != null ? item.total : item.quantity * item.unit_price;
            doc.text(this.formatCurrency(itemTotal, data.currency_code), 480, rowY, { width: 65, align: "right" });
          } else if (data.type === "job_card") {
            doc.text("PENDING", 480, rowY, { width: 65, align: "right" });
          }
          const rowHeight = item.description ? 24 : 18;
          doc.strokeColor("#cccccc").lineWidth(0.5).moveTo(40, rowY + rowHeight).lineTo(555, rowY + rowHeight).stroke();
          rowY += rowHeight + 4;
        }

        // Classic Total Box
        if (showPricing) {
          const tY = rowY + 10;
          doc.rect(350, tY, 205, 24).strokeColor("#000000").lineWidth(1).stroke();
          doc.font(fontHeader).fontSize(9.5).text("TOTAL PAYABLE:", 358, tY + 7);
          doc.font(fontHeader).fontSize(9.5).text(this.formatCurrency(data.total, data.currency_code), 460, tY + 7, { width: 90, align: "right" });
          rowY = tY + 30;
        }

        // Job Card Signatures Block in Classic
        if (data.type === "job_card") {
          const sigY = Math.min(Math.max(rowY + 25, 620), 660);
          doc.strokeColor("#000000").lineWidth(1).moveTo(40, sigY).lineTo(240, sigY).stroke();
          doc.font(fontHeader).fontSize(8).fillColor("#000000").text("CUSTOMER SIGNATURE", 40, sigY + 5);
          doc.font(fontRegular).fontSize(7).text("Terms accepted & diagnostic approved.", 40, sigY + 16);

          doc.strokeColor("#000000").lineWidth(1).moveTo(355, sigY).lineTo(555, sigY).stroke();
          doc.font(fontHeader).fontSize(8).fillColor("#000000").text("TECHNICIAN SIGNATURE", 355, sigY + 5);
          doc.font(fontRegular).fontSize(7).text("Intake inspected & registered.", 355, sigY + 16);
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  // -------------------------------------------------------------
  // TEMPLATE 3: MINIMAL TECH
  // -------------------------------------------------------------
  private static async generateMinimal(data: DocumentData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const buffers: Buffer[] = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // Monospace & High Contrast
        doc.font("Courier-Bold").fontSize(18).fillColor("#000000").text(data.company.name.toUpperCase(), 40, 40);
        doc.font("Courier").fontSize(8).fillColor("#666666");
        doc.text(`${data.company.email || ""} // ${data.company.website || ""}`, 40, 62);

        const docTitle = data.type === "job_card" ? "JOB CARD" : (data.title || data.type).toUpperCase();
        doc.font("Courier-Bold").fontSize(14).fillColor("#000000").text(`[${docTitle}]`, 350, 40, { align: "right" });
        doc.font("Courier").fontSize(9).text(`REF: ${data.display_id}`, 350, 58, { align: "right" });
        doc.text(`DATE: ${data.date || new Date().toISOString().split("T")[0]}`, 350, 70, { align: "right" });

        // QR Code if provided
        if (data.qr_url) {
          try {
            const qrBuf = await QRCode.toBuffer(data.qr_url, { width: 45, margin: 0 });
            doc.image(qrBuf, 510, 42, { width: 45, height: 45 });
          } catch (e) {}
        }

        doc.strokeColor("#000000").lineWidth(1).moveTo(40, 95).lineTo(555, 95).stroke();

        doc.font("Courier-Bold").fontSize(9).text("CLIENT:", 40, 110);
        doc.font("Courier").fontSize(8.5).text(`${data.customer.name} <${data.customer.email || "N/A"}>`, 95, 110);

        let tableY = 140;
        if (data.body_text) {
          doc.font("Courier").fontSize(8).text(data.body_text, 40, tableY, { width: 515 });
          tableY += 40;
        }

        const showPricing = data.type !== "packing_slip" && data.type !== "job_card";
        doc.font("Courier-Bold").fontSize(8).text(data.type === "job_card" ? "TASK / SERVICE" : "ITEM", 40, tableY);
        doc.text(data.type === "job_card" ? "CHECK" : "QTY", 340, tableY, { width: 40, align: "center" });
        if (showPricing) {
          doc.text("RATE", 400, tableY, { width: 60, align: "right" });
          doc.text("TOTAL", 480, tableY, { width: 65, align: "right" });
        } else if (data.type === "job_card") {
          doc.text("STATUS", 480, tableY, { width: 65, align: "right" });
        }
        doc.strokeColor("#000000").lineWidth(0.5).moveTo(40, tableY + 12).lineTo(555, tableY + 12).stroke();

        let rY = tableY + 20;
        for (const item of data.items || []) {
          doc.font("Courier").fontSize(8).text(data.type === "job_card" ? `[ ] ${item.title}` : item.title, 40, rY);
          doc.text(data.type === "job_card" ? "[ ]" : String(item.quantity), 340, rY, { width: 40, align: "center" });
          if (showPricing) {
            doc.text(this.formatCurrency(item.unit_price, data.currency_code), 400, rY, { width: 60, align: "right" });
            const itemTotal = item.total != null ? item.total : item.quantity * item.unit_price;
            doc.text(this.formatCurrency(itemTotal, data.currency_code), 480, rY, { width: 65, align: "right" });
          } else if (data.type === "job_card") {
            doc.text("PENDING", 480, rY, { width: 65, align: "right" });
          }
          rY += 16;
        }

        if (showPricing) {
          doc.strokeColor("#000000").lineWidth(0.5).moveTo(340, rY + 8).lineTo(555, rY + 8).stroke();
          doc.font("Courier-Bold").fontSize(10).text("TOTAL:", 340, rY + 14);
          doc.text(this.formatCurrency(data.total, data.currency_code), 460, rY + 14, { width: 85, align: "right" });
          rY += 30;
        }

        if (data.type === "job_card") {
          const sigY = Math.min(Math.max(rY + 25, 620), 660);
          doc.strokeColor("#000000").lineWidth(1).moveTo(40, sigY).lineTo(240, sigY).stroke();
          doc.font("Courier-Bold").fontSize(8).text("CUSTOMER SIGNATURE", 40, sigY + 5);

          doc.strokeColor("#000000").lineWidth(1).moveTo(355, sigY).lineTo(555, sigY).stroke();
          doc.font("Courier-Bold").fontSize(8).text("TECHNICIAN SIGNATURE", 355, sigY + 5);
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}

export default PDFKitGenerator;
