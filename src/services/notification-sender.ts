import { MedusaContainer } from "@medusajs/framework/types";
import { ModuleRegistrationName } from "@medusajs/framework/utils";
import { OrderNotificationTemplates, OrderNotificationVariables, OrderNotificationEventType } from "./order-notification-templates";
import { generateOrderPaymentLink } from "../utils/payment-link";

export interface SendNotificationOptions {
  container: MedusaContainer;
  document: {
    id: string;
    display_id: string;
    title?: string | null;
    type: string;
    customer_name?: string | null;
    customer_email?: string | null;
    customer_phone?: string | null;
    total_amount?: number | null;
    currency_code?: string | null;
    payment_status?: string | null;
    payment_link?: string | null;
    short_payment_link?: string | null;
    pdf_url?: string | null;
    short_pdf_link?: string | null;
    custom_message?: string | null;
    subject?: string | null;
    order_id?: string | null;
    repair_ticket_id?: string | null;
  };
  channels?: Array<"email" | "sms" | "whatsapp">;
  settings?: any;
}

export interface SendOrderNotificationOptions {
  container: MedusaContainer;
  event: OrderNotificationEventType;
  order: any;
  documentRecord?: any;
  settings?: any;
  channels?: Array<"email" | "sms" | "whatsapp">;
  extraData?: Record<string, any>;
}

/**
 * Replaces placeholders in format {variable_name} with actual values.
 * Supported variables are case-insensitive.
 */
export function renderTemplatePlaceholders(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  if (!template) return "";
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (key in variables && variables[key] != null) {
      return String(variables[key]);
    }
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(variables)) {
      if (k.toLowerCase() === lowerKey && v != null) {
        return String(v);
      }
    }
    return "";
  });
}

export class NotificationSender {
  /**
   * Helper to resolve the Notification Module from Medusa container
   */
  private static resolveNotificationModule(container: MedusaContainer): any {
    try {
      return container.resolve(ModuleRegistrationName.NOTIFICATION, {
        allowUnregistered: true,
      });
    } catch (e) {
      try {
        return container.resolve("notification", { allowUnregistered: true });
      } catch (err) {
        return null;
      }
    }
  }

  /**
   * Formats a monetary amount into a localized currency string
   */
  private static formatCurrency(amount: number, currencyCode: string = "KES"): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currencyCode || "KES").toUpperCase(),
    }).format(amount);
  }

  /**
   * General document-centric notification sender (Invoices, Receipts, Job Cards, Estimates)
   */
  static async send(options: SendNotificationOptions): Promise<{ sent: string[]; failed: string[] }> {
    const { container, document, settings } = options;
    const logger = container.resolve("logger");

    const sent: string[] = [];
    const failed: string[] = [];

    const notificationModule = this.resolveNotificationModule(container);

    if (!notificationModule) {
      logger.warn(`[Documents-Notify] Notification module not found in container. Skipping dispatch.`);
      return { sent, failed: ["Notification module not found"] };
    }

    // Determine target channels based on settings & options
    const activeChannels = options.channels || [];
    if (activeChannels.length === 0) {
      if (settings?.email_notifications_enabled !== false) activeChannels.push("email");
      if (settings?.sms_notifications_enabled !== false) activeChannels.push("sms");
      if (settings?.whatsapp_notifications_enabled !== false) activeChannels.push("whatsapp");
    }

    const companyName = settings?.company_name || "Company Store";
    const customerName = document.customer_name || "Valued Customer";
    const currency = (document.currency_code || "KES").toUpperCase();
    const formattedTotal = this.formatCurrency(Number(document.total_amount || 0), currency);

    const docUrl = document.short_pdf_link || document.pdf_url || "";
    const payUrl = document.short_payment_link || document.payment_link || "";
    const isUnpaid = document.payment_status === "unpaid" && Number(document.total_amount || 0) > 0;

    const docTitle = document.title || (
      document.type === "job_card" ? "Repair Job Card" :
      document.type === "invoice" ? "Invoice" :
      document.type === "receipt" ? "Receipt" :
      document.type === "packing_slip" ? "Packing Slip" :
      document.type === "estimate" ? "Estimate" : "Document"
    );

    // Build common action HTML blocks
    let paymentButtonHtml = "";
    if (isUnpaid && payUrl) {
      paymentButtonHtml = `
        <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-weight: bold; color: #166534; font-size: 15px;">Payment Due: ${formattedTotal}</p>
          <a href="${payUrl}" style="background-color: #16a34a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Pay Balance Online</a>
        </div>
      `;
    }

    let docDownloadHtml = "";
    if (docUrl) {
      docDownloadHtml = `
        <div style="margin: 15px 0;">
          <a href="${docUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">📄 View / Download ${docTitle}</a>
        </div>
      `;
    }

    let customMsgHtml = "";
    if (document.custom_message) {
      customMsgHtml = `
        <div style="margin: 15px 0; padding: 12px; background-color: #f8fafc; border-left: 4px solid #3b82f6; color: #334155;">
          <p style="margin: 0; white-space: pre-wrap;">${document.custom_message}</p>
        </div>
      `;
    }

    // Template replacement variables
    const variables: Record<string, string> = {
      order_id: document.order_id || "",
      customer_name: customerName,
      customer_email: document.customer_email || "",
      customer_phone: document.customer_phone || "",
      company_name: companyName,
      document_title: docTitle,
      display_id: document.display_id,
      total_amount: formattedTotal,
      total: formattedTotal,
      currency: currency,
      currency_code: currency,
      payment_status: document.payment_status || "",
      payment_link: payUrl,
      document_link: docUrl,
      download_link: docUrl,
      pdf_url: docUrl,
      custom_message: document.custom_message || "",
      payment_button: paymentButtonHtml,
      download_button: docDownloadHtml,
      storefront_url: settings?.storefront_url || process.env.STOREFRONT_URL || "http://localhost:5173",
    };

    // -------------------------------------------------------------
    // 1. EMAIL DISPATCH
    // -------------------------------------------------------------
    if (activeChannels.includes("email") && document.customer_email) {
      try {
        let subject = document.subject;
        if (!subject) {
          if (settings?.email_subject_template && settings.email_subject_template.trim()) {
            subject = renderTemplatePlaceholders(settings.email_subject_template, variables);
          } else {
            subject = `${companyName}: ${docTitle} #${document.display_id}`;
          }
        }

        let emailHtml = "";
        if (settings?.email_body_template && settings.email_body_template.trim()) {
          let customBody = renderTemplatePlaceholders(settings.email_body_template, variables);

          const hasPayTag = settings.email_body_template.includes("{payment_button}") || settings.email_body_template.includes("{payment_link}");
          const hasDocTag = settings.email_body_template.includes("{download_button}") || settings.email_body_template.includes("{document_link}") || settings.email_body_template.includes("{pdf_url}");

          let appendedActions = "";
          if (!hasPayTag && paymentButtonHtml) appendedActions += paymentButtonHtml;
          if (!hasDocTag && docDownloadHtml) appendedActions += docDownloadHtml;
          if (appendedActions) {
            customBody += appendedActions;
          }

          if (customBody.includes("<html") || (customBody.includes("<div") && customBody.includes("max-width:"))) {
            emailHtml = customBody;
          } else {
            emailHtml = `
              <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #2563eb; padding: 20px; color: #ffffff;">
                  <h2 style="margin: 0; font-size: 20px;">${companyName}</h2>
                  <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">${docTitle} #${document.display_id}</p>
                </div>
                <div style="padding: 24px;">
                  ${customBody}
                </div>
              </div>
            `;
          }
        } else {
          emailHtml = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #2563eb; padding: 20px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 20px;">${companyName}</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">${docTitle} #${document.display_id}</p>
              </div>
              <div style="padding: 24px;">
                <p>Hello <strong>${customerName}</strong>,</p>
                <p>Your ${docTitle.toLowerCase()} <strong>#${document.display_id}</strong> is ready.</p>
                ${customMsgHtml}
                ${paymentButtonHtml}
                ${docDownloadHtml}
                <p style="margin-top: 25px; font-size: 13px; color: #64748b;">
                  Thank you for choosing ${companyName}. If you have any questions, please feel free to reach out.
                </p>
              </div>
            </div>
          `;
        }

        await notificationModule.createNotifications({
          to: document.customer_email,
          channel: "email",
          template: "document-notification-email",
          content: {
            subject: subject,
            html: emailHtml,
          },
          data: {
            document_id: document.id,
            display_id: document.display_id,
            type: document.type,
            total: document.total_amount,
            pdf_url: docUrl,
            payment_link: payUrl,
          },
        });

        sent.push("email");
        logger.info(`[Documents-Notify] Email sent to ${document.customer_email} for ${document.display_id}`);
      } catch (err: any) {
        failed.push(`email: ${err.message}`);
        logger.error(`[Documents-Notify] Failed to send email to ${document.customer_email}: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // 2. SMS DISPATCH
    // -------------------------------------------------------------
    if (activeChannels.includes("sms") && document.customer_phone) {
      try {
        let smsText = "";
        if (settings?.sms_body_template && settings.sms_body_template.trim()) {
          smsText = renderTemplatePlaceholders(settings.sms_body_template, variables);
        } else {
          smsText = `[${companyName}] Hi ${customerName}, your ${docTitle} #${document.display_id} is ready.`;
          if (Number(document.total_amount || 0) > 0) {
            smsText += ` Total: ${formattedTotal}.`;
          }
          if (isUnpaid && payUrl) {
            smsText += ` Pay: ${payUrl}`;
          }
          if (docUrl) {
            smsText += ` View: ${docUrl}`;
          }
        }

        await notificationModule.createNotifications({
          to: document.customer_phone,
          channel: "sms",
          template: "document-notification-sms",
          data: {
            body: smsText,
            text: smsText,
            document_id: document.id,
          },
        });

        sent.push("sms");
        logger.info(`[Documents-Notify] SMS sent to ${document.customer_phone} for ${document.display_id}`);
      } catch (err: any) {
        failed.push(`sms: ${err.message}`);
        logger.error(`[Documents-Notify] Failed to send SMS to ${document.customer_phone}: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // 3. WHATSAPP DISPATCH (Guarded: graceful failure on missing provider)
    // -------------------------------------------------------------
    if (activeChannels.includes("whatsapp") && document.customer_phone) {
      try {
        let waText = "";
        if (settings?.whatsapp_body_template && settings.whatsapp_body_template.trim()) {
          waText = renderTemplatePlaceholders(settings.whatsapp_body_template, variables);
        } else {
          waText = `*${companyName}*\nHello *${customerName}*,\nYour *${docTitle} #${document.display_id}* has been generated.`;
          if (Number(document.total_amount || 0) > 0) {
            waText += `\n*Amount:* ${formattedTotal}`;
          }
          if (isUnpaid && payUrl) {
            waText += `\n*Pay Online:* ${payUrl}`;
          }
          if (docUrl) {
            waText += `\n*Download PDF:* ${docUrl}`;
          }
        }

        await notificationModule.createNotifications({
          to: document.customer_phone,
          channel: "whatsapp",
          template: "document-notification-whatsapp",
          data: {
            body: waText,
            text: waText,
            document_id: document.id,
          },
        });

        sent.push("whatsapp");
        logger.info(`[Documents-Notify] WhatsApp sent to ${document.customer_phone} for ${document.display_id}`);
      } catch (err: any) {
        failed.push(`whatsapp: ${err.message}`);
        const isMissingProvider =
          err.message?.toLowerCase().includes("provider") ||
          err.message?.toLowerCase().includes("whatsapp") ||
          err.message?.toLowerCase().includes("not registered") ||
          err.message?.toLowerCase().includes("not found");
        if (isMissingProvider) {
          logger.warn(
            `[Documents-Notify] WhatsApp provider is not registered or unavailable. Gracefully skipped dispatch to ${document.customer_phone}: ${err.message}`
          );
        } else {
          logger.error(`[Documents-Notify] Failed to send WhatsApp to ${document.customer_phone}: ${err.message}`);
        }
      }
    }

    return { sent, failed };
  }

  /**
   * Dedicated store order event notification sender (order.placed, payment.captured, order.fulfillment_created, order.canceled)
   */
  static async sendOrderNotification(options: SendOrderNotificationOptions): Promise<{ sent: string[]; failed: string[] }> {
    const { container, event, order, documentRecord, settings, extraData } = options;
    const logger = container.resolve("logger");

    const sent: string[] = [];
    const failed: string[] = [];

    const notificationModule = this.resolveNotificationModule(container);

    if (!notificationModule) {
      logger.warn(`[Documents-Notify] Notification module not found in container. Skipping dispatch for order event '${event}'.`);
      return { sent, failed: ["Notification module not found"] };
    }

    const activeChannels = options.channels || [];
    if (activeChannels.length === 0) {
      if (settings?.email_notifications_enabled !== false) activeChannels.push("email");
      if (settings?.sms_notifications_enabled !== false) activeChannels.push("sms");
      if (settings?.whatsapp_notifications_enabled !== false) activeChannels.push("whatsapp");
    }

    const companyName = settings?.company_name || "Company Store";
    const storeUrl = settings?.storefront_url || process.env.STOREFRONT_URL || "http://localhost:5173";

    // Resolve Customer
    const customerName =
      order.customer?.first_name
        ? `${order.customer.first_name} ${order.customer.last_name || ""}`.trim()
        : order.shipping_address?.first_name
        ? `${order.shipping_address.first_name} ${order.shipping_address.last_name || ""}`.trim()
        : order.email || "Valued Customer";
    const customerEmail = order.email || order.customer?.email;
    const customerPhone = order.shipping_address?.phone || order.customer?.phone;

    if (!customerEmail && !customerPhone) {
      logger.warn(`[Documents-Notify] No email or phone found for order ${order.id}. Skipping notifications.`);
      return { sent, failed: ["No contact information found"] };
    }

    // Financial formatting
    const currency = (order.currency_code || "KES").toUpperCase();
    const orderTotal = Number(order.total || 0);
    const formattedTotal = this.formatCurrency(orderTotal, currency);
    const formattedSubtotal = this.formatCurrency(Number(order.subtotal || 0), currency);
    const formattedTax = this.formatCurrency(Number(order.tax_total || 0), currency);
    const formattedShipping = this.formatCurrency(Number(order.shipping_total || 0), currency);

    // Calculate captured & remaining balance
    let capturedAmount = 0;
    if (extraData?.captured_amount != null) {
      capturedAmount = Number(extraData.captured_amount);
    } else if (extraData?.amount != null) {
      capturedAmount = Number(extraData.amount);
    } else if (order.payment_collections) {
      for (const pc of order.payment_collections) {
        if (pc.payments) {
          for (const p of pc.payments) {
            if (p.captured_at && !p.canceled_at) {
              capturedAmount += Number(p.amount || 0);
            }
          }
        }
      }
    } else if (order.summary?.paid_total != null) {
      capturedAmount = Number(order.summary.paid_total);
    } else if (order.paid_total != null) {
      capturedAmount = Number(order.paid_total);
    } else if (event === "order.payment_captured" || event === "payment.captured") {
      capturedAmount = orderTotal;
    }

    const remainingRaw = Math.max(0, orderTotal - capturedAmount);
    const formattedPaid = this.formatCurrency(
      capturedAmount > 0
        ? capturedAmount
        : event === "order.payment_captured" || event === "payment.captured"
        ? orderTotal
        : 0,
      currency
    );
    const formattedRemaining = this.formatCurrency(remainingRaw, currency);

    // Payment Link
    let paymentLink: string | undefined = undefined;
    if (remainingRaw > 0) {
      const pInfo = generateOrderPaymentLink(order, storeUrl);
      paymentLink = pInfo.paymentLink || undefined;
    }

    // Document links
    const docLink = documentRecord?.short_pdf_link || documentRecord?.pdf_url || "";

    // Items formatting
    const items = order.items || [];
    const itemsSummary = items.map((it: any) => `${it.title} (x${it.quantity || 1})`).join(", ") || "Order items";
    const itemsHtml = `
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b;">
            <th style="padding: 8px 0;">Item</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px 0; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it: any) => {
            const itemQty = Number(it.quantity || 1);
            const itemPrice = Number(it.unit_price || 0);
            const lineTotal = this.formatCurrency(itemQty * itemPrice, currency);
            return `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #0f172a;">
                  <strong>${it.title}</strong>
                  ${it.variant_title ? `<br><span style="font-size: 12px; color: #64748b;">${it.variant_title}</span>` : ""}
                </td>
                <td style="padding: 10px; text-align: center; color: #475569;">${itemQty}</td>
                <td style="padding: 10px 0; text-align: right; color: #0f172a; font-weight: 500;">${lineTotal}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    // Shipping Address
    const addr = order.shipping_address;
    const shippingAddress = addr
      ? [addr.address_1, addr.address_2, addr.city, addr.postal_code, addr.country_code].filter(Boolean).join(", ")
      : undefined;

    // Tracking Info
    const fulfillment = order.fulfillments?.[0];
    const label = fulfillment?.labels?.[0];
    const trackingNumber =
      extraData?.tracking_number || label?.tracking_number || (order.metadata?.tracking_number as string) || "";
    const trackingUrl =
      extraData?.tracking_url || label?.tracking_url || (order.metadata?.tracking_url as string) || "";
    const carrier =
      extraData?.carrier || fulfillment?.provider_id || (order.metadata?.carrier as string) || "Standard Courier";
    const deliveryEstimate =
      extraData?.delivery_estimate || (order.metadata?.delivery_estimate as string) || "";

    // Action buttons HTML
    let paymentButtonHtml = "";
    if (remainingRaw > 0 && paymentLink) {
      paymentButtonHtml = `
        <div style="margin: 20px 0; padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-weight: 600; color: #166534; font-size: 14px;">Remaining Balance Due: ${formattedRemaining}</p>
          <a href="${paymentLink}" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">Pay Balance Online</a>
        </div>
      `;
    }

    let downloadButtonHtml = "";
    if (docLink) {
      const docLabel =
        event === "order.payment_captured"
          ? "🧾 Download Payment Receipt (PDF)"
          : event === "order.fulfillment_created" || event === "fulfillment.created"
          ? "📄 Download Packing Slip (PDF)"
          : "📄 Download Tax Invoice (PDF)";
      downloadButtonHtml = `
        <div style="margin: 18px 0; text-align: center;">
          <a href="${docLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">${docLabel}</a>
        </div>
      `;
    }

    let trackingButtonHtml = "";
    if (trackingUrl) {
      trackingButtonHtml = `
        <div style="margin: 18px 0; text-align: center;">
          <a href="${trackingUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">📍 Track Your Shipment</a>
        </div>
      `;
    }

    // Assemble dynamic variables
    const variables: OrderNotificationVariables = {
      order_id: order.id,
      display_id: String(order.display_id || order.id.slice(-6)),
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      company_name: companyName,
      storefront_url: storeUrl,
      items_summary: itemsSummary,
      items_html: itemsHtml,
      total_amount: formattedTotal,
      total: formattedTotal,
      subtotal: formattedSubtotal,
      tax_total: formattedTax,
      shipping_total: formattedShipping,
      currency: currency,
      shipping_address: shippingAddress,
      shipping_city: addr?.city,
      payment_status: remainingRaw === 0 ? "paid" : "unpaid",
      payment_method:
        extraData?.payment_method ||
        order.payment_collections?.[0]?.payments?.[0]?.provider_id ||
        "Online Card Payment",
      payment_reference:
        extraData?.payment_reference ||
        extraData?.payment_id ||
        order.payment_collections?.[0]?.payments?.[0]?.data?.id ||
        order.payment_collections?.[0]?.id,
      amount_paid: formattedPaid,
      remaining_balance: formattedRemaining,
      payment_link: paymentLink,
      document_link: docLink,
      download_link: docLink,
      pdf_url: docLink,
      document_title: documentRecord?.title || "Order Document",
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
      carrier: carrier,
      delivery_estimate: deliveryEstimate,
      cancellation_reason: extraData?.cancellation_reason || (order.metadata?.cancellation_reason as string) || "Order canceled upon customer or store request",
      support_email: settings?.pdf_email || "support@store.com",
      support_phone: settings?.pdf_phone || "",
      payment_button: paymentButtonHtml,
      download_button: downloadButtonHtml,
      tracking_button: trackingButtonHtml,
    };

    // Resolve template contents (custom or professional defaults)
    const { subject, emailHtml, smsText, whatsappText } = OrderNotificationTemplates.resolveNotificationContent(
      event,
      variables,
      settings
    );

    // 1. Email Channel
    if (activeChannels.includes("email") && customerEmail) {
      try {
        await notificationModule.createNotifications({
          to: customerEmail,
          channel: "email",
          template: `${event}-email`,
          content: {
            subject: subject,
            html: emailHtml,
          },
          data: {
            order_id: order.id,
            display_id: variables.display_id,
            event: event,
            total: order.total,
            document_link: docLink,
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
          },
        });
        sent.push("email");
        logger.info(`[Documents-Notify] Sent ${event} email to ${customerEmail} (Order #${variables.display_id})`);
      } catch (err: any) {
        failed.push(`email: ${err.message}`);
        logger.error(`[Documents-Notify] Failed sending ${event} email to ${customerEmail}: ${err.message}`);
      }
    }

    // 2. SMS Channel
    if (activeChannels.includes("sms") && customerPhone) {
      try {
        await notificationModule.createNotifications({
          to: customerPhone,
          channel: "sms",
          template: `${event}-sms`,
          data: {
            body: smsText,
            text: smsText,
            order_id: order.id,
            display_id: variables.display_id,
          },
        });
        sent.push("sms");
        logger.info(`[Documents-Notify] Sent ${event} SMS to ${customerPhone} (Order #${variables.display_id})`);
      } catch (err: any) {
        failed.push(`sms: ${err.message}`);
        logger.error(`[Documents-Notify] Failed sending ${event} SMS to ${customerPhone}: ${err.message}`);
      }
    }

    // 3. WhatsApp Channel (Guarded gracefully against unregistered provider)
    if (activeChannels.includes("whatsapp") && customerPhone) {
      try {
        await notificationModule.createNotifications({
          to: customerPhone,
          channel: "whatsapp",
          template: `${event}-whatsapp`,
          data: {
            body: whatsappText,
            text: whatsappText,
            order_id: order.id,
            display_id: variables.display_id,
          },
        });
        sent.push("whatsapp");
        logger.info(`[Documents-Notify] Sent ${event} WhatsApp to ${customerPhone} (Order #${variables.display_id})`);
      } catch (err: any) {
        failed.push(`whatsapp: ${err.message}`);
        const isMissingProvider =
          err.message?.toLowerCase().includes("provider") ||
          err.message?.toLowerCase().includes("whatsapp") ||
          err.message?.toLowerCase().includes("not registered") ||
          err.message?.toLowerCase().includes("not found");
        if (isMissingProvider) {
          logger.warn(
            `[Documents-Notify] WhatsApp provider is not registered in Medusa notification module. Gracefully skipped dispatch for ${event} to ${customerPhone}: ${err.message}`
          );
        } else {
          logger.error(`[Documents-Notify] Failed sending ${event} WhatsApp to ${customerPhone}: ${err.message}`);
        }
      }
    }

    return { sent, failed };
  }
}

export default NotificationSender;
