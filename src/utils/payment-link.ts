import crypto from "crypto";

export interface OrderPaymentInfo {
  paymentLink: string | null;
  remainingBalance: number;
  isUnpaid: boolean;
}

export function generateOrderPaymentLink(order: any, storefrontUrl: string): OrderPaymentInfo {
  let capturedAmount = 0;

  if (order.payment_collections) {
    for (const pc of order.payment_collections as any[]) {
      if (pc.captured_amount != null) {
        capturedAmount += Number(pc.captured_amount);
      } else if (pc.payments) {
        capturedAmount += pc.payments.reduce((acc: number, p: any) => {
          const isPaid = Boolean(p.captured_at) && !p.canceled_at;
          return acc + (isPaid ? Number(p.amount) : 0);
        }, 0);
      }
    }
  }

  const total = Number(order.total || 0);
  const remainingBalance = Math.max(0, total - capturedAmount);

  if (remainingBalance <= 0) {
    return {
      paymentLink: null,
      remainingBalance: 0,
      isUnpaid: false,
    };
  }

  // Generate secure Paystack HMAC storefront payment URL
  const secretKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    process.env.MEDUSA_PUBLISHABLE_API_KEY ||
    "super_secret_fallback_key";

  const hash = crypto
    .createHmac("sha256", secretKey)
    .update(order.id)
    .digest("hex");

  const cleanStorefrontUrl = storefrontUrl.replace(/\/$/, "");
  const paymentLink = `${cleanStorefrontUrl}/pay/${hash}/${order.id}`;

  return {
    paymentLink,
    remainingBalance,
    isUnpaid: true,
  };
}

export function generateRepairPaymentLink(ticket: any, storefrontUrl: string): OrderPaymentInfo {
  const targetTotal = Number((ticket.total_actual && ticket.total_actual > 0) ? ticket.total_actual : ticket.total_estimate || 0);
  const paid = Number(ticket.amount_paid || 0);
  const remainingBalance = Math.max(0, targetTotal - paid);

  if (remainingBalance <= 0 || !ticket.approval_token) {
    return {
      paymentLink: null,
      remainingBalance,
      isUnpaid: false,
    };
  }

  const cleanStorefrontUrl = storefrontUrl.replace(/\/$/, "");
  const paymentLink = `${cleanStorefrontUrl}/repairs/track?token=${ticket.approval_token}`;

  return {
    paymentLink,
    remainingBalance,
    isUnpaid: true,
  };
}
