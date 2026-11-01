import { Logger } from "@medusajs/framework/types";

export interface ZohoConfig {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  organization_id: string;
  domain?: string;
}

export interface ZohoInvoicePayload {
  customer_id: string;
  reference_number?: string;
  invoice_number?: string;
  date?: string;
  due_date?: string;
  line_items: Array<{
    name: string;
    description?: string;
    rate: number | string;
    quantity: number;
    tax_id?: string;
  }>;
  notes?: string;
  terms?: string;
  payment_terms?: number;
  is_inclusive_tax?: boolean;
}

export class ZohoBooksService {
  private config: ZohoConfig;
  private logger?: Logger;
  private access_token: string | null = null;
  private token_expires_at: number = 0;

  constructor(config: ZohoConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  private get baseAccountsUrl() {
    return `https://accounts.zoho.${this.config.domain || "com"}`;
  }

  private get baseApiUrl() {
    return `https://www.zohoapis.${this.config.domain || "com"}/books/v3`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.access_token && Date.now() < this.token_expires_at) {
      return this.access_token;
    }

    this.logger?.info(`[Zoho Books] Refreshing access token...`);
    const params = new URLSearchParams();
    params.append("refresh_token", this.config.refresh_token);
    params.append("client_id", this.config.client_id);
    params.append("client_secret", this.config.client_secret);
    params.append("grant_type", "refresh_token");

    const response = await fetch(`${this.baseAccountsUrl}/oauth/v2/token`, {
      method: "POST",
      body: params,
    });

    const data = await response.json();
    if (!response.ok || data.error) {
      this.logger?.error(`[Zoho Books] Failed to refresh token: ${JSON.stringify(data)}`);
      throw new Error(`Zoho authentication failed: ${data.error || response.statusText}`);
    }

    this.access_token = data.access_token;
    this.token_expires_at = Date.now() + (data.expires_in - 300) * 1000;
    return this.access_token!;
  }

  public async request(method: string, endpoint: string, body?: any, isBlob: boolean = false): Promise<any> {
    const token = await this.getAccessToken();
    const separator = endpoint.includes("?") ? "&" : "?";
    const url = `${this.baseApiUrl}${endpoint}${separator}organization_id=${this.config.organization_id}`;

    const headers: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${token}`,
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (isBlob) {
      if (!res.ok) {
        throw new Error(`Zoho API Blob Error: ${res.statusText}`);
      }
      return await res.arrayBuffer();
    }

    const data = await res.json();
    if (!res.ok || data.code !== 0) {
      this.logger?.error(`[Zoho Books] API Error: ${JSON.stringify(data)}`);
      throw new Error(`Zoho API Error: ${data.message || res.statusText}`);
    }
    return data;
  }

  async syncContact(customer: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company_name?: string;
  }): Promise<string> {
    const email = customer.email;
    const name = customer.company_name
      ? customer.company_name
      : customer.first_name
      ? `${customer.first_name} ${customer.last_name || ""}`.trim()
      : email || "Guest Customer";

    // 1. Search by email
    if (email && email.includes("@")) {
      try {
        const searchRes = await this.request("GET", `/contacts?email=${encodeURIComponent(email)}`);
        if (searchRes.contacts && searchRes.contacts.length > 0) {
          return searchRes.contacts[0].contact_id;
        }
      } catch (e) {
        this.logger?.warn(`[Zoho Books] Failed searching contact by email: ${(e as any).message}`);
      }
    }

    // 2. Search by contact name
    if (name) {
      try {
        const searchNameRes = await this.request("GET", `/contacts?contact_name=${encodeURIComponent(name)}`);
        if (searchNameRes.contacts && searchNameRes.contacts.length > 0) {
          return searchNameRes.contacts[0].contact_id;
        }
      } catch (e) {
        this.logger?.warn(`[Zoho Books] Failed searching contact by name: ${(e as any).message}`);
      }
    }

    // 3. Create new contact
    const payload = {
      contact_name: name,
      company_name: customer.company_name || name,
      contact_type: "customer",
      contact_persons: [
        {
          first_name: customer.first_name || "Valued",
          last_name: customer.last_name || "Customer",
          email: email || "",
          phone: customer.phone || "",
        },
      ],
    };

    const createRes = await this.request("POST", "/contacts", payload);
    return createRes.contact.contact_id;
  }

  async createInvoice(contactId: string, invoiceData: {
    reference_number?: string;
    invoice_number?: string;
    ignore_auto_number_generation?: boolean;
    line_items: any[];
    notes?: string;
    terms?: string;
    payment_terms?: number;
    is_inclusive_tax?: boolean;
    due_date?: string;
    custom_fields?: Array<{ label: string; value: string }>;
  }): Promise<{ invoice_id: string; invoice_number: string }> {
    const payload: any = {
      customer_id: contactId,
      reference_number: invoiceData.reference_number,
      invoice_number: invoiceData.invoice_number,
      due_date: invoiceData.due_date,
      payment_terms: invoiceData.payment_terms || 0,
      line_items: invoiceData.line_items,
      notes: invoiceData.notes || "Thank you for your business.",
      terms: invoiceData.terms || "",
      is_inclusive_tax: invoiceData.is_inclusive_tax ?? false,
    };

    if (invoiceData.custom_fields && invoiceData.custom_fields.length > 0) {
      payload.custom_fields = invoiceData.custom_fields;
    }

    const useIgnoreAuto =
      invoiceData.ignore_auto_number_generation !== undefined
        ? invoiceData.ignore_auto_number_generation
        : Boolean(invoiceData.invoice_number);

    const endpoint = useIgnoreAuto
      ? "/invoices?ignore_auto_number_generation=true"
      : "/invoices";

    let res: any;
    try {
      res = await this.request("POST", endpoint, payload);
    } catch (err: any) {
      if (payload.custom_fields && (err.message?.includes("custom field") || err.message?.includes("120129"))) {
        delete payload.custom_fields;
        res = await this.request("POST", endpoint, payload);
      } else {
        throw err;
      }
    }

    return {
      invoice_id: res.invoice.invoice_id,
      invoice_number: res.invoice.invoice_number,
    };
  }

  async getInvoiceByNumber(invoiceNumber: string): Promise<{ invoice_id: string; invoice_number: string } | null> {
    try {
      const cleanNum = String(invoiceNumber || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
      const isRepair = /^(JOB-|RT-)/i.test(invoiceNumber);
      const hasPrefix = /^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)/i.test(invoiceNumber);
      const candidates = Array.from(
        new Set(
          [
            invoiceNumber,
            isRepair ? `RT-${cleanNum}` : null,
            !hasPrefix ? cleanNum : null,
          ].filter(Boolean) as string[]
        )
      );
      for (const num of candidates) {
        const res = await this.request("GET", `/invoices?invoice_number=${encodeURIComponent(num)}`);
        if (res.invoices && res.invoices.length > 0) {
          const match =
            res.invoices.find((inv: any) => String(inv.invoice_number).trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            res.invoices.find((inv: any) => String(inv.reference_number || "").trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            (!hasPrefix && res.invoices.find((inv: any) => {
              const cleanInv = String(inv.invoice_number || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
              return cleanInv.trim().toLowerCase() === cleanNum.trim().toLowerCase();
            }));
          if (match) {
            return {
              invoice_id: match.invoice_id,
              invoice_number: match.invoice_number,
            };
          }
        }
      }
      for (const num of candidates) {
        const refRes = await this.request("GET", `/invoices?reference_number=${encodeURIComponent(num)}`);
        if (refRes.invoices && refRes.invoices.length > 0) {
          const match =
            refRes.invoices.find((inv: any) => String(inv.invoice_number).trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            refRes.invoices.find((inv: any) => String(inv.reference_number || "").trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            (!hasPrefix && refRes.invoices.find((inv: any) => {
              const cleanInv = String(inv.reference_number || inv.invoice_number || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
              return cleanInv.trim().toLowerCase() === cleanNum.trim().toLowerCase();
            }));
          if (match) {
            return {
              invoice_id: match.invoice_id,
              invoice_number: match.invoice_number,
            };
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async deleteInvoice(invoiceId: string): Promise<void> {
    await this.request("DELETE", `/invoices/${invoiceId}`);
  }

  async getInvoicePaymentQrCode(invoiceId: string): Promise<ArrayBuffer | null> {
    try {
      return await this.request("GET", `/invoices/${invoiceId}/payment-qr-code`, undefined, true);
    } catch (e) {
      try {
        return await this.request("GET", `/invoices/${invoiceId}/qr_code`, undefined, true);
      } catch (err) {
        return null;
      }
    }
  }

  async createEstimate(contactId: string, estimateData: {
    reference_number?: string;
    estimate_number?: string;
    line_items: any[];
    notes?: string;
    terms?: string;
    is_inclusive_tax?: boolean;
    custom_fields?: Array<{ label: string; value: string }>;
  }): Promise<{ estimate_id: string; estimate_number: string }> {
    const payload: any = {
      customer_id: contactId,
      reference_number: estimateData.reference_number,
      estimate_number: estimateData.estimate_number,
      line_items: estimateData.line_items,
      notes: estimateData.notes || "Estimate for goods/services.",
      terms: estimateData.terms || "",
      is_inclusive_tax: estimateData.is_inclusive_tax ?? false,
    };

    if (estimateData.custom_fields && estimateData.custom_fields.length > 0) {
      payload.custom_fields = estimateData.custom_fields;
    }

    const endpoint = estimateData.estimate_number
      ? "/estimates?ignore_auto_number_generation=true"
      : "/estimates";

    let res: any;
    try {
      res = await this.request("POST", endpoint, payload);
    } catch (err: any) {
      if (payload.custom_fields && (err.message?.includes("custom field") || err.message?.includes("120129"))) {
        delete payload.custom_fields;
        res = await this.request("POST", endpoint, payload);
      } else {
        throw err;
      }
    }

    return {
      estimate_id: res.estimate.estimate_id,
      estimate_number: res.estimate.estimate_number,
    };
  }

  async getEstimateByNumber(estimateNumber: string): Promise<{ estimate_id: string; estimate_number: string } | null> {
    try {
      const cleanNum = String(estimateNumber || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
      const isRepair = /^(JOB-|RT-|EST-)/i.test(estimateNumber);
      const hasPrefix = /^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)/i.test(estimateNumber);
      const candidates = Array.from(
        new Set(
          [
            estimateNumber,
            isRepair ? `RT-${cleanNum}` : null,
            isRepair ? `EST-${cleanNum}` : null,
            !hasPrefix ? cleanNum : null,
          ].filter(Boolean) as string[]
        )
      );
      for (const num of candidates) {
        const res = await this.request("GET", `/estimates?estimate_number=${encodeURIComponent(num)}`);
        if (res.estimates && res.estimates.length > 0) {
          const match =
            res.estimates.find((est: any) => String(est.estimate_number).trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            res.estimates.find((est: any) => String(est.reference_number || "").trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            (!hasPrefix && res.estimates.find((est: any) => {
              const cleanEst = String(est.estimate_number || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
              return cleanEst.trim().toLowerCase() === cleanNum.trim().toLowerCase();
            }));
          if (match) {
            return {
              estimate_id: match.estimate_id,
              estimate_number: match.estimate_number,
            };
          }
        }
      }
      for (const num of candidates) {
        const refRes = await this.request("GET", `/estimates?reference_number=${encodeURIComponent(num)}`);
        if (refRes.estimates && refRes.estimates.length > 0) {
          const match =
            refRes.estimates.find((est: any) => String(est.estimate_number).trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            refRes.estimates.find((est: any) => String(est.reference_number || "").trim().toLowerCase() === String(num).trim().toLowerCase()) ||
            (!hasPrefix && refRes.estimates.find((est: any) => {
              const cleanEst = String(est.reference_number || est.estimate_number || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
              return cleanEst.trim().toLowerCase() === cleanNum.trim().toLowerCase();
            }));
          if (match) {
            return {
              estimate_id: match.estimate_id,
              estimate_number: match.estimate_number,
            };
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async deleteEstimate(estimateId: string): Promise<void> {
    await this.request("DELETE", `/estimates/${estimateId}`);
  }

  async deletePayment(paymentId: string): Promise<void> {
    await this.request("DELETE", `/customerpayments/${paymentId}`);
  }

  async registerPayment(
    invoiceId: string,
    amount: number,
    contactId: string,
    paymentMode: string = "Online",
    referenceNumber?: string
  ): Promise<string> {
    const payload: any = {
      customer_id: contactId,
      payment_mode: paymentMode,
      amount: Number(amount).toFixed(2),
      date: new Date().toISOString().split("T")[0],
      invoices: [
        {
          invoice_id: invoiceId,
          amount_applied: Number(amount).toFixed(2),
        },
      ],
    };
    if (referenceNumber) {
      payload.reference_number = referenceNumber;
    }

    const res = await this.request("POST", "/customerpayments", payload);
    return res.payment.payment_id;
  }

  async getDocumentPdf(documentId: string, type: "invoice" | "estimate"): Promise<ArrayBuffer> {
    const endpoint = type === "estimate" ? `/estimates/${documentId}` : `/invoices/${documentId}`;
    return await this.request("GET", `${endpoint}?accept=pdf`, undefined, true);
  }

  async getPaymentReceiptPdf(paymentId: string): Promise<ArrayBuffer> {
    return await this.request("GET", `/customerpayments/${paymentId}?accept=pdf`, undefined, true);
  }

  async listInvoices(params: { page?: number; per_page?: number; search_text?: string } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.per_page) query.append("per_page", String(params.per_page));
    if (params.search_text) query.append("search_text", params.search_text);

    const res = await this.request("GET", `/invoices?${query.toString()}`);
    return res.invoices || [];
  }

  async listEstimates(params: { page?: number; per_page?: number } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.per_page) query.append("per_page", String(params.per_page));

    const res = await this.request("GET", `/estimates?${query.toString()}`);
    return res.estimates || [];
  }

  async listPayments(params: { page?: number; per_page?: number } = {}): Promise<any[]> {
    const query = new URLSearchParams();
    if (params.page) query.append("page", String(params.page));
    if (params.per_page) query.append("per_page", String(params.per_page));

    const res = await this.request("GET", `/customerpayments?${query.toString()}`);
    return res.customerpayments || [];
  }
}

export default ZohoBooksService;
