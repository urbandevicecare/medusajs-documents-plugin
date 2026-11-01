import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DOCUMENTS_MODULE } from "../../../../modules/documents";
import DocumentModuleService, { getDatabaseConnection } from "../../../../modules/documents/service";
import { ZohoBooksService } from "../../../../services/zoho-books";

// POST & GET /admin/documents/sync
// Syncs all repair tickets and Zoho Books documents into document_record, creating missing job cards and accompanying quotes/invoices
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return handleSync(req, res);
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return handleSync(req, res);
}

async function handleSync(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger", { allowUnregistered: true });
  try {
    const documentService: DocumentModuleService = req.scope.resolve(DOCUMENTS_MODULE);
    const settings = await documentService.getSettings({}, req.scope).catch(() => ({}));
    const specificTicketId = (req.query?.repair_ticket_id || (req.body as any)?.repair_ticket_id) as string | undefined;

    // 1. Fetch repair tickets from query graph or DB connection
    let tickets: any[] = [];
    try {
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
      const queryFilters: any = {};
      if (specificTicketId) {
        queryFilters.id = specificTicketId;
      }
      const { data } = await query.graph({
        entity: "repair_ticket",
        fields: [
          "*",
          "device.*",
          "product_variants.*",
          "product_variants.prices.*",
          "product_variants.product.*",
        ],
        filters: queryFilters,
      });
      tickets = data || [];
    } catch (graphErr: any) {
      logger?.warn?.(`[Documents-Sync] query.graph failed (${graphErr.message}), falling back to direct db query`);
      const conn = getDatabaseConnection(req.scope);
      if (conn) {
        let q = conn("repair_ticket").whereNull("deleted_at");
        if (specificTicketId) {
          q = q.where("id", specificTicketId);
        }
        tickets = await q;
      }
    }

    if (!tickets || tickets.length === 0) {
      return res.json({
        success: true,
        message: "No repair tickets found to synchronize.",
        synced_count: 0,
        documents_created: 0,
      });
    }

    // 2. Fetch Zoho Books existing invoices & estimates if enabled
    let zohoInvoices: any[] = [];
    let zohoEstimates: any[] = [];
    if (
      settings?.zoho_books_enabled &&
      settings.zoho_client_id &&
      settings.zoho_client_secret &&
      settings.zoho_refresh_token &&
      settings.zoho_organization_id
    ) {
      try {
        const zoho = new ZohoBooksService(
          {
            client_id: settings.zoho_client_id,
            client_secret: settings.zoho_client_secret,
            refresh_token: settings.zoho_refresh_token,
            organization_id: settings.zoho_organization_id,
            domain: settings.zoho_domain || "com",
          },
          logger
        );
        const [invRes, estRes] = await Promise.all([
          zoho.listInvoices().catch(() => []),
          zoho.listEstimates().catch(() => []),
        ]);
        zohoInvoices = Array.isArray(invRes) ? invRes : [];
        zohoEstimates = Array.isArray(estRes) ? estRes : [];
      } catch (zohoErr: any) {
        logger?.warn?.(`[Documents-Sync] Could not pre-fetch Zoho documents: ${zohoErr.message}`);
      }
    }

    const createdRecords: any[] = [];

    // 3. Process each ticket
    for (const ticket of tickets) {
      const cleanNum = String(ticket.ticket_number || "").replace(/^(JOB-|RT-)+/i, "");
      const ticketNum = ticket.ticket_number || `RT-${cleanNum}`;
      const meta = (ticket.metadata || {}) as Record<string, any>;

      // A. Fetch existing documents for this ticket
      let existingDocs: any[] = [];
      try {
        existingDocs = await documentService.listDocumentRecords(
          { repair_ticket_id: ticket.id },
          {},
          {}
        ).catch(() => []);
      } catch (_) {
        const conn = getDatabaseConnection(req.scope);
        if (conn) {
          existingDocs = await conn("document_record")
            .where({ repair_ticket_id: ticket.id })
            .whereNull("deleted_at");
        }
      }

      const hasJobCard = existingDocs.some((d: any) => d.type === "job_card");
      const hasInvoice = existingDocs.some((d: any) => d.type === "invoice");
      const hasEstimate = existingDocs.some((d: any) => d.type === "estimate");
      const hasReceipt = existingDocs.some((d: any) => d.type === "receipt");

      const totalAmount = Number(ticket.total_actual > 0 ? ticket.total_actual : ticket.total_estimate || 0);
      const currencyCode = ticket.currency_code || (ticket.metadata as any)?.currency_code || "kes";

      // B. Ensure Job Card exists
      if (!hasJobCard) {
        try {
          const genJob = await documentService.generateDocument(
            {
              display_id: `JOB-${cleanNum}`,
              title: "Repair Job Card",
              type: "job_card",
              repair_ticket_id: ticket.id,
              total: totalAmount,
              currency_code: currencyCode,
              force_source: "pdfkit",
            },
            req.scope
          );
          if (genJob?.record) {
            createdRecords.push(genJob.record);
          }
        } catch (jobErr: any) {
          logger?.warn?.(`[Documents-Sync] Could not generate job card for ${ticketNum}: ${jobErr.message}`);
        }
      }

      // C. Match Zoho Invoice if not in document_record
      if (!hasInvoice) {
        let matchedZohoInv = zohoInvoices.find(
          (zi) =>
            zi.invoice_id === meta.zoho_invoice_id ||
            zi.invoice_number === ticketNum ||
            zi.invoice_number === cleanNum ||
            zi.reference_number === ticketNum ||
            zi.reference_number === `RT-${ticketNum}` ||
            zi.reference_number === `RT-RT-${cleanNum}` ||
            zi.reference_number?.includes(cleanNum)
        );

        if (matchedZohoInv || meta.zoho_invoice_id) {
          try {
            const genInv = await documentService.generateDocument(
              {
                display_id: matchedZohoInv?.invoice_number || ticketNum,
                title: (ticket.status === "completed" || ticket.status === "repaired") ? "Final Repair Invoice" : "Repair Invoice",
                type: "invoice",
                repair_ticket_id: ticket.id,
                total: totalAmount,
                currency_code: currencyCode,
                force_source: settings?.zoho_books_enabled ? "zoho" : undefined,
              },
              req.scope
            );
            if (genInv?.record) {
              createdRecords.push(genInv.record);
            }
          } catch (invErr: any) {
            logger?.warn?.(`[Documents-Sync] Could not sync invoice for ${ticketNum}: ${invErr.message}`);
          }
        } else if (["repairing", "ready", "completed", "collected", "repaired"].includes(ticket.status)) {
          // Ticket is in repair or completion phase: generate invoice
          try {
            const genInv = await documentService.generateDocument(
              {
                display_id: ticketNum,
                title: (ticket.status === "completed" || ticket.status === "repaired") ? "Final Repair Invoice" : "Repair Invoice",
                type: "invoice",
                repair_ticket_id: ticket.id,
                total: totalAmount,
                currency_code: currencyCode,
                force_source: settings?.zoho_books_enabled ? "zoho" : undefined,
              },
              req.scope
            );
            if (genInv?.record) {
              createdRecords.push(genInv.record);
            }
          } catch (invErr: any) {
            logger?.warn?.(`[Documents-Sync] Could not generate invoice for ${ticketNum}: ${invErr.message}`);
          }
        }
      }

      // D. Match Zoho Estimate if not in document_record
      if (!hasEstimate) {
        let matchedZohoEst = zohoEstimates.find(
          (ze) =>
            ze.estimate_id === meta.zoho_estimate_id ||
            ze.estimate_number === ticketNum ||
            ze.estimate_number === cleanNum ||
            ze.reference_number === ticketNum ||
            ze.reference_number === `RT-${ticketNum}` ||
            ze.reference_number === `RT-RT-${cleanNum}` ||
            ze.reference_number?.includes(cleanNum)
        );

        if (matchedZohoEst || meta.zoho_estimate_id) {
          try {
            const genEst = await documentService.generateDocument(
              {
                display_id: matchedZohoEst?.estimate_number || `EST-${cleanNum}`,
                title: "Repair Estimate / Quote",
                type: "estimate",
                repair_ticket_id: ticket.id,
                total: totalAmount,
                currency_code: currencyCode,
                force_source: settings?.zoho_books_enabled ? "zoho" : undefined,
              },
              req.scope
            );
            if (genEst?.record) {
              createdRecords.push(genEst.record);
            }
          } catch (estErr: any) {
            logger?.warn?.(`[Documents-Sync] Could not sync estimate for ${ticketNum}: ${estErr.message}`);
          }
        } else {
          // Generate estimate / quote for this ticket
          try {
            const genEst = await documentService.generateDocument(
              {
                display_id: `EST-${cleanNum}`,
                title: "Repair Estimate / Quote",
                type: "estimate",
                repair_ticket_id: ticket.id,
                total: totalAmount,
                currency_code: currencyCode,
                force_source: settings?.zoho_books_enabled ? "zoho" : undefined,
              },
              req.scope
            );
            if (genEst?.record) {
              createdRecords.push(genEst.record);
            }
          } catch (estErr: any) {
            logger?.warn?.(`[Documents-Sync] Could not generate estimate for ${ticketNum}: ${estErr.message}`);
          }
        }
      }

      // E. Check for Receipt if paid
      const isPaid = ticket.payment_status === "paid" || ticket.payment_status === "captured" || Number(ticket.amount_paid || 0) > 0;
      if (isPaid && !hasReceipt) {
        try {
          const genRcpt = await documentService.generateDocument(
            {
              display_id: `RCPT-${cleanNum}`,
              title: "Repair Payment Receipt",
              type: "receipt",
              repair_ticket_id: ticket.id,
              total: Number(ticket.amount_paid || totalAmount),
              currency_code: currencyCode,
              force_source: settings?.zoho_books_enabled ? "zoho" : undefined,
            },
            req.scope
          );
          if (genRcpt?.record) {
            createdRecords.push(genRcpt.record);
          }
        } catch (rcptErr: any) {
          logger?.warn?.(`[Documents-Sync] Could not generate receipt for ${ticketNum}: ${rcptErr.message}`);
        }
      }
    }

    return res.json({
      success: true,
      message: `Successfully synchronized ${tickets.length} repair tickets.`,
      synced_tickets: tickets.length,
      documents_created: createdRecords.length,
      records: createdRecords.map((r) => ({
        id: r.id,
        display_id: r.display_id,
        type: r.type,
        source: r.source,
        total_amount: r.total_amount,
      })),
    });
  } catch (error: any) {
    logger?.error?.(`[Documents-Sync] Fatal error during synchronization: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to synchronize documents",
      error: true,
    });
  }
}
