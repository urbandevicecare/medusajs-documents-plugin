# Medusa v2 Documents Plugin (`medusajs-documents-plugin`)

A powerful, production-ready document generation, accounting, and multi-channel notification plugin for **Medusa v2**, modeled after `@rsc-labs/medusa-documents-v2` with deep **Zoho Books** accounting integration, **PDFKit multi-template fallback**, **Paystack QR codes & short payment links**, **Medusa Workflows**, and a **unified Admin Documents Hub**.

---

## Key Features

1. **Unified Documents Hub**
   - Access all invoices, payment receipts, quotations/estimates, packing slips, and custom certificates in one single Medusa Admin tab.
   - Eliminates the need to switch back and forth into the Zoho Books app for day-to-day document lookup.
   - Includes full-text search, type filtering, source filtering (Zoho vs PDFKit), and direct actions: View PDF, Send Notification, Push to Zoho, and Copy Short Link.

2. **Zoho Books Integration & Exposed Customizations**
   - Official Zoho Books API v3 integration with automated OAuth access token refreshing.
   - Contacts, Invoices, and Estimates automatically sync to your Zoho organization.
   - Exposes common Zoho customizations directly in the plugin settings (Terms & Conditions, Customer Notes, Net Payment Due Days, Tax Inclusive/Exclusive treatment, Invoice Prefix) so you don't have to open Zoho Books to tweak them.

3. **PDFKit Fallback with Multiple Design Templates**
   - Automatically takes over when Zoho Books is disabled, credentials are unset, or for documents that Zoho doesn't support (such as Packing Slips and Custom Warranty Certificates).
   - Choose between 3 distinct aesthetic templates in the **PDF Templates** tab:
     - **Modern Minimalist**: Crisp headers, subtle borders, accent banners, and modern typography.
     - **Classic Corporate**: Traditional formal grid, serif typography, double border lines.
     - **Clean Tech Monospace**: High-contrast, monospace typography optimized for hardware, repairs, and technical orders.
   - Instant live PDF preview button for each template directly in Admin.

4. **Paystack Payment Links & Embedded QR Codes**
   - For all unpaid documents (orders with remaining balance or repair tickets):
     - Computes exact balance due.
     - Generates secure Paystack storefront HMAC checkout URL (`/pay/:hash/:order_id` or `/repairs/track?token=...`).
     - Shortens the link to keep text messages clean.
     - Appends the payment link directly to Zoho invoice notes and custom fields.
     - Embeds a scan-to-pay QR code onto the top right of the PDF invoice!

5. **Automations & Captured Events Tab**
   - Dedicated tab in the Admin UI with on/off switches for each event subscriber:
     - `order.placed`: Autogenerates Tax Invoice + QR payment link.
     - `order.completed`: Autogenerates Packing Slip.
     - `payment.captured`: Autogenerates Payment Receipt.
     - `order.fulfillment_created`: Autogenerates Packing Slip.
     - `repair.status_changed`: Autogenerates updated repair invoice or quote.
     - `repair.ticket.compliance_requested`: Autogenerates Quotation.
     - `repair.created`: Autogenerates initial Job Card / Estimate.
     - `repair.completed`: Autogenerates final Repair Invoice.
     - `repair.customer_reminder`: Nudges customer with document link.

6. **Custom Document Creator with Direct Email Delivery**
   - Create custom certificates (e.g. Warranty Certificates, Work Orders, Proforma Invoices, Agreements) with custom body text and optional line items.
   - Immediately dispatches the document PDF link and customized message to the customer's email via the Medusa notification module.

7. **Multi-Channel Dispatch Optimized for Email, SMS & WhatsApp**
   - **Email**: Responsive HTML email with document branding, summary, action buttons (download PDF, pay online if unpaid).
   - **SMS**: Concise SMS message with company name, doc reference, amount, due status, and short links.
   - **WhatsApp**: Clean message with emojis, bold formatting, and short links.

8. **Shortened Links Engine**
   - Database model & public route (`/api/store/documents/r/:code`) providing 302 redirection for clean, short messages.

9. **Inter-Plugin Delegation Helper**
   - Exported helper function `delegateDocumentGeneration` allowing `medusajs-repairshop-plugin` or custom checkout modules to resolve `documents` and offload document creation.

10. **Medusa v2 Workflows**
    - `generateDocumentWorkflow`: Full compensation-safe document generation pipeline.
    - `sendDocumentNotificationWorkflow`: Multi-channel notification pipeline.
    - `createManualDocumentWorkflow`: Manual document creation pipeline.

---

## How to Enable the Zoho QR Code Feature

Our plugin gives you two complementary ways to enable and display QR codes on Zoho invoices:

### Method A: Plugin Automatic QR Code Embedding (Recommended)
Our plugin automatically embeds a high-resolution, scan-to-pay Paystack QR code on the top-right corner of the generated Zoho PDF, and includes the short payment link in the Zoho invoice customer notes:
1. In the Medusa Admin sidebar, open **Documents**.
2. Click the **Settings & Zoho** tab.
3. Under **Zoho Books Integration**, ensure **Enable Zoho Books Sync** is turned on.
4. Under **Exposed Zoho Invoice Customizations**, ensure **Embed Payment QR Code on Zoho Invoices** is switched **ON** (enabled by default).
5. (Optional) Set the **Custom Field Name for Payment Link** (e.g., `Payment Link`).
6. Click **Save All Settings**.

Whenever an invoice with an unpaid balance is generated, our post-processor streams the Zoho PDF, stamps the payment QR code on the top right, and adds the payment instructions directly into the document.

### Method B: Zoho Books Native Invoice QR Code Setting
If you also want Zoho Books' web portal and native email templates to display QR codes:
1. Log in to your [Zoho Books Dashboard](https://books.zoho.com).
2. Go to **Settings (Gear Icon)** > **Preferences** > **Invoices**.
3. Scroll down to the **Invoice QR Code** section and toggle it to **Enabled**.
4. Under **QR Code Type**, choose **Invoice URL** or **Custom**.
5. If using custom invoice templates, ensure the `%InvoiceQRCodeImage%` or `<img src="%InvQRCodeImgSrcURL%"/>` placeholder is positioned in your template header.
6. Click **Save** in Zoho Books.

---

## Installation & Setup

### 1. Add to `medusa-config.ts`
In your Medusa project's `medusa-config.ts` (or `medusa-config.js`):

```typescript
module.exports = defineConfig({
  plugins: [
    {
      resolve: "medusajs-documents-plugin",
      options: {}
    },
    // other plugins...
  ],
  modules: [
    {
      key: "documents",
      resolve: "medusajs-documents-plugin",
      options: {}
    }
  ]
});
```

### 2. Run Database Migrations
```bash
npx medusa db:migrate
```

### 3. Build & Run
```bash
yarn build
yarn dev
```

---

## Inter-Plugin Integration: How to Use in `medusajs-repairshop-plugin`

To delegate document generation from your repair plugin to this plugin:

```typescript
import { delegateDocumentGeneration } from "medusajs-documents-plugin";

// Inside your repair endpoint or service:
const result = await delegateDocumentGeneration(container, {
  display_id: `RT-${ticket.ticket_number}`,
  title: "Repair Invoice",
  type: "invoice",
  repair_ticket_id: ticket.id,
  customer: {
    name: customer.first_name,
    email: customer.email,
    phone: customer.phone,
  },
  items: [
    { title: "OEM Screen Replacement", quantity: 1, unit_price: 150 },
    { title: "Labor Fee", quantity: 1, unit_price: 45 }
  ],
  total: 195,
  currency_code: "usd",
  payment_link: `https://store.example.com/repairs/track?token=${ticket.approval_token}`,
  auto_send: true,
});

if (result) {
  // Successfully generated through Documents plugin (via Zoho or PDFKit)!
  console.log("Generated Document ID:", result.record.id);
}
```

---

## Running Automated Tests

```bash
yarn test
```

Runs the 6 unit and integration test suites:
- PDFKit Generator (Modern, Classic, Minimal templates & Custom documents)
- PDF Post-Processor (QR Code embedding, watermark validation)
- Payment Link Generator (HMAC calculation & balance due validation)
- Zoho Books Service (OAuth & API payload mapping)
- Notification Sender (Channel routing & payload formatting)

---

## License
MIT
