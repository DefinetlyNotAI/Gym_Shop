import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const { requestApi } = await loadProduction(new URL("../src/lib/client-api.ts", import.meta.url));
test("staff client requests preserve method, JSON body and typed data", async () => {
  let call;
  const data = await requestApi("/api/v1/admin/referrals", { method: "PATCH", body: { action: "DISABLE_CODE" } }, async (url, init) => { call = { url, ...init }; return Response.json({ data: { updated: true } }); });
  assert.deepEqual(data, { updated: true });
  assert.equal(call.method, "PATCH");
  assert.deepEqual(JSON.parse(call.body), { action: "DISABLE_CODE" });
});
test("staff client requests reject unsafe paths and preserve typed API failures", async () => {
  let calls = 0;
  await assert.rejects(requestApi("https://evil.test", {}, async () => { calls += 1; return Response.json({ data: {} }); }), (error) => error.code === "API_PATH_REJECTED");
  assert.equal(calls, 0);
  await assert.rejects(requestApi("/api/v1/admin/reviews", {}, async () => Response.json({ error: { code: "PERMISSION_DENIED" } }, { status: 403 })), (error) => error.code === "PERMISSION_DENIED" && error.status === 403);
});
