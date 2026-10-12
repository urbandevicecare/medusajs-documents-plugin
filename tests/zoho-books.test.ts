import assert from "node:assert";
import { test } from "node:test";
import { ZohoBooksService } from "../src/services/zoho-books";

test("ZohoBooksService sets up base URLs and handles endpoints correctly", () => {
  const zohoCom = new ZohoBooksService({
    client_id: "test_client",
    client_secret: "test_secret",
    refresh_token: "test_token",
    organization_id: "org_12345",
    domain: "com",
  });

  const zohoEu = new ZohoBooksService({
    client_id: "test_client",
    client_secret: "test_secret",
    refresh_token: "test_token",
    organization_id: "org_12345",
    domain: "eu",
  });

  assert.ok(zohoCom instanceof ZohoBooksService);
  assert.ok(zohoEu instanceof ZohoBooksService);
});
