import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { requestApi } = await loadProduction(
  new URL("../src/lib/client-api.ts", import.meta.url),
);

test("client requests serialize bodies and return the typed API data envelope", async () => {
  let call;
  const data = await requestApi(
    "/api/v1/account/password",
    { method: "POST", body: { currentPassword: "old", password: "new-password" } },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { changed: true } });
    },
  );
  assert.deepEqual(data, { changed: true });
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { currentPassword: "old", password: "new-password" });
});

test("client requests reject unsafe paths, API errors and malformed success", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return Response.json({ data: { ok: true } });
  };
  await assert.rejects(requestApi("https://evil.test/api", {}, transport), (error) => error.code === "API_PATH_REJECTED");
  assert.equal(calls, 0);
  await assert.rejects(
    requestApi("/api/v1/account/sessions", {}, async () => Response.json({ error: { code: "SESSION_EXPIRED" } }, { status: 401 })),
    (error) => error.code === "SESSION_EXPIRED" && error.status === 401,
  );
  await assert.rejects(
    requestApi("/api/v1/account/sessions", {}, async () => Response.json({ unexpected: true })),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
