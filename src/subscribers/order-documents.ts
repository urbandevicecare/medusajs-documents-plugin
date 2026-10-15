import { SubscriberArgs, type SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { DOCUMENTS_MODULE } from "../modules/documents";
import DocumentModuleService from "../modules/documents/service";
import { generateOrderPaymentLink } from "../utils/payment-link";
import { NotificationSender } from "../services/notification-sender";

export default async function orderDocumentsSubscriber({
  event,
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve("logger");
  const eventName = event.name;
  const data = event.data || {};

  logger.info(`[Documents-Subscriber] Handling '${eventName}' event (Payload ID: ${data?.id || data?.order_id})`);

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
    if (
      (eventName === "payment.captured" || eventName === "order.payment_captured") &&
      !settings.event_payment_captured_enabled
    ) {
      logger.info(`[Documents-Subscriber] Payment captured event processing is disabled in Documents settings.`);
      return;
    }
    if (
      (eventName === "order.fulfillment_created" ||
        eventName === "fulfillment.created" ||
        eventName === "order.shipment_created" ||
        eventName === "shipment.created") &&
      !settings.event_order_fulfillment_enabled
    ) {
      logger.info(`[Documents-Subscriber] Fulfillment/shipment event processing is disabled in Documents settings.`);
      return;
    }
    if (
      (eventName === "order.canceled" || eventName === "order.cancelled") &&
      settings.event_order_canceled_enabled === false
    ) {
      logger.info(`[Documents-Subscriber] Order canceled event processing is disabled in Documents settings.`);
      return;
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Extra event metadata
    const extraData: Record<string, any> = {
      tracking_number: data.tracking_number || data.tracking_numbers?.[0],
      tracking_url: data.tracking_url || data.tracking_urls?.[0],
      carrier: data.carrier || data.provider_id,
      cancellation_reason: data.reason || data.cancellation_reason,
      amount: data.amount,
      payment_method: data.payment_method || data.provider_id,
      payment_reference: data.payment_reference || data.payment_id,
    };

    // -------------------------------------------------------------
    // Robust Order ID Resolution
    // In Medusa v2:
    // - order.placed: data.id is order_id
    // - payment.captured: data.id is payment_id (pay_...)
    // - fulfillment.created / shipment.created: data.id is fulfillment_id (ful_...)
    // -------------------------------------------------------------
    let orderId = data.order_id;

    // 1. Resolve order ID from payment event
    if (
      !orderId &&
      (eventName === "payment.captured" ||
        eventName === "order.payment_captured" ||
        (data.id && String(data.id).startsWith("pay_")))
    ) {
      const paymentId = data.payment_id || data.id;
      const { data: payments } = await query
        .graph({
          entity: "payment",
          fields: [
            "id",
            "amount",
            "currency_code",
            "provider_id",
            "payment_collection.id",
            "payment_collection.order.id",
          ],
          filters: { id: paymentId },
        })
        .catch(() => ({ data: [] }));

      if (payments && payments.length > 0) {
        orderId = payments[0]?.payment_collection?.order?.id;
        if (payments[0]?.amount != null) {
          extraData.captured_amount = payments[0].amount;
        }
        if (payments[0]?.provider_id) {
          extraData.payment_method = extraData.payment_method || payments[0].provider_id;
        }
        extraData.payment_reference = extraData.payment_reference || payments[0]?.id;
      }

      // Fallback: Query order by payment_collections link
      if (!orderId) {
        const { data: ords } = await query
          .graph({
            entity: "order",
            fields: ["id"],
            filters: {
              payment_collections: {
                payments: { id: paymentId },
              },
            },
          })
          .catch(() => ({ data: [] }));
        if (ords && ords.length > 0) {
          orderId = ords[0].id;
        }
      }
    }

    // 2. Resolve order ID from fulfillment / shipment event
    if (
      !orderId &&
      (eventName === "fulfillment.created" ||
        eventName === "shipment.created" ||
        eventName === "order.shipment_created" ||
        eventName === "order.fulfillment_created" ||
        (data.id && String(data.id).startsWith("ful_")))
    ) {
      const fulfillmentId = data.fulfillment_id || data.id;
      const { data: fuls } = await query
        .graph({
          entity: "fulfillment",
          fields: ["id", "order.id", "labels.*", "provider_id"],
          filters: { id: fulfillmentId },
        })
        .catch(() => ({ data: [] }));

      if (fuls && fuls.length > 0) {
        orderId = fuls[0]?.order?.id;
        if (fuls[0]?.labels && fuls[0].labels.length > 0) {
          extraData.tracking_number =
            extraData.tracking_number || fuls[0].labels[0]?.tracking_number;
          extraData.tracking_url =
            extraData.tracking_url || fuls[0].labels[0]?.tracking_url;
        }
        if (fuls[0]?.provider_id) {
          extraData.carrier = extraData.carrier || fuls[0].provider_id;
        }
      }
    }

    // 3. Fallback: If still unresolved, treat data.id as order ID
    if (!orderId && data.id) {
      orderId = data.id;
    }

    if (!orderId) {
      logger.warn(`[Documents-Subscriber] No order ID found in '${eventName}' payload.`);
      return;
    }

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
        "metadata",
        "customer.first_name",
        "customer.last_name",
        "customer.email",
        "customer.phone",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.address_1",
        "shipping_address.address_2",
        "shipping_address.city",
        "shipping_address.postal_code",
        "shipping_address.country_code",
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
        "payment_collections.payments.provider_id",
        "fulfillments.id",
        "fulfillments.provider_id",
        "fulfillments.labels.*",
        "fulfillments.items.*",
      ],
      filters: { id: orderId },
    });

    if (!orders || orders.length === 0) {
      logger.warn(`[Documents-Subscriber] Order ${orderId} not found in database.`);
      return;
    }

    const order = orders[0];

    // Fix 3: Suppress duplicate order documents/receipts when order is for a repair payment
    if (order.metadata?.repair_ticket_id) {
      if (eventName === "payment.captured" || eventName === "order.payment_captured") {
        logger.info(
          `[Documents-Subscriber] Order ${order.id} represents a repair payment for ticket #${order.metadata.repair_ticket_id}. Suppressing duplicate store receipt.`
        );
        return;
      }
      if (eventName === "order.placed") {
        logger.info(
          `[Documents-Subscriber] Order ${order.id} represents a repair payment for ticket #${order.metadata.repair_ticket_id}. Suppressing store tax invoice (handled by repair subscriber).`
        );
        return;
      }
      if (eventName === "order.completed") {
        logger.info(
          `[Documents-Subscriber] Order ${order.id} represents a repair payment for ticket #${order.metadata.repair_ticket_id}. Suppressing store order completed notification (handled by repair subscriber).`
        );
        return;
      }
      if (
        eventName === "fulfillment.created" ||
        eventName === "order.fulfillment_created" ||
        eventName === "shipment.created" ||
        eventName === "order.shipment_created"
      ) {
        logger.info(
          `[Documents-Subscriber] Order ${order.id} represents a repair payment for ticket #${order.metadata.repair_ticket_id}. Suppressing store fulfillment / shipment notification.`
        );
        return;
      }
    }

    const customerName =
      order.customer?.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : order.shipping_address?.first_name
        ? `${order.shipping_address.first_name} ${order.shipping_address.last_name || ""}`.trim()
        : order.email || "Valued Customer";
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

    // -------------------------------------------------------------
    // 1. Handle 'order.placed' -> Tax Invoice + Order Confirmation
    // -------------------------------------------------------------
    if (eventName === "order.placed") {
      // Deduplicate: check if tax invoice was already generated for this order
      const existingInvoices = await documentService.listDocumentRecords({
        order_id: order.id,
        type: "invoice",
      }).catch(() => []);

      let record: any = null;
      if (existingInvoices && existingInvoices.length > 0) {
        logger.info(`[Documents-Subscriber] Tax invoice already generated for order ${order.id}. Reusing existing document.`);
        record = existingInvoices[0];
      } else {
        const paymentInfo = generateOrderPaymentLink(order, storeUrl);

        const gen = await documentService.generateDocument(
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
            auto_send: false, // Sent via dedicated NotificationSender.sendOrderNotification below
            email_subject: `Order Confirmation #${order.display_id || order.id}`,
          },
          container
        );
        record = gen.record;
      }

      await NotificationSender.sendOrderNotification({
        container,
        event: "order.placed",
        order,
        documentRecord: record,
        settings,
        extraData,
      });
    }

    // -------------------------------------------------------------
    // 2. Handle 'payment.captured' -> Payment Receipt
    // -------------------------------------------------------------
    else if (eventName === "payment.captured" || eventName === "order.payment_captured") {
      const receiptTotal =
        extraData.captured_amount != null
          ? Number(extraData.captured_amount)
          : extraData.amount != null
          ? Number(extraData.amount)
          : Number(order.total || 0);

      const { record } = await documentService.generateDocument(
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
          total: receiptTotal,
          currency_code: order.currency_code,
          payment_status: "paid",
          auto_send: false, // Sent via dedicated NotificationSender.sendOrderNotification below
          email_subject: `Payment Receipt for Order #${order.display_id || order.id}`,
        },
        container
      );

      await NotificationSender.sendOrderNotification({
        container,
        event: "order.payment_captured",
        order,
        documentRecord: record,
        settings,
        extraData,
      });
    }

    // -------------------------------------------------------------
    // 3. Handle Fulfillment / Shipment -> Packing Slip + Tracking
    // -------------------------------------------------------------
    else if (
      eventName === "order.fulfillment_created" ||
      eventName === "fulfillment.created" ||
      eventName === "order.shipment_created" ||
      eventName === "shipment.created"
    ) {
      const isShipment =
        eventName === "order.shipment_created" || eventName === "shipment.created";

      // Check for existing packing slip to prevent duplicate generation
      const existingPackingSlips = await documentService
        .listDocumentRecords({
          order_id: order.id,
          type: "packing_slip",
        })
        .catch(() => []);

      let record: any = null;
      if (existingPackingSlips && existingPackingSlips.length > 0) {
        record = existingPackingSlips[0];
        // If this is a redundant duplicate fulfillment creation event without new tracking info, suppress
        if (!isShipment && !extraData.tracking_number) {
          logger.info(
            `[Documents-Subscriber] Packing slip already exists for order ${order.id}. Suppressing duplicate fulfillment notification.`
          );
          return;
        }
      } else {
        const genResult = await documentService.generateDocument(
          {
            display_id: `PACK-${order.display_id || order.id.slice(-6)}`,
            title: "Packing Slip",
            type: "packing_slip",
            order_id: order.id,
            customer: {
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              address: `${order.shipping_address?.address_1 || ""}, ${order.shipping_address?.city || ""}`.trim(),
            },
            items: lineItems,
            total: 0,
            currency_code: order.currency_code,
            payment_status: "not_applicable",
            force_source: "pdfkit",
            auto_send: false,
          },
          container
        );
        record = genResult.record;
      }

      await NotificationSender.sendOrderNotification({
        container,
        event: "order.fulfillment_created",
        order,
        documentRecord: record,
        settings,
        extraData,
      });
    }

    // -------------------------------------------------------------
    // 4. Handle 'order.completed' -> Completion Notification
    // -------------------------------------------------------------
    else if (eventName === "order.completed") {
      await NotificationSender.sendOrderNotification({
        container,
        event: "order.completed",
        order,
        settings,
        extraData,
      });
    }

    // -------------------------------------------------------------
    // 5. Handle 'order.canceled' -> Order Cancellation & Invoice Voiding
    // -------------------------------------------------------------
    else if (eventName === "order.canceled" || eventName === "order.cancelled") {
      // Void any active/unpaid invoices for this order in document records
      try {
        const existingDocs = await documentService.listDocumentRecords({
          order_id: order.id,
        });
        for (const doc of existingDocs) {
          if (doc.type === "invoice" && doc.status !== "void" && doc.status !== "paid") {
            await documentService.updateDocumentRecords({
              id: doc.id,
              status: "void",
            });
          }
        }
      } catch (err) {}

      await NotificationSender.sendOrderNotification({
        container,
        event: "order.canceled",
        order,
        settings,
        extraData,
      });
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
    "order.payment_captured",
    "order.fulfillment_created",
    "fulfillment.created",
    "order.shipment_created",
    "shipment.created",
    "order.canceled",
    "order.cancelled",
  ],
};
