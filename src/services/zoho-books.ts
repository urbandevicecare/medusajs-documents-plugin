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

    const res = await this.request("POST", "/invoices", payload);
    return {
      invoice_id: res.invoice.invoice_id,
      invoice_number: res.invoice.invoice_number,
    };
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
    line_items: any[];
    notes?: string;
    terms?: string;
    is_inclusive_tax?: boolean;
  }): Promise<{ estimate_id: string; estimate_number: string }> {
    const payload = {
      customer_id: contactId,
      reference_number: estimateData.reference_number,
      line_items: estimateData.line_items,
      notes: estimateData.notes || "Estimate for goods/services.",
      terms: estimateData.terms || "",
      is_inclusive_tax: estimateData.is_inclusive_tax ?? false,
    };

    const res = await this.request("POST", "/estimates", payload);
    return {
      estimate_id: res.estimate.estimate_id,
      estimate_number: res.estimate.estimate_number,
    };
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
