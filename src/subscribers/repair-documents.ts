import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService from "../modules/documents/service";
import { generateRepairPaymentLink } from "../utils/payment-link";

export default async function repairDocumentsSubscriber({
  event,
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve("logger");
  const eventName = event.name;
  const data = event.data;

  logger.info(`[Documents-Subscriber] Handling repair event '${eventName}'`);

  try {
    const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE, {
      allowUnregistered: true,
    });
    if (!documentService) return;

    const settings = await documentService.getSettings();

    // Fix 5: Handle repair completion via repair.status_changed where status === "completed"
    const isCompleted =
      eventName === "repair.completed" ||
      (eventName === "repair.status_changed" &&
        (data.status === "completed" || data.status === "repaired"));

    // Check on/off toggles
    if (isCompleted) {
      if (!settings.event_repair_completed_enabled) {
        logger.info(`[Documents-Subscriber] Repair completed document processing is disabled in settings.`);
        return;
      }
    } else if (eventName === "repair.status_changed") {
      if (!settings.event_repair_status_changed_enabled) return;
    }
    if (eventName === "repair.ticket.compliance_requested" && !settings.event_repair_compliance_enabled) return;
    if (eventName === "repair.created" && !settings.event_repair_created_enabled) return;
    if (eventName === "repair.customer_reminder" && !settings.event_repair_reminder_enabled) return;

    const ticketId = data.id || data.repair_ticket_id;
    if (!ticketId) return;

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: tickets } = await query
      .graph({
        entity: "repair_ticket",
        fields: [
          "*",
          "device.*",
          "product_variants.*",
          "product_variants.prices.*",
          "product_variants.product.*",
        ],
        filters: { id: ticketId },
      })
      .catch(() => ({ data: [] }));

    if (!tickets || tickets.length === 0) return;
    const ticket = tickets[0];

    // Customer resolution
    let customerName = "Valued Customer";
    let customerEmail: string | undefined = undefined;
    let customerPhone: string | undefined = undefined;

    if (ticket.customer_id) {
      try {
        const customerModule = container.resolve("customer", { allowUnregistered: true });
        if (customerModule) {
          const c = await customerModule.retrieveCustomer(ticket.customer_id);
          if (c) {
            customerName = c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.email;
            customerEmail = c.email || undefined;
            customerPhone = c.phone || undefined;
          }
        }
      } catch (e) {}
    }

    const storeUrl = settings.storefront_url || process.env.STORE_URL || "http://localhost:3000";
    const paymentInfo = generateRepairPaymentLink(ticket, storeUrl);

    // Fix 4: Build line items mapping inventory parts from product_variants as well as custom_parts
    const lineItems: any[] = [];

    // 1. Map inventory parts from product_variants (SKU, title, unit price, quantity)
    if (ticket.product_variants && ticket.product_variants.length > 0) {
      for (const pv of ticket.product_variants) {
        const qty = Number(pv.quantity || (pv as any).pivot?.quantity || 1);
        const unitPrice = Number(pv.unit_price ?? pv.price ?? pv.prices?.[0]?.amount ?? 0);
        const partTitle = pv.product?.title
          ? `${pv.product.title}${pv.title && pv.title !== "Default Variant" ? ` (${pv.title})` : ""}`
          : pv.title || pv.product?.title || "Inventory Part";

        lineItems.push({
          title: partTitle,
          description: pv.sku ? `SKU: ${pv.sku}` : (pv.product?.title ? `${pv.title || ""}`.trim() : ""),
          quantity: qty,
          unit_price: unitPrice,
          total: qty * unitPrice,
        });
      }
    }

    // 2. Map parts from device.parts_used if present
    if (ticket.device?.parts_used && ticket.device.parts_used.length > 0) {
      for (const part of ticket.device.parts_used) {
        const qty = Number(part.quantity || 1);
        const unitPrice = Number(part.price || part.unit_price || 0);
        lineItems.push({
          title: part.name || part.title || "Replacement Part",
          description: part.sku ? `SKU: ${part.sku}` : "",
          quantity: qty,
          unit_price: unitPrice,
          total: qty * unitPrice,
        });
      }
    }

    // 3. Labor estimate
    if (Number(ticket.labor_estimate || 0) > 0) {
      lineItems.push({
        title: "Labor Charge",
        quantity: 1,
        unit_price: Number(ticket.labor_estimate),
        total: Number(ticket.labor_estimate),
      });
    }

    // 4. Custom parts / services
    if (ticket.custom_parts && ticket.custom_parts.length > 0) {
      for (const cp of ticket.custom_parts) {
        const qty = Number(cp.quantity || 1);
        const unitPrice = Number(cp.price || cp.unit_price || 0);
        lineItems.push({
          title: cp.name || cp.title || "Custom Service / Part",
          description: cp.description || (cp.sku ? `SKU: ${cp.sku}` : ""),
          quantity: qty,
          unit_price: unitPrice,
          total: qty * unitPrice,
        });
      }
    }

    // 5. Fallback line item if none specified
    if (lineItems.length === 0) {
      const tot = Number(ticket.total_actual || ticket.total_estimate || 0);
      lineItems.push({
        title: `Repair Service (#${ticket.ticket_number})`,
        quantity: 1,
        unit_price: tot,
        total: tot,
      });
    }

    const isPaid =
      ticket.payment_status === "captured" ||
      ticket.payment_status === "paid" ||
      eventName === "repair.payment_received";
    const isAwaitingApproval = ticket.status === "awaiting_approval";

    let docType: any = isPaid ? "receipt" : (isAwaitingApproval ? "estimate" : "invoice");
    let docTitle = isPaid
      ? "Repair Payment Receipt"
      : isAwaitingApproval
      ? "Repair Estimate / Quote"
      : isCompleted
      ? "Final Repair Invoice"
      : "Repair Invoice";

    if (eventName === "repair.created") {
      docType = "job_card";
      docTitle = "Repair Job Card";
    }

    const displayId = docType === "job_card" ? `JOB-${ticket.ticket_number}` : `RT-${ticket.ticket_number}`;
    const totalEstimate = Number(ticket.total_actual && ticket.total_actual > 0 ? ticket.total_actual : ticket.total_estimate || 0);

    const trackingUrl = ticket.approval_token ? `${storeUrl}/repairs/track?token=${ticket.approval_token}` : undefined;
    const paymentOrTrackingLink = docType === "job_card" ? (trackingUrl || paymentInfo.paymentLink) : paymentInfo.paymentLink;

    // Documents plugin solely creates documents and hands them over to repair plugin.
    // All customer notifications are handled exclusively by Meduajs-repair-plugin alone.
    const autoSend = false;

    const genResult = await documentService.generateDocument(
      {
        display_id: displayId,
        title: docTitle,
        type: docType,
        repair_ticket_id: ticket.id,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        items: lineItems,
        total: totalEstimate,
        currency_code: "usd",
        payment_status: isPaid ? "paid" : "unpaid",
        payment_link: paymentOrTrackingLink || undefined,
        auto_send: autoSend,
        email_subject: `${docTitle} for Ticket #${ticket.ticket_number} (${ticket.device?.model_name || "Device"})`,
        notes:
          ticket.terms_accepted != null
            ? `Intake Consent: Terms Accepted: ${ticket.terms_accepted ? "Yes" : "No"} | Data Wipe: ${ticket.data_wiped_consent ? "Yes" : "No"}`
            : undefined,
        custom_fields: {
          "Device Model": ticket.device?.model_name || "N/A",
          Brand: ticket.device?.brand || "N/A",
          "Serial / IMEI": ticket.device?.serial_number || ticket.device?.imei || "N/A",
          Condition: ticket.device?.condition || "Not specified",
          Accessories: ticket.accessories || "None",
          Technician: ticket.technician_name || "Unassigned",
          Issue: ticket.issue_description || "Standard Repair",
        },
      },
      container
    );

    // Hand over the generated document link and record to Meduajs-repair-plugin
    if (genResult?.record) {
      try {
        const repairModule: any = container.resolve("repair", { allowUnregistered: true });
        if (repairModule) {
          const existingTicket = await repairModule.retrieveRepairTicket(ticket.id).catch(() => null);
          const currentMeta = existingTicket?.metadata || ticket.metadata || {};
          await repairModule.updateRepairTickets({
            id: ticket.id,
            metadata: {
              ...currentMeta,
              document_id: genResult.record.id,
              pdf_url: genResult.record.pdf_url,
              short_pdf_link: genResult.record.short_pdf_link || genResult.record.pdf_url,
              last_document_type: docType,
              last_document_title: genResult.record.title,
            },
          });
          logger.info(`[Documents-Subscriber] Successfully handed over document link (${genResult.record.short_pdf_link || genResult.record.pdf_url}) to repair ticket #${ticket.ticket_number}`);
        }
      } catch (handoverErr: any) {
        logger.warn(`[Documents-Subscriber] Could not update repair ticket with handed over document: ${handoverErr.message}`);
      }
    }
  } catch (error: any) {
    logger.error(`[Documents-Subscriber] Failed processing repair event '${eventName}': ${error.message}`);
  }
}

export const config: SubscriberConfig = {
  event: [
    "repair.status_changed",
    "repair.ticket.compliance_requested",
    "repair.customer_reminder",
    "repair.created",
    "repair.completed",
    "repair.payment_received",
  ],
};
