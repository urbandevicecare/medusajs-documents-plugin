# Changelog

All notable changes to `medusajs-documents-plugin` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.31] - 2026-11-01

### HTTP HEAD Request Handling, Accept-Ranges Byte Streaming & Order Fallback
- **HEAD Method Route Handlers & Unauthenticated Allowlist**: Exported `export const HEAD = GET;` across all document streaming and template preview routes (`/admin/documents/:id/document`, `/admin/documents/templates/preview`, `/api/admin/documents/:id/document`, `/documents/:id/document`, `/documents/templates/preview`) and added `HEAD` and `OPTIONS` to `src/api/middlewares.ts`. This resolves HTTP 401 Unauthorized errors caused when browsers, PDF viewers, or proxies issue HTTP HEAD requests to verify content type before fetching the PDF body.
- **HTTP Range & Accept-Ranges Streaming**: Added `Accept-Ranges: bytes` and HTTP 206 Partial Content byte-range slicing to stream handlers, supporting native PDF viewers and media pre-loaders requesting partial byte ranges.
- **Order Lookup Fallback in Admin Stream Route**: Extended `/admin/documents/:id/document` route lookup to query `order_id` in both database query layers.
- **Admin Document Navigation Alignment**: Restored `src/admin/routes/documents/page.tsx` view and preview handlers to use `/admin/documents/...` endpoints directly.
- **Zoho PDF Magic Bytes Verification**: Enforced `%PDF` header validation on buffers received from Zoho Books before invoking PDF post-processing.

## [1.1.30] - 2026-11-01

### Unauthenticated PDF Document Streaming & Robust Fallback Handling
- **Unauthenticated PDF Streaming**: Added `export const AUTHENTICATE = false;` to `/admin/documents/:id/document` and template preview routes, and registered matching allowlist middlewares in `src/api/middlewares.ts`. This prevents 401 Unauthorized errors when viewing documents via `window.open` or direct browser links without Bearer authorization headers.
- **Admin UI Streaming URLs**: Updated `src/admin/routes/documents/page.tsx` to point `window.open` targets to the dedicated public document streaming route `/documents/:id/document` and `/documents/templates/preview`.
- **Defensive PDFKit Fallback**: Hardened `PDFKitGenerator.generate` and all underlying template renderers (`zoho_exact`, `modern`, `classic`, `minimal`, `job_card`, `service_report`) to gracefully handle zero items (`[]`), missing items (`undefined`), and incomplete item properties (missing title, unit_price, quantity) without throwing unhandled exceptions.
- **Resilient Currency Formatting**: Enhanced `PDFKitGenerator.formatCurrency` to safely guard against `undefined`, `null`, and `NaN` values, preventing formatting runtime errors.
- **Service Document Retrieval & Knex String Parsing**: Made `DocumentModuleService.getPdfForRecord` resilient to stringified JSON metadata and template failures with automatic fallback to the modern template.
- **Repair Module Lookup Fallback**: Extended `/admin/documents/:id/document` to resolve document records via repair ticket tokens or ticket IDs if the primary ID lookup does not immediately match.

## [1.1.27] - 2026-11-01

### Repair Sync, 3-Column Template Gallery & Preset Previews
- **Repair Ticket & Zoho Books Bi-directional Sync (`/admin/documents/sync`)**: Added dedicated sync endpoint and Admin UI action to reconcile repair tickets with Zoho Books estimates/invoices, backfilling missing job cards, linking pre-existing quotes/invoices, and updating ticket metadata.
- **Enhanced PDF Templates UI**: Redesigned the Document Templates tab to match `Meduajs-repair-plugin` styling, with a modern 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) displaying 12 distinct cards (5 core operational document types + 7 specialized presets: Warranty, Diagnostic Report, Service Completion, Handover Protocol, Proforma Invoice, Trade-In Agreement, Equipment Destruction).
- **Preset Preview Endpoint**: Extended `/admin/documents/templates/preview` to accept `preset` query parameter, generating realistic contextual mock data and titles for all specialized document presets.
- **Documents Hub Default Filter**: Updated default document type filter from `"invoice"` to `"all"` so that job cards, estimates, and receipts are immediately accessible upon visiting the hub.

## [1.1.25] - 2026-11-01

### Receipt Companion Invoicing & Settings Tag Customization Hardening
- **Receipt Companion Invoicing Fix**: Fixed receipt companion invoice creation in Zoho Books to use the store invoice prefix (`ST-` or configured prefix) instead of `RCPT-`, preventing ghost invoice creation in Zoho.
- **Repair Priority over Store Order**: When both `repair_ticket_id` and `order_id` are present on a document or repair checkout payment, prioritize repair workshop identification (`RT-` prefix and repair ticket lookup) so repair tickets are not incorrectly classified as store orders.
- **Admin Settings Tag UI**: Exposed the Store Order Invoice Prefix / Tag setting directly in General Branding & Details in addition to Zoho Customizations, ensuring administrators can customize the store prefix even if Zoho Books is toggled off.
- **Universal Prefix Regex**: Generalized prefix stripping across `document-grouper`, `pdfkit-generator`, and `zoho-books` to support arbitrary custom tags (e.g. `SHOP-`, `ORD-`, `STORE-ORD-`) without losing ticket or order numbers.
- **Estimate Matching Precision**: Removed blind fallback to `estimates[0]` in `getEstimateByNumber`, ensuring only exact matches by number or reference are returned.
- **Strict Zoho Document Type Validation**: Restricted `POST /admin/documents/:id/sync-zoho` to strictly accept only `invoice` and `estimate` documents, returning HTTP 400 for receipts and packing slips.

## [1.1.24] - 2026-11-01

### Configurable Store Invoice Prefix & Zoho Idempotent Invoicing
- **Configurable Store Invoice Prefix**: Added `store_invoice_prefix` (defaulting to `ST-`) to `DocumentSettings` model, default settings, and the Admin UI Settings tab.
- **Store Order Invoice Generation**: Store order tax invoices in `orderDocumentsSubscriber` now generate with `${store_invoice_prefix}${order.display_id || order.id.slice(-6)}` (e.g. `ST-1001`), cleanly separating store orders from workshop (`RT-`) and manual (`INV-`) invoices.
- **Zoho Books Custom Numbering**: Ensured `ignore_auto_number_generation=true` is appended to Zoho Books endpoint and custom `invoice_number` is populated in payload.
- **Idempotent Pre-flight Lookup**: Added pre-flight lookup before creating Zoho invoices to reuse existing invoices and prevent duplicates without false cross-prefix matches.
- **Document Grouping & PDF Normalization**: Extended prefix stripping to cleanly group and render `ST-`, `STORE-`, and `PACK-` references alongside existing prefixes.

## [1.1.19] - 2026-10-17

### Localized Currency Normalization & KES Formatting
- **Document Record Currency Default**: Updated default currency to `kes` in `DocumentRecord` model.
- **Document Grouper Currency Normalization**: Fallback normalizes legacy `"usd"` or empty currency codes to `"kes"` so grouped packs consistently format in KES.
- **Admin Hub Currency Formatting**: Introduced `formatCurrency` helper across all Admin Hub views (master packed rows, related docs dropdown, accordion sub-tables, flat list, and creation modals), defaulting to `en-KE` / `KES` (`KSh ...`) and preventing unwanted dollar (`$`) rendering.

## [1.1.17] - 2026-10-16

### Seamless Zoho Books Credentials Inheritance
- **Auto-Inherit Zoho Credentials**: `DocumentModuleService.getSettings` now automatically inherits Zoho Books OAuth configuration from `repair_settings` if not explicitly populated in `document_settings`. This ensures seamless integration and stops invoices from falling back to PDFKit when Zoho is active.

## [1.1.16] - 2026-10-16

### Group & Pack Related Documents by Job / Order

- **Packed Document Rows by Job / Order**:
  - Automatically clusters related documents belonging to the same repair or order into a single collapsed master row to dramatically save vertical space.
  - Multi-tier correlation algorithm (`src/utils/document-grouper.ts`):
    - Correlates by `repair_ticket_id`
    - Correlates by `order_id`
    - Correlates by normalized base reference number suffix (e.g. `1792156525673-SNL9QH` shared between `JOB-`, `RT-`, `EST-`, `RCPT-`, and `1001` shared between `INV-`, `RCPT-`, `PKG-`).
- **Primary Invoice Priority in Collapsed View**:
  - If an **Invoice** is present in the pack, the collapsed master row prominently displays the **Invoice** display ID, amount, and payment status.
  - If an invoice is not yet generated, primary representation gracefully falls back to Quote/Estimate or Job Card.
  - Reference column features a count badge (e.g. `4 docs`) and an expandable chevron (`▼` / `▶`).
  - Type column shows a clear summary of included documents: `Includes: Job Card • Quote • Invoice • Receipt`.
- **Inline Accordion Sub-Table & Quick Dropdown Menu**:
  - Clicking the chevron or row expands an indented nested sub-table directly below the parent row with distinct color-coded badges for every document in the workflow:
    - `Job Card` (orange)
    - `Quote / Estimate` (blue)
    - `Tax Invoice` (green / purple)
    - `Payment Receipt` (emerald / purple)
    - `Packing Slip` (amber / grey)
  - Every child document includes clickable PDF view/download, status badge, amount, source, created date, and individual actions (View, Send, Push Zoho, Copy shortlink).
  - Added a "Related Docs" quick-action dropdown menu (`Docs (4) ▼`) directly on the master row for rapid one-click access.
- **Pack by Job / Order Toolbar Switch**:
  - Added a toggle switch in the Admin Hub toolbar to easily switch between the packed view (enabled by default) and the flat document list anytime.
- **Comprehensive Test Suite**:
  - Added `tests/document-grouping.test.ts` validating base reference extraction, priority scoring, multi-tier clustering, and lifecycle ordering (48/48 unit tests passing).

---

## [1.1.14] - 2026-10-16

### Company Name Support, Shortlink 500 Fix, Duplicate Prefix Cleanup & Currency Improvements

- **Short Payment Link HTTP 500 Resolution**:
  - Implemented universal `handleShortlinkRedirect` utility protecting against `TypeError: req.get is not a function` across Medusa v2 / Express / Fastify environments.
  - Added safe extraction of `host` (`x-forwarded-host` -> `host` -> `req.hostname` -> `localhost:9000`) and `protocol` (`x-forwarded-proto` -> `req.protocol` -> `https`).
  - Added multi-tier fallback lookup: checks `documents` module, `repair` module, `document_link` table, `repair_link` table, `document_record` table, and `repair_ticket` table.
  - Safe redirect execution via `res.redirect` with fallback to `Location` header + HTTP 302.
  - Updated all shortlink routes: `/r/:code`, `/documents/r/:code`, `/store/documents/r/:code`, and `/api/store/documents/r/:code`.
- **Customer Company Name Priority**:
  - Prioritized customer `company_name` over personal name across document records, PDFKit generator, and Zoho Books contact synchronization.
  - Updated Modern, Classic, and Minimal PDFKit templates to render `customerDisplayName = data.customer.company_name || data.customer.name` with `(Attn: ${name})` when personal contact name differs.
  - Added `company_name` input fields to manual document and custom document modals in Admin UI.
- **Prevent Pushing Non-Zoho Documents to Zoho Books**:
  - Disabled and hid the "Push Zoho" action button in Admin UI for non-Zoho document types (`job_card`, `packing_slip`, `custom`) and documents with zero or negative total amounts.
  - Enforced strict validation in `POST /admin/documents/:id/sync-zoho`, rejecting non-Zoho document types and zero-amount documents with informative HTTP 400 messages.
- **Eliminate Duplicate `RT-` & `JOB-RT-` Reference Prefixes**:
  - Normalized repair ticket number prefixes across `repair-documents` subscriber and document generator to prevent duplicate prefixes such as `RT-RT-...` and `JOB-RT-...`.
  - Output clean formatted reference IDs like `RT-1792156525673-SNL9QH` and `JOB-1792156525673-SNL9QH`.
- **Live Zoho Books Invoices UI & Hover Tooltip Refresh Button**:
  - Converted the "Refresh Live Zoho" / "View Live Zoho" button in the filter bar and the Live Zoho table header into dedicated `IconButton` components wrapped with interactive hover tooltips (`<Tooltip content="Refresh Live Zoho Books Invoices">`).
  - Live Zoho Books invoices table is permanently visible and automatically synchronized on initial mount, tab switches, and on-demand refreshes.
- **Default Document Types to Invoices**:
  - Filter bar, preview modal, and manual document creation form now default to `"invoice"` (Tax Invoice / Invoices).
- **Currency Formatting Defaulted to KES**:
  - Set default currency to `KES` (Kenya Shillings / `KSh 1,500.00`) across all Admin UI tables, amount summaries, PDFKit templates, and notification dispatches when not explicitly overridden by store region settings.

---

## [1.1.13] - 2026-10-16

### Live Zoho Books Invoices View Enhancements

- Added persistent Live Zoho Books Invoices table to the Documents Hub.
- Automatically queries Zoho API upon mounting with localized empty states.

---

## [1.1.12] - 2026-10-16

### Admin UI Enhancements: Auto-fetch Live Zoho Documents & Invoices Default Filter

- **Persistent Live Zoho Books Invoices Section**:
  - The live Zoho Books documents table is now permanently visible on the All Documents tab instead of hiding when unpopulated.
  - Added dedicated loading state ("Fetching live documents from Zoho Books...") and empty state guidance.
  - Added localized "Refresh Zoho" action button directly in the section header.
- **Auto-Fetch on Mount & Global Refresh Integration**:
  - Automatically fetches live Zoho invoices upon mounting the documents admin route (`useEffect`).
  - Integrated live Zoho fetching into the global toolbar refresh button to update both local documents and Zoho cloud documents simultaneously with spinning feedback.
  - Linked document type filter dropdown changes to trigger synchronous live Zoho document category lookups (`invoices` vs `estimates`).
- **Default Document Filter**:
  - Initialized default `typeFilter` to `"invoice"` (Invoices) when opening the Documents Hub.

---

## [1.1.10] - 2026-10-16

### Documentation & Registration Safeguards

- **Installation & Setup Documentation Update**:
  - Corrected `medusa-config.ts` registration snippet in `README.md` to show registration solely within the `plugins: [...]` array.
  - Added a prominent `[!IMPORTANT]` warning cautioning users never to declare the plugin in both `plugins` and `modules`, explaining how Medusa v2's `mergePluginModules` loader overwrites internal model/migration directory paths, causing skipped migrations (`relation "document_settings" does not exist`) and MikroORM `reading 'fork'` runtime exceptions.

---

## [1.1.9] - 2026-10-16

### Patch Release: PostgreSQL 42P01 Missing Table Resilience & Barcode Generation Support

- **PostgreSQL 42P01 (`undefined_table`) Graceful Recovery**:
  - Added `isUndefinedTableError` to catch PostgreSQL error `42P01` / `relation "..." does not exist` across both MikroORM DML and Knex fallback paths.
  - Hardened `GET /admin/documents/settings` to return default settings with `{ settings: defaultSettings, success: true, warning: "Migrations pending" }` and HTTP 200 instead of crashing with HTTP 500 when tables are not yet migrated.
  - Hardened `GET /admin/documents` to return `{ documents: [], count: 0, warning: "Migrations pending" }` and HTTP 200 when `document_record` table has not yet been migrated.
  - Hardened `POST /admin/documents/settings` to return a clear, actionable error `{ message: "Database table document_settings does not exist. Please run npx medusa db:migrate.", error: true }` with status 400.
  - Hardened `DocumentModuleService.getSettings` to safely return `DEFAULT_DOCUMENT_SETTINGS` if table `document_settings` does not exist.
  - Hardened `DocumentModuleService.generateDocument` and `getPdfForRecord` against `42P01` with explicit migration reminder errors.
- **1D Barcode (Code 128) Generation**:
  - Integrated `bwip-js` Code 128 barcode rendering on document headers and repair tickets using `display_id`.
- **Comprehensive Unit Testing**:
  - Added test suite in `tests/table-resilience.test.ts` verifying error classification, mock missing table recovery, and route resilience across all document endpoints.

---

## [1.1.6] - 2026-10-16

### Patch Release: Safe Knex Resolution via `ContainerRegistrationKeys.PG_CONNECTION` & DML Table Name Correction

- **Container DI Registration Key Fix**: Resolved `AwilixResolutionError: Could not resolve 'pg_connection'` by introducing `getDatabaseConnection(container)` helper which queries `ContainerRegistrationKeys.PG_CONNECTION` (`"__pg_connection__"`), `"__pg_connection__"`, and `"pg_connection"` with `{ allowUnregistered: true }` wrapped safely in try/catch blocks.
- **Awilix Cradle Proxy Safety**: Eliminated raw property lookups against `__container__` proxies which bypass `allowUnregistered` and trigger unhandled errors in Medusa v2.
- **DML Database Table Alignment**: Fixed table name mismatch where Knex fallback queries were referencing `document_records` (plural) instead of the singular `document_record` table created by Medusa v2 DML (`model.define("document_record", ...)`), preventing `relation "document_records" does not exist` 500 runtime exceptions in document listings and PDF streams.
- **Primary Key Entity ID Generation**: Generated standard Medusa entity IDs (`docset_...`, `doc_...`) via `generateEntityId` on Knex fallback inserts, preventing PostgreSQL not-null constraint violations on primary key `"id"`.
- **Soft-Delete & OR-Precedence Safeguards**: Applied `.whereNull("deleted_at")` with grouped sub-clauses across all Knex fallback queries to exclude soft-deleted records and maintain predicate integrity.
- **Compatibility Route Resilience**: Added Knex fallback handling and safe logger resolution across `/api/admin/documents/:id/document`, `/api/documents/:id/document`, and universal shortlink `/r/:code`.
- **Backend Dependency Update**: Pointed `admin.urbandevicecare.co.uk` backend dependency to `"medusajs-documents-plugin": "^1.1.6"`.

---

## [1.1.5] - 2026-10-16

### Patch Release: Dual Transaction Context Injection & Direct Knex Fallback for Settings & Documents

- **Resolved `reading 'fork'` Exception**: Fixed runtime `TypeError: Cannot read properties of undefined (reading 'fork')` encountered when loading or saving plugin settings (`GET/POST /admin/documents/settings`) and viewing documents (`GET /admin/documents`).
- **Transaction Context Resolution**: Injected `sharedContext` with the resolved MikroORM `manager` from `req.scope` into all generated `MedusaService` operations.
- **Fail-Safe PostgreSQL/Knex Fallbacks**: Added direct Knex fallback queries (`pg_connection`) for retrieving and persisting settings (`document_settings`) and document records (`document_records`), ensuring zero runtime crashes even in non-standard plugin loading or standalone module environments.
- **Resilient PDF Streaming**: Updated admin and public PDF retrieval routes to pass transaction context and fallback to Knex if module repository manager is uninitialized.

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
