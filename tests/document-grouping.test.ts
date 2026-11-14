import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractBaseReference,
  getDocTypePriority,
  getDocLifecycleOrder,
  groupDocuments,
  formatCurrency,
  DocumentRecord,
} from "../src/utils/document-grouper";

describe("Document Grouping Utility (Pack Related Documents by Job / Order)", () => {
  it("extractBaseReference strips known prefixes cleanly", () => {
    assert.equal(extractBaseReference("JOB-1792156525673-SNL9QH"), "1792156525673-SNL9QH");
    assert.equal(extractBaseReference("RT-1792156525673-SNL9QH"), "1792156525673-SNL9QH");
    assert.equal(extractBaseReference("EST-1792156525673-SNL9QH"), "1792156525673-SNL9QH");
    assert.equal(extractBaseReference("RCPT-1792156525673-SNL9QH"), "1792156525673-SNL9QH");
    assert.equal(extractBaseReference("INV-1001"), "1001");
    assert.equal(extractBaseReference("PKG-1001"), "1001");
    assert.equal(extractBaseReference("DOC-555"), "555");
  });

  it("getDocTypePriority gives highest precedence to invoices", () => {
    assert.ok(getDocTypePriority("invoice") > getDocTypePriority("estimate"));
    assert.ok(getDocTypePriority("estimate") > getDocTypePriority("job_card"));
    assert.ok(getDocTypePriority("job_card") > getDocTypePriority("receipt"));
  });

  it("packs 4 related repair documents into 1 group with invoice as primary", () => {
    const docs: DocumentRecord[] = [
      {
        id: "doc_job_1",
        display_id: "JOB-1792156525673-SNL9QH",
        title: "Workshop Job Card",
        type: "job_card",
        source: "pdfkit",
        status: "sent",
        total_amount: 0,
        currency_code: "kes",
        created_at: "2026-10-16T10:00:00Z",
        repair_ticket_id: "rep_ticket_99",
      },
      {
        id: "doc_est_1",
        display_id: "EST-1792156525673-SNL9QH",
        title: "Quotation / Estimate",
        type: "estimate",
        source: "pdfkit",
        status: "sent",
        total_amount: 3500,
        currency_code: "kes",
        created_at: "2026-10-16T11:00:00Z",
        repair_ticket_id: "rep_ticket_99",
      },
      {
        id: "doc_inv_1",
        display_id: "RT-1792156525673-SNL9QH",
        title: "Tax Invoice",
        type: "invoice",
        source: "zoho",
        status: "paid",
        total_amount: 3500,
        currency_code: "kes",
        created_at: "2026-10-16T12:00:00Z",
        repair_ticket_id: "rep_ticket_99",
      },
      {
        id: "doc_rcpt_1",
        display_id: "RCPT-1792156525673-SNL9QH",
        title: "Payment Receipt",
        type: "receipt",
        source: "pdfkit",
        status: "paid",
        total_amount: 3500,
        currency_code: "kes",
        created_at: "2026-10-16T13:00:00Z",
        repair_ticket_id: "rep_ticket_99",
      },
    ];

    const groups = groupDocuments(docs);
    assert.equal(groups.length, 1, "All 4 documents should be packed into 1 group");
    const group = groups[0];
    assert.equal(group.primaryDoc.id, "doc_inv_1", "Invoice must be elected as the primary document");
    assert.equal(group.primaryDoc.display_id, "RT-1792156525673-SNL9QH");
    assert.equal(group.hasInvoice, true);
    assert.equal(group.documents.length, 4);
    assert.equal(group.totalAmount, 3500);

    // Verify lifecycle sorting: Job Card -> Estimate -> Invoice -> Receipt
    assert.equal(group.documents[0].type, "job_card");
    assert.equal(group.documents[1].type, "estimate");
    assert.equal(group.documents[2].type, "invoice");
    assert.equal(group.documents[3].type, "receipt");
    assert.ok(group.includedTypesSummary.includes("Job Card"));
    assert.ok(group.includedTypesSummary.includes("Invoice"));
  });

  it("falls back to estimate or job card when no invoice exists in the group", () => {
    const docs: DocumentRecord[] = [
      {
        id: "doc_job_2",
        display_id: "JOB-1792888888888-ABC123",
        title: "Job Card",
        type: "job_card",
        source: "pdfkit",
        status: "sent",
        total_amount: 0,
        currency_code: "kes",
        created_at: "2026-10-16T09:00:00Z",
        repair_ticket_id: "rep_ticket_88",
      },
      {
        id: "doc_est_2",
        display_id: "EST-1792888888888-ABC123",
        title: "Quotation",
        type: "estimate",
        source: "pdfkit",
        status: "sent",
        total_amount: 1200,
        currency_code: "kes",
        created_at: "2026-10-16T09:30:00Z",
        repair_ticket_id: "rep_ticket_88",
      },
    ];

    const groups = groupDocuments(docs);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].primaryDoc.id, "doc_est_2", "Primary document should fall back to Estimate");
    assert.equal(groups[0].hasInvoice, false);
    assert.equal(groups[0].totalAmount, 1200);
  });

  it("packs order documents sharing order_id and base suffix", () => {
    const docs: DocumentRecord[] = [
      {
        id: "doc_ord_inv",
        display_id: "INV-1001",
        title: "Tax Invoice",
        type: "invoice",
        source: "zoho",
        status: "paid",
        total_amount: 8500,
        currency_code: "kes",
        order_id: "ord_1001",
        created_at: "2026-10-16T08:00:00Z",
      },
      {
        id: "doc_ord_pkg",
        display_id: "PKG-1001",
        title: "Packing Slip",
        type: "packing_slip",
        source: "pdfkit",
        status: "sent",
        total_amount: 0,
        currency_code: "kes",
        order_id: "ord_1001",
        created_at: "2026-10-16T08:30:00Z",
      },
    ];

    const groups = groupDocuments(docs);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].primaryDoc.id, "doc_ord_inv");
    assert.equal(groups[0].documents.length, 2);
  });

  it("normalizes legacy usd and empty currency codes to kes in groupDocuments", () => {
    const legacyDocs: DocumentRecord[] = [
      {
        id: "doc_legacy_1",
        display_id: "RT-1792156525673-SNL9QH",
        title: "Tax Invoice",
        type: "invoice",
        source: "zoho",
        status: "paid",
        total_amount: 13500,
        currency_code: "usd", // legacy USD from database
        repair_ticket_id: "rep_ticket_99",
        created_at: "2026-10-16T12:00:00Z",
      },
    ];

    const groups = groupDocuments(legacyDocs);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].currencyCode, "kes");
    assert.equal(groups[0].totalAmount, 13500);
  });

  it("formatCurrency formats amounts with en-KE / KES and treats usd or empty as kes", () => {
    const formattedUsd = formatCurrency(13500, "usd");
    assert.ok(formattedUsd.includes("13,500.00"), "Must format numeric amount with separators");
    assert.ok(formattedUsd.includes("Ksh") || formattedUsd.includes("KES"), "Legacy usd must format as KES / Ksh");
    assert.ok(!formattedUsd.includes("$"), "Legacy usd must not format with dollar sign");

    const formattedKes = formatCurrency(13500, "kes");
    assert.ok(formattedKes.includes("13,500.00"));
    assert.ok(formattedKes.includes("Ksh") || formattedKes.includes("KES"));
    assert.ok(!formattedKes.includes("$"));

    const formattedEmpty = formatCurrency(13500, "");
    assert.ok(formattedEmpty.includes("13,500.00"));
    assert.ok(formattedEmpty.includes("Ksh") || formattedEmpty.includes("KES"));

    const formattedZero = formatCurrency(0, "usd");
    assert.ok(formattedZero.includes("0.00"));
    assert.ok(!formattedZero.includes("$"));
  });

  it("sets group isPaid=true, paymentStatus='paid' and heals invoice status when receipt is paid", () => {
    const docs: DocumentRecord[] = [
      {
        id: "doc_inv_10",
        display_id: "RT-10001",
        title: "Repair Invoice",
        type: "invoice",
        source: "zoho",
        status: "sent",
        payment_status: "unpaid",
        total_amount: 5000,
        currency_code: "kes",
        created_at: "2026-10-16T12:00:00Z",
        repair_ticket_id: "rep_ticket_100",
      },
      {
        id: "doc_rcpt_10",
        display_id: "RCPT-10001",
        title: "Payment Receipt",
        type: "receipt",
        source: "zoho",
        status: "paid",
        payment_status: "paid",
        total_amount: 5000,
        currency_code: "kes",
        created_at: "2026-10-16T13:00:00Z",
        repair_ticket_id: "rep_ticket_100",
      },
    ];

    const groups = groupDocuments(docs);
    assert.equal(groups.length, 1);
    const g = groups[0];
    assert.equal(g.isPaid, true, "Group must be marked as paid");
    assert.equal(g.paymentStatus, "paid", "Group paymentStatus must be 'paid'");
    assert.equal(g.primaryDoc.payment_status, "paid", "Primary invoice doc must be healed to 'paid'");
    assert.equal(g.primaryDoc.status, "paid", "Primary invoice doc status must be healed to 'paid'");
    const invInDocs = g.documents.find((d) => d.type === "invoice");
    assert.equal(invInDocs?.payment_status, "paid", "Invoice in documents list must be healed to 'paid'");
  });

  it("sets group paymentStatus='partially_paid' and isPaid=false when receipt is partially_paid", () => {
    const docs: DocumentRecord[] = [
      {
        id: "doc_inv_11",
        display_id: "RT-10002",
        title: "Repair Invoice",
        type: "invoice",
        source: "zoho",
        status: "sent",
        payment_status: "unpaid",
        total_amount: 5000,
        currency_code: "kes",
        created_at: "2026-10-16T12:00:00Z",
        repair_ticket_id: "rep_ticket_101",
      },
      {
        id: "doc_rcpt_11",
        display_id: "RCPT-10002",
        title: "Payment Receipt",
        type: "receipt",
        source: "zoho",
        status: "paid",
        payment_status: "partially_paid",
        total_amount: 2000,
        currency_code: "kes",
        created_at: "2026-10-16T13:00:00Z",
        repair_ticket_id: "rep_ticket_101",
      },
    ];

    const groups = groupDocuments(docs);
    assert.equal(groups.length, 1);
    const g = groups[0];
    assert.equal(g.isPaid, false, "Group must not be fully paid");
    assert.equal(g.paymentStatus, "partially_paid", "Group paymentStatus must be 'partially_paid'");
    assert.equal(g.primaryDoc.payment_status, "partially_paid", "Primary invoice doc must show 'partially_paid'");
  });
});
