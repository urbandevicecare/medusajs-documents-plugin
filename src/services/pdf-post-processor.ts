import { PDFDocument as PDFLibDoc, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";

export interface PostProcessOptions {
  qrUrl?: string | null;
  obscureZohoFooter?: boolean;
  paymentLink?: string | null;
  isInvoice?: boolean;
  docType?: string | null;
}

/**
 * Post-processes PDF buffers to embed QR codes, payment links, and clean up Zoho footers.
 */
export async function postProcessPdf(
  pdfBuffer: Buffer,
  options: PostProcessOptions = {}
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFLibDoc.load(pdfBuffer, { ignoreEncryption: true });

    // 1. Generate QR Code image if URL is provided
    let qrImage: any = null;
    if (options.qrUrl) {
      try {
        const qrBufferLib = await QRCode.toBuffer(options.qrUrl, {
          errorCorrectionLevel: "H",
          type: "png",
          margin: 1,
          width: 80,
        });
        qrImage = await pdfDoc.embedPng(qrBufferLib);
      } catch (qrErr) {
        console.error("[postProcessPdf] QR Code generation error:", qrErr);
      }
    }

    const pages = pdfDoc.getPages();
    if (pages.length > 0) {
      const lastPage = pages[pages.length - 1];

      // 1. Stamp QR Code on bottom right (above the divider line at 51 on the bottom right: y = 56, x = 502)
      const isInvoice = options.isInvoice === true || options.docType === "invoice";
      if (qrImage) {
        lastPage.drawImage(qrImage, {
          x: 502,
          y: 56,
          width: 46,
          height: 46,
        });

        // Label under QR code
        try {
          const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const qrLabel = isInvoice && options.paymentLink ? "Scan to Pay Online" : options.docType === "receipt" ? "Scan to Verify" : "Scan to View";
          lastPage.drawText(qrLabel, {
            x: 488,
            y: 42,
            size: 5.5,
            font: fontBold,
            color: rgb(0.3, 0.35, 0.4),
          });
        } catch (_) {}
      }

      // 2. For invoices ONLY, stamp payment link block to the left of QR code (x = 340..495)
      // without overlapping customer notes on the left (x < 320) or totals above (y > 170)
      if (isInvoice && options.paymentLink) {
        try {
          const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const pLink = String(options.paymentLink).trim();

          lastPage.drawText("Pay Online:", {
            x: 340,
            y: 92,
            size: 7.5,
            font: fontBold,
            color: rgb(0.12, 0.16, 0.22),
          });

          // Display clean link without protocol (e.g. urbandevicecare.co.uk/r/15wb2j)
          let displayLink = pLink.replace(/^https?:\/\//i, "");
          if (displayLink.length > 44) {
            displayLink = displayLink.slice(0, 42) + "…";
          }
          lastPage.drawText(displayLink, {
            x: 340,
            y: 81,
            size: 6.8,
            font: fontRegular,
            color: rgb(0.15, 0.39, 0.92),
          });

          lastPage.drawText("Scan QR code to pay instantly", {
            x: 340,
            y: 70,
            size: 6.2,
            font: fontRegular,
            color: rgb(0.4, 0.45, 0.5),
          });
        } catch (stampErr) {
          console.error("[postProcessPdf] Error stamping payment link:", stampErr);
        }
      }

      // 3. Obscure only the Zoho footer badge on the bottom left (x: 35, y: 12, width: 220, height: 36)
      if (options.obscureZohoFooter) {
        for (const page of pages) {
          page.drawRectangle({
            x: 35,
            y: 12,
            width: 220,
            height: 36,
            color: rgb(1, 1, 1),
          });
        }
      }
    }

    const modifiedPdfBytes = await pdfDoc.save();
    return Buffer.from(modifiedPdfBytes);
  } catch (err: any) {
    console.error("[postProcessPdf] Error processing PDF:", err?.message || err);
    return pdfBuffer; // fallback cleanly to original buffer
  }
}

export default postProcessPdf;
