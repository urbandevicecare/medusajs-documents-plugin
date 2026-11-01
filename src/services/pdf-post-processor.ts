import crypto from "crypto";
import {
  PDFDocument as PDFLibDoc,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFRef,
  rgb,
  StandardFonts,
} from "pdf-lib";
import QRCode from "qrcode";
import { decryptPDF, isEncrypted, RC4 } from "@pdfsmaller/pdf-decrypt";

export interface PostProcessOptions {
  qrUrl?: string | null;
  obscureZohoFooter?: boolean;
  paymentLink?: string | null;
  isInvoice?: boolean;
  docType?: string | null;
}

const PADDING = Buffer.from([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

function computeEncryptionKey(
  password: string,
  ownerKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  revision: number,
  keyLength: number,
  encryptMetadata: boolean
): Buffer {
  const pwd = Buffer.from(password);
  const padded = Buffer.alloc(32);
  if (pwd.length >= 32) {
    pwd.copy(padded, 0, 0, 32);
  } else {
    pwd.copy(padded, 0);
    PADDING.copy(padded, pwd.length, 0, 32 - pwd.length);
  }

  const hash = crypto.createHash("md5");
  hash.update(padded);
  hash.update(Buffer.from(ownerKey));

  const pBuf = Buffer.alloc(4);
  pBuf.writeInt32LE(permissions, 0);
  hash.update(pBuf);

  hash.update(Buffer.from(fileId));

  if (revision >= 4 && !encryptMetadata) {
    hash.update(Buffer.from([0xff, 0xff, 0xff, 0xff]));
  }

  let digest = hash.digest();
  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      digest = crypto.createHash("md5").update(digest.subarray(0, keyLength)).digest();
    }
  }
  return digest.subarray(0, keyLength);
}

function decryptData(
  data: Buffer,
  objNum: number,
  genNum: number,
  encKey: Buffer,
  keyLength: number,
  isAES: boolean
): Buffer {
  if (isAES) {
    if (data.length <= 16) return data;
    const saltBuf = Buffer.from("sAlT", "ascii");
    const objKeyInput = Buffer.concat([
      encKey,
      Buffer.from([objNum & 0xff, (objNum >> 8) & 0xff, (objNum >> 16) & 0xff]),
      Buffer.from([genNum & 0xff, (genNum >> 8) & 0xff]),
      saltBuf,
    ]);
    const objKey = crypto.createHash("md5").update(objKeyInput).digest().subarray(0, 16);
    const iv = data.subarray(0, 16);
    const ciphertext = data.subarray(16);
    try {
      const decipher = crypto.createDecipheriv("aes-128-cbc", objKey, iv);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      return data;
    }
  } else {
    const objKeyInput = Buffer.concat([
      encKey,
      Buffer.from([objNum & 0xff, (objNum >> 8) & 0xff, (objNum >> 16) & 0xff]),
      Buffer.from([genNum & 0xff, (genNum >> 8) & 0xff]),
    ]);
    const objKey = crypto.createHash("md5").update(objKeyInput).digest();
    const len = Math.min(keyLength + 5, 16);
    const rc4 = new RC4(objKey.subarray(0, len));
    return Buffer.from(rc4.process(data));
  }
}

function decryptStrings(
  obj: any,
  objNum: number,
  genNum: number,
  encKey: Buffer,
  keyLength: number,
  isAES: boolean
) {
  if (!obj) return;
  if (obj instanceof PDFString) {
    const orig = Buffer.from(obj.asBytes());
    const dec = decryptData(orig, objNum, genNum, encKey, keyLength, isAES);
    (obj as any).value = Array.from(dec)
      .map((b) => String.fromCharCode(b))
      .join("");
  } else if (obj instanceof PDFHexString) {
    const orig = Buffer.from(obj.asBytes());
    const dec = decryptData(orig, objNum, genNum, encKey, keyLength, isAES);
    (obj as any).value = dec.toString("hex");
  } else if (obj instanceof PDFDict) {
    for (const [key, val] of obj.entries()) {
      const kn = key.asString();
      if (
        kn !== "/Length" &&
        kn !== "/Filter" &&
        kn !== "/DecodeParms" &&
        kn !== "/CF" &&
        kn !== "/StdCF"
      ) {
        decryptStrings(val, objNum, genNum, encKey, keyLength, isAES);
      }
    }
  } else if (obj instanceof PDFArray) {
    for (const el of obj.asArray()) {
      decryptStrings(el, objNum, genNum, encKey, keyLength, isAES);
    }
  }
}

export async function decryptStandardPdf(pdfBuffer: Buffer, password = ""): Promise<Buffer> {
  try {
    const pdfDoc = await PDFLibDoc.load(pdfBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const context = pdfDoc.context;
    const encryptRef = (context as any).trailerInfo?.Encrypt;
    if (!encryptRef) {
      return pdfBuffer;
    }

    const encryptDict = context.lookup(encryptRef);
    if (!encryptDict || !(encryptDict instanceof PDFDict)) {
      return pdfBuffer;
    }

    const O = (encryptDict.get(PDFName.of("O")) as any)?.asBytes?.();
    const P_val = encryptDict.get(PDFName.of("P")) as any;
    const P = P_val
      ? typeof P_val.asNumber === "function"
        ? P_val.asNumber()
        : Number(P_val.toString())
      : 0;
    const R_val = encryptDict.get(PDFName.of("R")) as any;
    const R = R_val
      ? typeof R_val.asNumber === "function"
        ? R_val.asNumber()
        : Number(R_val.toString())
      : 3;
    const Length = encryptDict.get(PDFName.of("Length")) as any;
    const keyLengthBits = Length
      ? typeof Length.asNumber === "function"
        ? Length.asNumber()
        : Number(Length.toString())
      : 128;
    const keyLength = keyLengthBits / 8;

    const encMeta = encryptDict.get(PDFName.of("EncryptMetadata"));
    const encryptMetadata = encMeta ? encMeta.toString() !== "false" : true;

    if (!O) {
      return pdfBuffer;
    }

    const idArray = (context as any).trailerInfo?.ID;
    let fileId = Buffer.alloc(0);
    if (idArray) {
      if (Array.isArray(idArray) && idArray.length > 0) {
        fileId = Buffer.from(idArray[0].asBytes ? idArray[0].asBytes() : idArray[0]);
      } else if (idArray instanceof PDFArray) {
        const first = idArray.lookup(0) as any;
        fileId = Buffer.from(first?.asBytes ? first.asBytes() : []);
      }
    }

    let isAES = false;
    const cf = encryptDict.get(PDFName.of("CF"));
    if (cf && cf instanceof PDFDict) {
      const stdcf = cf.get(PDFName.of("StdCF"));
      if (stdcf && stdcf instanceof PDFDict) {
        const cfm = stdcf.get(PDFName.of("CFM"));
        if (cfm && (cfm.toString() === "/AESV2" || cfm.toString() === "/AESV3")) {
          isAES = true;
        }
      }
    }

    const encKey = computeEncryptionKey(
      password,
      O,
      P,
      fileId,
      R,
      keyLength,
      encryptMetadata
    );
    const encObjNum = encryptRef instanceof PDFRef ? encryptRef.objectNumber : -1;

    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      const objNum = ref.objectNumber;
      const genNum = ref.generationNumber || 0;
      if (objNum === encObjNum) continue;

      if (obj instanceof PDFRawStream) {
        if (obj.dict) {
          const type = obj.dict.get(PDFName.of("Type"));
          if (type && (type.toString() === "/XRef" || type.toString() === "/Sig")) continue;
        }
        (obj as any).contents = decryptData(
          Buffer.from(obj.contents),
          objNum,
          genNum,
          encKey,
          keyLength,
          isAES
        );
        if (obj.dict) {
          decryptStrings(obj.dict, objNum, genNum, encKey, keyLength, isAES);
        }
      } else {
        decryptStrings(obj, objNum, genNum, encKey, keyLength, isAES);
      }
    }

    delete (context as any).trailerInfo.Encrypt;

    const decryptedBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(decryptedBytes);
  } catch (err: any) {
    console.warn("[decryptStandardPdf] Fallback failed:", err?.message || err);
    return pdfBuffer;
  }
}

export async function ensureDecryptedPdf(pdfBuffer: Buffer): Promise<Buffer> {
  let workingBuffer = pdfBuffer;
  try {
    const encInfo = await isEncrypted(new Uint8Array(workingBuffer)).catch(() => null);
    if (encInfo && encInfo.encrypted) {
      const decryptedBytes = await decryptPDF(new Uint8Array(workingBuffer), "");
      workingBuffer = Buffer.from(decryptedBytes);
      return workingBuffer;
    }
  } catch (_e) {
    // If @pdfsmaller/pdf-decrypt throws (e.g. Unsupported encryption: V=4, R=4), fallback to Standard Security Handler
  }
  return await decryptStandardPdf(workingBuffer, "");
}

/**
 * Post-processes PDF buffers to embed QR codes, payment links, and clean up Zoho footers.
 */
export async function postProcessPdf(
  pdfBuffer: Buffer,
  options: PostProcessOptions = {}
): Promise<Buffer> {
  try {
    const decryptedBuffer = await ensureDecryptedPdf(pdfBuffer);
    const pdfDoc = await PDFLibDoc.load(decryptedBuffer, { ignoreEncryption: true });

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
          const qrLabel =
            isInvoice && options.paymentLink
              ? "Scan to Pay Online"
              : options.docType === "receipt"
              ? "Scan to Verify"
              : "Scan to View";
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

    if ((pdfDoc.context as any)?.trailerInfo?.Encrypt) {
      delete (pdfDoc.context as any).trailerInfo.Encrypt;
    }

    const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(modifiedPdfBytes);
  } catch (err: any) {
    console.error("[postProcessPdf] Error processing PDF:", err?.message || err);
    return pdfBuffer; // fallback cleanly to original buffer
  }
}

export default postProcessPdf;
