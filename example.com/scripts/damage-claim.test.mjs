import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { submitDamageClaim } = await loadProduction(
  new URL("../src/lib/damage-claims.ts", import.meta.url),
);

const input = {
  orderLineId: "11111111-1111-4111-8111-111111111111",
  quantity: 1,
  description: "The frame arrived bent and cannot be used safely.",
  mediaIds: ["22222222-2222-4222-8222-222222222222"],
};

test("damage claims preserve the selected line, evidence, and confirmed identifiers", async () => {
  let call;
  const result = await submitDamageClaim(input, async (url, init) => {
    call = { url, ...init };
    return Response.json(
      { data: { ticketId: "tkt_claim", claimId: "claim-id" } },
      { status: 201 },
    );
  });
  assert.deepEqual(result, { ticketId: "tkt_claim", claimId: "claim-id" });
  assert.equal(call.url, "/api/v1/support/claims");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), input);
});

test("claim validation prevents incomplete evidence and unsafe quantities from reaching the API", async () => {
  let calls = 0;
  for (const invalid of [
    { ...input, quantity: 0 },
    { ...input, quantity: 1.5 },
    { ...input, description: "Too short" },
    { ...input, mediaIds: [] },
    { ...input, mediaIds: Array(6).fill(input.mediaIds[0]) },
  ]) {
    await assert.rejects(
      submitDamageClaim(invalid, async () => {
        calls++;
        return Response.json({ data: {} });
      }),
    );
  }
  assert.equal(calls, 0);
});

test("claim failures retain typed diagnostics and malformed success is never confirmed", async () => {
  await assert.rejects(
    submitDamageClaim(input, async () =>
      Response.json(
        { error: { code: "CLAIM_WINDOW_EXPIRED", message: "Expired" } },
        { status: 409 },
      ),
    ),
    (error) => error.code === "CLAIM_WINDOW_EXPIRED" && error.status === 409,
  );
  await assert.rejects(
    submitDamageClaim(input, async () => Response.json({ data: {} })),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
