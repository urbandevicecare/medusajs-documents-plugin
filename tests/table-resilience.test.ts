import assert from "node:assert";
import { test } from "node:test";
import {
  isUndefinedTableError,
  DEFAULT_DOCUMENT_SETTINGS,
  DocumentModuleService,
} from "../src/modules/documents/service";
import { GET as getSettingsRoute, POST as postSettingsRoute } from "../src/api/admin/documents/settings/route";
import { GET as getDocumentsRoute } from "../src/api/admin/documents/route";

test("isUndefinedTableError accurately identifies PostgreSQL 42P01 and table-missing errors", () => {
  // Direct PostgreSQL 42P01
  assert.strictEqual(isUndefinedTableError({ code: "42P01" }), true);

  // Nested in cause
  assert.strictEqual(isUndefinedTableError({ cause: { code: "42P01" } }), true);

  // Knex error message with relation does not exist
  assert.strictEqual(
    isUndefinedTableError(
      new Error('select * from "document_settings" where "deleted_at" is null limit $1 - relation "document_settings" does not exist')
    ),
    true
  );

  // Table does not exist variant
  assert.strictEqual(
    isUndefinedTableError(new Error('table "document_record" does not exist')),
    true
  );

  // MikroORM TableNotFoundException
  const notFoundErr = new Error("Table not found");
  notFoundErr.name = "TableNotFoundException";
  assert.strictEqual(isUndefinedTableError(notFoundErr), true);

  // Normal / other errors must NOT match
  assert.strictEqual(isUndefinedTableError(new Error("Connection timeout")), false);
  assert.strictEqual(isUndefinedTableError({ code: "23505" }), false);
  assert.strictEqual(isUndefinedTableError(null), false);
  assert.strictEqual(isUndefinedTableError(undefined), false);
});

test("DocumentModuleService.getSettings gracefully returns DEFAULT_DOCUMENT_SETTINGS on 42P01 error", async () => {
  const service: any = Object.create(DocumentModuleService.prototype);
  
  // Mock listDocumentSettings to throw missing table error
  service.listDocumentSettings = async () => {
    const err: any = new Error('relation "document_settings" does not exist');
    err.code = "42P01";
    throw err;
  };

  // Mock knex connection to also throw missing table error
  const mockContainer = {
    resolve: (key: string) => {
      if (key === "__pg_connection__" || key === "pg_connection") {
        return () => ({
          whereNull: () => ({
            first: async () => {
              const err: any = new Error('relation "document_settings" does not exist');
              err.code = "42P01";
              throw err;
            },
          }),
        });
      }
      return null;
    },
  };

  const settings = await service.getSettings({}, mockContainer);
  assert.ok(settings, "Settings should be returned");
  assert.strictEqual(settings.id, "default");
  assert.strictEqual(settings.company_name, "Store");
  assert.strictEqual(settings.email_notifications_enabled, true);
});

test("GET /admin/documents/settings returns HTTP 200 with pending migrations warning on missing table", async () => {
  let statusSet: number | null = null;
  let jsonResult: any = null;

  const mockReq: any = {
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            getSettings: async () => {
              const err: any = new Error('select * from "document_settings" where "deleted_at" is null limit $1 - relation "document_settings" does not exist');
              err.code = "42P01";
              throw err;
            },
          };
        }
        if (key === "__pg_connection__" || key === "pg_connection") {
          return () => ({
            whereNull: () => ({
              first: async () => {
                const err: any = new Error('relation "document_settings" does not exist');
                err.code = "42P01";
                throw err;
              },
            }),
          });
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    status: (code: number) => {
      statusSet = code;
      return mockRes;
    },
    json: (data: any) => {
      jsonResult = data;
      return mockRes;
    },
  };

  await getSettingsRoute(mockReq, mockRes);

  assert.strictEqual(statusSet, null, "Should not set error status code (defaults to 200)");
  assert.ok(jsonResult, "Should return JSON");
  assert.strictEqual(jsonResult.success, true);
  assert.strictEqual(jsonResult.warning, "Migrations pending");
  assert.strictEqual(jsonResult.settings.id, "default");
});

test("POST /admin/documents/settings returns HTTP 400 with helpful error on missing table", async () => {
  let statusSet: number | null = null;
  let jsonResult: any = null;

  const mockReq: any = {
    body: { company_name: "Updated Name" },
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            listDocumentSettings: async () => {
              const err: any = new Error('relation "document_settings" does not exist');
              err.code = "42P01";
              throw err;
            },
          };
        }
        if (key === "__pg_connection__" || key === "pg_connection") {
          return () => ({
            whereNull: () => ({
              first: async () => {
                const err: any = new Error('relation "document_settings" does not exist');
                err.code = "42P01";
                throw err;
              },
            }),
          });
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    status: (code: number) => {
      statusSet = code;
      return mockRes;
    },
    json: (data: any) => {
      jsonResult = data;
      return mockRes;
    },
  };

  await postSettingsRoute(mockReq, mockRes);

  assert.strictEqual(statusSet, 400, "Should return HTTP 400");
  assert.ok(jsonResult, "Should return JSON error response");
  assert.strictEqual(jsonResult.error, true);
  assert.ok(
    jsonResult.message.includes("Database table document_settings does not exist. Please run npx medusa db:migrate."),
    `Message was: ${jsonResult.message}`
  );
});

test("GET /admin/documents returns HTTP 200 with empty list and warning on missing table", async () => {
  let statusSet: number | null = null;
  let jsonResult: any = null;

  const mockReq: any = {
    query: { take: 50, skip: 0 },
    scope: {
      resolve: (key: string) => {
        if (key === "documents") {
          return {
            listAndCountDocumentRecords: async () => {
              const err: any = new Error('relation "document_record" does not exist');
              err.code = "42P01";
              throw err;
            },
          };
        }
        if (key === "__pg_connection__" || key === "pg_connection") {
          return () => ({
            whereNull: () => {
              const err: any = new Error('relation "document_record" does not exist');
              err.code = "42P01";
              throw err;
            },
          });
        }
        return null;
      },
    },
  };

  const mockRes: any = {
    status: (code: number) => {
      statusSet = code;
      return mockRes;
    },
    json: (data: any) => {
      jsonResult = data;
      return mockRes;
    },
  };

  await getDocumentsRoute(mockReq, mockRes);

  assert.strictEqual(statusSet, null, "Should not return error status code (defaults to 200)");
  assert.ok(jsonResult, "Should return JSON response");
  assert.deepStrictEqual(jsonResult.documents, []);
  assert.strictEqual(jsonResult.count, 0);
  assert.strictEqual(jsonResult.warning, "Migrations pending");
});
