# Changelog

All notable changes to `medusajs-documents-plugin` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2026-10-15

### Patch Release: Public Stream Endpoints, Shortlink Normalization & Repair Handover

- **Public Recipient Streaming Endpoints**: Updated document URLs and shortlinks to resolve against the public recipient streaming route (`/documents/:id/document`), eliminating 404/401 errors caused by targeting internal admin routes.
- **Shortlink Normalization**: Added automatic subpath and host rewriting so legacy stored links gracefully redirect to the backend streaming endpoint.
- **Deposit & Partial Payment Itemization**: Re-aligned receipt line items and summary labels (`AMOUNT PAID:` vs `TOTAL DUE:`) when partial deposits are recorded, preventing balance mismatch errors in Zoho Books.
- **Suppressed E-Commerce Notifications for Repairs**: Filtered out fulfillment and order shipment notifications for repair-tied orders, preventing duplicate e-commerce alerts for repair tickets.

## [1.1.0] - 2026-10-12

### Minor Release: Repair Job Card Intake & Automated Release Pipeline

#### ✨ What's New in v1.1.0

- **First-Class Repair Job Card Generation (`type: "job_card"`)**:
  - Automatically triggered upon repair intake (`repair.created`).
  - Device specifications: Brand, Model, Serial Number, and IMEI.
  - Workshop physical intake condition, accessories left, and customer reported fault.
  - Workshop technician diagnostic checklist `[ ]`.
  - Dual physical sign-off lines: **Customer Signature** & **Workshop Technician Signature**.
  - Dynamic QR code directing straight to customer online repair tracking portal.

- **Repair Event Subscribers & Delegation**:
  - Event listeners for `repair.created` and `repair.payment_received`.
  - Automatic Query Graph hydration of repair ticket details for document rendering.
  - Seamless delegation from `Meduajs-repair-plugin` with fallback protection.

- **Automated CI/CD & Distribution Pipeline**:
  - GitHub Actions release pipeline with automated version tagging.
  - Dynamic changelog extraction as release notes.
  - Release asset bundling with compressed `.zip` distribution archive and `.tgz` npm package.
  - Automated public publishing to the npm registry with authentication tokens.

---

## [1.0.0] - 2026-10-12

### Initial Release: Medusa v2 Documents & Accounting Plugin

Comprehensive document generation, accounting synchronization, and multi-channel notification engine for Medusa v2 with Zoho Books integration, local PDFKit fallback, dynamic QR codes, short links, and a unified Admin Documents Hub.

#### ✨ Key Features

- **First-Class Repair Job Cards (`job_card`)**:
  - Automatic intake generation when `repair.created` fires.
  - Device specifications (Brand, Model, Serial Number, IMEI).
  - Cosmetic condition, accessories left with workshop, and reported fault description.
  - Diagnostic checklist `[ ]` tasks for workshop technicians.
  - Dual physical sign-off lines: **Customer Signature** & **Workshop Technician Signature**.
  - Scannable QR code directing straight to customer online repair tracking portal.

- **Zoho Books Synchronization**:
  - Automatic customer contact creation and matching.
  - Real-time generation of Invoices, Estimates, and Payment Receipts via Zoho Books API.
  - Native Zoho invoice QR code customization and notes injection.
  - Two-way reference mapping with local fallback records.

- **Local PDFKit Generation Engine (Fallback)**:
  - 3 modern, clean, print-ready document templates:
    - **Modern Minimalist**: Crisp clean lines, typography-driven hierarchy, accent color branding.
    - **Classic Corporate**: Traditional business layout with header grids and signature blocks.
    - **Clean Tech Monospace**: Tech-repair inspired monospace layout with scannable barcodes and checklist grids.
  - Document types: Job Cards, Tax Invoices, Payment Receipts, Estimates / Quotes, Packing Slips, and Custom Certificates.
  - Complete removal of semi-transparent watermarks for sharp, professional PDFs.

- **Paystack Dynamic Scan-to-Pay QR Codes & Short Links**:
  - Direct QR code embedded onto invoices and estimates for instant mobile checkout.
  - Built-in URL shortener (`/store/documents/r/:code`) for clean, deliverable SMS and WhatsApp links.

- **Multi-Channel Notification Dispatcher**:
  - **Email**: Responsive HTML emails with document branding, summary tables, and download/pay CTAs.
  - **SMS**: Concise SMS notifications powered by TalkSasa SMS provider.
  - **WhatsApp**: Rich formatting with emoji bullets and direct short links.

- **Unified Admin Documents Hub (`/app/documents`)**:
  - **All Documents Tab**: Search, filter by document type (including Job Cards), view statuses, create manual invoices, and resend notifications.
  - **PDF Templates Tab**: Live document previewers and template style switchers.
  - **Automations Tab**: Per-event subscriber toggle switches for order and repair events.
  - **Settings Tab**: Zoho Books OAuth configuration, domain selector, company branding, and QR options.

- **Automated Event Subscribers**:
  - Order events: `order.placed`, `order.completed`, `payment.captured`, `order.fulfillment_created`.
  - Repair events: `repair.created`, `repair.status_changed`, `repair.payment_received`, `repair.completed`, `repair.customer_reminder`.

- **Graceful Integration Utility**:
  - Exported `delegateDocumentGeneration` and `DOCUMENTS_MODULE` helpers allowing external plugins (like `Meduajs-repair-plugin`) to delegate document generation while maintaining safe fallbacks.
