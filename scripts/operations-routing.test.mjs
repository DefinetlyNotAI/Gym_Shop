import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const analyticsSource = await readFile(
  new URL("../src/lib/analytics-query.ts", import.meta.url),
  "utf8",
);
const analyticsOutput = ts.transpileModule(analyticsSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { analyticsQuery } = await import(
  `data:text/javascript;base64,${Buffer.from(analyticsOutput).toString("base64")}`
);

test("date-only analytics filters include the entire selected Amman day", () => {
  const original = new URLSearchParams(
    "from=2026-09-12&to=2026-09-12&status=PAID",
  );
  const query = analyticsQuery(original);
  assert.equal(query.get("from"), "2026-09-12T00:00:00.000+03:00");
  assert.equal(query.get("to"), "2026-09-12T23:59:59.999+03:00");
  assert.equal(query.get("status"), "PAID");
  assert.equal(original.get("to"), "2026-09-12");
  assert.ok(new Date("2026-09-12T20:00:00+03:00") <= new Date(query.get("to")));
  assert.ok(new Date("2026-09-13T00:00:00+03:00") > new Date(query.get("to")));
});

test("normalized reporting queries preserve explicit instants and export scope", () => {
  const query = new URLSearchParams(
    "to=2026-09-12T20:00:00Z&productId=product-1&format=csv",
  );
  assert.equal(analyticsQuery(query).toString(), query.toString());
});

// Transpile the real pure routing module so tests also run on supported Node 20.
const source = await readFile(
  new URL("../src/lib/operations-routes.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
});
const { getOperationsRoute, routesForRole, operationsRequests } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("each operations destination resolves to an independent URL, not an in-page anchor", () => {
  for (const id of [
    "orders",
    "support",
    "delivery-settings",
    "analytics",
    "promotions",
    "campaigns",
    "referrals",
    "reviews",
    "verification",
    "payouts",
    "catalog",
    "categories",
    "collections",
    "size-guides",
    "inventory",
    "customers",
    "finance",
    "notifications",
    "audits",
    "staff",
    "settings",
  ]) {
    assert.equal(getOperationsRoute(id)?.href, `/${id}`);
  }
  assert.equal(getOperationsRoute("unknown"), undefined);
});

test("finance staff cannot navigate to customer or promotion data", () => {
  const ids = routesForRole("FINANCE_STAFF").map((route) => route.id);
  assert.ok(ids.includes("finance"));
  assert.ok(ids.includes("payouts"));
  assert.ok(!ids.includes("customers"));
  assert.ok(!ids.includes("promotions"));
  assert.deepEqual(routesForRole("CUSTOMER"), []);
});

test("an inventory page fetches inventory only, never unrelated domains", () => {
  assert.deepEqual(operationsRequests("inventory", "LOGISTICS_STAFF"), [
    "/api/v1/admin/inventory",
  ]);
  assert.deepEqual(operationsRequests("finance", "ADMIN"), []);
});

test("overview requests only the measures authorized for the current role", () => {
  assert.deepEqual(operationsRequests("overview", "SUPPORT_AGENT"), [
    "/api/v1/admin/support/tickets",
  ]);
  assert.deepEqual(operationsRequests("orders", "ADMIN"), [
    "/api/v1/admin/orders",
    "/api/v1/platform",
  ]);
  assert.deepEqual(operationsRequests("unknown", "CTO"), []);
});
