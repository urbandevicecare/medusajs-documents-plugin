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

    // Check on/off toggles
    if (eventName === "repair.status_changed" && !settings.event_repair_status_changed_enabled) return;
    if (eventName === "repair.ticket.compliance_requested" && !settings.event_repair_compliance_enabled) return;
    if (eventName === "repair.created" && !settings.event_repair_created_enabled) return;
    if (eventName === "repair.completed" && !settings.event_repair_completed_enabled) return;
    if (eventName === "repair.customer_reminder" && !settings.event_repair_reminder_enabled) return;

    const ticketId = data.id || data.repair_ticket_id;
    if (!ticketId) return;

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: tickets } = await query.graph({
      entity: "repair_ticket",
      fields: [
        "*",
        "device.*",
        "product_variants.*",
      ],
      filters: { id: ticketId },
    }).catch(() => ({ data: [] }));

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

    // Build line items
    const lineItems: any[] = [];
    if (ticket.device?.parts_used && ticket.device.parts_used.length > 0) {
      for (const part of ticket.device.parts_used) {
        lineItems.push({
          title: part.name || "Replacement Part",
          description: part.sku ? `SKU: ${part.sku}` : "",
          quantity: 1,
          unit_price: Number(part.price || 0),
          total: Number(part.price || 0),
        });
      }
    }
    if (Number(ticket.labor_estimate || 0) > 0) {
      lineItems.push({
        title: "Labor Charge",
        quantity: 1,
        unit_price: Number(ticket.labor_estimate),
        total: Number(ticket.labor_estimate),
      });
    }
    if (ticket.custom_parts && ticket.custom_parts.length > 0) {
      for (const cp of ticket.custom_parts) {
        lineItems.push({
          title: cp.name || "Custom Service",
          quantity: 1,
          unit_price: Number(cp.price || 0),
          total: Number(cp.price || 0),
        });
      }
    }
    if (lineItems.length === 0) {
      const tot = Number(ticket.total_actual || ticket.total_estimate || 0);
      lineItems.push({
        title: `Repair Service (#${ticket.ticket_number})`,
        quantity: 1,
        unit_price: tot,
        total: tot,
      });
    }

    const isPaid = ticket.payment_status === "captured" || ticket.payment_status === "paid" || eventName === "repair.payment_received";
    const isAwaitingApproval = ticket.status === "awaiting_approval";

    const docType = isPaid ? "receipt" : (isAwaitingApproval ? "estimate" : "invoice");
    const docTitle = isPaid ? "Repair Payment Receipt" : (isAwaitingApproval ? "Repair Estimate / Quote" : "Repair Invoice");

    const totalEstimate = Number(ticket.total_actual && ticket.total_actual > 0 ? ticket.total_actual : ticket.total_estimate || 0);

    await documentService.generateDocument(
      {
        display_id: `RT-${ticket.ticket_number}`,
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
        payment_link: paymentInfo.paymentLink || undefined,
        auto_send: true,
        email_subject: `${docTitle} for Ticket #${ticket.ticket_number} (${ticket.device?.model_name || "Device"})`,
        custom_fields: {
          "Device Model": ticket.device?.model_name || "N/A",
          "Serial / IMEI": ticket.device?.serial_number || ticket.device?.imei || "N/A",
          "Issue": ticket.issue_description || "Standard Repair",
        },
      },
      container
    );
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
