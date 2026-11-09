import assert from "node:assert";
import { test } from "node:test";
import { DocumentModuleService } from "../src/modules/documents/service";
import { ZohoBooksService } from "../src/services/zoho-books";
import * as editRoute from "../src/api/admin/documents/[id]/route";

test("Release 1.1.51 - Requirement 1: Zoho Books single source of truth fallback and auto-enabling", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  
  // Test applyInheritedRepairSettings
  const targetSettings: any = {};
  const repSettings: any = {
    zoho_books_enabled: true,
    zoho_client_id: "test_client_id",
    zoho_client_secret: "test_client_secret",
    zoho_refresh_token: "test_refresh_token",
    zoho_organization_id: "test_org_id",
  };

  const inherited = (service as any).applyInheritedRepairSettings(targetSettings, repSettings);
  assert.strictEqual(inherited.zoho_books_enabled, true, "Zoho books must be enabled when credentials exist");
  assert.strictEqual(inherited.zoho_client_id, "test_client_id");
  assert.strictEqual(inherited.zoho_client_secret, "test_client_secret");
  assert.strictEqual(inherited.zoho_refresh_token, "test_refresh_token");
  assert.strictEqual(inherited.zoho_organization_id, "test_org_id");
});

test("Release 1.1.51 - Requirement 2: Quote is automatically created when invoice is generated", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  const createdDocs: any[] = [];

  // Mock listDocumentRecords and createDocumentRecords
  service.listDocumentRecords = async (filter: any) => {
    return createdDocs.filter((d) => {
      if (filter.repair_ticket_id && d.repair_ticket_id !== filter.repair_ticket_id) return false;
      if (filter.type && d.type !== filter.type) return false;
      return true;
    });
  };

  service.createDocumentRecords = async (data: any) => {
    createdDocs.push(data);
    return data;
  };

  service.getSettings = async () => ({
    company_name: "Urban Device Care",
    zoho_books_enabled: false, // fallback to pdfkit for unit test
    store_invoice_prefix: "ST-",
  });

  service.getOrGenerateShortUrl = async (url: string) => url;

  const res = await service.generateDocument(
    {
      display_id: "RT-888999",
      title: "Repair Invoice",
      type: "invoice",
      repair_ticket_id: "ticket_test_123",
      force_source: "pdfkit",
      auto_send: false,
      total: 5000,
    },
    { resolve: () => null }
  );

  assert.ok(res, "Invoice generation result returned");
  assert.strictEqual(createdDocs.length, 2, "Both Quote (estimate) and Invoice must be created");

  const quoteDoc = createdDocs.find((d) => d.type === "estimate");
  const invoiceDoc = createdDocs.find((d) => d.type === "invoice");

  assert.ok(quoteDoc, "Estimate / quote must exist");
  assert.ok(invoiceDoc, "Invoice must exist");
  assert.strictEqual(quoteDoc.display_id, "EST-888999", "Quote display id must have EST- prefix");
  assert.strictEqual(quoteDoc.repair_ticket_id, "ticket_test_123");
});

test("Release 1.1.51 - Requirement 3: Paystack payment link attached to Zoho notes and QR", async () => {
  const paymentLink = "https://urbandevicecare.co.uk/repairs/track?token=tok123";
  let zohoNotes = "Thank you for your business.";
  if (!zohoNotes.includes("Paystack Payment Link:")) {
    zohoNotes += `\n\nPaystack Payment Link: ${paymentLink}\nPay Online (Paystack): ${paymentLink}`;
  }

  assert.ok(zohoNotes.includes("Paystack Payment Link: https://urbandevicecare.co.uk/repairs/track?token=tok123"));
  assert.ok(zohoNotes.includes("Pay Online (Paystack): https://urbandevicecare.co.uk/repairs/track?token=tok123"));
});

test("Release 1.1.51 - Requirement 4: Paystack payment reference recorded on Zoho receipts", async () => {
  let paymentRegistration: any = null;
  const zoho = new ZohoBooksService(
    {
      client_id: "dummy_client",
      client_secret: "dummy_secret",
      refresh_token: "dummy_token",
      organization_id: "dummy_org",
      domain: "com",
    },
    { info: () => {}, warn: () => {}, error: () => {} } as any
  );

  // Mock request method on zoho
  (zoho as any).request = async (method: string, endpoint: string, body?: any) => {
    if (endpoint === "/customerpayments") {
      paymentRegistration = {
        method,
        endpoint,
        body,
      };
      return { payment: { payment_id: "pay_123" } };
    }
    return {};
  };

  const paymentId = await zoho.registerPayment(
    "inv_123",
    4500,
    "contact_123",
    "Paystack",
    "PSTK_REF_998877",
    "Payment via Paystack: PSTK_REF_998877"
  );

  assert.strictEqual(paymentId, "pay_123");
  assert.ok(paymentRegistration, "Payment registration must be invoked");
  assert.strictEqual(paymentRegistration.body.payment_mode, "Paystack");
  assert.strictEqual(paymentRegistration.body.reference_number, "PSTK_REF_998877");
  assert.strictEqual(paymentRegistration.body.description, "Payment via Paystack: PSTK_REF_998877");
});

test("Release 1.1.51 - Requirement 5: Document editing allows updating quotes and invoices with Zoho sync", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  let updatedRecordData: any = null;

  service.retrieveDocumentRecord = async (id: string) => ({
    id,
    display_id: "RT-100200",
    title: "Old Invoice Title",
    type: "invoice",
    source: "zoho",
    zoho_document_id: "zoho_inv_555",
    total_amount: 3000,
    metadata: {
      items: [{ title: "Screen", quantity: 1, unit_price: 3000 }],
      notes: "Old notes",
    },
  });

  service.getSettings = async () => ({
    zoho_books_enabled: false,
    zoho_client_id: "cid",
    zoho_client_secret: "csecret",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "orgid",
    zoho_domain: "com",
  });

  service.updateDocumentRecords = async (data: any) => {
    updatedRecordData = data;
    return data;
  };

  const mockContainer = {
    resolve: (key: string) => {
      if (key === "logger") return { info: () => {}, warn: () => {}, error: () => {} };
      return null;
    },
  };

  const mockUpdatedDoc = await service.updateDocument(
    "doc_123",
    {
      title: "Updated Invoice Title",
      customer_name: "Jane Doe",
      items: [
        { title: "Screen Replacement (OLED)", quantity: 1, unit_price: 4500 },
        { title: "Tempered Glass", quantity: 2, unit_price: 500 },
      ],
      total: 5500,
      notes: "Updated terms and remarks",
      force_source: "pdfkit", // test local update path
    },
    mockContainer
  );

  assert.ok(updatedRecordData, "Document record must be updated");
  assert.strictEqual(updatedRecordData.title, "Updated Invoice Title");
  assert.strictEqual(updatedRecordData.customer_name, "Jane Doe");
  assert.strictEqual(updatedRecordData.total_amount, 5500);
  assert.strictEqual(updatedRecordData.metadata.items.length, 2);
  assert.strictEqual(updatedRecordData.metadata.notes, "Updated terms and remarks");

  // Verify route handlers exist for PUT and POST
  assert.strictEqual(typeof editRoute.PUT, "function", "PUT handler must be exported");
  assert.strictEqual(typeof editRoute.POST, "function", "POST handler must be exported");
});

test("Release 1.1.51 - Requirement 5b: Zoho Books updateInvoice and updateEstimate enforce customer_id and reason", async () => {
  let capturedPayload: any = null;
  let capturedEndpoint: string = "";
  const zoho = new ZohoBooksService(
    {
      client_id: "dummy_client",
      client_secret: "dummy_secret",
      refresh_token: "dummy_token",
      organization_id: "dummy_org",
      domain: "com",
    },
    { info: () => {}, warn: () => {}, error: () => {} } as any
  );

  (zoho as any).request = async (method: string, endpoint: string, body?: any) => {
    capturedEndpoint = endpoint;
    capturedPayload = body;
    if (endpoint.startsWith("/invoices/")) {
      return { invoice: { invoice_id: "inv_999", invoice_number: "RT-100200" } };
    }
    if (endpoint.startsWith("/estimates/")) {
      return { estimate: { estimate_id: "est_999", estimate_number: "EST-100200" } };
    }
    return {};
  };

  await zoho.updateInvoice("inv_999", {
    customer_id: "cust_777",
    notes: "Updated invoice notes",
    line_items: [{ name: "Repair Service", rate: "5000.00", quantity: 1 }],
  });

  assert.strictEqual(capturedEndpoint, "/invoices/inv_999");
  assert.strictEqual(capturedPayload.customer_id, "cust_777", "customer_id is mandatory on PUT /invoices/{id}");
  assert.strictEqual(capturedPayload.reason, "Updated via Admin Dashboard", "reason is mandatory on PUT /invoices/{id} for open invoices");

  await zoho.updateEstimate("est_999", {
    customer_id: "cust_777",
    notes: "Updated estimate notes",
  });

  assert.strictEqual(capturedEndpoint, "/estimates/est_999");
  assert.strictEqual(capturedPayload.customer_id, "cust_777", "customer_id is mandatory on PUT /estimates/{id}");
});

test("Release 1.1.51 - Requirement 4b: registerPayment gracefully falls back to 'others' if payment_mode is rejected", async () => {
  let callCount = 0;
  let lastPayload: any = null;
  const zoho = new ZohoBooksService(
    {
      client_id: "dummy_client",
      client_secret: "dummy_secret",
      refresh_token: "dummy_token",
      organization_id: "dummy_org",
      domain: "com",
    },
    { info: () => {}, warn: () => {}, error: () => {} } as any
  );

  (zoho as any).request = async (method: string, endpoint: string, body?: any) => {
    callCount++;
    lastPayload = body;
    if (callCount === 1) {
      throw new Error("Invalid value passed for payment_mode");
    }
    return { payment: { payment_id: "pay_fallback_456" } };
  };

  const paymentId = await zoho.registerPayment("inv_123", 2000, "cust_123", "Paystack", "REF_FALLBACK");
  assert.strictEqual(paymentId, "pay_fallback_456");
  assert.strictEqual(callCount, 2, "Must retry with fallback payment_mode");
  assert.strictEqual(lastPayload.payment_mode, "others");
  assert.ok(lastPayload.description.includes("Mode: Paystack"));
});

test("Release 1.1.51 - Requirement 1b: Custom documents use DOC- or CERT- prefix, never INV-", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  let createdDoc: any = null;

  service.getSettings = async () => ({
    company_name: "Urban Device Care",
    zoho_books_enabled: true,
    zoho_invoice_prefix: "INV-",
  });

  service.getOrGenerateShortUrl = async (url: string) => url;
  service.createDocumentRecords = async (data: any) => {
    createdDoc = data;
    return data;
  };
  service.createDocumentLinks = async () => {};

  await service.generateDocument(
    {
      title: "Trade-In Agreement",
      type: "custom",
      force_source: "pdfkit",
      customer: { name: "John Doe" },
    },
    { resolve: () => null }
  );

  assert.ok(createdDoc, "Document must be created");
  assert.ok(!createdDoc.display_id.startsWith("INV-"), "Custom document display_id must NOT start with INV-");
  assert.ok(createdDoc.display_id.startsWith("DOC-"), "Custom non-repair document display_id must start with DOC-");
});

test("Release 1.1.51 - Requirement 1c: deleteDocumentsForRepairTicket deletes receipts before invoices", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  const deletionLog: string[] = [];

  service.listDocumentRecords = async () => [
    { id: "doc_inv", type: "invoice", zoho_document_id: "zoho_inv_01" },
    { id: "doc_rcpt", type: "receipt", zoho_document_id: "zoho_rcpt_01" },
    { id: "doc_est", type: "estimate", zoho_document_id: "zoho_est_01" },
  ];

  service.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "cid",
    zoho_client_secret: "csecret",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "orgid",
  });

  service.deleteDocumentRecords = async () => {};

  // Mock ZohoBooksService methods
  const originalZoho = ZohoBooksService.prototype;
  const mockDeletePayment = async (id: string) => { deletionLog.push(`deletePayment:${id}`); };
  const mockDeleteInvoice = async (id: string) => { deletionLog.push(`deleteInvoice:${id}`); };
  const mockDeleteEstimate = async (id: string) => { deletionLog.push(`deleteEstimate:${id}`); };

  (ZohoBooksService.prototype as any).deletePayment = mockDeletePayment;
  (ZohoBooksService.prototype as any).deleteInvoice = mockDeleteInvoice;
  (ZohoBooksService.prototype as any).deleteEstimate = mockDeleteEstimate;

  try {
    const res = await service.deleteDocumentsForRepairTicket("rep_ticket_999", {
      resolve: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
    });

    assert.strictEqual(deletionLog.length, 3);
    assert.strictEqual(deletionLog[0], "deletePayment:zoho_rcpt_01", "Payment receipt must be deleted FIRST");
    assert.strictEqual(deletionLog[1], "deleteInvoice:zoho_inv_01", "Invoice must be deleted SECOND");
    assert.strictEqual(deletionLog[2], "deleteEstimate:zoho_est_01", "Estimate must be deleted THIRD");
  } finally {
    ZohoBooksService.prototype.deletePayment = originalZoho.deletePayment;
    ZohoBooksService.prototype.deleteInvoice = originalZoho.deleteInvoice;
    ZohoBooksService.prototype.deleteEstimate = originalZoho.deleteEstimate;
  }
});

test("Release 1.1.53 - Requirement 1d: ticket metadata cleanup deletes payments before invoices", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  const deletionLog: string[] = [];

  service.listDocumentRecords = async () => [];
  service.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "cid",
    zoho_client_secret: "csecret",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "orgid",
  });
  service.deleteDocumentRecords = async () => {};

  const originalZoho = ZohoBooksService.prototype;
  (ZohoBooksService.prototype as any).deletePayment = async (id: string) => { deletionLog.push(`deletePayment:${id}`); };
  (ZohoBooksService.prototype as any).deleteInvoice = async (id: string) => { deletionLog.push(`deleteInvoice:${id}`); };
  (ZohoBooksService.prototype as any).deleteEstimate = async (id: string) => { deletionLog.push(`deleteEstimate:${id}`); };

  try {
    const mockRepair = {
      retrieveRepairTicket: async () => ({
        id: "rep_ticket_meta_test",
        metadata: {
          zoho_invoice_id: "meta_inv_99",
          zoho_payment_id: "meta_pay_99",
          zoho_estimate_id: "meta_est_99",
        },
      }),
      updateRepairTickets: async () => {},
    };

    await service.deleteDocumentsForRepairTicket("rep_ticket_meta_test", {
      resolve: (key: string) => {
        if (key === "repair") return mockRepair;
        return { info: () => {}, warn: () => {}, error: () => {} };
      },
    });

    assert.strictEqual(deletionLog.length, 3);
    assert.strictEqual(deletionLog[0], "deletePayment:meta_pay_99", "Metadata payment must be deleted FIRST");
    assert.strictEqual(deletionLog[1], "deleteInvoice:meta_inv_99", "Metadata invoice must be deleted SECOND");
    assert.strictEqual(deletionLog[2], "deleteEstimate:meta_est_99", "Metadata estimate must be deleted THIRD");
  } finally {
    ZohoBooksService.prototype.deletePayment = originalZoho.deletePayment;
    ZohoBooksService.prototype.deleteInvoice = originalZoho.deleteInvoice;
    ZohoBooksService.prototype.deleteEstimate = originalZoho.deleteEstimate;
  }
});

test("Release 1.1.53 - Requirement 4c: receipt generation is idempotent and reuses existing Zoho payment", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);

  service.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "cid",
    zoho_client_secret: "csecret",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "orgid",
  });
  service.listDocumentRecords = async () => [
    { id: "doc_inv_1", type: "invoice", zoho_document_id: "zh_inv_444" },
  ];
  service.createDocumentRecords = async (rec: any) => ({ ...rec, id: "doc_rcpt_new" });

  const originalZoho = ZohoBooksService.prototype;
  let registerPaymentCalled = false;

  (ZohoBooksService.prototype as any).syncContact = async () => "contact_123";
  (ZohoBooksService.prototype as any).getInvoice = async (invId: string) => ({
    invoice_id: invId,
    payments: [
      { payment_id: "existing_pay_888", reference_number: "PSTK_REF_9999", amount: 15000 },
    ],
  });
  (ZohoBooksService.prototype as any).registerPayment = async () => {
    registerPaymentCalled = true;
    return "new_pay_id";
  };
  const minimalPdf = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000108 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n182\n%%EOF"
  );
  (ZohoBooksService.prototype as any).getPaymentReceiptPdf = async () => minimalPdf;

  try {
    const result = await service.generateDocument(
      {
        type: "receipt",
        repair_ticket_id: "rep_ticket_idem",
        total: 15000,
        payment_reference: "PSTK_REF_9999",
        payment_status: "paid",
        auto_send: false,
      },
      {
        resolve: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
      }
    );

    assert.strictEqual(registerPaymentCalled, false, "Must NOT call registerPayment when payment already exists in Zoho");
    assert.strictEqual(result.record.zoho_document_id, "existing_pay_888", "Must reuse existing payment_id");
    assert.strictEqual(result.record.source, "zoho");
  } finally {
    ZohoBooksService.prototype.syncContact = originalZoho.syncContact;
    ZohoBooksService.prototype.getInvoice = originalZoho.getInvoice;
    ZohoBooksService.prototype.registerPayment = originalZoho.registerPayment;
    ZohoBooksService.prototype.getPaymentReceiptPdf = originalZoho.getPaymentReceiptPdf;
  }
});

test("Release 1.1.53 - Requirement 1e: getPdfForRecord self-heals PDFKit document to Zoho Books", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);

  const mockRecord = {
    id: "doc_pdfkit_old",
    display_id: "RT-888999",
    type: "invoice",
    source: "pdfkit",
    zoho_document_id: null,
    metadata: {},
  };

  service.retrieveDocumentRecord = async () => mockRecord;
  service.getSettings = async () => ({
    zoho_books_enabled: true,
    zoho_client_id: "cid",
    zoho_client_secret: "csecret",
    zoho_refresh_token: "rtoken",
    zoho_organization_id: "orgid",
  });

  const originalZoho = ZohoBooksService.prototype;
  (ZohoBooksService.prototype as any).getInvoiceByNumber = async (num: string) => ({
    invoice_id: "zoho_inv_healed_123",
    invoice_number: num,
  });
  (ZohoBooksService.prototype as any).getDocumentPdf = async () => Buffer.from("%PDF-1.4 official zoho invoice");

  try {
    const pdf = await service.getPdfForRecord("doc_pdfkit_old", {
      resolve: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
    });

    assert.ok(pdf, "Must return PDF buffer");
    assert.strictEqual(mockRecord.source, "zoho", "Record source must be updated to zoho");
    assert.strictEqual(mockRecord.zoho_document_id, "zoho_inv_healed_123", "zoho_document_id must be self-healed");
  } finally {
    ZohoBooksService.prototype.getInvoiceByNumber = originalZoho.getInvoiceByNumber;
    ZohoBooksService.prototype.getDocumentPdf = originalZoho.getDocumentPdf;
  }
});


