import { renderTemplatePlaceholders } from "./notification-sender";

export interface OrderNotificationVariables {
  order_id: string;
  display_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  company_name: string;
  storefront_url: string;
  items_summary: string;
  items_html: string;
  total_amount: string;
  total: string;
  subtotal?: string;
  tax_total?: string;
  shipping_total?: string;
  discount_total?: string;
  currency: string;
  shipping_address?: string;
  shipping_city?: string;
  payment_status?: string;
  payment_method?: string;
  payment_reference?: string;
  amount_paid?: string;
  remaining_balance?: string;
  payment_link?: string;
  document_link?: string;
  download_link?: string;
  pdf_url?: string;
  document_title?: string;
  tracking_number?: string;
  tracking_url?: string;
  carrier?: string;
  delivery_estimate?: string;
  cancellation_reason?: string;
  support_email?: string;
  support_phone?: string;
  payment_button?: string;
  download_button?: string;
  tracking_button?: string;
  [key: string]: any;
}

export type OrderNotificationEventType =
  | "order.placed"
  | "order.payment_captured"
  | "payment.captured"
  | "order.fulfillment_created"
  | "fulfillment.created"
  | "order.shipment_created"
  | "shipment.created"
  | "order.canceled"
  | "order.cancelled"
  | "order.completed";

export class OrderNotificationTemplates {
  // -------------------------------------------------------------
  // Default Email Subjects
  // -------------------------------------------------------------
  static getDefaultSubject(event: OrderNotificationEventType, vars: OrderNotificationVariables): string {
    switch (event) {
      case "order.placed":
        return `Order Confirmation #${vars.display_id} - ${vars.company_name}`;
      case "order.payment_captured":
      case "payment.captured":
        return `Payment Receipt for Order #${vars.display_id} - ${vars.company_name}`;
      case "order.fulfillment_created":
      case "fulfillment.created":
      case "order.shipment_created":
      case "shipment.created":
        return `Your Order #${vars.display_id} Has Shipped! - ${vars.company_name}`;
      case "order.canceled":
      case "order.cancelled":
        return `Update: Order #${vars.display_id} Has Been Canceled - ${vars.company_name}`;
      case "order.completed":
        return `Your Order #${vars.display_id} is Complete - ${vars.company_name}`;
      default:
        return `Update for Order #${vars.display_id} - ${vars.company_name}`;
    }
  }

  // -------------------------------------------------------------
  // Default Email HTML Templates
  // -------------------------------------------------------------
  static getDefaultEmailHtml(event: OrderNotificationEventType, vars: OrderNotificationVariables): string {
    const baseHeader = `
      <div style="background-color: #0f172a; padding: 28px 24px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${vars.company_name}</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Official Store Notification</p>
      </div>
    `;

    const baseFooter = `
      <div style="background-color: #f8fafc; padding: 20px 24px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center;">
        <p style="margin: 0 0 6px 0;">Need assistance? Reply directly or contact <a href="mailto:${vars.support_email || "support@store.com"}" style="color: #2563eb; text-decoration: underline;">${vars.support_email || "our support team"}</a>.</p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} ${vars.company_name}. All rights reserved.</p>
      </div>
    `;

    let bodyContent = "";

    switch (event) {
      case "order.placed": {
        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #047857; margin-bottom: 16px;">
              ✓ Order Confirmed
            </div>
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Thank you for your order, ${vars.customer_name}!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              We have received order <strong>#${vars.display_id}</strong> and are preparing it for packaging. Below is your order confirmation and tax invoice link.
            </p>

            <!-- Order Details Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; font-size: 13px;">
                <span style="color: #64748b;">Order Number:</span>
                <strong style="color: #0f172a;">#${vars.display_id}</strong>
              </div>
              ${vars.shipping_address ? `
              <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px; font-size: 13px;">
                <span style="color: #64748b; display: block; margin-bottom: 4px;">Shipping Address:</span>
                <strong style="color: #0f172a; line-height: 1.4;">${vars.shipping_address}</strong>
              </div>` : ""}
              <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span style="color: #64748b;">Order Total:</span>
                <strong style="color: #0f172a; font-size: 16px;">${vars.total_amount}</strong>
              </div>
            </div>

            <!-- Items Table -->
            <div style="margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; color: #0f172a; font-weight: 600;">Purchased Items</h3>
              ${vars.items_html}
            </div>

            <!-- Action Buttons -->
            ${vars.payment_button || ""}
            ${vars.download_button || (vars.document_link ? `
              <div style="margin: 18px 0; text-align: center;">
                <a href="${vars.document_link}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
                  📄 Download Tax Invoice (PDF)
                </a>
              </div>
            ` : "")}

            <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
              <strong>What happens next?</strong> Our warehouse team will fulfill your order. You will receive another notification with tracking details as soon as your parcel is on its way.
            </p>
          </div>
        `;
        break;
      }

      case "order.payment_captured":
      case "payment.captured": {
        const hasRemaining =
          vars.remaining_balance &&
          vars.remaining_balance !== "$0.00" &&
          vars.remaining_balance !== "0" &&
          vars.remaining_balance !== "£0.00" &&
          vars.remaining_balance !== "0.00";

        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #047857; margin-bottom: 16px;">
              ✓ Payment Received
            </div>
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Payment Confirmed</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              Hello ${vars.customer_name}, we've successfully processed your payment for order <strong>#${vars.display_id}</strong>.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #64748b;">Amount Paid:</span>
                <strong style="color: #047857; font-size: 15px;">${vars.amount_paid || vars.total_amount}</strong>
              </div>
              ${vars.payment_method ? `
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #64748b;">Payment Method:</span>
                <strong style="color: #0f172a;">${vars.payment_method}</strong>
              </div>` : ""}
              ${vars.payment_reference ? `
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #64748b;">Payment Reference:</span>
                <strong style="color: #0f172a;">${vars.payment_reference}</strong>
              </div>` : ""}
              ${hasRemaining ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px; color: #b45309;">
                <span>Remaining Balance:</span>
                <strong>${vars.remaining_balance}</strong>
              </div>` : `
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: #64748b;">Remaining Balance:</span>
                <strong style="color: #047857;">Paid in Full</strong>
              </div>`}
            </div>

            ${vars.payment_button || ""}

            ${vars.download_button || (vars.document_link ? `
              <div style="margin: 20px 0; text-align: center;">
                <a href="${vars.document_link}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
                  🧾 Download Payment Receipt (PDF)
                </a>
              </div>
            ` : "")}

            <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
              Your order is being processed for dispatch. We will notify you with full tracking information once your package has been handed to the courier.
            </p>
          </div>
        `;
        break;
      }

      case "order.fulfillment_created":
      case "fulfillment.created":
      case "order.shipment_created":
      case "shipment.created": {
        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #1d4ed8; margin-bottom: 16px;">
              🚚 Dispatched & In Transit
            </div>
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Good news, ${vars.customer_name}!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              Your items for order <strong>#${vars.display_id}</strong> have been packed and handed over to our courier partner.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #64748b;">Carrier:</span>
                <strong style="color: #0f172a;">${vars.carrier || "Standard Delivery"}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 10px; font-size: 13px;">
                <span style="color: #64748b;">Tracking Number:</span>
                <strong style="color: #0f172a; font-family: monospace;">${vars.tracking_number || "Available in portal"}</strong>
              </div>
              ${vars.delivery_estimate ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: #64748b;">Estimated Delivery:</span>
                <strong style="color: #0f172a;">${vars.delivery_estimate}</strong>
              </div>` : ""}
            </div>

            <!-- Action Buttons -->
            ${vars.tracking_button || (vars.tracking_url ? `
              <div style="margin: 20px 0; text-align: center;">
                <a href="${vars.tracking_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block; font-size: 14px;">
                  📍 Track Your Package
                </a>
              </div>
            ` : "")}

            ${vars.download_button || (vars.document_link ? `
              <div style="margin: 12px 0; text-align: center;">
                <a href="${vars.document_link}" style="color: #475569; text-decoration: underline; font-size: 13px;">
                  📄 View Packing Slip / Delivery Note
                </a>
              </div>
            ` : "")}
          </div>
        `;
        break;
      }

      case "order.canceled":
      case "order.cancelled": {
        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #b91c1c; margin-bottom: 16px;">
              ✕ Order Canceled
            </div>
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Order #${vars.display_id} Canceled</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              Hello ${vars.customer_name}, this notification confirms that your order <strong>#${vars.display_id}</strong> has been canceled.
            </p>

            ${vars.cancellation_reason ? `
            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; margin-bottom: 20px; border-radius: 4px;">
              <p style="margin: 0; font-size: 13px; color: #9a3412;"><strong>Reason:</strong> ${vars.cancellation_reason}</p>
            </div>` : ""}

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a; font-size: 14px;">Refund & Billing Information</p>
              <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                If payment was already collected for this order, a full refund of <strong>${vars.total_amount}</strong> has been initiated to your original payment method. Please allow 3–5 business days for banking processing.
              </p>
            </div>

            <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
              If you did not request this cancellation or believe this occurred in error, please contact our support team right away.
            </p>
          </div>
        `;
        break;
      }

      case "order.completed": {
        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <div style="display: inline-block; padding: 4px 12px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 600; color: #047857; margin-bottom: 16px;">
              ✓ Order Complete
            </div>
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Your Order #${vars.display_id} is Complete!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              Hello ${vars.customer_name}, thank you for choosing ${vars.company_name}. We hope you are delighted with your items!
            </p>
            ${vars.download_button || ""}
            <p style="margin: 20px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">
              If you have any questions, feedback, or need warranty support, please don't hesitate to reach out.
            </p>
          </div>
        `;
        break;
      }

      default: {
        bodyContent = `
          <div style="padding: 28px 24px; background-color: #ffffff;">
            <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Order Update #${vars.display_id}</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
              Hello ${vars.customer_name}, your order has been updated.
            </p>
            ${vars.download_button || ""}
          </div>
        `;
      }
    }

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${vars.company_name}</title>
      </head>
      <body style="margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          ${baseHeader}
          ${bodyContent}
          ${baseFooter}
        </div>
      </body>
      </html>
    `;
  }

  // -------------------------------------------------------------
  // Default SMS Text Templates
  // -------------------------------------------------------------
  static getDefaultSmsText(event: OrderNotificationEventType, vars: OrderNotificationVariables): string {
    const hasRemaining =
      vars.remaining_balance &&
      vars.remaining_balance !== "$0.00" &&
      vars.remaining_balance !== "0" &&
      vars.remaining_balance !== "£0.00" &&
      vars.remaining_balance !== "0.00";

    switch (event) {
      case "order.placed": {
        let msg = `[${vars.company_name}] Hi ${vars.customer_name}, order #${vars.display_id} confirmed! Total: ${vars.total_amount}.`;
        if (vars.payment_link) {
          msg += ` Pay balance: ${vars.payment_link}`;
        }
        if (vars.document_link) {
          msg += ` Invoice: ${vars.document_link}`;
        }
        return msg;
      }
      case "order.payment_captured":
      case "payment.captured": {
        let msg = `[${vars.company_name}] Hi ${vars.customer_name}, payment of ${vars.amount_paid || vars.total_amount} received for order #${vars.display_id}.`;
        if (hasRemaining && vars.payment_link) {
          msg += ` Bal: ${vars.remaining_balance}. Pay: ${vars.payment_link}`;
        }
        if (vars.document_link) {
          msg += ` Receipt: ${vars.document_link}`;
        }
        return msg;
      }
      case "order.fulfillment_created":
      case "fulfillment.created":
      case "order.shipment_created":
      case "shipment.created": {
        let msg = `[${vars.company_name}] Hi ${vars.customer_name}, order #${vars.display_id} has shipped via ${vars.carrier || "Courier"}!`;
        if (vars.tracking_url) {
          msg += ` Track: ${vars.tracking_url}`;
        } else if (vars.tracking_number) {
          msg += ` Tracking: ${vars.tracking_number}`;
        }
        return msg;
      }
      case "order.canceled":
      case "order.cancelled": {
        return `[${vars.company_name}] Order #${vars.display_id} has been canceled. If charged, a refund of ${vars.total_amount} has been initiated to your original payment method.`;
      }
      case "order.completed": {
        return `[${vars.company_name}] Hi ${vars.customer_name}, order #${vars.display_id} is completed. Thank you for shopping with ${vars.company_name}!`;
      }
      default:
        return `[${vars.company_name}] Update for order #${vars.display_id}: Total ${vars.total_amount}. View: ${vars.document_link || vars.storefront_url}`;
    }
  }

  // -------------------------------------------------------------
  // Default WhatsApp Text Templates
  // -------------------------------------------------------------
  static getDefaultWhatsAppText(event: OrderNotificationEventType, vars: OrderNotificationVariables): string {
    const hasRemaining =
      vars.remaining_balance &&
      vars.remaining_balance !== "$0.00" &&
      vars.remaining_balance !== "0" &&
      vars.remaining_balance !== "£0.00" &&
      vars.remaining_balance !== "0.00";

    switch (event) {
      case "order.placed": {
        let text = `*Order Confirmation - ${vars.company_name}*\n\nHello *${vars.customer_name}*,\nThank you for your order! We've received order *#${vars.display_id}*.\n\n📦 *Items:*\n${vars.items_summary}\n\n💰 *Total:* ${vars.total_amount}`;
        if (vars.shipping_address) {
          text += `\n📍 *Shipping to:* ${vars.shipping_address}`;
        }
        if (vars.payment_link) {
          text += `\n\n💳 *Pay Balance:* ${vars.payment_link}`;
        }
        if (vars.document_link) {
          text += `\n📄 *Tax Invoice:* ${vars.document_link}`;
        }
        text += `\n\nWe will notify you as soon as your items are on the way!`;
        return text;
      }
      case "order.payment_captured":
      case "payment.captured": {
        let text = `*Payment Received - ${vars.company_name}*\n\nHello *${vars.customer_name}*,\nWe have received your payment for order *#${vars.display_id}*.\n\n💰 *Amount Paid:* ${vars.amount_paid || vars.total_amount}`;
        if (vars.payment_method) {
          text += `\n💳 *Method:* ${vars.payment_method}`;
        }
        if (vars.payment_reference) {
          text += `\n🔖 *Ref:* ${vars.payment_reference}`;
        }
        if (hasRemaining) {
          text += `\n⚠️ *Remaining Balance:* ${vars.remaining_balance}`;
          if (vars.payment_link) {
            text += `\n👉 *Pay Balance:* ${vars.payment_link}`;
          }
        }
        if (vars.document_link) {
          text += `\n🧾 *Receipt:* ${vars.document_link}`;
        }
        text += `\n\nYour order is now moving into fulfillment. Thank you!`;
        return text;
      }
      case "order.fulfillment_created":
      case "fulfillment.created":
      case "order.shipment_created":
      case "shipment.created": {
        let text = `*Order Dispatched - ${vars.company_name}*\n\nHello *${vars.customer_name}*,\nGood news! Your order *#${vars.display_id}* has shipped.\n\n🚚 *Carrier:* ${vars.carrier || "Courier"}`;
        if (vars.tracking_number) {
          text += `\n🔍 *Tracking #:* ${vars.tracking_number}`;
        }
        if (vars.tracking_url) {
          text += `\n📍 *Live Tracking:* ${vars.tracking_url}`;
        }
        if (vars.document_link) {
          text += `\n📄 *Packing Slip:* ${vars.document_link}`;
        }
        text += `\n\nThank you for choosing ${vars.company_name}!`;
        return text;
      }
      case "order.canceled":
      case "order.cancelled": {
        let text = `*Order Canceled - ${vars.company_name}*\n\nHello *${vars.customer_name}*,\nYour order *#${vars.display_id}* has been canceled.`;
        if (vars.cancellation_reason) {
          text += `\n\n*Reason:* ${vars.cancellation_reason}`;
        }
        text += `\n\n💳 *Refund Notice:* If you were already charged, a refund of ${vars.total_amount} is being processed to your original payment method within 3–5 business days.\n\nNeed help? Contact us at ${vars.support_email || "support"}.`;
        return text;
      }
      case "order.completed": {
        return `*Order Complete - ${vars.company_name}*\n\nHello *${vars.customer_name}*,\nYour order *#${vars.display_id}* is complete. Thank you for choosing ${vars.company_name}! If you need any assistance, feel free to reply to this message.`;
      }
      default:
        return `*Update for Order #${vars.display_id}* (${vars.company_name})\nTotal: ${vars.total_amount}\nView: ${vars.document_link || vars.storefront_url}`;
    }
  }

  // -------------------------------------------------------------
  // Resolves Content (Custom Setting Template or Built-in Default)
  // -------------------------------------------------------------
  static resolveNotificationContent(
    event: OrderNotificationEventType,
    vars: OrderNotificationVariables,
    settings?: any
  ): {
    subject: string;
    emailHtml: string;
    smsText: string;
    whatsappText: string;
  } {
    // 1. Email Subject
    let customSubjectKey = "";
    let customEmailBodyKey = "";
    let customSmsBodyKey = "";
    let customWaBodyKey = "";

    if (event === "order.placed") {
      customSubjectKey = "order_placed_email_subject";
      customEmailBodyKey = "order_placed_email_template";
      customSmsBodyKey = "order_placed_sms_template";
      customWaBodyKey = "order_placed_whatsapp_template";
    } else if (event === "order.payment_captured" || event === "payment.captured") {
      customSubjectKey = "order_payment_email_subject";
      customEmailBodyKey = "order_payment_email_template";
      customSmsBodyKey = "order_payment_sms_template";
      customWaBodyKey = "order_payment_whatsapp_template";
    } else if (
      event === "order.fulfillment_created" ||
      event === "fulfillment.created" ||
      event === "order.shipment_created" ||
      event === "shipment.created"
    ) {
      customSubjectKey = "order_fulfillment_email_subject";
      customEmailBodyKey = "order_fulfillment_email_template";
      customSmsBodyKey = "order_fulfillment_sms_template";
      customWaBodyKey = "order_fulfillment_whatsapp_template";
    } else if (event === "order.canceled" || event === "order.cancelled") {
      customSubjectKey = "order_canceled_email_subject";
      customEmailBodyKey = "order_canceled_email_template";
      customSmsBodyKey = "order_canceled_sms_template";
      customWaBodyKey = "order_canceled_whatsapp_template";
    }

    const defaultSubject = this.getDefaultSubject(event, vars);
    const subject =
      settings?.[customSubjectKey] && settings[customSubjectKey].trim()
        ? renderTemplatePlaceholders(settings[customSubjectKey], vars)
        : defaultSubject;

    // 2. Email HTML
    let emailHtml = "";
    if (settings?.[customEmailBodyKey] && settings[customEmailBodyKey].trim()) {
      let customHtml = renderTemplatePlaceholders(settings[customEmailBodyKey], vars);
      if (!customHtml.includes("<html") && !customHtml.includes("<!DOCTYPE")) {
        // Wrap in professional responsive wrapper if user provided a partial snippet
        emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 580px; margin: 0 auto; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
            <div style="background-color: #0f172a; padding: 24px; color: #ffffff; text-align: center;">
              <h1 style="margin: 0; font-size: 20px;">${vars.company_name}</h1>
              <p style="margin: 4px 0 0 0; opacity: 0.8; font-size: 13px;">Order #${vars.display_id}</p>
            </div>
            <div style="padding: 24px;">
              ${customHtml}
            </div>
            <div style="background-color: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              &copy; ${new Date().getFullYear()} ${vars.company_name}
            </div>
          </div>
        `;
      } else {
        emailHtml = customHtml;
      }
    } else {
      emailHtml = this.getDefaultEmailHtml(event, vars);
    }

    // 3. SMS Text
    let smsText = "";
    if (settings?.[customSmsBodyKey] && settings[customSmsBodyKey].trim()) {
      smsText = renderTemplatePlaceholders(settings[customSmsBodyKey], vars);
    } else {
      smsText = this.getDefaultSmsText(event, vars);
    }

    // 4. WhatsApp Text
    let whatsappText = "";
    if (settings?.[customWaBodyKey] && settings[customWaBodyKey].trim()) {
      whatsappText = renderTemplatePlaceholders(settings[customWaBodyKey], vars);
    } else {
      whatsappText = this.getDefaultWhatsAppText(event, vars);
    }

    return { subject, emailHtml, smsText, whatsappText };
  }
}

export default OrderNotificationTemplates;
