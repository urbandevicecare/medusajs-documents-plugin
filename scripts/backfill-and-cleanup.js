const { Client } = require("pg");

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgres://urbandevicecare_pgsql:95KHmKzoq8@127.0.0.1:5432/urbandevicecare_medusa";

  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to PostgreSQL database.");

  try {
    // 1. Fetch document_settings for Zoho credentials
    const settingsRes = await client.query(
      "SELECT * FROM document_settings WHERE zoho_books_enabled = true LIMIT 1;"
    );

    if (settingsRes.rows.length === 0) {
      console.log("No enabled Zoho Books configuration found in document_settings. Exiting.");
      return;
    }

    const settings = settingsRes.rows[0];
    console.log("Using Zoho Org ID:", settings.zoho_organization_id);

    // Dynamic import of ZohoBooksService
    let ZohoBooksService;
    const path = require("path");
    const fs = require("fs");

    const possiblePaths = [
      "/var/www/vhosts/urbandevicecare.co.uk/admin.urbandevicecare.co.uk/node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js",
      path.resolve(process.cwd(), "../../node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(process.cwd(), "../node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(process.cwd(), "node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(__dirname, "../../node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(__dirname, "../node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(__dirname, "node_modules/medusajs-documents-plugin/.medusa/server/src/services/zoho-books.js"),
      path.resolve(__dirname, ".medusa/server/src/services/zoho-books.js"),
      path.resolve(__dirname, "../.medusa/server/src/services/zoho-books.js"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const mod = await import(p);
          ZohoBooksService = mod.ZohoBooksService || mod.default;
          if (ZohoBooksService) {
            console.log("Loaded ZohoBooksService from:", p);
            break;
          }
        } catch (e) {
          console.error("Error loading from", p, e.message);
        }
      }
    }

    if (!ZohoBooksService) {
      try {
        const mod = await import("medusajs-documents-plugin/services/zoho-books");
        ZohoBooksService = mod.ZohoBooksService || mod.default;
      } catch (_) {
        try {
          const mod = await import("medusajs-documents-plugin/services/zoho-books.js");
          ZohoBooksService = mod.ZohoBooksService || mod.default;
        } catch (e) {
          console.error("Could not load ZohoBooksService from package import:", e.message);
        }
      }
    }

    let zoho = null;
    if (ZohoBooksService && settings.zoho_client_id && settings.zoho_refresh_token) {
      zoho = new ZohoBooksService({
        client_id: settings.zoho_client_id,
        client_secret: settings.zoho_client_secret,
        refresh_token: settings.zoho_refresh_token,
        organization_id: settings.zoho_organization_id,
        domain: settings.zoho_domain || "com",
      });
      console.log("ZohoBooksService initialized successfully.");
    }

    // 2. Fetch all local pdfkit records that should be in Zoho
    const pdfkitDocsRes = await client.query(
      `SELECT * FROM document_record 
       WHERE source = 'pdfkit' 
         AND type IN ('invoice', 'estimate', 'receipt', 'packing_slip')
         AND deleted_at IS NULL
       ORDER BY created_at ASC;`
    );

    console.log(`Found ${pdfkitDocsRes.rows.length} local pdfkit records to reconcile.`);

    for (const doc of pdfkitDocsRes.rows) {
      console.log(`\nReconciling [${doc.type}] ID: ${doc.id}, display_id: ${doc.display_id}`);
      const cleanRef = String(doc.display_id || "").replace(/^(?:(?:JOB|RT|REC|RCPT|EST|DOC|INV|PKG|PACK|ST|STORE|[A-Za-z]{2,10})-)+/i, "");
      const originalDate = doc.created_at ? new Date(doc.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];

      // Check if a Zoho equivalent already exists in DB for this repair_ticket / order
      let existingZohoRecord = null;
      if (doc.repair_ticket_id) {
        const zRes = await client.query(
          `SELECT * FROM document_record 
           WHERE repair_ticket_id = $1 AND type = $2 AND source = 'zoho' AND deleted_at IS NULL LIMIT 1;`,
          [doc.repair_ticket_id, doc.type]
        );
        if (zRes.rows.length > 0) existingZohoRecord = zRes.rows[0];
      } else if (doc.order_id) {
        const zRes = await client.query(
          `SELECT * FROM document_record 
           WHERE order_id = $1 AND type = $2 AND source = 'zoho' AND deleted_at IS NULL LIMIT 1;`,
          [doc.order_id, doc.type]
        );
        if (zRes.rows.length > 0) existingZohoRecord = zRes.rows[0];
      }

      if (existingZohoRecord) {
        console.log(`  -> Duplicate local record! An active Zoho record (${existingZohoRecord.id}, zoho_id: ${existingZohoRecord.zoho_document_id}) already exists. Removing local duplicate ${doc.id}.`);
        await client.query("DELETE FROM document_record WHERE id = $1;", [doc.id]);
        continue;
      }

      // If no Zoho equivalent in DB, check Zoho directly
      if (zoho) {
        try {
          if (doc.type === "invoice") {
            let zInv = await zoho.getInvoiceByNumber(doc.display_id);
            if (!zInv && cleanRef) {
              zInv = await zoho.getInvoiceByNumber(`RT-${cleanRef}`) || await zoho.getInvoiceByNumber(cleanRef);
            }

            if (zInv) {
              console.log(`  -> Found matching invoice in Zoho Books (${zInv.invoice_id}, #${zInv.invoice_number}). Updating document_record.`);
              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1, status = 'sent' WHERE id = $2;",
                [zInv.invoice_id, doc.id]
              );
              await zoho.markInvoiceAsSent(zInv.invoice_id);
            } else {
              console.log(`  -> Creating missing invoice in Zoho Books with backdated date ${originalDate}...`);
              const cid = await zoho.syncContact({
                first_name: doc.customer_name || "Valued Customer",
                email: doc.customer_email || undefined,
                phone: doc.customer_phone || undefined,
              });

              const items = doc.metadata?.items || [
                {
                  title: doc.title || "Diagnostic / Repair Inspection",
                  description: "Device repair service",
                  quantity: 1,
                  unit_price: Number(doc.total_amount || 0),
                },
              ];

              const zohoItems = items.map((it) => ({
                name: it.title || "Service / Part",
                description: it.description || "",
                rate: Number(it.unit_price || 0).toFixed(2),
                quantity: it.quantity || 1,
              }));

              const createRes = await zoho.createInvoice(cid, {
                reference_number: doc.display_id,
                invoice_number: doc.display_id,
                ignore_auto_number_generation: true,
                date: originalDate,
                line_items: zohoItems,
                notes: doc.metadata?.notes || "Thank you for your business.",
                payment_terms: settings.zoho_payment_terms_days || 0,
              });

              await zoho.markInvoiceAsSent(createRes.invoice_id);

              if (doc.payment_status === "paid" && Number(doc.total_amount || 0) > 0) {
                try {
                  await zoho.registerPayment(
                    createRes.invoice_id,
                    Number(doc.total_amount),
                    cid,
                    "Paystack",
                    doc.display_id,
                    `Payment for ${doc.display_id}`
                  );
                } catch (e) {
                  console.log("  -> Warning registering payment:", e.message);
                }
              }

              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1, status = 'sent' WHERE id = $2;",
                [createRes.invoice_id, doc.id]
              );
              console.log(`  -> Successfully created and linked Zoho invoice ${createRes.invoice_id}`);
            }
          } else if (doc.type === "estimate") {
            let zEst = await zoho.getEstimateByNumber(doc.display_id);
            if (!zEst && cleanRef) {
              zEst = await zoho.getEstimateByNumber(`EST-${cleanRef}`) || await zoho.getEstimateByNumber(cleanRef);
            }

            if (zEst) {
              console.log(`  -> Found matching estimate in Zoho Books (${zEst.estimate_id}, #${zEst.estimate_number}). Updating document_record.`);
              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1, status = 'sent' WHERE id = $2;",
                [zEst.estimate_id, doc.id]
              );
              await zoho.markEstimateAsSent(zEst.estimate_id);
            } else {
              console.log(`  -> Creating missing estimate in Zoho Books with backdated date ${originalDate}...`);
              const cid = await zoho.syncContact({
                first_name: doc.customer_name || "Valued Customer",
                email: doc.customer_email || undefined,
                phone: doc.customer_phone || undefined,
              });

              const items = doc.metadata?.items || [
                {
                  title: doc.title || "Diagnostic / Repair Inspection Quote",
                  description: "Device repair estimate",
                  quantity: 1,
                  unit_price: Number(doc.total_amount || 0),
                },
              ];

              const zohoItems = items.map((it) => ({
                name: it.title || "Service / Part",
                description: it.description || "",
                rate: Number(it.unit_price || 0).toFixed(2),
                quantity: it.quantity || 1,
              }));

              const createRes = await zoho.createEstimate(cid, {
                reference_number: doc.display_id,
                estimate_number: doc.display_id,
                date: originalDate,
                line_items: zohoItems,
                notes: doc.metadata?.notes || "Estimate for goods/services.",
              });

              await zoho.markEstimateAsSent(createRes.estimate_id);

              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1, status = 'sent' WHERE id = $2;",
                [createRes.estimate_id, doc.id]
              );
              console.log(`  -> Successfully created and linked Zoho estimate ${createRes.estimate_id}`);
            }
          } else if (doc.type === "receipt") {
            console.log(`  -> Checking receipt companion in Zoho...`);
            // Check if there is an invoice in Zoho to link payment receipt
            const invLookup = await zoho.getInvoiceByNumber(cleanRef.startsWith("RT-") ? cleanRef : `RT-${cleanRef}`);
            if (invLookup) {
              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1 WHERE id = $2;",
                [invLookup.invoice_id, doc.id]
              );
              console.log(`  -> Linked receipt to Zoho invoice ${invLookup.invoice_id}`);
            } else {
              // Delete orphaned/duplicate pdfkit receipt if invoice is already present in Zoho
              await client.query("DELETE FROM document_record WHERE id = $1;", [doc.id]);
              console.log(`  -> Cleaned duplicate local pdfkit receipt ${doc.id}`);
            }
          } else if (doc.type === "packing_slip") {
            const invLookup = await zoho.getInvoiceByNumber(cleanRef.startsWith("ST-") ? cleanRef : `ST-${cleanRef}`);
            if (invLookup) {
              await client.query(
                "UPDATE document_record SET source = 'zoho', zoho_document_id = $1 WHERE id = $2;",
                [invLookup.invoice_id, doc.id]
              );
              console.log(`  -> Linked packing slip to Zoho invoice ${invLookup.invoice_id}`);
            } else {
              await client.query("DELETE FROM document_record WHERE id = $1;", [doc.id]);
              console.log(`  -> Cleaned duplicate local pdfkit packing slip ${doc.id}`);
            }
          }
        } catch (itemErr) {
          console.error(`  -> Error processing ${doc.id}: ${itemErr.message}`);
        }
      }
    }

    // 3. Final summary check of document_record
    const summaryRes = await client.query(
      "SELECT type, source, count(*) FROM document_record GROUP BY type, source ORDER BY type, source;"
    );
    console.log("\n================ RECONCILED DOCUMENT COUNTS ================");
    console.table(summaryRes.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
