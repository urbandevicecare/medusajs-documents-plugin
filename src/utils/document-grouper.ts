export interface DocumentRecord {
  id: string;
  display_id: string;
  title: string;
  type: string;
  source: string;
  status: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  order_id?: string;
  repair_ticket_id?: string;
  total_amount?: number;
  currency_code?: string;
  payment_status?: string;
  payment_link?: string;
  short_payment_link?: string;
  pdf_url?: string;
  short_pdf_link?: string;
  metadata?: any;
  created_at: string;
}

export interface DocumentGroup {
  groupId: string;
  groupKey: string;
  primaryDoc: DocumentRecord;
  documents: DocumentRecord[];
  hasInvoice: boolean;
  totalAmount: number;
  currencyCode: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  latestCreatedAt: string;
  includedTypesSummary: string;
}

/**
 * Extracts normalized base reference by stripping known document prefixes.
 * Examples:
 * - "JOB-1792156525673-SNL9QH" -> "1792156525673-SNL9QH"
 * - "RT-1792156525673-SNL9QH" -> "1792156525673-SNL9QH"
 * - "EST-1792156525673-SNL9QH" -> "1792156525673-SNL9QH"
 * - "RCPT-1792156525673-SNL9QH" -> "1792156525673-SNL9QH"
 * - "INV-1001" -> "1001"
 * - "RCPT-1001" -> "1001"
 * - "PKG-1001" -> "1001"
 */
export function extractBaseReference(displayId?: string): string {
  if (!displayId) return "";
  const cleaned = String(displayId).trim();
  // Strip repeated prefixes like JOB-, RT-, EST-, RCPT-, INV-, PKG-, DOC-
  const withoutPrefix = cleaned.replace(/^(JOB-|RT-|EST-|RCPT-|INV-|PKG-|DOC-)+/i, "");
  return withoutPrefix.trim();
}

/**
 * Priority scoring for electing the primary document representing a pack.
 * An Invoice is always top priority if available in the pack.
 */
export function getDocTypePriority(type?: string): number {
  switch (type?.toLowerCase()) {
    case "invoice":
      return 100; // Invoices always take top precedence
    case "estimate":
      return 80;
    case "job_card":
      return 70;
    case "receipt":
      return 60;
    case "packing_slip":
      return 50;
    case "custom":
      return 40;
    default:
      return 10;
  }
}

/**
 * Workflow lifecycle ordering for sorting related documents inside an expanded pack.
 * 1. Job Card -> 2. Quote/Estimate -> 3. Invoice -> 4. Receipt -> 5. Packing Slip -> 6. Custom
 */
export function getDocLifecycleOrder(type?: string): number {
  switch (type?.toLowerCase()) {
    case "job_card":
      return 1;
    case "estimate":
      return 2;
    case "invoice":
      return 3;
    case "receipt":
      return 4;
    case "packing_slip":
      return 5;
    case "custom":
      return 6;
    default:
      return 10;
  }
}

/**
 * Human-friendly title or label for a document type.
 */
export function getDocTypeLabel(type?: string): string {
  switch (type?.toLowerCase()) {
    case "invoice":
      return "Invoice";
    case "estimate":
      return "Quote";
    case "job_card":
      return "Job Card";
    case "receipt":
      return "Receipt";
    case "packing_slip":
      return "Packing Slip";
    case "custom":
      return "Certificate";
    default:
      return type || "Document";
  }
}

/**
 * Groups related documents by job or order using a multi-tier correlation algorithm.
 * 1. Ties documents by repair_ticket_id
 * 2. Ties documents by order_id
 * 3. Ties documents by normalized reference base suffix (e.g. 1792156525673-SNL9QH or 1001)
 */
export function groupDocuments(documents: DocumentRecord[]): DocumentGroup[] {
  if (!documents || documents.length === 0) return [];

  // Disjoint Set Union (DSU) to cluster documents sharing any correlation key
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(x: string, y: string) {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX !== rootY) {
      parent.set(rootY, rootX);
    }
  }

  // Assign keys to each document
  const docKeys = new Map<string, string[]>();

  for (const doc of documents) {
    const keys: string[] = [`doc:${doc.id}`];

    if (doc.repair_ticket_id) {
      keys.push(`rep:${doc.repair_ticket_id}`);
    }
    if (doc.order_id) {
      keys.push(`ord:${doc.order_id}`);
    }

    const baseRef = extractBaseReference(doc.display_id);
    if (baseRef && baseRef.length >= 3) {
      // Long references like 1792156525673-SNL9QH are globally unique
      if (baseRef.length >= 6 || /[A-Za-z]/.test(baseRef)) {
        keys.push(`ref:${baseRef.toLowerCase()}`);
      } else {
        // Short references like 1001 correlate within the same customer or order
        const custKey = (doc.customer_email || doc.customer_phone || doc.customer_name || "").toLowerCase().trim();
        keys.push(`ref:${baseRef.toLowerCase()}${custKey ? `:${custKey}` : ""}`);
      }
    }

    docKeys.set(doc.id, keys);

    // Union all keys of this document together
    const primaryKey = keys[0];
    for (let i = 1; i < keys.length; i++) {
      union(primaryKey, keys[i]);
    }
  }

  // Connect multiple documents that share any key
  const keyToDocs = new Map<string, string[]>();
  for (const [docId, keys] of docKeys.entries()) {
    for (const k of keys) {
      if (!keyToDocs.has(k)) keyToDocs.set(k, []);
      keyToDocs.get(k)!.push(docId);
    }
  }

  for (const [, docIds] of keyToDocs.entries()) {
    if (docIds.length > 1) {
      const firstRoot = `doc:${docIds[0]}`;
      for (let i = 1; i < docIds.length; i++) {
        union(firstRoot, `doc:${docIds[i]}`);
      }
    }
  }

  // Aggregate documents by root cluster
  const clusters = new Map<string, DocumentRecord[]>();
  for (const doc of documents) {
    const root = find(`doc:${doc.id}`);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(doc);
  }

  // Build DocumentGroup objects
  const groups: DocumentGroup[] = [];

  for (const [clusterId, clusterDocs] of clusters.entries()) {
    // Sort documents in lifecycle order: job_card -> estimate -> invoice -> receipt -> packing_slip -> custom
    clusterDocs.sort((a, b) => {
      const orderA = getDocLifecycleOrder(a.type);
      const orderB = getDocLifecycleOrder(b.type);
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Elect primary document: Highest priority (Invoice if available, else Estimate/Job Card)
    let primaryDoc = clusterDocs[0];
    let maxPriority = -1;

    for (const d of clusterDocs) {
      const p = getDocTypePriority(d.type);
      if (p > maxPriority) {
        maxPriority = p;
        primaryDoc = d;
      }
    }

    const hasInvoice = clusterDocs.some((d) => d.type?.toLowerCase() === "invoice");

    // Group total amount: prefer Invoice total, then Estimate total, then Receipt total, then primaryDoc total
    const invoiceDoc = clusterDocs.find((d) => d.type?.toLowerCase() === "invoice");
    const estimateDoc = clusterDocs.find((d) => d.type?.toLowerCase() === "estimate");
    const receiptDoc = clusterDocs.find((d) => d.type?.toLowerCase() === "receipt");

    const totalAmount = Number(
      (invoiceDoc && invoiceDoc.total_amount != null)
        ? invoiceDoc.total_amount
        : (estimateDoc && estimateDoc.total_amount != null)
        ? estimateDoc.total_amount
        : (receiptDoc && receiptDoc.total_amount != null)
        ? receiptDoc.total_amount
        : primaryDoc.total_amount || 0
    );

    // Group currency
    const currencyCode = primaryDoc.currency_code || invoiceDoc?.currency_code || "kes";

    // Summary of included types
    const uniqueTypes = Array.from(new Set(clusterDocs.map((d) => getDocTypeLabel(d.type))));
    const includedTypesSummary = uniqueTypes.join(" • ");

    // Latest created_at timestamp
    const latestCreatedAt = clusterDocs.reduce((latest, d) => {
      return new Date(d.created_at) > new Date(latest) ? d.created_at : latest;
    }, clusterDocs[0].created_at);

    // Build human-friendly groupKey
    let groupKey = primaryDoc.display_id;
    if (primaryDoc.repair_ticket_id) {
      groupKey = `Repair ${primaryDoc.display_id}`;
    } else if (primaryDoc.order_id) {
      groupKey = `Order #${primaryDoc.display_id}`;
    }

    groups.push({
      groupId: clusterId,
      groupKey,
      primaryDoc,
      documents: clusterDocs,
      hasInvoice,
      totalAmount,
      currencyCode,
      customerName: primaryDoc.customer_name || "Valued Customer",
      customerEmail: primaryDoc.customer_email || clusterDocs.find((d) => d.customer_email)?.customer_email,
      customerPhone: primaryDoc.customer_phone || clusterDocs.find((d) => d.customer_phone)?.customer_phone,
      latestCreatedAt,
      includedTypesSummary,
    });
  }

  // Sort groups by latest activity (most recent first)
  groups.sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());

  return groups;
}
