import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService from "../modules/documents/service";
import { generateOrderPaymentLink } from "../utils/payment-link";

export default async function orderDocumentsSubscriber({
  event,
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve("logger");
  const eventName = event.name;
  const data = event.data;

  logger.info(`[Documents-Subscriber] Handling '${eventName}' event (Order ID: ${data?.id})`);

  try {
    const documentService: DocumentModuleService = container.resolve(DOCUMENTS_MODULE, {
      allowUnregistered: true,
    });
    if (!documentService) {
      logger.warn(`[Documents-Subscriber] Documents module not registered in container. Aborting.`);
      return;
    }

    const settings = await documentService.getSettings();

    // Check on/off toggles from DocumentSettings
    if (eventName === "order.placed" && !settings.event_order_placed_enabled) {
      logger.info(`[Documents-Subscriber] 'order.placed' event processing is disabled in Documents settings.`);
      return;
    }
    if (eventName === "order.completed" && !settings.event_order_completed_enabled) {
      logger.info(`[Documents-Subscriber] 'order.completed' event processing is disabled in Documents settings.`);
      return;
    }
    if (eventName === "payment.captured" && !settings.event_payment_captured_enabled) {
      logger.info(`[Documents-Subscriber] 'payment.captured' event processing is disabled in Documents settings.`);
      return;
    }
    if (eventName === "order.fulfillment_created" && !settings.event_order_fulfillment_enabled) {
      logger.info(`[Documents-Subscriber] 'order.fulfillment_created' event processing is disabled in Documents settings.`);
      return;
    }

    const orderId = data.id || data.order_id;
    if (!orderId) {
      logger.warn(`[Documents-Subscriber] No order ID found in '${eventName}' payload.`);
      return;
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "created_at",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "discount_total",
        "tax_total",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
        "customer.phone",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.address_1",
        "shipping_address.city",
        "shipping_address.phone",
        "items.id",
        "items.title",
        "items.quantity",
        "items.unit_price",
        "payment_collections.captured_amount",
        "payment_collections.amount",
        "payment_collections.payments.amount",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: orderId },
    });

    if (!orders || orders.length === 0) {
      logger.warn(`[Documents-Subscriber] Order ${orderId} not found in database.`);
      return;
    }

    const order = orders[0];
    const customerName =
      order.customer?.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : order.shipping_address?.first_name || "Valued Customer";
    const customerEmail = order.email || order.customer?.email;
    const customerPhone = order.shipping_address?.phone || order.customer?.phone;

    const storeUrl = settings.storefront_url || process.env.STOREFRONT_URL || "http://localhost:5173";

    // Format Line Items
    const lineItems = (order.items || []).map((it: any) => ({
      title: it.title,
      quantity: Number(it.quantity || 1),
      unit_price: Number(it.unit_price || 0),
      total: Number(it.quantity || 1) * Number(it.unit_price || 0),
    }));

    // Handle 'order.placed' -> Tax Invoice
    if (eventName === "order.placed") {
      const paymentInfo = generateOrderPaymentLink(order, storeUrl);

      await documentService.generateDocument(
        {
          display_id: `INV-${order.display_id || order.id.slice(-6)}`,
          title: "Tax Invoice",
          type: "invoice",
          order_id: order.id,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            address: order.shipping_address?.address_1,
          },
          items: lineItems,
          subtotal: Number(order.subtotal || 0),
          tax_total: Number(order.tax_total || 0),
          shipping_total: Number(order.shipping_total || 0),
          discount_total: Number(order.discount_total || 0),
          total: Number(order.total || 0),
          currency_code: order.currency_code,
          payment_status: paymentInfo.isUnpaid ? "unpaid" : "paid",
          payment_link: paymentInfo.paymentLink || undefined,
          auto_send: true,
          email_subject: `Invoice for Order #${order.display_id || order.id}`,
        },
        container
      );
    }
    // Handle 'payment.captured' -> Payment Receipt
    else if (eventName === "payment.captured") {
      await documentService.generateDocument(
        {
          display_id: `RCPT-${order.display_id || order.id.slice(-6)}`,
          title: "Payment Receipt",
          type: "receipt",
          order_id: order.id,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
          },
          items: lineItems,
          total: Number(order.total || 0),
          currency_code: order.currency_code,
          payment_status: "paid",
          auto_send: true,
          email_subject: `Payment Receipt for Order #${order.display_id || order.id}`,
        },
        container
      );
    }
    // Handle 'order.completed' or 'order.fulfillment_created' -> Packing Slip
    else if (eventName === "order.completed" || eventName === "order.fulfillment_created") {
      await documentService.generateDocument(
        {
          display_id: `PACK-${order.display_id || order.id.slice(-6)}`,
          title: "Packing Slip",
          type: "packing_slip",
          order_id: order.id,
          customer: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            address: `${order.shipping_address?.address_1 || ""}, ${order.shipping_address?.city || ""}`,
          },
          items: lineItems,
          total: 0,
          currency_code: order.currency_code,
          payment_status: "not_applicable",
          force_source: "pdfkit", // Packing slips generated via PDFKit
          auto_send: false,
        },
        container
      );
    }
  } catch (error: any) {
    logger.error(`[Documents-Subscriber] Error processing '${eventName}': ${error.message}`);
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.completed",
    "payment.captured",
    "order.fulfillment_created",
  ],
};
