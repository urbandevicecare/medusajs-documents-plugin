import { defineRouteConfig } from "@medusajs/admin-sdk";
import {
  Container,
  Heading,
  Table,
  Badge,
  Button,
  Input,
  Select,
  FocusModal,
  Label,
  Textarea,
  Text,
  Switch,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  DocumentText,
  ArrowPath,
  Plus,
  ArrowDownTray,
  Envelope,
  CogSixTooth,
  Sparkles,
} from "@medusajs/icons";

interface DocumentRecord {
  id: string;
  display_id: string;
  title: string;
  type: string;
  source: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  currency_code: string;
  payment_status: string;
  payment_link?: string;
  short_payment_link?: string;
  pdf_url?: string;
  short_pdf_link?: string;
  created_at: string;
}

export const DocumentsPage = () => {
  const [activeTab, setActiveTab] = useState<"hub" | "templates" | "automations" | "settings">("hub");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [zohoLiveDocs, setZohoLiveDocs] = useState<any[]>([]);
  const [loadingZoho, setLoadingZoho] = useState(false);

  // Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [customDocModalOpen, setCustomDocModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);

  // Settings State
  const [settings, setSettings] = useState<any>({
    company_name: "Store",
    storefront_url: "",
    email_notifications_enabled: true,
    sms_notifications_enabled: true,
    whatsapp_notifications_enabled: true,

    // Automation event subscriber toggles
    event_order_placed_enabled: true,
    event_order_completed_enabled: true,
    event_payment_captured_enabled: true,
    event_order_fulfillment_enabled: true,
    event_repair_status_changed_enabled: true,
    event_repair_compliance_enabled: true,
    event_repair_created_enabled: true,
    event_repair_completed_enabled: true,
    event_repair_reminder_enabled: true,

    // Zoho Books
    zoho_books_enabled: false,
    zoho_domain: "com",
    zoho_organization_id: "",
    zoho_client_id: "",
    zoho_client_secret: "",
    zoho_refresh_token: "",
    zoho_invoice_notes: "Thank you for your business.",
    zoho_invoice_terms: "",
    zoho_estimate_terms: "",
    zoho_payment_terms_days: 0,
    zoho_tax_inclusive: false,
    zoho_invoice_prefix: "INV-",

    // PDF Branding
    pdf_logo_url: "",
    pdf_address: "",
    pdf_phone: "",
    pdf_email: "",
    pdf_website: "",
    pdf_payment_details: "",
    pdf_terms: "",

    // Template Choices
    invoice_template: "modern",
    packing_slip_template: "modern",
    receipt_template: "modern",
    estimate_template: "modern",
    custom_doc_template: "modern",
  });

  const [isSaving, setIsSaving] = useState(false);

  // Manual Invoice Form
  const [manualForm, setManualForm] = useState({
    title: "Tax Invoice",
    type: "invoice",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    items: [{ title: "", description: "", quantity: 1, unit_price: 0 }],
    currency_code: "usd",
    notes: "",
    force_source: "auto",
    auto_send: false,
  });

  // Custom Document Form
  const [customDocForm, setCustomDocForm] = useState({
    title: "Warranty Certificate",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    body_text: "This document certifies that the repair/device services rendered include standard warranty coverage.",
    items: [{ title: "Service Coverage", description: "Standard 90-Day Hardware Warranty", quantity: 1, unit_price: 0 }],
    send_email_now: true,
    email_subject: "Your Official Certificate / Document",
  });

  // Send Notification Form
  const [sendForm, setSendForm] = useState({
    channels: ["email"],
    custom_message: "",
    subject: "",
  });

  const loadDocuments = () => {
    setLoading(true);
    fetch("/admin/documents", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || []);
      })
      .catch((err) => console.error("Error loading documents:", err))
      .finally(() => setLoading(false));
  };

  const loadSettings = () => {
    fetch("/admin/documents/settings", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setSettings((prev: any) => ({ ...prev, ...data.settings }));
        }
      })
      .catch((err) => console.error("Error loading settings:", err));
  };

  const loadZohoLiveDocs = () => {
    setLoadingZoho(true);
    fetch("/admin/documents/zoho/list", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.items) {
          setZohoLiveDocs(data.items);
        }
      })
      .catch((err) => console.error("Error loading Zoho live docs:", err))
      .finally(() => setLoadingZoho(false));
  };

  useEffect(() => {
    loadDocuments();
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/admin/documents/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        alert("Settings saved successfully!");
      } else {
        alert("Failed to save settings.");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettingField = (key: string, val: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: val }));
  };

  // Submit Manual Document
  const handleCreateManual = async () => {
    try {
      const res = await fetch("/admin/documents/manual", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: manualForm.title,
          type: manualForm.type,
          customer: {
            name: manualForm.customer_name,
            email: manualForm.customer_email,
            phone: manualForm.customer_phone,
            address: manualForm.customer_address,
          },
          items: manualForm.items,
          currency_code: manualForm.currency_code,
          notes: manualForm.notes,
          force_source: manualForm.force_source === "auto" ? undefined : manualForm.force_source,
          auto_send: manualForm.auto_send,
        }),
      });
      if (res.ok) {
        alert("Document created successfully!");
        setManualModalOpen(false);
        loadDocuments();
      } else {
        alert("Failed to create document.");
      }
    } catch (e) {
      alert("Error creating document.");
    }
  };

  // Submit Custom Document
  const handleCreateCustomDoc = async () => {
    try {
      const res = await fetch("/admin/documents/custom", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customDocForm.title,
          customer: {
            name: customDocForm.customer_name,
            email: customDocForm.customer_email,
            phone: customDocForm.customer_phone,
          },
          body_text: customDocForm.body_text,
          items: customDocForm.items,
          send_email_now: customDocForm.send_email_now,
          email_subject: customDocForm.email_subject,
          custom_email_message: customDocForm.body_text,
        }),
      });
      if (res.ok) {
        alert("Custom document generated & emailed successfully!");
        setCustomDocModalOpen(false);
        loadDocuments();
      } else {
        alert("Failed to generate custom document.");
      }
    } catch (e) {
      alert("Error generating custom document.");
    }
  };

  // Submit Notification Send
  const handleSendNotification = async () => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/admin/documents/${selectedDoc.id}/send`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: sendForm.channels,
          custom_message: sendForm.custom_message,
          subject: sendForm.subject || undefined,
        }),
      });
      if (res.ok) {
        alert("Notification dispatched successfully!");
        setSendModalOpen(false);
      } else {
        alert("Failed to dispatch notification.");
      }
    } catch (e) {
      alert("Error sending notification.");
    }
  };

  // Sync to Zoho
  const handleSyncToZoho = async (docId: string) => {
    try {
      const res = await fetch(`/admin/documents/${docId}/sync-zoho`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Successfully synced to Zoho Books! (Zoho ID: ${data.zoho_document_id})`);
        loadDocuments();
      } else {
        alert(`Zoho Sync Failed: ${data.message || "Unknown error"}`);
      }
    } catch (e) {
      alert("Error syncing to Zoho Books.");
    }
  };

  // Filter documents
  const filteredDocs = documents.filter((doc) => {
    if (typeFilter !== "all" && doc.type !== typeFilter) return false;
    if (sourceFilter !== "all" && doc.source !== sourceFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        doc.display_id?.toLowerCase().includes(q) ||
        doc.customer_name?.toLowerCase().includes(q) ||
        doc.customer_email?.toLowerCase().includes(q) ||
        doc.title?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <Container className="p-0">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-ui-border-base gap-4 bg-ui-bg-base">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
            <DocumentText className="text-ui-fg-interactive w-5 h-5" />
          </div>
          <div>
            <Heading level="h1" className="text-xl font-semibold">Documents Hub</Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Unified document generation with Zoho Books, PDFKit templates & multi-channel dispatch
            </Text>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={() => setManualModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Invoice
          </Button>
          <Button variant="secondary" size="small" onClick={() => setCustomDocModalOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1" /> Custom Document
          </Button>
          <Button variant="transparent" size="small" onClick={loadDocuments}>
            <ArrowPath className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-6 px-6 border-b border-ui-border-base bg-ui-bg-subtle text-sm">
        <button
          onClick={() => setActiveTab("hub")}
          className={`py-3 font-medium border-b-2 transition-colors ${
            activeTab === "hub"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle"
          }`}
        >
          All Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`py-3 font-medium border-b-2 transition-colors ${
            activeTab === "templates"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle"
          }`}
        >
          PDF Templates
        </button>
        <button
          onClick={() => setActiveTab("automations")}
          className={`py-3 font-medium border-b-2 transition-colors ${
            activeTab === "automations"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle"
          }`}
        >
          Automations / Events
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`py-3 font-medium border-b-2 transition-colors ${
            activeTab === "settings"
              ? "border-ui-border-interactive text-ui-fg-base"
              : "border-transparent text-ui-fg-muted hover:text-ui-fg-subtle"
          }`}
        >
          Settings & Zoho
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ALL DOCUMENTS HUB                                 */}
      {/* ========================================================= */}
      {activeTab === "hub" && (
        <div className="p-6 flex flex-col gap-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <Input
                placeholder="Search reference, customer, or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
                <Select.Trigger size="small">
                  <Select.Value placeholder="Document Type" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Types</Select.Item>
                  <Select.Item value="invoice">Invoices</Select.Item>
                  <Select.Item value="receipt">Receipts</Select.Item>
                  <Select.Item value="estimate">Estimates / Quotes</Select.Item>
                  <Select.Item value="job_card">Job Cards</Select.Item>
                  <Select.Item value="packing_slip">Packing Slips</Select.Item>
                  <Select.Item value="custom">Custom Documents</Select.Item>
                </Select.Content>
              </Select>

              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v)}>
                <Select.Trigger size="small">
                  <Select.Value placeholder="Source" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Sources</Select.Item>
                  <Select.Item value="zoho">Zoho Books</Select.Item>
                  <Select.Item value="pdfkit">PDFKit Local</Select.Item>
                </Select.Content>
              </Select>

              {settings.zoho_books_enabled && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={loadZohoLiveDocs}
                  isLoading={loadingZoho}
                >
                  <ArrowPath className="w-3.5 h-3.5 mr-1" /> View Live Zoho List
                </Button>
              )}
            </div>
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="py-12 text-center text-ui-fg-muted text-sm">Loading documents...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-ui-fg-muted border border-dashed border-ui-border-base rounded-lg">
              <Text className="text-sm">No documents found.</Text>
              <Text className="text-xs text-ui-fg-subtle mt-1">
                Create a manual invoice or process an order to generate your first document.
              </Text>
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Reference</Table.HeaderCell>
                  <Table.HeaderCell>Type</Table.HeaderCell>
                  <Table.HeaderCell>Recipient</Table.HeaderCell>
                  <Table.HeaderCell>Amount</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Source</Table.HeaderCell>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filteredDocs.map((doc) => {
                  const isPaid = doc.payment_status === "paid" || doc.status === "paid";
                  const isZoho = doc.source === "zoho";

                  return (
                    <Table.Row key={doc.id} className="hover:bg-ui-bg-subtle-hover transition-colors">
                      <Table.Cell>
                        <a
                          href={`/api/admin/documents/${doc.id}/document`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-ui-fg-interactive hover:underline"
                        >
                          {doc.display_id}
                        </a>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs font-medium text-ui-fg-base">{doc.title}</span>
                      </Table.Cell>
                      <Table.Cell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{doc.customer_name || "Guest"}</span>
                          <span className="text-[11px] text-ui-fg-subtle">{doc.customer_email || doc.customer_phone || "-"}</span>
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs font-semibold">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: (doc.currency_code || "usd").toUpperCase(),
                          }).format(Number(doc.total_amount || 0))}
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={isPaid ? "green" : (doc.payment_status === "unpaid" ? "red" : "blue")} size="small">
                          {doc.payment_status || doc.status}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <Badge color={isZoho ? "purple" : "grey"} size="small">
                          {isZoho ? "Zoho Books" : "PDFKit"}
                        </Badge>
                      </Table.Cell>
                      <Table.Cell>
                        <span className="text-xs text-ui-fg-subtle">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`/api/admin/documents/${doc.id}/document`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
                            title="View / Download PDF"
                          >
                            <ArrowDownTray className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setSendForm({
                                channels: ["email"],
                                custom_message: "",
                                subject: `${settings.company_name}: ${doc.title} #${doc.display_id}`,
                              });
                              setSendModalOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
                            title="Send via Email / SMS / WhatsApp"
                          >
                            <Envelope className="w-4 h-4" />
                          </button>
                          {!isZoho && settings.zoho_books_enabled && (
                            <Button
                              variant="transparent"
                              size="small"
                              onClick={() => handleSyncToZoho(doc.id)}
                              className="text-xs text-purple-600 hover:text-purple-700"
                            >
                              Push Zoho
                            </Button>
                          )}
                          {doc.short_payment_link && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(doc.short_payment_link!);
                                alert("Short payment link copied to clipboard!");
                              }}
                              className="text-[11px] text-ui-fg-interactive hover:underline px-1.5 py-1"
                              title="Copy Short Payment Link"
                            >
                              Copy Link
                            </button>
                          )}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          )}

          {/* Zoho Remote Invoices View if Loaded */}
          {zohoLiveDocs.length > 0 && (
            <div className="mt-8 border border-ui-border-base rounded-lg p-4 bg-ui-bg-subtle">
              <Heading level="h2" className="text-sm font-semibold mb-3">Live Zoho Books Invoices</Heading>
              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Invoice #</Table.HeaderCell>
                    <Table.HeaderCell>Customer Name</Table.HeaderCell>
                    <Table.HeaderCell>Total</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Date</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {zohoLiveDocs.map((zi: any) => (
                    <Table.Row key={zi.invoice_id}>
                      <Table.Cell className="font-medium">{zi.invoice_number}</Table.Cell>
                      <Table.Cell>{zi.customer_name}</Table.Cell>
                      <Table.Cell>{zi.total}</Table.Cell>
                      <Table.Cell>
                        <Badge color={zi.status === "paid" ? "green" : "red"} size="small">{zi.status}</Badge>
                      </Table.Cell>
                      <Table.Cell>{zi.date}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PDF TEMPLATES SELECTION & PREVIEW                 */}
      {/* ========================================================= */}
      {activeTab === "templates" && (
        <div className="p-6 max-w-4xl flex flex-col gap-6">
          <div>
            <Heading level="h2" className="text-base font-semibold">PDFKit Fallback Templates</Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Configure different styling templates for each document type when generated locally via PDFKit.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Template */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between">
              <div>
                <Label className="font-semibold text-sm">Invoice Template</Label>
                <Text className="text-xs text-ui-fg-subtle mb-3">Used for standard customer order & repair invoices.</Text>
                <Select
                  value={settings.invoice_template || "modern"}
                  onValueChange={(v) => updateSettingField("invoice_template", v)}
                >
                  <Select.Trigger size="small">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="modern">Modern Minimalist</Select.Item>
                    <Select.Item value="classic">Classic Corporate</Select.Item>
                    <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                <a
                  href={`/api/admin/documents/templates/preview?style=${settings.invoice_template || "modern"}&type=invoice`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTray className="w-3.5 h-3.5" /> Preview Invoice Template
                </a>
              </div>
            </div>

            {/* Packing Slip Template */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between">
              <div>
                <Label className="font-semibold text-sm">Packing Slip Template</Label>
                <Text className="text-xs text-ui-fg-subtle mb-3">Used for warehouse fulfillment & shipping packing slips.</Text>
                <Select
                  value={settings.packing_slip_template || "modern"}
                  onValueChange={(v) => updateSettingField("packing_slip_template", v)}
                >
                  <Select.Trigger size="small">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="modern">Modern Minimalist</Select.Item>
                    <Select.Item value="classic">Classic Corporate</Select.Item>
                    <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                <a
                  href={`/api/admin/documents/templates/preview?style=${settings.packing_slip_template || "modern"}&type=packing_slip`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTray className="w-3.5 h-3.5" /> Preview Packing Slip Template
                </a>
              </div>
            </div>

            {/* Receipt Template */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between">
              <div>
                <Label className="font-semibold text-sm">Payment Receipt Template</Label>
                <Text className="text-xs text-ui-fg-subtle mb-3">Issued when orders or repairs are captured and paid in full.</Text>
                <Select
                  value={settings.receipt_template || "modern"}
                  onValueChange={(v) => updateSettingField("receipt_template", v)}
                >
                  <Select.Trigger size="small">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="modern">Modern Minimalist</Select.Item>
                    <Select.Item value="classic">Classic Corporate</Select.Item>
                    <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                <a
                  href={`/api/admin/documents/templates/preview?style=${settings.receipt_template || "modern"}&type=receipt`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTray className="w-3.5 h-3.5" /> Preview Receipt Template
                </a>
              </div>
            </div>

            {/* Custom Document Template */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between">
              <div>
                <Label className="font-semibold text-sm">Custom Document Template</Label>
                <Text className="text-xs text-ui-fg-subtle mb-3">Used for certificates, agreements, and customized memos.</Text>
                <Select
                  value={settings.custom_doc_template || "modern"}
                  onValueChange={(v) => updateSettingField("custom_doc_template", v)}
                >
                  <Select.Trigger size="small">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="modern">Modern Minimalist</Select.Item>
                    <Select.Item value="classic">Classic Corporate</Select.Item>
                    <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                <a
                  href={`/api/admin/documents/templates/preview?style=${settings.custom_doc_template || "modern"}&type=custom`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTray className="w-3.5 h-3.5" /> Preview Custom Doc Template
                </a>
              </div>
            </div>

            {/* Repair Job Card Template */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between">
              <div>
                <Label className="font-semibold text-sm">Repair Job Card Template</Label>
                <Text className="text-xs text-ui-fg-subtle mb-3">Workshop intake job card with device specs, inspection checklist & technician sign-off.</Text>
                <Select
                  value={settings.job_card_template || "modern"}
                  onValueChange={(v) => updateSettingField("job_card_template", v)}
                >
                  <Select.Trigger size="small">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="modern">Modern Minimalist</Select.Item>
                    <Select.Item value="classic">Classic Corporate</Select.Item>
                    <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                  </Select.Content>
                </Select>
              </div>
              <div className="mt-4 pt-3 border-t border-ui-border-base flex justify-end">
                <a
                  href={`/api/admin/documents/templates/preview?style=${settings.job_card_template || "modern"}&type=job_card`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-ui-fg-interactive hover:underline inline-flex items-center gap-1"
                >
                  <ArrowDownTray className="w-3.5 h-3.5" /> Preview Job Card Template
                </a>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={saveSettings} isLoading={isSaving}>
              Save Template Preferences
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: AUTOMATIONS & CAPTURED EVENTS SUBSCRIBERS         */}
      {/* ========================================================= */}
      {activeTab === "automations" && (
        <div className="p-6 max-w-4xl flex flex-col gap-6">
          <div>
            <Heading level="h2" className="text-base font-semibold">Event Subscribers & Automations</Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Toggle automated document generation on or off for captured Medusa order and repair events.
            </Text>
          </div>

          <div className="flex flex-col gap-4">
            {/* Medusa Order Events */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-4">
              <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">E-commerce Order Events</Heading>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Order Placed (`order.placed`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates Tax Invoice, embeds Paystack QR payment link for unpaid balances, and dispatches to customer.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_order_placed_enabled}
                  onCheckedChange={(v) => updateSettingField("event_order_placed_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Payment Captured (`payment.captured`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates official Payment Receipt and delivers download link to customer.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_payment_captured_enabled}
                  onCheckedChange={(v) => updateSettingField("event_payment_captured_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Order Completed (`order.completed`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates Packing Slip and final delivery documents.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_order_completed_enabled}
                  onCheckedChange={(v) => updateSettingField("event_order_completed_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-semibold text-sm">Fulfillment Created (`order.fulfillment_created`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates Packing Slip for fulfillment staff and warehouse tracking.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_order_fulfillment_enabled}
                  onCheckedChange={(v) => updateSettingField("event_order_fulfillment_enabled", v)}
                />
              </div>
            </div>

            {/* Repairshop Events */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-4">
              <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">Repair Plugin Events</Heading>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Repair Status Changed (`repair.status_changed`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates updated repair invoice or quote with device details and payment link.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_repair_status_changed_enabled}
                  onCheckedChange={(v) => updateSettingField("event_repair_status_changed_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Compliance Requested (`repair.ticket.compliance_requested`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates Quotation and sends approval link to customer.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_repair_compliance_enabled}
                  onCheckedChange={(v) => updateSettingField("event_repair_compliance_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Repair Created (`repair.created`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Generates initial Job Card / Estimate when a new repair ticket is filed.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_repair_created_enabled}
                  onCheckedChange={(v) => updateSettingField("event_repair_created_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Repair Completed (`repair.completed`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Generates final repair invoice with breakdown of parts and labor charges.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_repair_completed_enabled}
                  onCheckedChange={(v) => updateSettingField("event_repair_completed_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-semibold text-sm">Customer Reminder (`repair.customer_reminder`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Nudges customer with short document link and outstanding balance reminder.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_repair_reminder_enabled}
                  onCheckedChange={(v) => updateSettingField("event_repair_reminder_enabled", v)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={saveSettings} isLoading={isSaving}>
              Save Automations
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: SETTINGS & ZOHO INTEGRATION                       */}
      {/* ========================================================= */}
      {activeTab === "settings" && (
        <div className="p-6 max-w-4xl flex flex-col gap-8">
          {/* General Company & Branding */}
          <div className="flex flex-col gap-4">
            <Heading level="h2" className="text-base font-semibold">General Branding & Details</Heading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Company Name</Label>
                <Input
                  value={settings.company_name}
                  onChange={(e) => updateSettingField("company_name", e.target.value)}
                  placeholder="Urban Device Care Ltd"
                  size="small"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Storefront URL</Label>
                <Input
                  value={settings.storefront_url}
                  onChange={(e) => updateSettingField("storefront_url", e.target.value)}
                  placeholder="https://store.example.com"
                  size="small"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Logo URL</Label>
                <Input
                  value={settings.pdf_logo_url}
                  onChange={(e) => updateSettingField("pdf_logo_url", e.target.value)}
                  placeholder="https://example.com/logo.png"
                  size="small"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Phone Numbers</Label>
                <Input
                  value={settings.pdf_phone}
                  onChange={(e) => updateSettingField("pdf_phone", e.target.value)}
                  placeholder="+44 20 7946 0991"
                  size="small"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Support Email</Label>
                <Input
                  value={settings.pdf_email}
                  onChange={(e) => updateSettingField("pdf_email", e.target.value)}
                  placeholder="support@example.com"
                  size="small"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Website</Label>
                <Input
                  value={settings.pdf_website}
                  onChange={(e) => updateSettingField("pdf_website", e.target.value)}
                  placeholder="www.example.com"
                  size="small"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs font-medium">Address</Label>
                <Input
                  value={settings.pdf_address}
                  onChange={(e) => updateSettingField("pdf_address", e.target.value)}
                  placeholder="123 High Street, Tech Park, London"
                  size="small"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs font-medium">Payment Instructions / Bank Details</Label>
                <Textarea
                  value={settings.pdf_payment_details}
                  onChange={(e) => updateSettingField("pdf_payment_details", e.target.value)}
                  placeholder="Bank: Barclays | Acct: 12345678 | MPESA Till: 123456"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs font-medium">Default Terms & Conditions</Label>
                <Textarea
                  value={settings.pdf_terms}
                  onChange={(e) => updateSettingField("pdf_terms", e.target.value)}
                  placeholder="All items come with 90-day warranty. Invoices payable within 14 days."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="border-b border-ui-border-base" />

          {/* Multi-Channel Notification Switches */}
          <div className="flex flex-col gap-4">
            <Heading level="h2" className="text-base font-semibold">Notification Channels</Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Toggle which channels are active for auto-delivering document notifications.
            </Text>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between p-3 border border-ui-border-base rounded-lg bg-ui-bg-base">
                <div>
                  <Label className="font-semibold text-sm">Email Channel</Label>
                  <Text className="text-xs text-ui-fg-subtle">Deliver HTML documents and payment buttons via Email.</Text>
                </div>
                <Switch
                  checked={settings.email_notifications_enabled}
                  onCheckedChange={(v) => updateSettingField("email_notifications_enabled", v)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-ui-border-base rounded-lg bg-ui-bg-base">
                <div>
                  <Label className="font-semibold text-sm">SMS Channel</Label>
                  <Text className="text-xs text-ui-fg-subtle">Send concise texts with shortlinks via SMS provider.</Text>
                </div>
                <Switch
                  checked={settings.sms_notifications_enabled}
                  onCheckedChange={(v) => updateSettingField("sms_notifications_enabled", v)}
                />
              </div>
              <div className="flex items-center justify-between p-3 border border-ui-border-base rounded-lg bg-ui-bg-base">
                <div>
                  <Label className="font-semibold text-sm">WhatsApp Channel</Label>
                  <Text className="text-xs text-ui-fg-subtle">Send formatted message with shortlinks via WhatsApp provider.</Text>
                </div>
                <Switch
                  checked={settings.whatsapp_notifications_enabled}
                  onCheckedChange={(v) => updateSettingField("whatsapp_notifications_enabled", v)}
                />
              </div>
            </div>
          </div>

          <div className="border-b border-ui-border-base" />

          {/* Zoho Books Integration */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Heading level="h2" className="text-base font-semibold">Zoho Books Integration</Heading>
                <Text className="text-xs text-ui-fg-subtle">
                  Sync invoices and estimates with your official Zoho Books accounting account.
                </Text>
              </div>
              <Switch
                checked={settings.zoho_books_enabled}
                onCheckedChange={(v) => updateSettingField("zoho_books_enabled", v)}
              />
            </div>

            {settings.zoho_books_enabled && (
              <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-subtle flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-medium">Zoho Data Center Domain</Label>
                    <Select
                      value={settings.zoho_domain || "com"}
                      onValueChange={(v) => updateSettingField("zoho_domain", v)}
                    >
                      <Select.Trigger size="small">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="com">.com (Global / US)</Select.Item>
                        <Select.Item value="eu">.eu (Europe)</Select.Item>
                        <Select.Item value="in">.in (India)</Select.Item>
                        <Select.Item value="com.au">.com.au (Australia)</Select.Item>
                        <Select.Item value="jp">.jp (Japan)</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Organization ID</Label>
                    <Input
                      value={settings.zoho_organization_id}
                      onChange={(e) => updateSettingField("zoho_organization_id", e.target.value)}
                      placeholder="e.g. 12345678"
                      size="small"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Client ID</Label>
                    <Input
                      value={settings.zoho_client_id}
                      onChange={(e) => updateSettingField("zoho_client_id", e.target.value)}
                      placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXX"
                      size="small"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Client Secret</Label>
                    <Input
                      type="password"
                      value={settings.zoho_client_secret}
                      onChange={(e) => updateSettingField("zoho_client_secret", e.target.value)}
                      placeholder="Enter Client Secret"
                      size="small"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs font-medium">Refresh Token</Label>
                    <Input
                      type="password"
                      value={settings.zoho_refresh_token}
                      onChange={(e) => updateSettingField("zoho_refresh_token", e.target.value)}
                      placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXX"
                      size="small"
                    />
                  </div>
                </div>

                {/* Exposed Zoho Customizations */}
                <div className="pt-4 border-t border-ui-border-base flex flex-col gap-4">
                  <Heading level="h3" className="text-sm font-semibold text-ui-fg-base">
                    Exposed Zoho Invoice Customizations
                  </Heading>
                  <Text className="text-xs text-ui-fg-subtle">
                    Configure invoice options directly here without needing to log in to Zoho Books.
                  </Text>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-medium">Invoice Number Prefix</Label>
                      <Input
                        value={settings.zoho_invoice_prefix}
                        onChange={(e) => updateSettingField("zoho_invoice_prefix", e.target.value)}
                        placeholder="INV-"
                        size="small"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Payment Due Terms (Days)</Label>
                      <Select
                        value={String(settings.zoho_payment_terms_days || 0)}
                        onValueChange={(v) => updateSettingField("zoho_payment_terms_days", Number(v))}
                      >
                        <Select.Trigger size="small">
                          <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                          <Select.Item value="0">Due on Receipt (Net 0)</Select.Item>
                          <Select.Item value="7">Net 7 Days</Select.Item>
                          <Select.Item value="15">Net 15 Days</Select.Item>
                          <Select.Item value="30">Net 30 Days</Select.Item>
                          <Select.Item value="60">Net 60 Days</Select.Item>
                        </Select.Content>
                      </Select>
                    </div>
                    <div className="md:col-span-2 flex items-center justify-between p-3 border border-ui-border-base rounded bg-ui-bg-base">
                      <div>
                        <Label className="text-xs font-medium">Embed Payment QR Code on Zoho Invoices</Label>
                        <Text className="text-[11px] text-ui-fg-subtle">Automatically generate & embed Paystack scan-to-pay QR code on Zoho invoice PDFs.</Text>
                      </div>
                      <Switch
                        checked={settings.zoho_include_payment_qr !== false}
                        onCheckedChange={(v) => updateSettingField("zoho_include_payment_qr", v)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Custom Field Name for Payment Link (Optional)</Label>
                      <Input
                        value={settings.zoho_custom_field_payment_link || ""}
                        onChange={(e) => updateSettingField("zoho_custom_field_payment_link", e.target.value)}
                        placeholder="Payment Link"
                        size="small"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-ui-border-base rounded bg-ui-bg-base">
                      <div>
                        <Label className="text-xs font-medium">Tax Inclusive Treatment</Label>
                        <Text className="text-[11px] text-ui-fg-subtle">Include taxes in unit prices on Zoho line items.</Text>
                      </div>
                      <Switch
                        checked={settings.zoho_tax_inclusive}
                        onCheckedChange={(v) => updateSettingField("zoho_tax_inclusive", v)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs font-medium">Default Zoho Customer Notes</Label>
                      <Textarea
                        value={settings.zoho_invoice_notes}
                        onChange={(e) => updateSettingField("zoho_invoice_notes", e.target.value)}
                        placeholder="Thank you for your business. Please retain this invoice for your records."
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs font-medium">Default Zoho Invoice Terms & Conditions</Label>
                      <Textarea
                        value={settings.zoho_invoice_terms}
                        onChange={(e) => updateSettingField("zoho_invoice_terms", e.target.value)}
                        placeholder="Terms & Conditions printed on all Zoho Invoices."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={saveSettings} isLoading={isSaving}>
              Save All Settings
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CREATE MANUAL INVOICE                           */}
      {/* ========================================================= */}
      {manualModalOpen && (
        <FocusModal open={manualModalOpen} onOpenChange={setManualModalOpen}>
          <FocusModal.Content>
            <FocusModal.Header>
              <Heading level="h2">Create Manual Invoice / Document</Heading>
            </FocusModal.Header>
            <FocusModal.Body className="p-6 flex flex-col gap-6 max-w-2xl mx-auto overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Document Type</Label>
                  <Select
                    value={manualForm.type}
                    onValueChange={(v) => setManualForm({ ...manualForm, type: v })}
                  >
                    <Select.Trigger size="small"><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="invoice">Tax Invoice</Select.Item>
                      <Select.Item value="estimate">Estimate / Quote</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Document Title</Label>
                  <Input
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    value={manualForm.customer_name}
                    onChange={(e) => setManualForm({ ...manualForm, customer_name: e.target.value })}
                    placeholder="Customer Name"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Email</Label>
                  <Input
                    value={manualForm.customer_email}
                    onChange={(e) => setManualForm({ ...manualForm, customer_email: e.target.value })}
                    placeholder="customer@example.com"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Phone</Label>
                  <Input
                    value={manualForm.customer_phone}
                    onChange={(e) => setManualForm({ ...manualForm, customer_phone: e.target.value })}
                    placeholder="+44 7911 123456"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Generation Source</Label>
                  <Select
                    value={manualForm.force_source}
                    onValueChange={(v) => setManualForm({ ...manualForm, force_source: v })}
                  >
                    <Select.Trigger size="small"><Select.Value /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="auto">Auto (Zoho if enabled, else PDFKit)</Select.Item>
                      <Select.Item value="zoho">Force Zoho Books</Select.Item>
                      <Select.Item value="pdfkit">Force Local PDFKit</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <Label className="text-xs font-semibold">Line Items</Label>
                {manualForm.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center mt-2">
                    <Input
                      placeholder="Item Title"
                      value={item.title}
                      onChange={(e) => {
                        const updated = [...manualForm.items];
                        updated[idx].title = e.target.value;
                        setManualForm({ ...manualForm, items: updated });
                      }}
                      size="small"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...manualForm.items];
                        updated[idx].quantity = Number(e.target.value);
                        setManualForm({ ...manualForm, items: updated });
                      }}
                      size="small"
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder="Rate"
                      value={item.unit_price}
                      onChange={(e) => {
                        const updated = [...manualForm.items];
                        updated[idx].unit_price = Number(e.target.value);
                        setManualForm({ ...manualForm, items: updated });
                      }}
                      size="small"
                      className="w-24"
                    />
                  </div>
                ))}
                <Button
                  variant="transparent"
                  size="small"
                  className="mt-2 text-xs"
                  onClick={() => setManualForm({
                    ...manualForm,
                    items: [...manualForm.items, { title: "", description: "", quantity: 1, unit_price: 0 }],
                  })}
                >
                  + Add Line Item
                </Button>
              </div>

              <div>
                <Label className="text-xs">Notes / Special Instructions</Label>
                <Textarea
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  placeholder="Notes printed on document..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-ui-border-base rounded bg-ui-bg-subtle">
                <div>
                  <Label className="text-xs font-semibold">Auto-Send to Recipient</Label>
                  <Text className="text-[11px] text-ui-fg-subtle">Send immediately via active notification channels.</Text>
                </div>
                <Switch
                  checked={manualForm.auto_send}
                  onCheckedChange={(v) => setManualForm({ ...manualForm, auto_send: v })}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setManualModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleCreateManual}>Generate Document</Button>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CREATE CUSTOM DOCUMENT & EMAIL DIRECTLY         */}
      {/* ========================================================= */}
      {customDocModalOpen && (
        <FocusModal open={customDocModalOpen} onOpenChange={setCustomDocModalOpen}>
          <FocusModal.Content>
            <FocusModal.Header>
              <Heading level="h2">Create Custom Document & Send Email</Heading>
            </FocusModal.Header>
            <FocusModal.Body className="p-6 flex flex-col gap-6 max-w-2xl mx-auto overflow-y-auto max-h-[80vh]">
              <Text className="text-xs text-ui-fg-subtle">
                Create a customized document (e.g. Warranty Certificate, Service Contract, Proforma Invoice) and directly dispatch via email.
              </Text>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Document Title</Label>
                  <Input
                    value={customDocForm.title}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, title: e.target.value })}
                    placeholder="e.g. Warranty Certificate / Work Order"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    value={customDocForm.customer_name}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, customer_name: e.target.value })}
                    placeholder="Recipient Name"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Email</Label>
                  <Input
                    value={customDocForm.customer_email}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, customer_email: e.target.value })}
                    placeholder="recipient@example.com"
                    size="small"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Document Body / Certificate Details</Label>
                <Textarea
                  value={customDocForm.body_text}
                  onChange={(e) => setCustomDocForm({ ...customDocForm, body_text: e.target.value })}
                  placeholder="Enter the main body text or terms to appear on this document..."
                  rows={4}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Email Subject</Label>
                <Input
                  value={customDocForm.email_subject}
                  onChange={(e) => setCustomDocForm({ ...customDocForm, email_subject: e.target.value })}
                  placeholder="Email Subject"
                  size="small"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-ui-border-base rounded bg-ui-bg-subtle">
                <div>
                  <Label className="text-xs font-semibold">Send via Email Immediately</Label>
                  <Text className="text-[11px] text-ui-fg-subtle">Dispatches document PDF link and message via Medusa notification provider.</Text>
                </div>
                <Switch
                  checked={customDocForm.send_email_now}
                  onCheckedChange={(v) => setCustomDocForm({ ...customDocForm, send_email_now: v })}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setCustomDocModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleCreateCustomDoc}>Generate & Deliver</Button>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: MANUAL NOTIFICATION DISPATCH                    */}
      {/* ========================================================= */}
      {sendModalOpen && selectedDoc && (
        <FocusModal open={sendModalOpen} onOpenChange={setSendModalOpen}>
          <FocusModal.Content>
            <FocusModal.Header>
              <Heading level="h2">Dispatch Document Notification</Heading>
            </FocusModal.Header>
            <FocusModal.Body className="p-6 flex flex-col gap-5 max-w-lg mx-auto">
              <div>
                <Text className="text-sm font-semibold">{selectedDoc.title} #{selectedDoc.display_id}</Text>
                <Text className="text-xs text-ui-fg-subtle">
                  Recipient: {selectedDoc.customer_name} ({selectedDoc.customer_email || selectedDoc.customer_phone || "No contact info"})
                </Text>
              </div>

              <div>
                <Label className="text-xs font-medium">Select Channels</Label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sendForm.channels.includes("email")}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...sendForm.channels, "email"]
                          : sendForm.channels.filter((c) => c !== "email");
                        setSendForm({ ...sendForm, channels: next });
                      }}
                    />
                    Email
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sendForm.channels.includes("sms")}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...sendForm.channels, "sms"]
                          : sendForm.channels.filter((c) => c !== "sms");
                        setSendForm({ ...sendForm, channels: next });
                      }}
                    />
                    SMS
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={sendForm.channels.includes("whatsapp")}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...sendForm.channels, "whatsapp"]
                          : sendForm.channels.filter((c) => c !== "whatsapp");
                        setSendForm({ ...sendForm, channels: next });
                      }}
                    />
                    WhatsApp
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Custom Email / Text Message (Optional)</Label>
                <Textarea
                  value={sendForm.custom_message}
                  onChange={(e) => setSendForm({ ...sendForm, custom_message: e.target.value })}
                  placeholder="Add a personalized message to the notification..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={() => setSendModalOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={handleSendNotification}>Dispatch Now</Button>
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}
    </Container>
  );
};

export const config = defineRouteConfig({
  label: "Documents",
  icon: DocumentText,
});

export default DocumentsPage;
