import { PDFDocument as PDFLibDoc, rgb } from "pdf-lib";
import QRCode from "qrcode";

export interface PostProcessOptions {
  qrUrl?: string | null;
  obscureZohoFooter?: boolean;
}

/**
 * Post-processes PDF buffers to embed QR codes and clean up headers/footers.
 * (Note: Watermarks removed per user instruction)
 */
export async function postProcessPdf(
  pdfBuffer: Buffer,
  options: PostProcessOptions = {}
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFLibDoc.load(pdfBuffer);

    // 1. Generate & Embed QR Code if URL is provided
    let qrImage: any = null;
    if (options.qrUrl) {
      try {
        const qrBufferLib = await QRCode.toBuffer(options.qrUrl, {
          errorCorrectionLevel: "H",
          type: "png",
          margin: 1,
          width: 75,
        });
        qrImage = await pdfDoc.embedPng(qrBufferLib);
      } catch (qrErr) {
        console.error("[postProcessPdf] QR Code generation error:", qrErr);
      }
    }

    const pages = pdfDoc.getPages();

    if (pages.length > 0 && qrImage) {
      const firstPage = pages[0];
      // Draw QR Code on top right
      firstPage.drawImage(qrImage, {
        x: firstPage.getWidth() - 105,
        y: 40,
        width: 65,
        height: 65,
      });
    }

    // 2. Obscure external footer (e.g. "Powered by Zoho Books") if requested
    if (options.obscureZohoFooter) {
      for (const page of pages) {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: page.getWidth(),
          height: 35,
          color: rgb(1, 1, 1),
        });
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
