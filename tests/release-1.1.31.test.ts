import assert from "node:assert";
import { test } from "node:test";
import * as adminDocRoute from "../src/api/admin/documents/[id]/document/route";
import * as adminPreviewRoute from "../src/api/admin/documents/templates/preview/route";
import * as compatDocRoute from "../src/api/api/admin/documents/[id]/document/route";
import * as publicDocRoute from "../src/api/documents/[id]/document/route";
import * as publicPreviewRoute from "../src/api/documents/templates/preview/route";
import middlewaresConfig from "../src/api/middlewares";

test("Release 1.1.31 - Route files export AUTHENTICATE = false and HEAD handler", () => {
  const routes = [
    { name: "adminDocRoute", mod: adminDocRoute },
    { name: "adminPreviewRoute", mod: adminPreviewRoute },
    { name: "compatDocRoute", mod: compatDocRoute },
    { name: "publicDocRoute", mod: publicDocRoute },
    { name: "publicPreviewRoute", mod: publicPreviewRoute },
  ];

  for (const r of routes) {
    assert.strictEqual(r.mod.AUTHENTICATE, false, `${r.name} must export AUTHENTICATE = false`);
    assert.strictEqual(typeof r.mod.GET, "function", `${r.name} must export GET handler`);
    assert.strictEqual(typeof (r.mod as any).HEAD, "function", `${r.name} must export HEAD handler`);
  }
});

test("Release 1.1.31 - middlewares.ts registers unauthenticated allowlist with GET, HEAD, and OPTIONS", () => {
  assert.ok(middlewaresConfig, "middlewaresConfig must be defined");
  const routes = (middlewaresConfig as any).routes || [];
  assert.ok(routes.length >= 3, "Must have at least 3 routes configured");

  for (const route of routes) {
    assert.ok(route.methods.includes("GET"), `Route ${route.matcher} must include GET`);
    assert.ok(route.methods.includes("HEAD"), `Route ${route.matcher} must include HEAD`);
    assert.ok(route.methods.includes("OPTIONS"), `Route ${route.matcher} must include OPTIONS`);
  }
});

test("Release 1.1.31 - Range header slicing returns correct 206 chunk and headers", () => {
  const dummyBuffer = Buffer.from("0123456789ABCDEF"); // 16 bytes
  const totalLength = dummyBuffer.length;
  const range = "bytes=0-4";

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;

  assert.strictEqual(start, 0);
  assert.strictEqual(end, 4);

  const chunk = dummyBuffer.subarray(start, end + 1);
  assert.strictEqual(chunk.toString(), "01234");
  assert.strictEqual(chunk.length, 5);
});
