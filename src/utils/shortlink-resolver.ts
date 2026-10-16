import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../modules/documents/service";

/**
 * Universal safe shortlink redirection handler.
 * Resolves shortcodes from documents module, repair module, or direct knex fallback,
 * safely extracts host and protocol across Express and Fastify environments,
 * and performs redirection without throwing 500 errors.
 */
export async function handleShortlinkRedirect(
  req: MedusaRequest<{ code: string }>,
  res: MedusaResponse,
  contextTag: string = "Shortlink"
) {
  const code = req.params?.code;
  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(404).send("Link not found or expired.");
  }

  const cleanCode = code.trim();

  try {
    let targetUrl: string | null = null;

    // 1. Resolve via DocumentModuleService
    try {
      const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE, { allowUnregistered: true });
      if (documentService) {
        const links = await documentService.listDocumentLinks({ shortcode: cleanCode }).catch(() => []);
        if (links && links.length > 0 && links[0].url) {
          targetUrl = links[0].url;
        }
      }
    } catch (_) {}

    // 2. Resolve via Repair Module if present
    if (!targetUrl) {
      try {
        const repairModule: any = req.scope.resolve("repair", { allowUnregistered: true });
        if (repairModule && typeof repairModule.listRepairLinks === "function") {
          const links = await repairModule.listRepairLinks({ shortcode: cleanCode }).catch(() => []);
          if (links && links.length > 0 && links[0].url) {
            targetUrl = links[0].url;
          }
        }
      } catch (_) {}
    }

    // 3. Fallback direct SQL resolution using Knex
    if (!targetUrl) {
      try {
        const pg: any = getDatabaseConnection(req.scope);
        if (pg) {
          // 3a. document_link table
          try {
            const row = await pg("document_link")
              .where({ shortcode: cleanCode })
              .first();
            if (row && row.url) {
              targetUrl = row.url;
            }
          } catch (_) {}

          // 3b. repair_link table
          if (!targetUrl) {
            try {
              const row = await pg("repair_link")
                .where({ shortcode: cleanCode })
                .first();
              if (row && row.url) {
                targetUrl = row.url;
              }
            } catch (_) {}
          }

          // 3c. document_record table (search short_payment_link or short_pdf_link)
          if (!targetUrl) {
            try {
              const docRow = await pg("document_record")
                .where(function (this: any) {
                  this.where("short_payment_link", "like", `%/r/${cleanCode}`)
                    .orWhere("short_payment_link", "like", `%/${cleanCode}`)
                    .orWhere("short_pdf_link", "like", `%/r/${cleanCode}`)
                    .orWhere("short_pdf_link", "like", `%/${cleanCode}`);
                })
                .first();

              if (docRow) {
                if (docRow.short_payment_link && docRow.short_payment_link.endsWith(cleanCode)) {
                  targetUrl = docRow.payment_link || docRow.short_payment_link;
                } else if (docRow.short_pdf_link && docRow.short_pdf_link.endsWith(cleanCode)) {
                  targetUrl = docRow.pdf_url || docRow.short_pdf_link;
                }
              }
            } catch (_) {}
          }

          // 3d. repair_ticket table (search short_payment_link)
          if (!targetUrl) {
            try {
              const repRow = await pg("repair_ticket")
                .where(function (this: any) {
                  this.where("short_payment_link", "like", `%/r/${cleanCode}`)
                    .orWhere("short_payment_link", "like", `%/${cleanCode}`);
                })
                .first();

              if (repRow && repRow.payment_link && !repRow.payment_link.endsWith(cleanCode)) {
                targetUrl = repRow.payment_link;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    if (!targetUrl) {
      return res.status(404).send("Link not found or expired.");
    }

    // Safe extraction of host and protocol
    const getHeader = (name: string): string | undefined => {
      try {
        if (typeof req.get === "function") {
          const val = req.get(name);
          if (val) return val;
        }
      } catch (_) {}
      try {
        if (req.headers && typeof req.headers === "object") {
          const val = (req.headers as any)[name.toLowerCase()];
          if (Array.isArray(val)) return val[0];
          if (val != null) return String(val);
        }
      } catch (_) {}
      return undefined;
    };

    const host =
      getHeader("x-forwarded-host") ||
      getHeader("host") ||
      (req as any).hostname ||
      "localhost:9000";

    const forwardedProto = getHeader("x-forwarded-proto");
    const protocol =
      (forwardedProto === "http" || forwardedProto === "https")
        ? forwardedProto
        : ((req as any).protocol || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https"));

    // Normalize any document path pointing to admin or legacy routes
    if (targetUrl.includes("/documents/")) {
      const docSubpath = targetUrl.slice(targetUrl.indexOf("/documents/")).replace(/\/admin\/documents\//, "/documents/");
      targetUrl = `${protocol}://${host}${docSubpath}`;
    } else if (targetUrl.startsWith("/")) {
      targetUrl = `${protocol}://${host}${targetUrl}`;
    }

    // Perform redirect safely
    if (typeof (res as any).redirect === "function") {
      return (res as any).redirect(targetUrl);
    }
    res.setHeader("Location", targetUrl);
    return res.status(302).send("Redirecting...");
  } catch (err: any) {
    try {
      req.scope.resolve("logger", { allowUnregistered: true })?.error?.(`[${contextTag}] Error resolving /r/${cleanCode}: ${err.message}`);
    } catch (_) {}
    return res.status(500).send("Error resolving link");
  }
}
