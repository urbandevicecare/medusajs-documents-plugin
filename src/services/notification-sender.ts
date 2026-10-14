import { MedusaContainer } from "@medusajs/framework/types";
import { ModuleRegistrationName } from "@medusajs/framework/utils";

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
  };
  channels?: Array<"email" | "sms" | "whatsapp">;
  settings?: any;
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
  static async send(options: SendNotificationOptions): Promise<{ sent: string[]; failed: string[] }> {
    const { container, document, settings } = options;
    const logger = container.resolve("logger");

    const sent: string[] = [];
    const failed: string[] = [];

    let notificationModule: any = null;
    try {
      notificationModule = container.resolve(ModuleRegistrationName.NOTIFICATION, {
        allowUnregistered: true,
      });
    } catch (e) {
      try {
        notificationModule = container.resolve("notification", { allowUnregistered: true });
      } catch (err) {}
    }

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
    const currency = (document.currency_code || "USD").toUpperCase();
    const formattedTotal = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(Number(document.total_amount || 0));

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

          // If the custom template didn't explicitly use button placeholders, append action blocks if relevant
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
    // 3. WHATSAPP DISPATCH
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
        logger.error(`[Documents-Notify] Failed to send WhatsApp to ${document.customer_phone}: ${err.message}`);
      }
    }

    return { sent, failed };
  }
}

export default NotificationSender;
