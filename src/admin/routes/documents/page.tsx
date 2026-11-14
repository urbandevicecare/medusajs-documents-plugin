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
  Tooltip,
  IconButton,
  DropdownMenu,
} from "@medusajs/ui";
import React, { useEffect, useState, useMemo, useRef, useCallback, Fragment } from "react";
import {
  DocumentText,
  ArrowPath,
  Plus,
  ArrowDownTray,
  Envelope,
  CogSixTooth,
  Sparkles,
  Trash,
  ChevronDown,
  ChevronRight,
  PencilSquare,
  MagnifyingGlass,
  XMark,
  User,
} from "@medusajs/icons";
import {
  groupDocuments,
  DocumentRecord as BaseDocumentRecord,
  DocumentGroup,
  formatCurrency,
} from "../../../utils/document-grouper";


interface CustomDocPreset {
  id: string;
  name: string;
  icon: string;
  badge: string;
  title: string;
  subject: string;
  body_text: string;
  items: Array<{ title: string; description: string; quantity: number; unit_price: number }>;
  custom_fields?: Record<string, string>;
  notes?: string;
}

const CUSTOM_DOC_PRESETS: CustomDocPreset[] = [
  {
    id: "warranty",
    name: "Warranty Certificate",
    icon: "🛡️",
    badge: "90-Day Coverage",
    title: "Warranty Certificate",
    subject: "Your Official Warranty Certificate - Urban Device Care",
    body_text: `This official Warranty Certificate certifies that the serviced hardware specified below has undergone complete technical overhaul, component replacement, and bench testing in accordance with manufacturer specifications.\n\nAll genuine replacement components and associated technical workshop labor are guaranteed against functional defects for a period of 90 days from the date of issue. Urban Device Care warrants that all installed modules have passed rigorous electrical load and multi-point quality assurance protocols.`,
    items: [
      { title: "OEM Screen Assembly & Digitizer Replacement", description: "90-Day Comprehensive Warranty Coverage against touch and display anomalies", quantity: 1, unit_price: 0 },
      { title: "Internal Power Management & Battery Calibration", description: "Warranty against capacity degradation and voltage fluctuations", quantity: 1, unit_price: 0 },
      { title: "Clean-Room Workshop Installation & Bench Clearance", description: "Certified labor coverage and water/dust ingress seal integrity", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "Apple iPhone 15 Pro Max (256GB - Natural Titanium)",
      "Serial / IMEI": "F2LZ90K8MD6R",
      "Ticket Reference": "RT-2024-8841",
      "Technician": "Bonifencia A. (Lead Certified Engineer)",
      "Coverage Period": "90 Days from Date of Collection",
      "Warranty Status": "Active & Validated",
    },
    notes: "Warranty excludes accidental damage, liquid ingress, unauthorized third-party tampering, or software jailbreaking. Please retain this document and quote your ticket reference number for any warranty claims.",
  },
  {
    id: "service_completion",
    name: "Service Completion Certificate",
    icon: "📜",
    badge: "QC Cleared",
    title: "Certificate of Service Completion",
    subject: "Certificate of Service Completion & Quality Sign-Off",
    body_text: `This Certificate of Service Completion verifies that all diagnostic, repair, and maintenance procedures authorized under the referenced work order have been satisfactorily executed in full adherence to ISO/IPC hardware rework standards.\n\nThe equipment has successfully cleared all pre-delivery functional verifications, thermal load evaluations, and electrical safety diagnostics, and is officially released as fully operational.`,
    items: [
      { title: "Hardware Overhaul & Micro-Soldering Service", description: "Replaced degraded SMD power filtering capacitors and restored logic board rails", quantity: 1, unit_price: 0 },
      { title: "Firmware Diagnostics & Peripheral Bench Testing", description: "100% operational clearance on audio codecs, cameras, biometric sensors, and radios", quantity: 1, unit_price: 0 },
      { title: "Acoustic Chamber & Thermal Stress Verification", description: "Pass: Maximum load temperature maintained within normal threshold (38°C)", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "MacBook Pro 16-inch (M2 Max - Space Grey)",
      "Serial / IMEI": "C02G8027MD6T",
      "Ticket Reference": "RT-2024-9104",
      "Technician": "Bonifencia A. (Lead Certified Engineer)",
      "Quality Control Inspector": "Kevin M. (Senior QA Specialist)",
      "Final Testing Result": "PASSED - All Benchmarks Satisfied",
    },
    notes: "All original customer data was preserved intact. Device firmware updated to current stable release. The client has 7 days from collection to report any cosmetic or configuration discrepancies.",
  },
  {
    id: "destruction",
    name: "Certificate of Destruction & Disposal",
    icon: "♻️",
    badge: "Eco & Compliance",
    title: "Certificate of Destruction & Eco-Disposal",
    subject: "Certificate of Secure Hardware Destruction & Eco-Disposal",
    body_text: `This Certificate of Destruction legally certifies that the decommissioned computing equipment and electronic media detailed herein have been securely and irrevocably destroyed in compliance with NIST SP 800-88 Rev. 1 guidelines and WEEE environmental disposal regulations.\n\nAll storage media have undergone physical de-manufacturing, mechanical shredding, and complete demagnetization, ensuring zero residual data retrievability. Non-hazardous materials have been transferred to certified green-reclamation facilities.`,
    items: [
      { title: "Physical Demanufacturing & High-Torque Shredding", description: "Particle size reduced below DIN 66399 Level H-5 security standards", quantity: 1, unit_price: 0 },
      { title: "Certified NIST 800-88 Cryptographic & Magnetic Sanitization", description: "Complete data eradication across all solid-state and magnetic platters", quantity: 1, unit_price: 0 },
      { title: "Hazardous Materials & Lithium Battery Eco-Reclamation", description: "Zero-landfill certified chemical neutralization and precious metal recovery", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "Dell PowerEdge R740 Server / 4x 1.92TB NVMe",
      "Serial / IMEI": "SN-DELL-882194-X",
      "Ticket Reference": "RT-2024-7712",
      "Destruction Method": "Physical Shear Shredding & Degaussing",
      "Compliance Standard": "NIST SP 800-88 Rev. 1 & WEEE Directive",
      "Authorized Disposal Officer": "Bonifencia A. (Certified Waste Handler)",
    },
    notes: "Urban Device Care Ltd indemnifies the client against data breach liabilities originating from the specified serialized assets following the verified execution of destruction protocols.",
  },
  {
    id: "diagnostic",
    name: "Diagnostic & Inspection Report",
    icon: "🔍",
    badge: "Hardware Findings",
    title: "Diagnostic & Hardware Inspection Report",
    subject: "Device Diagnostic & Inspection Findings - Urban Device Care",
    body_text: `Our certified repair specialists have concluded an in-depth hardware, firmware, and electrical diagnostic examination of your device. The comprehensive technical findings, voltage line readings, and component health metrics are detailed below alongside our certified remediation roadmap.`,
    items: [
      { title: "Logic Board Primary Power Rail Diagnostic", description: "PP_VDD_MAIN measured at 3.82V (Nominal). No ground short-circuits detected on primary PMIC", quantity: 1, unit_price: 0 },
      { title: "Display Digitizer & Touch Array Profiling", description: "Matrix micro-fracture identified in bottom-left corner causing erratic capacitive touch feedback", quantity: 1, unit_price: 0 },
      { title: "Battery Health & Internal Impedance Evaluation", description: "Current capacity: 74% of design capacity (842 cycles). Service battery recommended", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "Samsung Galaxy S23 Ultra (512GB - Phantom Black)",
      "Serial / IMEI": "358941092847120",
      "Ticket Reference": "RT-2024-6523",
      "Technician": "Bonifencia A. (Lead Certified Engineer)",
      "Diagnostic Verdict": "Component Replacement Feasible",
      "Estimated Labor Time": "2.5 Workshop Hours",
    },
    notes: "Diagnostic findings remain valid for 14 calendar days. Internal safety seals have been inspected and logged.",
  },
  {
    id: "handover",
    name: "Equipment Handover & Release",
    icon: "🤝",
    badge: "Custody Form",
    title: "Equipment Handover & Custody Release Agreement",
    subject: "Equipment Handover & Custody Release Form",
    body_text: `This Handover Agreement legally documents the transfer of custody of the repaired equipment and accessories listed below from Urban Device Care to the client or authorized corporate representative.\n\nThe recipient confirms that the device has been inspected, tested in their presence (including display, camera, audio, and network connectivity), and accepted in verified good working condition.`,
    items: [
      { title: "Primary Computing Device Release", description: "Serial verified, cosmetic inspection performed, customer account signed in", quantity: 1, unit_price: 0 },
      { title: "OEM 96W USB-C Power Adapter & Braided Cable", description: "Tested and verified delivering 20V/4.8A under load", quantity: 1, unit_price: 0 },
      { title: "Protective Hard Case & Accessories", description: "Returned in clean, intact custody state", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "Lenovo ThinkPad X1 Carbon Gen 10",
      "Serial / IMEI": "PF-29X810-22",
      "Ticket Reference": "RT-2024-5390",
      "Released By": "Bonifencia A. (Urban Device Care)",
      "Received By": "Authorized Client Representative",
      "Handover Condition": "Inspected & Approved in Workshop",
    },
    notes: "By accepting handover, the client acknowledges satisfactory return of all custody items and confirms device operability.",
  },
  {
    id: "trade_in",
    name: "Device Trade-In Agreement",
    icon: "🔄",
    badge: "Trade-In & Transfer",
    title: "Device Trade-In & Buyback Agreement",
    subject: "Device Trade-In & Buyback Agreement - Urban Device Care",
    body_text: `This Agreement formalizes the title transfer, functional evaluation, and agreed trade-in credit valuation for the customer-owned equipment listed below.\n\nThe seller warrants that they are the sole lawful owner of the equipment, that it is free of all liens, financial encumbrances, iCloud/Google activation locks, and corporate MDM profiles. Urban Device Care agrees to apply the confirmed credit towards service fees or disbursement.`,
    items: [
      { title: "Trade-In Device Valuation Allowance (Grade A)", description: "Full functional clearance: battery health 91%, minor bezel wear, pristine screen", quantity: 1, unit_price: 35000 },
      { title: "NIST 800-88 Cryptographic Data Sanitation Protocol", description: "Certified factory reset and firmware wipe with zero data retention guarantee", quantity: 1, unit_price: 0 },
    ],
    custom_fields: {
      "Device Model": "Apple iPhone 13 Pro (128GB - Sierra Blue)",
      "Serial / IMEI": "G6TD9021ML8R",
      "Ticket Reference": "RT-2024-3829",
      "Activation Lock": "Removed & Verified Off",
      "Assessed Grade": "Grade A (Excellent)",
      "Evaluation Specialist": "Bonifencia A.",
    },
    notes: "Ownership transfers immediately upon document execution. Valuation is binding and irrevocable once trade-in payout or store credit is issued.",
  },
];

interface DocumentRecord extends BaseDocumentRecord {}

export { formatCurrency };

interface CustomerCandidate {
  id: string;
  name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  source: "customer" | "repair" | "document";
  source_label: string;
}

interface CustomerAutofillComboboxProps {
  candidates: CustomerCandidate[];
  loading?: boolean;
  onSelectCustomer: (candidate: CustomerCandidate) => void;
  label?: string;
}

const CustomerAutofillCombobox: React.FC<CustomerAutofillComboboxProps> = ({
  candidates,
  loading = false,
  onSelectCustomer,
  label = "Quick Autofill Customer Details",
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [autofilledNotice, setAutofilledNotice] = useState<string | null>(null);
  const [remoteCandidates, setRemoteCandidates] = useState<CustomerCandidate[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced live query to /admin/customers when typing >= 2 characters
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemoteCandidates([]);
      setIsSearchingRemote(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingRemote(true);
      try {
        const res = await fetch(`/admin/customers?q=${encodeURIComponent(q)}&fields=*addresses&limit=25`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.customers && Array.isArray(data.customers)) {
            const mapped: CustomerCandidate[] = data.customers.map((c: any) => {
              const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
              const addr = c.addresses?.[0] || c.default_billing_address || c.billing_address;
              const formattedAddr = addr
                ? [addr.address_1, addr.address_2, addr.city, addr.postal_code, addr.province, addr.country_code?.toUpperCase()].filter(Boolean).join(", ")
                : "";
              const company = c.company_name || addr?.company || c.metadata?.company_name || "";
              const name = fullName || company || c.email || "Customer";
              return {
                id: `remote-${c.id}`,
                name,
                company_name: company,
                email: c.email || "",
                phone: c.phone || addr?.phone || "",
                address: formattedAddr,
                source: "customer" as const,
                source_label: "Medusa Customer (Live)",
              };
            });
            setRemoteCandidates(mapped);
          }
        }
      } catch (e) {
        // ignore live search network errors
      } finally {
        setIsSearchingRemote(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Aggregate local + remote candidates
  const allCandidates = useMemo(() => {
    if (remoteCandidates.length === 0) return candidates;
    const map = new Map<string, CustomerCandidate>();
    for (const c of candidates) {
      const key = (c.email?.toLowerCase()) || (c.phone?.replace(/\s+/g, "")) || `${c.name.toLowerCase()}::${c.company_name.toLowerCase()}`;
      if (key) map.set(key, c);
    }
    for (const c of remoteCandidates) {
      const key = (c.email?.toLowerCase()) || (c.phone?.replace(/\s+/g, "")) || `${c.name.toLowerCase()}::${c.company_name.toLowerCase()}`;
      if (key) {
        if (!map.has(key)) {
          map.set(key, c);
        } else {
          const existing = map.get(key)!;
          if (!existing.address && c.address) existing.address = c.address;
          if (!existing.company_name && c.company_name) existing.company_name = c.company_name;
        }
      }
    }
    return Array.from(map.values());
  }, [candidates, remoteCandidates]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allCandidates.slice(0, 10);
    }
    const cleanQ = q.replace(/\s+/g, "");
    const digitsOnlyQ = cleanQ.replace(/\D/g, "");

    return allCandidates.filter((c) => {
      const name = c.name.toLowerCase();
      const company = c.company_name.toLowerCase();
      const email = c.email.toLowerCase();
      const phone = c.phone.replace(/\s+/g, "").toLowerCase();
      const digitsOnlyPhone = phone.replace(/\D/g, "");
      const addr = c.address.toLowerCase();
      const src = c.source_label.toLowerCase();

      const phoneMatches =
        phone.includes(cleanQ) ||
        (digitsOnlyQ.length >= 4 && (digitsOnlyPhone.includes(digitsOnlyQ) || digitsOnlyQ.includes(digitsOnlyPhone)));

      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phoneMatches ||
        addr.includes(q) ||
        src.includes(q)
      );
    }).slice(0, 20);
  }, [allCandidates, query]);

  const handleSelect = (candidate: CustomerCandidate) => {
    onSelectCustomer(candidate);
    const displayName = candidate.company_name
      ? `${candidate.name} (${candidate.company_name})`
      : candidate.name;
    setAutofilledNotice(`✓ Autofilled: ${displayName}`);
    setQuery("");
    setIsOpen(false);
    setTimeout(() => {
      setAutofilledNotice(null);
    }, 4000);
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 p-3 rounded-lg bg-ui-bg-subtle border border-ui-border-base">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold flex items-center gap-1.5 text-ui-fg-base">
          <Sparkles className="w-3.5 h-3.5 text-ui-fg-interactive" />
          {label}
        </Label>
        {autofilledNotice && (
          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200">
            {autofilledNotice}
          </span>
        )}
      </div>
      <Text className="text-[11px] text-ui-fg-subtle">
        Search existing customer records, repair tickets, or recent documents in Medusa to automatically populate customer fields.
      </Text>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-ui-fg-muted">
          <MagnifyingGlass className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          placeholder="Type name, company, email, phone, or ticket # to search & autofill..."
          className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-ui-bg-base border border-ui-border-base rounded-md text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-1 focus:ring-ui-border-interactive focus:border-ui-border-interactive"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-ui-fg-muted hover:text-ui-fg-base"
          >
            <XMark className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-ui-bg-base border border-ui-border-base rounded-md shadow-lg max-h-64 overflow-y-auto divide-y divide-ui-border-base">
          {loading || isSearchingRemote ? (
            <div className="p-3 text-xs text-ui-fg-muted text-center flex items-center justify-center gap-2">
              <ArrowPath className="w-3 h-3 animate-spin" />
              Searching customer records...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="p-3 text-xs text-ui-fg-muted text-center">
              No matching customer records found
            </div>
          ) : (
            filteredCandidates.map((c) => {
              const badgeColor =
                c.source === "customer"
                  ? "blue"
                  : c.source === "repair"
                  ? "orange"
                  : "green";
              return (
                <div
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="p-2.5 hover:bg-ui-bg-subtle-hover cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-semibold text-xs text-ui-fg-base truncate">
                        {c.name}
                      </span>
                      {c.company_name && c.company_name !== c.name && (
                        <span className="text-[11px] text-ui-fg-muted truncate">
                          ({c.company_name})
                        </span>
                      )}
                    </div>
                    <Badge size="small" color={badgeColor} className="shrink-0 text-[10px]">
                      {c.source_label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-ui-fg-subtle truncate">
                    {c.email && <span className="truncate">📧 {c.email}</span>}
                    {c.phone && <span className="truncate">📞 {c.phone}</span>}
                    {c.address && <span className="truncate max-w-[200px]">📍 {c.address}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface RepairTicketComboboxProps {
  tickets: any[];
  selectedTicketId: string;
  onSelectTicket: (ticketId: string) => void;
  onClear: () => void;
  loading?: boolean;
}

const RepairTicketCombobox: React.FC<RepairTicketComboboxProps> = ({
  tickets,
  selectedTicketId,
  onSelectTicket,
  onClear,
  loading = false,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getTicketLabel = (t: any): string => {
    const cleanNum = String(t.ticket_number || t.id).replace(/^(RT-|JOB-|CERT-)+/i, "");
    const displayRef = `RT-${cleanNum}`;
    const custName =
      t.customer?.company_name ||
      t.company_name ||
      t.customer_name ||
      (t.customer?.first_name ? `${t.customer.first_name} ${t.customer.last_name || ""}`.trim() : "") ||
      "Customer";
    const brandModel = [t.device?.brand, t.device?.model_name]
      .filter(Boolean)
      .join(" ")
      .trim() || t.custom_fields?.["Device Model"] || "Device";
    return `${displayRef} — ${custName} (${brandModel})`;
  };

  useEffect(() => {
    if (!selectedTicketId) {
      setQuery("");
      return;
    }
    const t = tickets.find((item) => item.id === selectedTicketId || item.ticket_number === selectedTicketId);
    if (t) {
      setQuery(getTicketLabel(t));
    }
  }, [selectedTicketId, tickets]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cleanQ = q.replace(/^(?:(?:rt|job|cert)[-–—\s#]*|[#])/i, "").trim().toLowerCase();
    const digitsOnlyQ = cleanQ.replace(/\D/g, "");

    const selectedTicket = tickets.find((item) => item.id === selectedTicketId || item.ticket_number === selectedTicketId);
    const selectedLabel = selectedTicket ? getTicketLabel(selectedTicket).toLowerCase() : "";
    const isUnmodifiedSelection = Boolean(selectedTicket && q === selectedLabel);

    if (!q || isUnmodifiedSelection) {
      return tickets.slice(0, 30);
    }

    return tickets.filter((t) => {
      const cleanNum = String(t.ticket_number || t.id).replace(/^(RT-|JOB-|CERT-)+/i, "").toLowerCase();
      const rawNum = String(t.ticket_number || "").toLowerCase();
      const rawId = String(t.id || "").toLowerCase();
      const displayRef = `rt-${cleanNum}`;
      const custName = (
        t.customer?.name ||
        t.customer_name ||
        (t.customer?.first_name ? `${t.customer.first_name} ${t.customer.last_name || ""}`.trim() : "")
      ).toLowerCase();
      const compName = (t.customer?.company_name || t.company_name || "").toLowerCase();
      const email = (t.customer?.email || t.customer_email || "").toLowerCase();
      const phone = (t.customer?.phone || t.customer_phone || "").replace(/\s+/g, "").toLowerCase();
      const digitsOnlyPhone = phone.replace(/\D/g, "");
      const brandModel = (
        [t.device?.brand, t.device?.model_name].filter(Boolean).join(" ") ||
        t.custom_fields?.["Device Model"] ||
        ""
      ).toLowerCase();

      const phoneMatches =
        phone.includes(q.replace(/\s+/g, "")) ||
        (digitsOnlyQ.length >= 4 && (digitsOnlyPhone.includes(digitsOnlyQ) || digitsOnlyQ.includes(digitsOnlyPhone)));

      return (
        cleanNum.includes(q) ||
        (cleanQ && cleanNum.includes(cleanQ)) ||
        displayRef.includes(q) ||
        rawNum.includes(q) ||
        (cleanQ && rawNum.includes(cleanQ)) ||
        rawId.includes(q) ||
        custName.includes(q) ||
        compName.includes(q) ||
        email.includes(q) ||
        phoneMatches ||
        brandModel.includes(q)
      );
    }).slice(0, 30);
  }, [tickets, query, selectedTicketId]);

  const handleSelect = (ticket: any) => {
    onSelectTicket(ticket.id);
    setQuery(getTicketLabel(ticket));
    setIsOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-ui-fg-muted">
          <MagnifyingGlass className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          placeholder="Search by customer name, company, or ticket number (e.g. 5390 or RT-5390)..."
          className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-ui-bg-base border border-ui-border-base rounded-md text-ui-fg-base placeholder:text-ui-fg-muted focus:outline-none focus:ring-1 focus:ring-ui-border-interactive focus:border-ui-border-interactive"
        />
        {(query || selectedTicketId) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-ui-fg-muted hover:text-ui-fg-base"
            title="Clear ticket link"
          >
            <XMark className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-ui-bg-base border border-ui-border-base rounded-md shadow-lg max-h-64 overflow-y-auto divide-y divide-ui-border-base">
          {loading ? (
            <div className="p-3 text-xs text-ui-fg-muted text-center flex items-center justify-center gap-2">
              <ArrowPath className="w-3 h-3 animate-spin" />
              Loading repair tickets...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-3 text-xs text-ui-fg-muted text-center">
              No repair tickets found matching "{query}"
            </div>
          ) : (
            filteredTickets.map((t) => {
              const cleanNum = String(t.ticket_number || t.id).replace(/^(RT-|JOB-|CERT-)+/i, "");
              const displayRef = `RT-${cleanNum}`;
              const custName =
                t.customer?.company_name ||
                t.company_name ||
                t.customer_name ||
                (t.customer?.first_name ? `${t.customer.first_name} ${t.customer.last_name || ""}`.trim() : "") ||
                "Customer";
              const compName = t.customer?.company_name || t.company_name;
              const brandModel = [t.device?.brand, t.device?.model_name]
                .filter(Boolean)
                .join(" ")
                .trim() || t.custom_fields?.["Device Model"] || "Device";
              const isSelected = selectedTicketId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className={`p-2.5 hover:bg-ui-bg-subtle-hover cursor-pointer transition-colors ${
                    isSelected ? "bg-ui-bg-interactive-subtle" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <Badge size="small" color={isSelected ? "blue" : "grey"} className="shrink-0 font-mono">
                        {displayRef}
                      </Badge>
                      <span className="font-semibold text-xs text-ui-fg-base truncate">
                        {custName}
                      </span>
                      {compName && compName !== custName && (
                        <span className="text-[11px] text-ui-fg-muted truncate">
                          ({compName})
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ui-fg-subtle truncate shrink-0 font-medium">
                      {brandModel}
                    </span>
                  </div>
                  {(t.customer?.email || t.customer_email || t.customer?.phone || t.customer_phone) && (
                    <div className="flex items-center gap-3 text-[11px] text-ui-fg-muted truncate">
                      {(t.customer?.email || t.customer_email) && (
                        <span className="truncate">📧 {t.customer?.email || t.customer_email}</span>
                      )}
                      {(t.customer?.phone || t.customer_phone) && (
                        <span className="truncate">📞 {t.customer?.phone || t.customer_phone}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};


export const DocumentsPage = () => {
  const [activeTab, setActiveTab] = useState<"hub" | "templates" | "automations" | "settings">("hub");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("invoice");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [zohoLiveDocs, setZohoLiveDocs] = useState<any[]>([]);
  const [loadingZoho, setLoadingZoho] = useState(false);
  const [isSyncingRepairs, setIsSyncingRepairs] = useState(false);

  // Pagination & Infinite Scroll State (capped at 100 rows per batch)
  const [displayLimit, setDisplayLimit] = useState(100);
  const [totalBackendCount, setTotalBackendCount] = useState<number>(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Grouping state
  const [groupByJob, setGroupByJob] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };


  // Modals
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [customDocModalOpen, setCustomDocModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);

  // Edit Document Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);
  const [isUpdatingDoc, setIsUpdatingDoc] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    notes: string;
    terms: string;
    items: Array<{ title: string; description: string; quantity: number; unit_price: number }>;
  }>({
    title: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    notes: "",
    terms: "",
    items: [],
  });

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
    event_order_canceled_enabled: true,
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
    store_invoice_prefix: "ST-",

    // PDF Branding
    pdf_logo_url: "",
    pdf_address: "",
    pdf_phone: "",
    pdf_email: "",
    pdf_website: "",
    pdf_payment_details: "",
    pdf_terms: "",

    // Template Choices
    invoice_template: "zoho_exact",
    packing_slip_template: "modern",
    receipt_template: "zoho_exact",
    estimate_template: "zoho_exact",
    job_card_template: "standard",
    custom_doc_template: "modern",

    // Customizable Notification Templates
    email_subject_template: "",
    email_body_template: "",
    sms_body_template: "",
    whatsapp_body_template: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewStyle, setPreviewStyle] = useState("modern");
  const [previewType, setPreviewType] = useState("invoice");
  const [previewPreset, setPreviewPreset] = useState<string | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [isPreviewModalLoading, setIsPreviewModalLoading] = useState(false);
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  // Manual Invoice Form
  const [manualForm, setManualForm] = useState({
    title: "Tax Invoice",
    type: "invoice",
    company_name: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    items: [{ title: "", description: "", quantity: 1, unit_price: 0 }],
    currency_code: "kes",
    notes: "",
    force_source: "zoho",
    auto_send: false,
  });

  // Custom Document Form
  const [customDocForm, setCustomDocForm] = useState({
    preset_id: "warranty",
    title: CUSTOM_DOC_PRESETS[0].title,
    company_name: "",
    customer_name: "Jane Doe",
    customer_email: "jane.doe@example.com",
    customer_phone: "+254 712 345 678",
    customer_address: "",
    body_text: CUSTOM_DOC_PRESETS[0].body_text,
    items: CUSTOM_DOC_PRESETS[0].items.map((it) => ({ ...it })),
    custom_fields: { ...(CUSTOM_DOC_PRESETS[0].custom_fields || {}) } as Record<string, string>,
    notes: CUSTOM_DOC_PRESETS[0].notes || "",
    currency_code: "kes",
    send_email_now: true,
    email_subject: CUSTOM_DOC_PRESETS[0].subject,
  });

  const [repairTickets, setRepairTickets] = useState<any[]>([]);
  const [loadingRepairs, setLoadingRepairs] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [newCustomFieldKey, setNewCustomFieldKey] = useState<string>("");
  const [newCustomFieldValue, setNewCustomFieldValue] = useState<string>("");

  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const loadRepairTickets = async () => {
    setLoadingRepairs(true);
    try {
      const res = await fetch("/admin/repairs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.repair_tickets && Array.isArray(data.repair_tickets)) {
          setRepairTickets(data.repair_tickets);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch /admin/repairs:", e);
    } finally {
      setLoadingRepairs(false);
    }
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await fetch("/admin/customers?limit=100&fields=*addresses", { credentials: "include" });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.customers && Array.isArray(data.customers)) {
          setCustomersList(data.customers);
          return;
        }
      }
    } catch (e) {
      console.warn("Could not fetch /admin/customers:", e);
    } finally {
      setLoadingCustomers(false);
    }
  };

  useEffect(() => {
    if (customDocModalOpen || manualModalOpen) {
      loadRepairTickets();
      loadCustomers();
    }
  }, [customDocModalOpen, manualModalOpen]);

  const availableTickets = useMemo(() => {
    const map = new Map<string, any>();
    for (const t of repairTickets) {
      if (t.id) {
        const linkedCust = t.customer_id ? customersList.find((c) => c.id === t.customer_id) : null;
        const custName =
          t.customer?.name ||
          (t.customer?.first_name ? `${t.customer.first_name} ${t.customer.last_name || ""}`.trim() : "") ||
          t.customer_name ||
          t.metadata?.customer_name ||
          (linkedCust ? [linkedCust.first_name, linkedCust.last_name].filter(Boolean).join(" ").trim() : "") ||
          "";
        const compName =
          t.customer?.company_name ||
          t.company_name ||
          t.metadata?.company_name ||
          linkedCust?.company_name ||
          "";
        const email =
          t.customer?.email ||
          t.customer_email ||
          t.metadata?.customer_email ||
          linkedCust?.email ||
          "";
        const phone =
          t.customer?.phone ||
          t.customer_phone ||
          t.metadata?.customer_phone ||
          linkedCust?.phone ||
          "";
        const linkedAddr = linkedCust?.addresses?.[0];
        const formattedCustAddr = linkedAddr
          ? [linkedAddr.address_1, linkedAddr.address_2, linkedAddr.city, linkedAddr.postal_code, linkedAddr.province, linkedAddr.country_code?.toUpperCase()].filter(Boolean).join(", ")
          : "";
        const address =
          t.customer?.address ||
          t.customer_address ||
          t.metadata?.address ||
          t.custom_fields?.["Address"] ||
          formattedCustAddr ||
          "";

        map.set(t.id, {
          ...t,
          customer_name: custName || t.customer_name,
          company_name: compName || t.company_name,
          customer_email: email || t.customer_email,
          customer_phone: phone || t.customer_phone,
          customer_address: address || t.customer_address,
          customer: {
            name: custName,
            first_name: linkedCust?.first_name || t.customer?.first_name,
            last_name: linkedCust?.last_name || t.customer?.last_name,
            company_name: compName,
            email,
            phone,
            address,
          },
        });
      }
    }
    for (const d of documents) {
      const ticketId = (d as any).repair_ticket_id;
      const displayId = d.display_id || "";
      const isRepairDoc = displayId.startsWith("RT-") || displayId.startsWith("JOB-") || displayId.startsWith("CERT-") || Boolean(ticketId);
      const idKey = ticketId || displayId;
      if (isRepairDoc && idKey) {
        if (!map.has(idKey)) {
          const customFields = (d as any).custom_fields || (d as any).metadata?.custom_fields || {};
          map.set(idKey, {
            id: idKey,
            ticket_number: String(displayId).replace(/^(RT-|JOB-|CERT-)+/i, "") || idKey,
            customer_name: d.customer_name,
            customer_email: d.customer_email,
            customer_phone: d.customer_phone,
            company_name: (d as any).customer?.company_name || (d as any).metadata?.company_name,
            device: {
              brand: customFields["Brand"] || "",
              model_name: customFields["Device Model"] || customFields["Model"] || "Device",
              serial_number: customFields["Serial / IMEI"] || customFields["Serial Number"] || "N/A",
              condition: customFields["Condition"] || "Good condition",
            },
            accessories: customFields["Accessories"] || "None",
            technician_name: customFields["Technician"] || "Bonifencia A.",
            issue_description: customFields["Reported Issue"] || d.notes || "Standard Service",
            custom_fields: customFields,
            items: (d as any).metadata?.items || [],
          });
        } else {
          // Enrich existing ticket from document records if fields are missing
          const existing = map.get(idKey);
          if (!existing.customer_name && d.customer_name) existing.customer_name = d.customer_name;
          if (!existing.customer_email && d.customer_email) existing.customer_email = d.customer_email;
          if (!existing.customer_phone && d.customer_phone) existing.customer_phone = d.customer_phone;
          const compName = (d as any).customer?.company_name || (d as any).metadata?.company_name;
          if (!existing.company_name && compName) existing.company_name = compName;
          if ((!existing.device?.model_name || existing.device?.model_name === "Device") && (d as any).metadata?.custom_fields?.["Device Model"]) {
            existing.device = existing.device || {};
            existing.device.model_name = (d as any).metadata.custom_fields["Device Model"];
          }
        }
      }
    }
    return Array.from(map.values());
  }, [repairTickets, documents, customersList]);

  const customerAutofillCandidates = useMemo(() => {
    const map = new Map<string, CustomerCandidate>();

    const addCandidate = (c: CustomerCandidate) => {
      const key = (c.email?.trim().toLowerCase()) ||
                  (c.phone?.trim().replace(/\s+/g, "")) ||
                  (`${c.name.trim().toLowerCase()}::${c.company_name.trim().toLowerCase()}`);
      
      if (!key || key === "::" || key === "customer::") return;

      if (!map.has(key)) {
        map.set(key, c);
      } else {
        const existing = map.get(key)!;
        if (!existing.name || existing.name === "Customer") existing.name = c.name;
        if (!existing.company_name && c.company_name) existing.company_name = c.company_name;
        if (!existing.email && c.email) existing.email = c.email;
        if (!existing.phone && c.phone) existing.phone = c.phone;
        if (!existing.address && c.address) existing.address = c.address;
      }
    };

    // 1. Medusa Customers
    for (const c of customersList) {
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
      const addr = c.addresses?.[0] || c.default_billing_address || c.billing_address;
      const formattedAddr = addr
        ? [addr.address_1, addr.address_2, addr.city, addr.postal_code, addr.province, addr.country_code?.toUpperCase()].filter(Boolean).join(", ")
        : "";
      const company = c.company_name || addr?.company || c.metadata?.company_name || "";
      const name = fullName || company || c.email || "Customer";
      addCandidate({
        id: c.id || `cust-${Math.random()}`,
        name,
        company_name: company,
        email: c.email || "",
        phone: c.phone || addr?.phone || "",
        address: formattedAddr,
        source: "customer",
        source_label: "Medusa Customer",
      });
    }

    // 2. Repair Tickets
    for (const t of availableTickets) {
      const fullName = (t.customer?.first_name ? `${t.customer.first_name} ${t.customer.last_name || ""}`.trim() : "") ||
        t.customer?.name ||
        t.customer_name ||
        "";
      const company = t.customer?.company_name || t.company_name || t.metadata?.company_name || "";
      const email = t.customer?.email || t.customer_email || t.metadata?.customer_email || "";
      const phone = t.customer?.phone || t.customer_phone || t.metadata?.customer_phone || "";
      const address = t.customer?.address || t.customer_address || t.metadata?.address || t.custom_fields?.["Address"] || "";
      const cleanNum = String(t.ticket_number || t.id).replace(/^(RT-|JOB-|CERT-)+/i, "");
      const name = fullName || company || "Customer";
      if (name || company || email || phone) {
        addCandidate({
          id: `ticket-${t.id || cleanNum}`,
          name,
          company_name: company,
          email,
          phone,
          address,
          source: "repair",
          source_label: `Ticket RT-${cleanNum}`,
        });
      }
    }

    // 3. Documents
    for (const d of documents) {
      const name = d.customer_name || "";
      const company = (d as any).customer?.company_name || (d as any).metadata?.company_name || (d as any).company_name || "";
      const email = d.customer_email || (d as any).customer?.email || "";
      const phone = d.customer_phone || (d as any).customer?.phone || "";
      const address = (d as any).customer?.address || (d as any).customer_address || (d as any).metadata?.customer_address || (d as any).metadata?.customer?.address || "";
      const docRef = d.display_id || d.id?.slice(0, 8);
      if (name || company || email || phone) {
        addCandidate({
          id: `doc-${d.id}`,
          name: name || company || "Customer",
          company_name: company,
          email,
          phone,
          address,
          source: "document",
          source_label: `Doc ${docRef}`,
        });
      }
    }

    return Array.from(map.values());
  }, [customersList, availableTickets, documents]);

  const handleSelectRepairTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    if (!ticketId) return;

    const ticket = availableTickets.find((t) => t.id === ticketId || t.ticket_number === ticketId);
    if (!ticket) return;

    const brandModel = [ticket.device?.brand, ticket.device?.model_name]
      .filter(Boolean)
      .join(" ")
      .trim() || ticket.custom_fields?.["Device Model"] || "Apple iPhone 15 Pro Max";

    const serialImei = ticket.device?.serial_number || ticket.device?.imei || ticket.custom_fields?.["Serial / IMEI"] || "N/A";
    const technician = ticket.technician_name || ticket.custom_fields?.["Technician"] || "Bonifencia A. (Lead Certified Engineer)";
    const accessories = ticket.accessories || ticket.custom_fields?.["Accessories"] || "None (Unit only)";
    const condition = ticket.device?.condition || ticket.custom_fields?.["Condition"] || "Good (Normal wear)";
    const cleanNum = String(ticket.ticket_number || ticket.id).replace(/^(RT-|JOB-|CERT-)+/i, "");
    const ticketRef = `RT-${cleanNum}`;

    const customerName =
      (ticket.customer?.first_name ? `${ticket.customer.first_name} ${ticket.customer.last_name || ""}`.trim() : "") ||
      ticket.customer?.name ||
      ticket.customer_name ||
      ticket.metadata?.customer_name ||
      ticket.customer?.company_name ||
      ticket.company_name ||
      "Valued Customer";

    const customerEmail = ticket.customer?.email || ticket.customer_email || ticket.metadata?.customer_email || "";
    const customerPhone = ticket.customer?.phone || ticket.customer_phone || ticket.metadata?.customer_phone || "";
    const companyName = ticket.customer?.company_name || ticket.company_name || ticket.metadata?.company_name || "";

    const ticketItems: Array<{ title: string; description: string; quantity: number; unit_price: number }> = [];

    if (ticket.product_variants && Array.isArray(ticket.product_variants) && ticket.product_variants.length > 0) {
      for (const pv of ticket.product_variants) {
        const qty = Number(pv.quantity || (pv as any).pivot?.quantity || 1);
        const unitPrice = Number(pv.unit_price ?? pv.price ?? pv.prices?.[0]?.amount ?? 0);
        const partTitle = pv.product?.title
          ? `${pv.product.title}${pv.title && pv.title !== "Default Variant" ? ` (${pv.title})` : ""}`
          : pv.title || pv.product?.title || "Inventory Part";
        ticketItems.push({
          title: partTitle,
          description: pv.sku ? `SKU: ${pv.sku}` : "",
          quantity: qty,
          unit_price: unitPrice,
        });
      }
    }

    if (ticket.custom_parts && Array.isArray(ticket.custom_parts) && ticket.custom_parts.length > 0) {
      for (const cp of ticket.custom_parts) {
        ticketItems.push({
          title: cp.name || cp.title || "Custom Repair Part / Service",
          description: cp.description || "",
          quantity: Number(cp.quantity || 1),
          unit_price: Number(cp.price || cp.unit_price || 0),
        });
      }
    }

    if (ticket.device?.parts_used && Array.isArray(ticket.device.parts_used)) {
      for (const p of ticket.device.parts_used) {
        ticketItems.push({
          title: p.name || p.title || "Replacement Part",
          description: p.sku ? `SKU: ${p.sku}` : "",
          quantity: Number(p.quantity || 1),
          unit_price: Number(p.price || 0),
        });
      }
    }

    if (Number(ticket.labor_estimate || 0) > 0) {
      ticketItems.push({
        title: "Workshop Labor & Clean-Room Installation",
        description: "Certified hardware diagnostic and component installation",
        quantity: 1,
        unit_price: Number(ticket.labor_estimate),
      });
    }

    if (ticketItems.length === 0 && ticket.items && Array.isArray(ticket.items) && ticket.items.length > 0) {
      for (const it of ticket.items) {
        ticketItems.push({
          title: it.title || "Service Item",
          description: it.description || "",
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || 0),
        });
      }
    }

    const customerAddress = ticket.customer?.address || ticket.customer_address || ticket.metadata?.address || ticket.custom_fields?.["Address"] || "";

    setCustomDocForm((prev) => ({
      ...prev,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      company_name: companyName,
      customer_address: customerAddress || prev.customer_address,
      custom_fields: {
        ...prev.custom_fields,
        "Device Model": brandModel,
        "Serial / IMEI": serialImei,
        "Ticket Reference": ticketRef,
        "Technician": technician,
        "Accessories": accessories,
        "Condition": condition,
        "Reported Issue": ticket.issue_description || ticket.reported_issue || "Standard Service",
      },
      items: ticketItems.length > 0 ? ticketItems : prev.items,
      email_subject: `${prev.title} - ${brandModel} (${ticketRef})`,
      notes: prev.notes || `Linked to Repair Ticket ${ticketRef}. Device: ${brandModel} (S/N: ${serialImei}).`,
    }));
  };

  const handleClearRepairLink = () => {
    setSelectedTicketId("");
  };

  const selectCustomDocPreset = (presetId: string) => {
    const preset = CUSTOM_DOC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setCustomDocForm((prev) => {
      const updatedFields = {
        ...(preset.custom_fields || {}),
        ...(selectedTicketId ? {
          "Device Model": prev.custom_fields?.["Device Model"] || preset.custom_fields?.["Device Model"],
          "Serial / IMEI": prev.custom_fields?.["Serial / IMEI"] || preset.custom_fields?.["Serial / IMEI"],
          "Ticket Reference": prev.custom_fields?.["Ticket Reference"] || preset.custom_fields?.["Ticket Reference"],
          "Technician": prev.custom_fields?.["Technician"] || preset.custom_fields?.["Technician"],
          "Accessories": prev.custom_fields?.["Accessories"] || preset.custom_fields?.["Accessories"],
          "Condition": prev.custom_fields?.["Condition"] || preset.custom_fields?.["Condition"],
          "Reported Issue": prev.custom_fields?.["Reported Issue"] || preset.custom_fields?.["Reported Issue"],
        } : {}),
      };
      return {
        ...prev,
        preset_id: preset.id,
        title: preset.title,
        email_subject: prev.custom_fields?.["Device Model"]
          ? `${preset.title} - ${prev.custom_fields["Device Model"]}`
          : preset.subject,
        body_text: preset.body_text,
        items: preset.items.map((it) => ({ ...it })),
        custom_fields: updatedFields,
        notes: preset.notes != null ? preset.notes : prev.notes,
      };
    });
  };

  // Send Notification Form
  const [sendForm, setSendForm] = useState({
    channels: ["email"],
    custom_message: "",
    subject: "",
  });

  const loadDocuments = (resetLimit = true) => {
    setLoading(true);
    fetch("/admin/documents?take=100&skip=0", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setDocuments(data.documents || []);
        if (data.count != null) {
          setTotalBackendCount(Number(data.count));
        }
        if (resetLimit) {
          setDisplayLimit(100);
        }
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

  const loadZohoLiveDocs = (customType?: string, customSearch?: string) => {
    setLoadingZoho(true);
    const targetType =
      customType ||
      (typeFilter === "estimate"
        ? "estimates"
        : typeFilter === "receipt" || typeFilter === "payment"
        ? "payments"
        : "invoices");
    const q = customSearch !== undefined ? customSearch : searchTerm;
    const searchParam = q ? `&search=${encodeURIComponent(q)}` : "";
    fetch(`/admin/documents/zoho/list?type=${targetType}${searchParam}`, { credentials: "include" })
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
    loadZohoLiveDocs();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch("/admin/documents/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSaveSuccessMsg("Preferences saved successfully!");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        alert("Settings saved successfully!");
      } else {
        alert(`Failed to save settings: ${data.message || res.statusText || "Unknown error"}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error saving settings: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettingField = (key: string, val: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: val }));
  };

  // Submit Manual Document
  const handleCreateManual = async () => {
    if (!manualForm.customer_name?.trim()) {
      alert("Please provide a Customer Name.");
      return;
    }
    const validItems = manualForm.items.filter((it) => it.title.trim() !== "");
    if (validItems.length === 0) {
      alert("Please add at least one line item with a title.");
      return;
    }

    setIsGeneratingManual(true);
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
            company_name: manualForm.company_name || undefined,
            email: manualForm.customer_email,
            phone: manualForm.customer_phone,
            address: manualForm.customer_address,
          },
          items: validItems,
          currency_code: manualForm.currency_code,
          notes: manualForm.notes,
          force_source: "zoho",
          auto_send: manualForm.auto_send,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert("Document created successfully!");
        setManualModalOpen(false);
        setManualForm({
          title: "Tax Invoice",
          type: "invoice",
          company_name: "",
          customer_name: "",
          customer_email: "",
          customer_phone: "",
          customer_address: "",
          items: [{ title: "", description: "", quantity: 1, unit_price: 0 }],
          currency_code: "kes",
          notes: "",
          force_source: "zoho",
          auto_send: false,
        });
        loadDocuments();
      } else {
        alert(`Failed to create document: ${data.message || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Error creating document: ${e.message}`);
    } finally {
      setIsGeneratingManual(false);
    }
  };

  // Submit Custom Document
  const handleCreateCustomDoc = async () => {
    if (!customDocForm.title?.trim()) {
      alert("Please provide a Document Title.");
      return;
    }
    if (!customDocForm.customer_name?.trim()) {
      alert("Please provide a Customer / Recipient Name.");
      return;
    }

    setIsGeneratingCustom(true);
    try {
      const res = await fetch("/admin/documents/custom", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: customDocForm.title,
          repair_ticket_id: selectedTicketId || undefined,
          customer: {
            name: customDocForm.customer_name,
            company_name: customDocForm.company_name || undefined,
            email: customDocForm.customer_email,
            phone: customDocForm.customer_phone,
            address: customDocForm.customer_address || undefined,
          },
          body_text: customDocForm.body_text,
          notes: customDocForm.notes,
          custom_fields: customDocForm.custom_fields,
          items: customDocForm.items.filter((it) => it.title.trim() !== ""),
          currency_code: customDocForm.currency_code,
          send_email_now: customDocForm.send_email_now,
          email_subject: customDocForm.email_subject,
          custom_email_message: customDocForm.body_text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert(
          customDocForm.send_email_now
            ? "Custom document generated & emailed successfully!"
            : "Custom document generated and saved to Documents Hub!"
        );
        setCustomDocModalOpen(false);
        setSelectedTicketId("");
        loadDocuments();
      } else {
        alert(`Failed to generate custom document: ${data.message || res.statusText}`);
      }
    } catch (e: any) {
      alert(`Error generating custom document: ${e.message}`);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  // Template Preview Logic (Live In-App Modal + Controls)
  const loadPreviewBlob = async (style: string, type: string, preset?: string | null) => {
    setIsPreviewModalLoading(true);
    try {
      const presetParam = preset ? `&preset=${preset}` : "";
      const res = await fetch(`/admin/documents/templates/preview?style=${style}&type=${type}${presetParam}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const errText = await res.text();
        alert(`Preview failed: ${errText || res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return blobUrl;
      });
    } catch (e: any) {
      alert(`Error previewing template: ${e.message}`);
    } finally {
      setIsPreviewModalLoading(false);
      setPreviewLoading(null);
    }
  };

  const handlePreviewTemplate = async (style: string, type: string, preset?: string) => {
    const key = preset ? `${style}-${type}-${preset}` : `${style}-${type}`;
    setPreviewLoading(key);
    setPreviewStyle(style);
    setPreviewType(type);
    setPreviewPreset(preset || null);
    setPreviewModalOpen(true);
    await loadPreviewBlob(style, type, preset);
  };

  const switchPreview = async (style: string, type: string) => {
    setPreviewStyle(style);
    setPreviewType(type);
    await loadPreviewBlob(style, type, previewPreset);
  };

  const handleOpenPreviewNewTab = () => {
    const presetParam = previewPreset ? `&preset=${previewPreset}` : "";
    window.open(`/admin/documents/templates/preview?style=${previewStyle}&type=${previewType}${presetParam}`, "_blank");
  };

  const handleDownloadPreview = () => {
    if (!previewBlobUrl) return;
    const a = document.createElement("a");
    a.href = previewBlobUrl;
    a.download = `preview-${previewStyle}-${previewPreset || previewType}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSyncRepairs = async () => {
    setIsSyncingRepairs(true);
    try {
      const res = await fetch("/admin/documents/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        alert(data.message || `Successfully synced ${data.synced_tickets || 0} repairs!`);
        loadDocuments();
      } else {
        alert(`Sync failed: ${data.message || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error syncing repairs: ${e.message}`);
    } finally {
      setIsSyncingRepairs(false);
    }
  };

  // View Document PDF (Direct native browser stream without popup blocker restriction)
  const handleViewDocument = (id: string, displayId: string) => {
    window.open(`/admin/documents/${id}/document`, "_blank");
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

  // Open Edit Modal for an Invoice or Estimate
  const handleOpenEditModal = (doc: any) => {
    setEditingDoc(doc);
    let meta: any = doc.metadata || {};
    if (typeof meta === "string") {
      try {
        meta = JSON.parse(meta);
      } catch (_) {
        meta = {};
      }
    }
    const docItems = Array.isArray(meta?.items) && meta.items.length > 0
      ? meta.items.map((it: any) => ({
          title: it.title || it.name || "Item",
          description: it.description || "",
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.unit_price || it.rate || 0),
        }))
      : [
          {
            title: doc.title || "Service / Goods",
            description: "",
            quantity: 1,
            unit_price: Number(doc.total_amount || 0),
          },
        ];

    setEditForm({
      title: doc.title || (doc.type === "invoice" ? "Tax Invoice" : "Quotation"),
      customer_name: doc.customer_name || "",
      customer_email: doc.customer_email || "",
      customer_phone: doc.customer_phone || "",
      notes: meta?.notes || "",
      terms: meta?.terms || "",
      items: docItems,
    });
    setEditModalOpen(true);
  };

  // Save changes to document and update Zoho Books
  const handleSaveEditDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingDoc) return;
    setIsUpdatingDoc(true);
    try {
      const calculatedTotal = editForm.items.reduce(
        (sum, it) => sum + Number(it.quantity || 1) * Number(it.unit_price || 0),
        0
      );

      const res = await fetch(`/admin/documents/${editingDoc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editForm.title,
          customer_name: editForm.customer_name,
          customer_email: editForm.customer_email,
          customer_phone: editForm.customer_phone,
          notes: editForm.notes,
          terms: editForm.terms,
          items: editForm.items,
          total: calculatedTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.message || "Failed to update document");
      }

      setEditModalOpen(false);
      setEditingDoc(null);
      await loadDocuments();
      alert("Document updated successfully and synced with Zoho Books!");
    } catch (err: any) {
      alert(`Error updating document: ${err.message}`);
    } finally {
      setIsUpdatingDoc(false);
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

  // Delete a single document record (including Zoho document if present)
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document record?")) return;
    try {
      const res = await fetch(`/admin/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Document deleted successfully!");
        loadDocuments();
      } else {
        alert(`Failed to delete document: ${data.message || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error deleting document: ${e.message}`);
    }
  };

  // Delete all documents for a repair ticket (including in Zoho Books) so they can be regenerated
  const handleDeleteRepairDocuments = async (repairTicketId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete ALL generated documents for this repair ticket (including in Zoho Books)? This will allow documents to be cleanly regenerated with updated ticket information."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/admin/documents/repair/${repairTicketId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const zohoCount = (data.deleted_zoho_invoices?.length || 0) + (data.deleted_zoho_estimates?.length || 0) + (data.deleted_zoho_payments?.length || 0);
        alert(`Successfully deleted ${data.deleted_records || 0} document record(s)${zohoCount > 0 ? ` and ${zohoCount} Zoho document(s)` : ""}!`);
        loadDocuments();
      } else {
        alert(`Failed to delete repair documents: ${data.message || "Unknown error"}`);
      }
    } catch (e: any) {
      alert(`Error deleting repair documents: ${e.message}`);
    }
  };

  // Unified document list merging local documents and live Zoho Books documents into one single source
  const unifiedDocuments = useMemo(() => {
    const list = [...documents];
    const existingZohoIds = new Set(documents.map((d: any) => d.zoho_document_id).filter(Boolean));
    const existingDisplayIds = new Set(
      documents
        .map((d: any) => d.display_id?.toLowerCase())
        .filter(Boolean)
        .concat(
          documents.map((d: any) =>
            d.display_id ? d.display_id.toLowerCase().replace(/^(?:(?:job|rt|rec|rcpt|est|doc|inv|pkg|pack|st|store|[a-z]{2,10})-)+/i, "") : ""
          ).filter(Boolean)
        )
    );

    for (const zi of zohoLiveDocs) {
      const zId = zi.invoice_id || zi.estimate_id || zi.payment_id;
      const dispId = zi.invoice_number || zi.estimate_number || zi.payment_number || zi.reference_number;
      const cleanDispId = dispId
        ? String(dispId).toLowerCase().replace(/^(?:(?:job|rt|rec|rcpt|est|doc|inv|pkg|pack|st|store|[a-z]{2,10})-)+/i, "")
        : "";

      if (zId && existingZohoIds.has(zId)) continue;
      if (dispId && existingDisplayIds.has(String(dispId).toLowerCase())) continue;
      if (cleanDispId && existingDisplayIds.has(cleanDispId)) continue;

      const docType = zi.invoice_id ? "invoice" : zi.estimate_id ? "estimate" : "receipt";
      list.push({
        id: `zoho_${zId}`,
        display_id: dispId || zId,
        type: docType,
        title: zi.invoice_id ? "Zoho Invoice" : zi.estimate_id ? "Zoho Estimate / Quote" : "Zoho Payment Receipt",
        customer_name: zi.customer_name || "—",
        customer_email: zi.email || "",
        total: zi.total != null ? Number(zi.total) : (zi.amount != null ? Number(zi.amount) : 0),
        currency_code: (zi.currency_code || "kes").toLowerCase(),
        status: zi.status || "sent",
        source: "zoho",
        zoho_document_id: zId,
        created_at: zi.date || new Date().toISOString(),
        metadata: { is_live_zoho: true },
      } as any);
    }
    return list;
  }, [documents, zohoLiveDocs]);

  // Filter documents (flat mode) using unifiedDocuments
  const filteredDocs = unifiedDocuments.filter((doc) => {
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

  // Group documents by job / order (packed mode) using unifiedDocuments
  const documentGroups = useMemo(() => {
    const allGroups = groupDocuments(unifiedDocuments);

    return allGroups.filter((group) => {
      // Source filter
      if (sourceFilter !== "all") {
        const matchesSource = group.documents.some((d) => d.source === sourceFilter);
        if (!matchesSource) return false;
      }

      // Type filter
      if (typeFilter !== "all") {
        const matchesType = group.documents.some((d) => d.type === typeFilter);
        if (!matchesType) return false;
      }

      // Search filter
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          group.groupKey?.toLowerCase().includes(q) ||
          group.customerName?.toLowerCase().includes(q) ||
          group.customerEmail?.toLowerCase().includes(q) ||
          group.customerPhone?.toLowerCase().includes(q) ||
          group.documents.some(
            (d) =>
              d.display_id?.toLowerCase().includes(q) ||
              d.title?.toLowerCase().includes(q) ||
              d.customer_name?.toLowerCase().includes(q)
          );
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [documents, sourceFilter, typeFilter, searchTerm]);

  // Infinite scroll calculations & triggers
  const totalItemCount = groupByJob ? documentGroups.length : filteredDocs.length;
  const hasMoreLocally = displayLimit < totalItemCount;
  const hasMoreBackend = documents.length < totalBackendCount;
  const canLoadMore = hasMoreLocally || hasMoreBackend;

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || loading) return;

    if (hasMoreLocally) {
      setDisplayLimit((prev) => prev + 100);
      return;
    }

    if (hasMoreBackend) {
      setIsLoadingMore(true);
      try {
        const nextSkip = documents.length;
        const res = await fetch(`/admin/documents?take=100&skip=${nextSkip}`, { credentials: "include" });
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
          setDocuments((prev) => {
            const existingIds = new Set(prev.map((d: any) => d.id));
            const newUnique = data.documents.filter((d: any) => !existingIds.has(d.id));
            return [...prev, ...newUnique];
          });
          if (data.count != null) {
            setTotalBackendCount(Number(data.count));
          }
          setDisplayLimit((prev) => prev + 100);
        } else {
          setTotalBackendCount(documents.length);
        }
      } catch (err) {
        console.error("Error loading more documents:", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  }, [isLoadingMore, loading, hasMoreLocally, hasMoreBackend, documents.length, totalBackendCount]);

  // Reset display cap when search, filters, or group mode change
  useEffect(() => {
    setDisplayLimit(100);
  }, [searchTerm, typeFilter, sourceFilter, groupByJob]);

  // IntersectionObserver for seamless infinite scrolling
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !canLoadMore || isLoadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [handleLoadMore, canLoadMore, isLoadingMore, loading]);

  // Fallback window scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (!canLoadMore || isLoadingMore || loading) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.documentElement.scrollHeight - 350;
      if (scrollPosition >= threshold) {
        handleLoadMore();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleLoadMore, canLoadMore, isLoadingMore, loading]);


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
          <Button
            variant="secondary"
            size="small"
            onClick={handleSyncRepairs}
            isLoading={isSyncingRepairs}
            title="Scan and synchronize all repair tickets and Zoho documents"
          >
            <ArrowPath className={`w-4 h-4 mr-1 ${isSyncingRepairs ? "animate-spin" : ""}`} /> Sync Repairs & Zoho
          </Button>
          <Button variant="secondary" size="small" onClick={() => setManualModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create Invoice
          </Button>
          <Button variant="secondary" size="small" onClick={() => setCustomDocModalOpen(true)}>
            <Sparkles className="w-4 h-4 mr-1" /> Custom Document
          </Button>
          <Button
            variant="transparent"
            size="small"
            onClick={() => {
              loadDocuments();
              loadZohoLiveDocs();
            }}
            title="Refresh documents & live Zoho list"
          >
            <ArrowPath className={`w-4 h-4 ${(loading || loadingZoho) ? "animate-spin" : ""}`} />
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
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  loadZohoLiveDocs(undefined, e.target.value);
                }}
                size="small"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v);
                  if (v === "estimate") {
                    loadZohoLiveDocs("estimates");
                  } else if (v === "receipt") {
                    loadZohoLiveDocs("payments");
                  } else if (v === "invoice" || v === "all") {
                    loadZohoLiveDocs("invoices");
                  }
                }}
              >
                <Select.Trigger size="small">
                  <Select.Value placeholder="Document Type" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="invoice">Invoices (Default)</Select.Item>
                  <Select.Item value="all">All Types</Select.Item>
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

              <Tooltip content="Refresh Live Zoho Books Invoices">
                <IconButton
                  variant="secondary"
                  size="small"
                  onClick={() => loadZohoLiveDocs()}
                  isLoading={loadingZoho}
                  title="Refresh Live Zoho Books Invoices"
                >
                  <ArrowPath className={`w-4 h-4 ${loadingZoho ? "animate-spin" : ""}`} />
                </IconButton>
              </Tooltip>

              <div className="flex items-center gap-2 pl-2 border-l border-ui-border-base">
                <Switch
                  id="group-by-job"
                  checked={groupByJob}
                  onCheckedChange={setGroupByJob}
                />
                <Label htmlFor="group-by-job" className="text-xs cursor-pointer select-none font-medium text-ui-fg-base">
                  Pack by Job / Order
                </Label>
              </div>
            </div>
          </div>

          {/* Documents Table */}
          {loading ? (
            <div className="py-12 text-center text-ui-fg-muted text-sm">Loading documents...</div>
          ) : (groupByJob ? documentGroups.length === 0 : filteredDocs.length === 0) ? (
            <div className="py-12 text-center text-ui-fg-muted border border-dashed border-ui-border-base rounded-lg">
              <Text className="text-sm">No documents found.</Text>
              <Text className="text-xs text-ui-fg-subtle mt-1">
                Create a manual invoice or process an order to generate your first document.
              </Text>
            </div>
          ) : (
            <Fragment>
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
                {groupByJob ? (
                  documentGroups.slice(0, displayLimit).map((group) => {
                    const isExpanded = !!expandedGroups[group.groupId];
                    const doc = group.primaryDoc;
                    const isPaid = group.isPaid || doc.payment_status === "paid" || doc.status === "paid";
                    const isPartial = !isPaid && (group.paymentStatus === "partially_paid" || doc.payment_status === "partially_paid" || doc.status === "partially_paid");
                    const displayStatus = isPaid ? "paid" : isPartial ? "partially_paid" : (group.paymentStatus || doc.payment_status || doc.status || "unpaid");
                    const isZoho = doc.source === "zoho";
                    const hasMultiple = group.documents.length > 1;

                    return (
                      <Fragment key={group.groupId}>
                        <Table.Row
                          className={`transition-colors ${
                            isExpanded ? "bg-ui-bg-subtle" : "hover:bg-ui-bg-subtle-hover"
                          }`}
                        >
                          <Table.Cell>
                            <div className="flex items-center gap-1.5">
                              {hasMultiple ? (
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(group.groupId)}
                                  className="p-1 rounded hover:bg-ui-bg-base text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer transition-colors"
                                  title={isExpanded ? "Collapse related documents" : `Expand ${group.documents.length} related documents`}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-purple-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-ui-fg-subtle" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-5 inline-block" />
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleViewDocument(doc.id, doc.display_id)}
                                  className="font-medium text-ui-fg-interactive hover:underline text-left cursor-pointer bg-transparent border-0 p-0"
                                >
                                  {doc.display_id}
                                </button>
                                {hasMultiple && (
                                  <Badge
                                    size="2xsmall"
                                    color="purple"
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => toggleGroup(group.groupId)}
                                  >
                                    {group.documents.length} docs
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-ui-fg-base">{doc.title}</span>
                              {hasMultiple && (
                                <span className="text-[11px] text-ui-fg-subtle truncate max-w-[220px]" title={group.includedTypesSummary}>
                                  Includes: {group.includedTypesSummary}
                                </span>
                              )}
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{group.customerName || "Guest"}</span>
                              <span className="text-[11px] text-ui-fg-subtle">{group.customerEmail || group.customerPhone || "-"}</span>
                            </div>
                          </Table.Cell>

                          <Table.Cell>
                            <span className="text-xs font-semibold">
                              {formatCurrency(group.totalAmount, group.currencyCode)}
                            </span>
                          </Table.Cell>

                          <Table.Cell>
                            <Badge color={isPaid ? "green" : (isPartial ? "orange" : (displayStatus === "unpaid" ? "red" : "blue"))} size="small">
                              {displayStatus}
                            </Badge>
                          </Table.Cell>

                          <Table.Cell>
                            <Badge color={isZoho ? "purple" : "grey"} size="small">
                              {isZoho ? "Zoho Books" : "PDFKit"}
                            </Badge>
                          </Table.Cell>

                          <Table.Cell>
                            <span className="text-xs text-ui-fg-subtle">
                              {new Date(group.latestCreatedAt).toLocaleDateString()}
                            </span>
                          </Table.Cell>

                          <Table.Cell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasMultiple && (
                                <DropdownMenu>
                                  <DropdownMenu.Trigger asChild>
                                    <button
                                      type="button"
                                      className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-ui-bg-subtle hover:bg-ui-bg-base border border-ui-border-base text-ui-fg-base transition-colors"
                                      title="View all related documents for this job/order"
                                    >
                                      <DocumentText className="w-3.5 h-3.5 text-purple-600" />
                                      <span>Docs ({group.documents.length})</span>
                                      <ChevronDown className="w-3 h-3 text-ui-fg-subtle" />
                                    </button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Content align="end" className="w-72 p-1.5 z-50">
                                    <DropdownMenu.Label className="text-xs font-semibold px-2 py-1.5 text-ui-fg-muted">
                                      Related Documents ({group.documents.length})
                                    </DropdownMenu.Label>
                                    <DropdownMenu.Separator />
                                    {group.documents.map((subDoc) => (
                                      <DropdownMenu.Item
                                        key={subDoc.id}
                                        onClick={() => handleViewDocument(subDoc.id, subDoc.display_id)}
                                        className="flex items-center justify-between px-2 py-2 cursor-pointer hover:bg-ui-bg-subtle-hover rounded text-xs transition-colors"
                                      >
                                        <div className="flex flex-col text-left">
                                          <span className="font-medium text-ui-fg-base">{subDoc.title}</span>
                                          <span className="text-[10px] text-ui-fg-subtle">{subDoc.display_id}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-semibold text-ui-fg-base">
                                            {subDoc.total_amount != null && Number(subDoc.total_amount) > 0
                                              ? formatCurrency(subDoc.total_amount, subDoc.currency_code)
                                              : "—"}
                                          </span>
                                          <ArrowDownTray className="w-3.5 h-3.5 text-ui-fg-subtle" />
                                        </div>
                                      </DropdownMenu.Item>
                                    ))}
                                  </DropdownMenu.Content>
                                </DropdownMenu>
                              )}

                              <button
                                type="button"
                                onClick={() => handleViewDocument(doc.id, doc.display_id)}
                                className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
                                title="View / Download PDF"
                              >
                                <ArrowDownTray className="w-4 h-4" />
                              </button>
                              {(doc.type === "invoice" || doc.type === "estimate" || (doc as any).type === "quote") && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(doc)}
                                  className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-purple-600 cursor-pointer"
                                  title="Edit Quote / Invoice & Sync with Zoho Books"
                                >
                                  <PencilSquare className="w-4 h-4" />
                                </button>
                              )}
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
                              {!isZoho && settings.zoho_books_enabled && (doc.type === "invoice" || doc.type === "estimate") && Number(doc.total_amount || 0) > 0 && (
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
                              <button
                                type="button"
                                onClick={() => {
                                  if (doc.repair_ticket_id) {
                                    handleDeleteRepairDocuments(doc.repair_ticket_id);
                                  } else {
                                    handleDeleteDocument(doc.id);
                                  }
                                }}
                                className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-red-600 transition-colors"
                                title={doc.repair_ticket_id ? "Delete / Reset All Documents for this Repair Ticket (including in Zoho Books)" : "Delete Document Record"}
                              >
                                <Trash className="w-4 h-4 text-red-500 hover:text-red-700" />
                              </button>
                            </div>
                          </Table.Cell>
                        </Table.Row>

                        {/* Expanded Nested Sub-Table Row */}
                        {isExpanded && hasMultiple && (
                          <Table.Row className="bg-ui-bg-subtle hover:bg-ui-bg-subtle border-b border-ui-border-base">
                            <Table.Cell colSpan={8} className="p-0">
                              <div className="py-3 px-6 bg-ui-bg-subtle/80 border-l-4 border-l-purple-500 my-1 mx-2 rounded-r-md">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <DocumentText className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-semibold text-ui-fg-base">
                                      Related Documents for this Job / Order ({group.documents.length})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {group.repair_ticket_id && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRepairDocuments(group.repair_ticket_id!)}
                                        className="text-[11px] text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 font-medium"
                                        title="Delete all generated documents for this repair job in database & Zoho Books to allow clean regeneration"
                                      >
                                        <Trash className="w-3 h-3" /> Reset / Delete Job Documents
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => toggleGroup(group.groupId)}
                                      className="text-[11px] text-ui-fg-interactive hover:underline"
                                    >
                                      Collapse
                                    </button>
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded border border-ui-border-base bg-ui-bg-base">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-ui-border-base bg-ui-bg-subtle text-[11px] text-ui-fg-muted font-medium">
                                        <th className="py-1.5 px-3">Document Type</th>
                                        <th className="py-1.5 px-3">Reference</th>
                                        <th className="py-1.5 px-3">Amount</th>
                                        <th className="py-1.5 px-3">Status</th>
                                        <th className="py-1.5 px-3">Source</th>
                                        <th className="py-1.5 px-3">Created Date</th>
                                        <th className="py-1.5 px-3 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-ui-border-base text-xs">
                                      {group.documents.map((subDoc) => {
                                        const subIsPaid = subDoc.payment_status === "paid" || subDoc.status === "paid" || (subDoc.type === "invoice" && group.isPaid);
                                        const subIsPartial = !subIsPaid && (subDoc.payment_status === "partially_paid" || subDoc.status === "partially_paid" || (subDoc.type === "invoice" && group.paymentStatus === "partially_paid"));
                                        const subDisplayStatus = subIsPaid ? "paid" : subIsPartial ? "partially_paid" : (subDoc.payment_status || subDoc.status || "unpaid");
                                        const subIsZoho = subDoc.source === "zoho";
                                        return (
                                          <tr key={subDoc.id} className="hover:bg-ui-bg-subtle-hover transition-colors">
                                            <td className="py-2 px-3">
                                              <Badge
                                                size="2xsmall"
                                                color={
                                                  subDoc.type === "invoice" ? "green" :
                                                  subDoc.type === "estimate" ? "blue" :
                                                  subDoc.type === "job_card" ? "orange" :
                                                  subDoc.type === "receipt" ? "purple" : "grey"
                                                }
                                              >
                                                {subDoc.title}
                                              </Badge>
                                            </td>
                                            <td className="py-2 px-3 font-medium">
                                              <button
                                                type="button"
                                                onClick={() => handleViewDocument(subDoc.id, subDoc.display_id)}
                                                className="text-ui-fg-interactive hover:underline text-left cursor-pointer bg-transparent border-0 p-0 font-medium"
                                              >
                                                {subDoc.display_id}
                                              </button>
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-ui-fg-base">
                                              {subDoc.total_amount != null && Number(subDoc.total_amount) > 0
                                                ? formatCurrency(subDoc.total_amount, subDoc.currency_code)
                                                : "—"}
                                            </td>
                                            <td className="py-2 px-3">
                                              <Badge
                                                size="2xsmall"
                                                color={subIsPaid ? "green" : (subIsPartial ? "orange" : (subDisplayStatus === "unpaid" ? "red" : "blue"))}
                                              >
                                                {subDisplayStatus}
                                              </Badge>
                                            </td>
                                            <td className="py-2 px-3">
                                              <Badge size="2xsmall" color={subIsZoho ? "purple" : "grey"}>
                                                {subIsZoho ? "Zoho Books" : "PDFKit"}
                                              </Badge>
                                            </td>
                                            <td className="py-2 px-3 text-ui-fg-subtle text-[11px]">
                                              {new Date(subDoc.created_at).toLocaleString()}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() => handleViewDocument(subDoc.id, subDoc.display_id)}
                                                  className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
                                                  title="View / Download PDF"
                                                >
                                                  <ArrowDownTray className="w-3.5 h-3.5" />
                                                </button>
                                                {(subDoc.type === "invoice" || subDoc.type === "estimate" || (subDoc as any).type === "quote") && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(subDoc)}
                                                    className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-purple-600"
                                                    title="Edit Quote / Invoice & Sync with Zoho Books"
                                                  >
                                                    <PencilSquare className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedDoc(subDoc);
                                                    setSendForm({
                                                      channels: ["email"],
                                                      custom_message: "",
                                                      subject: `${settings.company_name}: ${subDoc.title} #${subDoc.display_id}`,
                                                    });
                                                    setSendModalOpen(true);
                                                  }}
                                                  className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base"
                                                  title="Send Document"
                                                >
                                                  <Envelope className="w-3.5 h-3.5" />
                                                </button>
                                                {!subIsZoho && settings.zoho_books_enabled && (subDoc.type === "invoice" || subDoc.type === "estimate") && Number(subDoc.total_amount || 0) > 0 && (
                                                  <Button
                                                    variant="transparent"
                                                    size="small"
                                                    onClick={() => handleSyncToZoho(subDoc.id)}
                                                    className="text-[11px] text-purple-600 hover:text-purple-700 py-0.5 px-1.5"
                                                  >
                                                    Push Zoho
                                                  </Button>
                                                )}
                                                {subDoc.short_payment_link && (
                                                  <button
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(subDoc.short_payment_link!);
                                                      alert("Short payment link copied to clipboard!");
                                                    }}
                                                    className="text-[10px] text-ui-fg-interactive hover:underline px-1 py-0.5"
                                                    title="Copy Short Link"
                                                  >
                                                    Copy Link
                                                  </button>
                                                )}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    if (subDoc.repair_ticket_id) {
                                                      handleDeleteRepairDocuments(subDoc.repair_ticket_id);
                                                    } else {
                                                      handleDeleteDocument(subDoc.id);
                                                    }
                                                  }}
                                                  className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-red-600 transition-colors"
                                                  title={subDoc.repair_ticket_id ? "Delete / Reset All Documents for this Repair Ticket (including in Zoho Books)" : "Delete Document Record"}
                                                >
                                                  <Trash className="w-3.5 h-3.5 text-red-500 hover:text-red-700" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  filteredDocs.slice(0, displayLimit).map((doc) => {
                    const isPaid = doc.payment_status === "paid" || doc.status === "paid";
                    const isZoho = doc.source === "zoho";

                    return (
                      <Table.Row key={doc.id} className="hover:bg-ui-bg-subtle-hover transition-colors">
                        <Table.Cell>
                          <button
                            type="button"
                            onClick={() => handleViewDocument(doc.id, doc.display_id)}
                            className="font-medium text-ui-fg-interactive hover:underline text-left cursor-pointer bg-transparent border-0 p-0"
                          >
                            {doc.display_id}
                          </button>
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
                            {formatCurrency(doc.total_amount, doc.currency_code)}
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
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc.id, doc.display_id)}
                              className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
                              title="View / Download PDF"
                            >
                              <ArrowDownTray className="w-4 h-4" />
                            </button>
                            {(doc.type === "invoice" || doc.type === "estimate" || (doc as any).type === "quote") && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(doc)}
                                className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-purple-600 cursor-pointer"
                                title="Edit Quote / Invoice & Sync with Zoho Books"
                              >
                                <PencilSquare className="w-4 h-4" />
                              </button>
                            )}
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
                            {!isZoho && settings.zoho_books_enabled && (doc.type === "invoice" || doc.type === "estimate") && Number(doc.total_amount || 0) > 0 && (
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
                            <button
                              type="button"
                              onClick={() => {
                                if (doc.repair_ticket_id) {
                                  handleDeleteRepairDocuments(doc.repair_ticket_id);
                                } else {
                                  handleDeleteDocument(doc.id);
                                }
                              }}
                              className="p-1.5 rounded hover:bg-ui-bg-subtle text-ui-fg-subtle hover:text-red-600 transition-colors"
                              title={doc.repair_ticket_id ? "Delete / Reset All Documents for this Repair Ticket (including in Zoho Books)" : "Delete Document Record"}
                            >
                              <Trash className="w-4 h-4 text-red-500 hover:text-red-700" />
                            </button>
                          </div>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })
                )}
              </Table.Body>
            </Table>

            {/* Infinite Scroll Sentinel & Status Bar */}
            <div ref={sentinelRef} className="h-6 w-full pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-ui-border-base bg-ui-bg-subtle text-xs text-ui-fg-subtle gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Showing <strong className="font-semibold text-ui-fg-base">{Math.min(displayLimit, totalItemCount)}</strong> of{" "}
                  <strong className="font-semibold text-ui-fg-base">{totalItemCount}</strong> {groupByJob ? "jobs/orders" : "documents"}
                </span>
                {totalBackendCount > documents.length && (
                  <Badge size="2xsmall" color="grey">
                    {totalBackendCount} total in database
                  </Badge>
                )}
                <span className="text-ui-fg-muted">(capped at 100 per scroll batch)</span>
              </div>
              <div className="flex items-center gap-2">
                {isLoadingMore && (
                  <div className="flex items-center gap-2 text-purple-600 font-medium">
                    <ArrowPath className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading next batch...</span>
                  </div>
                )}
                {canLoadMore && !isLoadingMore && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleLoadMore}
                    className="text-xs h-7"
                  >
                    Load More (+100)
                  </Button>
                )}
                {!canLoadMore && totalItemCount > 0 && (
                  <span className="text-ui-fg-muted">All documents loaded</span>
                )}
              </div>
            </div>
          </Fragment>
        )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: PDF TEMPLATES SELECTION & PREVIEW                 */}
      {/* ========================================================= */}
      {activeTab === "templates" && (
        <div className="p-6 w-full flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <Heading level="h2" className="text-lg font-semibold">Document Templates & Live Previews</Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Configure styling templates and preview official customer, workshop, and compliance documents. Zoho-backed documents match official Zoho Books layouts; workshop and custom certificates use dedicated professional formats with consistent company headers.
            </Text>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 w-full">
            {/* 1. Tax Invoice */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🧾</span>
                    <Label className="font-semibold text-sm">Tax Invoice</Label>
                  </div>
                  <Badge color="orange" size="small">Zoho Exact</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Official invoice matching Zoho Books layout with itemized parts & labor, balance due highlight, online payment shortlink, QR tracking, and KRA PIN.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
                  <Select
                    value={settings.invoice_template || "zoho_exact"}
                    onValueChange={(v) => updateSettingField("invoice_template", v)}
                  >
                    <Select.Trigger size="small">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="zoho_exact">Zoho Books Exact Format</Select.Item>
                      <Select.Item value="modern">Modern Minimalist</Select.Item>
                      <Select.Item value="classic">Classic Corporate</Select.Item>
                      <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Type: invoice</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.invoice_template || "zoho_exact", "invoice")}
                  isLoading={previewLoading === `${settings.invoice_template || "zoho_exact"}-invoice`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Invoice
                </Button>
              </div>
            </div>

            {/* 2. Repair Estimate / Quotation */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💼</span>
                    <Label className="font-semibold text-sm">Repair Estimate / Quote</Label>
                  </div>
                  <Badge color="orange" size="small">Zoho Exact</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Itemized repair quotation matching Zoho Books with validity period, customer approval links, and workshop labor breakdown.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
                  <Select
                    value={settings.estimate_template || "zoho_exact"}
                    onValueChange={(v) => updateSettingField("estimate_template", v)}
                  >
                    <Select.Trigger size="small">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="zoho_exact">Zoho Books Exact Format</Select.Item>
                      <Select.Item value="modern">Modern Minimalist</Select.Item>
                      <Select.Item value="classic">Classic Corporate</Select.Item>
                      <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Type: quote</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.estimate_template || "zoho_exact", "estimate")}
                  isLoading={previewLoading === `${settings.estimate_template || "zoho_exact"}-estimate`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Estimate
                </Button>
              </div>
            </div>

            {/* 3. Payment Receipt */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💳</span>
                    <Label className="font-semibold text-sm">Payment Receipt</Label>
                  </div>
                  <Badge color="orange" size="small">Zoho Exact</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Official payment receipt issued upon payment capture with green PAID watermark stamp, payment reference, and receipt details.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
                  <Select
                    value={settings.receipt_template || "zoho_exact"}
                    onValueChange={(v) => updateSettingField("receipt_template", v)}
                  >
                    <Select.Trigger size="small">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="zoho_exact">Zoho Books Exact Format</Select.Item>
                      <Select.Item value="modern">Modern Minimalist</Select.Item>
                      <Select.Item value="classic">Classic Corporate</Select.Item>
                      <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Type: receipt</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.receipt_template || "zoho_exact", "receipt")}
                  isLoading={previewLoading === `${settings.receipt_template || "zoho_exact"}-receipt`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Receipt
                </Button>
              </div>
            </div>

            {/* 4. Repair Job Card */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <Label className="font-semibold text-sm">Repair Job Card</Label>
                  </div>
                  <Badge color="blue" size="small">Workshop Intake</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Customer intake job card featuring asset specifications, serial/IMEI, intake condition, checklist tasks, and technician sign-off.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
                  <Select
                    value={settings.job_card_template || "standard"}
                    onValueChange={(v) => updateSettingField("job_card_template", v)}
                  >
                    <Select.Trigger size="small">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="standard">Standard Workshop Intake</Select.Item>
                      <Select.Item value="modern">Modern Minimalist</Select.Item>
                      <Select.Item value="classic">Classic Corporate</Select.Item>
                      <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Type: job_card</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.job_card_template || "standard", "job_card")}
                  isLoading={previewLoading === `${settings.job_card_template || "standard"}-job_card`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Job Card
                </Button>
              </div>
            </div>

            {/* 5. Packing Slip */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <Label className="font-semibold text-sm">Packing Slip</Label>
                  </div>
                  <Badge color="purple" size="small">Order Fulfillment</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Used for warehouse fulfillment, package tracking, and shipping dispatch verification with itemized manifest.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Type: packing_slip</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.packing_slip_template || "modern", "packing_slip")}
                  isLoading={previewLoading === `${settings.packing_slip_template || "modern"}-packing_slip`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Packing Slip
                </Button>
              </div>
            </div>

            {/* 6. Warranty Certificate */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛡️</span>
                    <Label className="font-semibold text-sm">Warranty Certificate</Label>
                  </div>
                  <Badge color="green" size="small">90-Day Coverage</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Official certificate verifying professional repair with OEM-specification components and 90-day parts and labor coverage.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: warranty</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "warranty")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-warranty`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Certificate
                </Button>
              </div>
            </div>

            {/* 7. Diagnostic & Inspection Report */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔬</span>
                    <Label className="font-semibold text-sm">Diagnostic & Inspection</Label>
                  </div>
                  <Badge color="purple" size="small">Hardware Findings</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Technical diagnostic report featuring component voltage checks, TrueTone / digitizer measurements, and technician notes.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: diagnostic</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "diagnostic")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-diagnostic`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Report
                </Button>
              </div>
            </div>

            {/* 8. Service Completion Certificate */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📜</span>
                    <Label className="font-semibold text-sm">Service Completion</Label>
                  </div>
                  <Badge color="green" size="small">QC Cleared</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Certificate verifying that maintenance, repair overhaul, and 100% bench functional test criteria have been passed.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: service_completion</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "service_completion")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-service_completion`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Certificate
                </Button>
              </div>
            </div>

            {/* 9. IT Asset Handover & Release */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🤝</span>
                    <Label className="font-semibold text-sm">Asset Handover & Custody</Label>
                  </div>
                  <Badge color="blue" size="small">Custody Release</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Official physical custody and equipment return agreement acknowledging customer receipt in verified working condition.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: handover</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "handover")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-handover`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Handover
                </Button>
              </div>
            </div>

            {/* 11. Device Trade-In Agreement */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔄</span>
                    <Label className="font-semibold text-sm">Device Trade-In Agreement</Label>
                  </div>
                  <Badge color="green" size="small">Trade-In & Transfer</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Official contract confirming hardware valuation, title handover, and trade-in store credit with verified ownership transfer.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: trade_in</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "trade_in")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-trade_in`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Trade-In
                </Button>
              </div>
            </div>

            {/* 12. Certificate of Destruction & Disposal */}
            <div className="p-5 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col justify-between shadow-sm hover:border-ui-border-interactive transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♻️</span>
                    <Label className="font-semibold text-sm">Destruction & Disposal</Label>
                  </div>
                  <Badge color="red" size="small">Eco & Compliance</Badge>
                </div>
                <Text className="text-xs text-ui-fg-subtle mb-4">
                  Certificate verifying compliant electronic demanufacturing, physical shredding, and WEEE eco-friendly recycling.
                </Text>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs font-medium">Template Style</Label>
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
              </div>
              <div className="mt-5 pt-3 border-t border-ui-border-base flex items-center justify-between">
                <Text className="text-[11px] text-ui-fg-muted font-mono">Preset: destruction</Text>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePreviewTemplate(settings.custom_doc_template || "modern", "custom", "destruction")}
                  isLoading={previewLoading === `${settings.custom_doc_template || "modern"}-custom-destruction`}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" /> Preview Disposal
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            {saveSuccessMsg && (
              <span className="text-xs text-ui-fg-interactive font-medium">✓ {saveSuccessMsg}</span>
            )}
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

              <div className="flex items-center justify-between py-2 border-b border-ui-border-base">
                <div>
                  <Label className="font-semibold text-sm">Fulfillment Created (`order.fulfillment_created`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Autogenerates Packing Slip and sends shipment tracking notification.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_order_fulfillment_enabled}
                  onCheckedChange={(v) => updateSettingField("event_order_fulfillment_enabled", v)}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label className="font-semibold text-sm">Order Canceled (`order.canceled`)</Label>
                  <Text className="text-xs text-ui-fg-subtle">
                    Sends cancellation notice with refund information and support details.
                  </Text>
                </div>
                <Switch
                  checked={settings.event_order_canceled_enabled}
                  onCheckedChange={(v) => updateSettingField("event_order_canceled_enabled", v)}
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

          <div className="flex items-center justify-end gap-3 mt-4">
            {saveSuccessMsg && (
              <span className="text-xs text-ui-fg-interactive font-medium">✓ {saveSuccessMsg}</span>
            )}
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
                <Label className="text-xs font-medium">Store Order Invoice Prefix / Tag</Label>
                <Input
                  value={settings.store_invoice_prefix || ""}
                  onChange={(e) => updateSettingField("store_invoice_prefix", e.target.value)}
                  placeholder="ST-"
                  size="small"
                />
                <Text className="text-[11px] text-ui-fg-muted mt-1">
                  Prefix for store order invoices (e.g. ST-1001) separated from repair tickets (RT-).
                </Text>
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

          {/* Customizable Notification Message Templates */}
          <div className="flex flex-col gap-5">
            <div>
              <Heading level="h2" className="text-base font-semibold">Customizable Notification Message Templates</Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Customize the exact message format and body text dispatched across Email, SMS, and WhatsApp.
                Click on any tag below each editor to insert dynamic placeholders.
              </Text>
            </div>

            {/* Email Template Card */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm flex items-center gap-2">
                    <Envelope className="w-4 h-4 text-ui-fg-interactive" />
                    Email Notification Customizer
                  </Label>
                  <Text className="text-xs text-ui-fg-subtle">Customize email subject line and HTML/text message body.</Text>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    updateSettingField("email_subject_template", "");
                    updateSettingField("email_body_template", "");
                  }}
                >
                  Reset to Default
                </Button>
              </div>

              <div>
                <Label className="text-xs font-medium">Email Subject Template</Label>
                <Input
                  value={settings.email_subject_template || ""}
                  onChange={(e) => updateSettingField("email_subject_template", e.target.value)}
                  placeholder="{company_name}: {document_title} #{display_id}"
                  size="small"
                  className="mt-1 font-mono text-xs"
                />
                <Text className="text-[11px] text-ui-fg-muted mt-1">
                  Default: <code>&#123;company_name&#125;: &#123;document_title&#125; #&#123;display_id&#125;</code>
                </Text>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-medium">Email Body Template (HTML / Text)</Label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "{customer_name}",
                      "{document_title}",
                      "{display_id}",
                      "{total_amount}",
                      "{company_name}",
                      "{payment_link}",
                      "{document_link}",
                      "{payment_button}",
                      "{download_button}",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const cur = settings.email_body_template || "";
                          updateSettingField("email_body_template", cur + (cur ? " " : "") + tag);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-subtle border border-ui-border-base font-mono cursor-pointer transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={settings.email_body_template || ""}
                  onChange={(e) => updateSettingField("email_body_template", e.target.value)}
                  placeholder={`<p>Hello <strong>{customer_name}</strong>,</p>\n<p>Your {document_title} <strong>#{display_id}</strong> is ready.</p>\n{payment_button}\n{download_button}\n<p>Thank you for choosing {company_name}.</p>`}
                  rows={5}
                  className="font-mono text-xs"
                />
                <Text className="text-[11px] text-ui-fg-muted mt-1">
                  Leave blank to use default responsive layout with company banner, payment button, and PDF download button.
                </Text>
              </div>
            </div>

            {/* SMS Template Card */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm">SMS Message Body Template</Label>
                  <Text className="text-xs text-ui-fg-subtle">Concise text message dispatched via your SMS provider.</Text>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => updateSettingField("sms_body_template", "")}
                >
                  Reset to Default
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-wrap gap-1">
                    {[
                      "{company_name}",
                      "{customer_name}",
                      "{document_title}",
                      "{display_id}",
                      "{total_amount}",
                      "{payment_link}",
                      "{document_link}",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const cur = settings.sms_body_template || "";
                          updateSettingField("sms_body_template", cur + (cur ? " " : "") + tag);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-subtle border border-ui-border-base font-mono cursor-pointer transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-ui-fg-muted font-mono">
                    {(settings.sms_body_template || "").length} chars
                  </span>
                </div>
                <Textarea
                  value={settings.sms_body_template || ""}
                  onChange={(e) => updateSettingField("sms_body_template", e.target.value)}
                  placeholder="[{company_name}] Hi {customer_name}, your {document_title} #{display_id} is ready. Total: {total_amount}. Pay: {payment_link} View: {document_link}"
                  rows={3}
                  className="font-mono text-xs"
                />
                <Text className="text-[11px] text-ui-fg-muted mt-1">
                  Default: <code>[&#123;company_name&#125;] Hi &#123;customer_name&#125;, your &#123;document_title&#125; #&#123;display_id&#125; is ready. Total: &#123;total_amount&#125;. Pay: &#123;payment_link&#125; View: &#123;document_link&#125;</code>
                </Text>
              </div>
            </div>

            {/* WhatsApp Template Card */}
            <div className="p-4 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold text-sm">WhatsApp Message Body Template</Label>
                  <Text className="text-xs text-ui-fg-subtle">Formatted message supporting WhatsApp formatting (*bold*, _italics_).</Text>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => updateSettingField("whatsapp_body_template", "")}
                >
                  Reset to Default
                </Button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-wrap gap-1">
                    {[
                      "{company_name}",
                      "{customer_name}",
                      "{document_title}",
                      "{display_id}",
                      "{total_amount}",
                      "{payment_link}",
                      "{document_link}",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const cur = settings.whatsapp_body_template || "";
                          updateSettingField("whatsapp_body_template", cur + (cur ? " " : "") + tag);
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-ui-bg-subtle hover:bg-ui-bg-subtle-hover text-ui-fg-subtle border border-ui-border-base font-mono cursor-pointer transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  value={settings.whatsapp_body_template || ""}
                  onChange={(e) => updateSettingField("whatsapp_body_template", e.target.value)}
                  placeholder={`*{company_name}*\nHello *{customer_name}*,\nYour *{document_title} #{display_id}* has been generated.\n*Amount:* {total_amount}\n*Pay Online:* {payment_link}\n*Download PDF:* {document_link}`}
                  rows={4}
                  className="font-mono text-xs"
                />
                <Text className="text-[11px] text-ui-fg-muted mt-1">
                  Default: <code>*&#123;company_name&#125;*\nHello *&#123;customer_name&#125;*,\nYour *&#123;document_title&#125; #&#123;display_id&#125;* has been generated.\n*Amount:* &#123;total_amount&#125;\n*Pay Online:* &#123;payment_link&#125;\n*Download PDF:* &#123;document_link&#125;</code>
                </Text>
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
                      <Label className="text-xs font-medium">Store Order Invoice Prefix / Tag</Label>
                      <Input
                        value={settings.store_invoice_prefix || ""}
                        onChange={(e) => updateSettingField("store_invoice_prefix", e.target.value)}
                        placeholder="ST-"
                        size="small"
                      />
                      <Text className="text-[11px] text-ui-fg-muted mt-1">
                        Prefix for store order invoices (e.g. ST-1001) separated from workshop (RT-) and manual (INV-).
                      </Text>
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Zoho Manual Invoice Prefix</Label>
                      <Input
                        value={settings.zoho_invoice_prefix || ""}
                        onChange={(e) => updateSettingField("zoho_invoice_prefix", e.target.value)}
                        placeholder="INV-"
                        size="small"
                      />
                      <Text className="text-[11px] text-ui-fg-muted mt-1">
                        Default prefix for manual or standalone invoices in Zoho Books.
                      </Text>
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

          <div className="flex items-center justify-end gap-3 mt-4">
            {saveSuccessMsg && (
              <span className="text-xs text-ui-fg-interactive font-medium">✓ {saveSuccessMsg}</span>
            )}
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

                {/* Autofill Customer from Medusa / Tickets / Documents */}
                <div className="col-span-2">
                  <CustomerAutofillCombobox
                    candidates={customerAutofillCandidates}
                    loading={loadingCustomers || loadingRepairs}
                    onSelectCustomer={(candidate) => {
                      setManualForm((prev) => ({
                        ...prev,
                        customer_name: candidate.name,
                        company_name: candidate.company_name,
                        customer_email: candidate.email,
                        customer_phone: candidate.phone,
                        customer_address: candidate.address || prev.customer_address,
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label className="text-xs">Company Name (Optional)</Label>
                  <Input
                    value={manualForm.company_name}
                    onChange={(e) => setManualForm({ ...manualForm, company_name: e.target.value })}
                    placeholder="Company / Organization Name"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Name *</Label>
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
                <div className="col-span-2">
                  <Label className="text-xs">Customer Address (Optional)</Label>
                  <Input
                    value={manualForm.customer_address}
                    onChange={(e) => setManualForm({ ...manualForm, customer_address: e.target.value })}
                    placeholder="Street Address, City, Postal Code"
                    size="small"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Generation Source</Label>
                  <div className="flex items-center gap-2 mt-1 px-3 py-2 rounded-md border border-ui-border-base bg-ui-bg-subtle text-xs text-ui-fg-base">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-ui-fg-base">Zoho Books (Cloud Invoicing)</span>
                    <Badge size="small" color="blue" className="ml-auto font-mono">Enforced</Badge>
                  </div>
                  <Text className="text-[11px] text-ui-fg-subtle mt-1">
                    All manual invoices and quotes are generated and synced directly via Zoho Books. Local PDFKit fallback is disabled.
                  </Text>
                </div>
              </div>

              {/* Line Items */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Itemized Line Items</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-ui-fg-subtle">Currency:</Label>
                    <Select
                      value={manualForm.currency_code}
                      onValueChange={(v) => setManualForm({ ...manualForm, currency_code: v })}
                    >
                      <Select.Trigger size="small" className="w-24">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="kes">KES (KSh)</Select.Item>
                        <Select.Item value="usd">USD ($)</Select.Item>
                        <Select.Item value="gbp">GBP (£)</Select.Item>
                        <Select.Item value="eur">EUR (€)</Select.Item>
                        <Select.Item value="cad">CAD ($)</Select.Item>
                        <Select.Item value="aud">AUD ($)</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                </div>

                {/* Table Header / Column Labels */}
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-ui-bg-subtle rounded border border-ui-border-base text-[11px] font-semibold text-ui-fg-muted uppercase tracking-wider">
                  <div className="col-span-6">Description / Item Details</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {/* Line Item Rows */}
                {manualForm.items.map((item, idx) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                  return (
                    <div
                      key={idx}
                      className="p-3 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-2 relative group hover:border-ui-border-interactive transition-colors"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        {/* Title & Description */}
                        <div className="col-span-6 flex flex-col gap-1.5">
                          <div>
                            <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Item Name / Service Title *</Label>
                            <Input
                              placeholder="e.g. Screen Replacement / Diagnostic"
                              value={item.title}
                              onChange={(e) => {
                                const updated = [...manualForm.items];
                                updated[idx].title = e.target.value;
                                setManualForm({ ...manualForm, items: updated });
                              }}
                              size="small"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Specifications / Details (Optional)</Label>
                            <Input
                              placeholder="e.g. OEM grade component, includes installation"
                              value={item.description || ""}
                              onChange={(e) => {
                                const updated = [...manualForm.items];
                                updated[idx].description = e.target.value;
                                setManualForm({ ...manualForm, items: updated });
                              }}
                              size="small"
                            />
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 flex flex-col">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...manualForm.items];
                              updated[idx].quantity = Math.max(1, Number(e.target.value) || 1);
                              setManualForm({ ...manualForm, items: updated });
                            }}
                            size="small"
                            className="text-center font-medium"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-2 flex flex-col">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...manualForm.items];
                              updated[idx].unit_price = Number(e.target.value);
                              setManualForm({ ...manualForm, items: updated });
                            }}
                            size="small"
                            className="text-right font-medium"
                          />
                        </div>

                        {/* Line Total & Remove */}
                        <div className="col-span-2 flex flex-col items-end justify-between self-stretch">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Row Total</Label>
                          <span className="text-xs font-semibold text-ui-fg-base py-1">
                            {formatCurrency(lineTotal, manualForm.currency_code)}
                          </span>
                          {manualForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = manualForm.items.filter((_, i) => i !== idx);
                                setManualForm({ ...manualForm, items: updated });
                              }}
                              className="text-ui-fg-muted hover:text-red-500 p-1 rounded hover:bg-ui-bg-subtle transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between mt-1">
                  <Button
                    variant="secondary"
                    size="small"
                    className="text-xs"
                    onClick={() =>
                      setManualForm({
                        ...manualForm,
                        items: [
                          ...manualForm.items,
                          { title: "", description: "", quantity: 1, unit_price: 0 },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
                  </Button>

                  {/* Summary Subtotal Box */}
                  <div className="flex items-center gap-3 bg-ui-bg-subtle px-4 py-2 rounded border border-ui-border-base">
                    <span className="text-xs text-ui-fg-subtle font-medium">Document Total:</span>
                    <span className="text-sm font-bold text-ui-fg-base">
                      {formatCurrency(
                        manualForm.items.reduce(
                          (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                          0
                        ),
                        manualForm.currency_code
                      )}
                    </span>
                  </div>
                </div>
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
                <Button variant="primary" onClick={handleCreateManual} isLoading={isGeneratingManual}>
                  Generate Document
                </Button>
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
                Create a customized document (e.g. Warranty Certificate, Inspection Report, Service Clearance) and directly dispatch via email.
              </Text>

              {/* Repair Ticket Selector / Linker */}
              <div className="p-3.5 border border-ui-border-base rounded-lg bg-ui-bg-subtle flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DocumentText className="w-4 h-4 text-ui-fg-interactive" />
                    <Label className="text-xs font-semibold text-ui-fg-base">
                      Link / Load from Repair Ticket (Optional)
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedTicketId && (
                      <Button
                        variant="secondary"
                        size="small"
                        className="text-[11px] h-6 px-2 text-ui-fg-muted hover:text-red-600"
                        onClick={handleClearRepairLink}
                      >
                        Clear Ticket Link
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="small"
                      className="text-[11px] h-6 px-2"
                      onClick={loadRepairTickets}
                      isLoading={loadingRepairs}
                    >
                      <ArrowPath className="w-3 h-3 mr-1" /> Refresh Tickets
                    </Button>
                  </div>
                </div>

                <Text className="text-[11px] text-ui-fg-subtle">
                  Automatically autofills customer details, device specifications (model, serial/IMEI, accessories), technician notes, and services from active repairs.
                </Text>

                <RepairTicketCombobox
                  tickets={availableTickets}
                  selectedTicketId={selectedTicketId}
                  onSelectTicket={handleSelectRepairTicket}
                  onClear={handleClearRepairLink}
                  loading={loadingRepairs}
                />

                {selectedTicketId && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-ui-bg-interactive-subtle border border-ui-border-interactive text-[11px] text-ui-fg-interactive font-medium">
                    <span>✓ Loaded details from ticket</span>
                    <span className="font-semibold underline">
                      {customDocForm.custom_fields?.["Ticket Reference"] || selectedTicketId}
                    </span>
                    <span>• {customDocForm.custom_fields?.["Device Model"]}</span>
                  </div>
                )}
              </div>

              {/* Optional Preset Templates Selector */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold">Select a Document Preset (Optional)</Label>
                <Text className="text-[11px] text-ui-fg-subtle">
                  Pick a pre-configured template below to automatically populate title, certificate text, and itemized points.
                </Text>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                  {CUSTOM_DOC_PRESETS.map((preset) => {
                    const isSelected = customDocForm.preset_id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => selectCustomDocPreset(preset.id)}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "border-ui-border-interactive bg-ui-bg-interactive-subtle shadow-sm ring-1 ring-ui-border-interactive"
                            : "border-ui-border-base bg-ui-bg-base hover:border-ui-border-strong hover:bg-ui-bg-subtle"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xl">{preset.icon}</span>
                          <Badge size="small" color={isSelected ? "blue" : "grey"}>
                            {preset.badge}
                          </Badge>
                        </div>
                        <div className="text-xs font-semibold text-ui-fg-base leading-snug">
                          {preset.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Document Title</Label>
                  <Input
                    value={customDocForm.title}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, title: e.target.value })}
                    placeholder="e.g. Warranty Certificate / Diagnostic Report"
                    size="small"
                  />
                </div>

                {/* Autofill Customer from Medusa / Tickets / Documents */}
                <div className="col-span-2">
                  <CustomerAutofillCombobox
                    candidates={customerAutofillCandidates}
                    loading={loadingCustomers || loadingRepairs}
                    onSelectCustomer={(candidate) => {
                      setCustomDocForm((prev) => ({
                        ...prev,
                        customer_name: candidate.name,
                        company_name: candidate.company_name,
                        customer_email: candidate.email,
                        customer_phone: candidate.phone,
                        customer_address: candidate.address || prev.customer_address,
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label className="text-xs">Company Name (Optional)</Label>
                  <Input
                    value={customDocForm.company_name}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, company_name: e.target.value })}
                    placeholder="Company / Organization Name"
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Name *</Label>
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
                <div>
                  <Label className="text-xs">Customer Phone (Optional)</Label>
                  <Input
                    value={customDocForm.customer_phone}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, customer_phone: e.target.value })}
                    placeholder="+44 7911 123456"
                    size="small"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Customer Address (Optional)</Label>
                  <Input
                    value={customDocForm.customer_address}
                    onChange={(e) => setCustomDocForm({ ...customDocForm, customer_address: e.target.value })}
                    placeholder="Street Address, City, Postal Code"
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

              {/* Line Items for Custom Doc */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Included Items / Service Specifications (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-ui-fg-subtle">Currency:</Label>
                    <Select
                      value={customDocForm.currency_code}
                      onValueChange={(v) => setCustomDocForm({ ...customDocForm, currency_code: v })}
                    >
                      <Select.Trigger size="small" className="w-24">
                        <Select.Value />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="kes">KES (KSh)</Select.Item>
                        <Select.Item value="usd">USD ($)</Select.Item>
                        <Select.Item value="gbp">GBP (£)</Select.Item>
                        <Select.Item value="eur">EUR (€)</Select.Item>
                        <Select.Item value="cad">CAD ($)</Select.Item>
                        <Select.Item value="aud">AUD ($)</Select.Item>
                      </Select.Content>
                    </Select>
                  </div>
                </div>

                {/* Table Header / Column Labels */}
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-ui-bg-subtle rounded border border-ui-border-base text-[11px] font-semibold text-ui-fg-muted uppercase tracking-wider">
                  <div className="col-span-6">Description / Item Details</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>

                {/* Line Item Rows */}
                {customDocForm.items.map((item, idx) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                  return (
                    <div
                      key={idx}
                      className="p-3 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-2 relative group hover:border-ui-border-interactive transition-colors"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        {/* Title & Description */}
                        <div className="col-span-6 flex flex-col gap-1.5">
                          <div>
                            <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Item Name / Service Title</Label>
                            <Input
                              placeholder="e.g. Diagnostic / Inspection Finding"
                              value={item.title}
                              onChange={(e) => {
                                const updated = [...customDocForm.items];
                                updated[idx].title = e.target.value;
                                setCustomDocForm({ ...customDocForm, items: updated });
                              }}
                              size="small"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Details / Specifications (Optional)</Label>
                            <Input
                              placeholder="e.g. Coverage terms, diagnostic measurement"
                              value={item.description || ""}
                              onChange={(e) => {
                                const updated = [...customDocForm.items];
                                updated[idx].description = e.target.value;
                                setCustomDocForm({ ...customDocForm, items: updated });
                              }}
                              size="small"
                            />
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 flex flex-col">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...customDocForm.items];
                              updated[idx].quantity = Math.max(1, Number(e.target.value) || 1);
                              setCustomDocForm({ ...customDocForm, items: updated });
                            }}
                            size="small"
                            className="text-center font-medium"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-2 flex flex-col">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...customDocForm.items];
                              updated[idx].unit_price = Number(e.target.value);
                              setCustomDocForm({ ...customDocForm, items: updated });
                            }}
                            size="small"
                            className="text-right font-medium"
                          />
                        </div>

                        {/* Line Total & Remove */}
                        <div className="col-span-2 flex flex-col items-end justify-between self-stretch">
                          <Label className="text-[11px] text-ui-fg-subtle mb-0.5">Row Total</Label>
                          <span className="text-xs font-semibold text-ui-fg-base py-1">
                            {formatCurrency(lineTotal, customDocForm.currency_code)}
                          </span>
                          {customDocForm.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = customDocForm.items.filter((_, i) => i !== idx);
                                setCustomDocForm({ ...customDocForm, items: updated });
                              }}
                              className="text-ui-fg-muted hover:text-red-500 p-1 rounded hover:bg-ui-bg-subtle transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between mt-1">
                  <Button
                    variant="secondary"
                    size="small"
                    className="text-xs"
                    onClick={() =>
                      setCustomDocForm({
                        ...customDocForm,
                        items: [
                          ...customDocForm.items,
                          { title: "", description: "", quantity: 1, unit_price: 0 },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
                  </Button>

                  {/* Summary Subtotal Box */}
                  <div className="flex items-center gap-3 bg-ui-bg-subtle px-4 py-2 rounded border border-ui-border-base">
                    <span className="text-xs text-ui-fg-subtle font-medium">Document Total:</span>
                    <span className="text-sm font-bold text-ui-fg-base">
                      {formatCurrency(
                        customDocForm.items.reduce(
                          (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
                          0
                        ),
                        customDocForm.currency_code
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Equipment & Record Specifications (Custom Fields) */}
              <div className="flex flex-col gap-2 p-3.5 border border-ui-border-base rounded-lg bg-ui-bg-subtle">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-ui-fg-base">
                      Equipment & Record Specifications (Custom Fields)
                    </Label>
                    <Text className="text-[11px] text-ui-fg-subtle">
                      Key-value metadata printed prominently in the client & equipment specifications summary box.
                    </Text>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-1">
                  {Object.entries(customDocForm.custom_fields || {}).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-12 gap-2 items-center bg-ui-bg-base p-2 rounded border border-ui-border-base">
                      <div className="col-span-4">
                        <Label className="text-[11px] text-ui-fg-subtle mb-0.5">{key}</Label>
                      </div>
                      <div className="col-span-7">
                        <Input
                          size="small"
                          value={value}
                          onChange={(e) => {
                            setCustomDocForm({
                              ...customDocForm,
                              custom_fields: {
                                ...(customDocForm.custom_fields || {}),
                                [key]: e.target.value,
                              },
                            });
                          }}
                          placeholder={`Enter ${key}...`}
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...(customDocForm.custom_fields || {}) };
                            delete updated[key];
                            setCustomDocForm({ ...customDocForm, custom_fields: updated });
                          }}
                          className="text-ui-fg-muted hover:text-red-500 p-1 rounded hover:bg-ui-bg-subtle transition-colors cursor-pointer"
                          title="Delete Field"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add New Custom Field Row */}
                  <div className="grid grid-cols-12 gap-2 items-center pt-1">
                    <div className="col-span-4">
                      <Input
                        size="small"
                        placeholder="New Field Name (e.g. Battery Health)"
                        value={newCustomFieldKey}
                        onChange={(e) => setNewCustomFieldKey(e.target.value)}
                      />
                    </div>
                    <div className="col-span-6">
                      <Input
                        size="small"
                        placeholder="Field Value (e.g. 98% Peak Performance)"
                        value={newCustomFieldValue}
                        onChange={(e) => setNewCustomFieldValue(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        className="w-full text-xs"
                        onClick={() => {
                          if (!newCustomFieldKey.trim()) return;
                          setCustomDocForm({
                            ...customDocForm,
                            custom_fields: {
                              ...(customDocForm.custom_fields || {}),
                              [newCustomFieldKey.trim()]: newCustomFieldValue.trim(),
                            },
                          });
                          setNewCustomFieldKey("");
                          setNewCustomFieldValue("");
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Field
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms & Conditions / Special Notes */}
              <div>
                <Label className="text-xs font-semibold">Terms & Conditions / Special Notes (Printed at bottom)</Label>
                <Textarea
                  value={customDocForm.notes || ""}
                  onChange={(e) => setCustomDocForm({ ...customDocForm, notes: e.target.value })}
                  placeholder="Official warranty terms, legal compliance notes, or inspection disclaimers..."
                  rows={3}
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
                <Button variant="primary" onClick={handleCreateCustomDoc} isLoading={isGeneratingCustom}>
                  Generate & Deliver
                </Button>
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

      {/* ========================================================= */}
      {/* MODAL 4: TEMPLATE LIVE PREVIEW MODAL                      */}
      {/* ========================================================= */}
      {previewModalOpen && (
        <FocusModal open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
          <FocusModal.Content>
            <FocusModal.Header className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <Heading level="h2" className="text-base font-semibold">
                  Template Live Preview
                </Heading>
                <Badge color="blue" size="small">
                  {previewStyle.toUpperCase()}
                </Badge>
                <Badge color="grey" size="small">
                  {previewType.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleOpenPreviewNewTab}
                >
                  Open in New Window
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleDownloadPreview}
                  disabled={!previewBlobUrl}
                >
                  <ArrowDownTray className="w-3.5 h-3.5 mr-1" />
                  Download PDF
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setPreviewModalOpen(false)}
                >
                  Close
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-6 flex flex-col gap-4 max-w-5xl mx-auto h-[82vh]">
              {/* Quick style and document type switcher toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-ui-bg-subtle border border-ui-border-base rounded-lg">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Style:</Label>
                  <Select value={previewStyle} onValueChange={(v) => switchPreview(v, previewType)}>
                    <Select.Trigger size="small" className="w-[180px]">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="modern">Modern Minimalist</Select.Item>
                      <Select.Item value="classic">Classic Corporate</Select.Item>
                      <Select.Item value="minimal">Clean Tech Monospace</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Document Type:</Label>
                  <Select value={previewType} onValueChange={(v) => switchPreview(previewStyle, v)}>
                    <Select.Trigger size="small" className="w-[190px]">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="invoice">Tax Invoice</Select.Item>
                      <Select.Item value="receipt">Payment Receipt</Select.Item>
                      <Select.Item value="packing_slip">Packing Slip</Select.Item>
                      <Select.Item value="estimate">Estimate / Quote</Select.Item>
                      <Select.Item value="custom">Custom Document</Select.Item>
                      <Select.Item value="job_card">Repair Job Card</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => switchPreview(previewStyle, previewType)}
                  isLoading={isPreviewModalLoading}
                >
                  <ArrowPath className="w-3.5 h-3.5 mr-1" /> Refresh Preview
                </Button>
              </div>

              {/* PDF Viewer Iframe */}
              <div className="flex-1 w-full bg-ui-bg-subtle border border-ui-border-base rounded-lg overflow-hidden flex items-center justify-center relative min-h-[500px]">
                {isPreviewModalLoading ? (
                  <div className="flex flex-col items-center gap-3 text-ui-fg-subtle">
                    <ArrowPath className="w-6 h-6 animate-spin text-ui-fg-interactive" />
                    <Text className="text-xs">Rendering live template preview...</Text>
                  </div>
                ) : previewBlobUrl ? (
                  <iframe
                    src={previewBlobUrl}
                    className="w-full h-full border-0 rounded-lg"
                    title="Live Template Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-ui-fg-error">
                    <Text className="text-xs font-medium">Failed to generate PDF preview.</Text>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => switchPreview(previewStyle, previewType)}
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>
            </FocusModal.Body>
          </FocusModal.Content>
        </FocusModal>
      )}

      {/* Edit Document Modal */}
      {editModalOpen && editingDoc && (
        <FocusModal open={editModalOpen} onOpenChange={setEditModalOpen}>
          <FocusModal.Content>
            <FocusModal.Header className="flex items-center justify-between px-6 py-4 border-b border-ui-border-base">
              <div className="flex items-center gap-2">
                <PencilSquare className="w-5 h-5 text-purple-600" />
                <Heading level="h2">
                  Edit {editingDoc.type === "invoice" ? "Invoice" : "Quote / Estimate"} #{editingDoc.display_id}
                </Heading>
                <Badge color="purple" size="small">
                  Zoho Synced
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setEditModalOpen(false)}
                  disabled={isUpdatingDoc}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => handleSaveEditDocument()}
                  isLoading={isUpdatingDoc}
                  disabled={isUpdatingDoc}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Save & Sync to Zoho Books
                </Button>
              </div>
            </FocusModal.Header>
            <FocusModal.Body className="p-6 flex flex-col gap-6 max-w-3xl mx-auto overflow-y-auto max-h-[80vh]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Document Title</Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Email</Label>
                  <Input
                    value={editForm.customer_email}
                    onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                    size="small"
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer Phone</Label>
                  <Input
                    value={editForm.customer_phone}
                    onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                    size="small"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Itemized Line Items</Label>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() =>
                      setEditForm({
                        ...editForm,
                        items: [
                          ...editForm.items,
                          { title: "", description: "", quantity: 1, unit_price: 0 },
                        ],
                      })
                    }
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Line Item
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  {editForm.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 border border-ui-border-base rounded-lg bg-ui-bg-base flex flex-col gap-2"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-6 flex flex-col gap-1">
                          <Label className="text-[11px] text-ui-fg-subtle">Item Title *</Label>
                          <Input
                            placeholder="Item name / Service"
                            value={it.title}
                            onChange={(e) => {
                              const newItems = [...editForm.items];
                              newItems[idx] = { ...newItems[idx], title: e.target.value };
                              setEditForm({ ...editForm, items: newItems });
                            }}
                            size="small"
                          />
                        </div>
                        <div className="col-span-2 flex flex-col gap-1">
                          <Label className="text-[11px] text-ui-fg-subtle">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) => {
                              const newItems = [...editForm.items];
                              newItems[idx] = { ...newItems[idx], quantity: Number(e.target.value) || 1 };
                              setEditForm({ ...editForm, items: newItems });
                            }}
                            size="small"
                          />
                        </div>
                        <div className="col-span-3 flex flex-col gap-1">
                          <Label className="text-[11px] text-ui-fg-subtle">Unit Price</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={it.unit_price}
                            onChange={(e) => {
                              const newItems = [...editForm.items];
                              newItems[idx] = { ...newItems[idx], unit_price: Number(e.target.value) || 0 };
                              setEditForm({ ...editForm, items: newItems });
                            }}
                            size="small"
                          />
                        </div>
                        <div className="col-span-1 pt-6 flex justify-end">
                          <Button
                            variant="transparent"
                            size="small"
                            onClick={() => {
                              const newItems = editForm.items.filter((_, i) => i !== idx);
                              setEditForm({ ...editForm, items: newItems });
                            }}
                            className="text-ui-fg-muted hover:text-ui-fg-error p-1"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-ui-fg-subtle">Description (Optional)</Label>
                        <Input
                          placeholder="Optional item details / specifications"
                          value={it.description}
                          onChange={(e) => {
                            const newItems = [...editForm.items];
                            newItems[idx] = { ...newItems[idx], description: e.target.value };
                            setEditForm({ ...editForm, items: newItems });
                          }}
                          size="small"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal preview */}
                <div className="flex justify-end items-center gap-4 py-2 border-t border-ui-border-base">
                  <Text className="text-xs text-ui-fg-subtle">Calculated Total:</Text>
                  <Text className="text-sm font-semibold">
                    {formatCurrency(
                      editForm.items.reduce(
                        (sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0),
                        0
                      ),
                      editingDoc.currency_code || "KES"
                    )}
                  </Text>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Notes / Client Remarks</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Notes visible on the document..."
                  />
                </div>
                <div>
                  <Label className="text-xs">Terms & Conditions</Label>
                  <Textarea
                    value={editForm.terms}
                    onChange={(e) => setEditForm({ ...editForm, terms: e.target.value })}
                    rows={3}
                    placeholder="Terms and conditions..."
                  />
                </div>
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
