import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { editSupportMessage } = await loadProduction(
  new URL("../src/lib/support-actions.ts", import.meta.url),
);

test("staff message editing uses PATCH, encoded identifiers and a trimmed body", async () => {
  let call;
  const result = await editSupportMessage(
    "ticket/1",
    "message/2",
    "  Corrected reply  ",
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { edited: true } });
    },
  );
  assert.deepEqual(result, { edited: true });
  assert.equal(
    call.url,
    "/api/v1/admin/support/tickets/ticket%2F1/messages/message%2F2",
  );
  assert.equal(call.method, "PATCH");
  assert.deepEqual(JSON.parse(call.body), { body: "Corrected reply" });
});

test("blank and oversized messages never reach the API", async () => {
  let calls = 0;
  for (const body of ["   ", "x".repeat(10001)]) {
    await assert.rejects(
      editSupportMessage("ticket", "message", body, async () => {
        calls++;
        return Response.json({ data: { edited: true } });
      }),
      /1.*10,000/,
    );
  }
  assert.equal(calls, 0);
});

test("authorization failures, unavailable upstreams and malformed successes cannot masquerade as saves", async () => {
  await assert.rejects(
    editSupportMessage("ticket", "message", "Reply", async () =>
      Response.json(
        {
          error: {
            code: "MESSAGE_EDIT_FORBIDDEN",
            message: "Only your own messages can be edited.",
          },
        },
        { status: 422 },
      ),
    ),
    (error) => error.code === "MESSAGE_EDIT_FORBIDDEN" && error.status === 422,
  );
  await assert.rejects(
    editSupportMessage(
      "ticket",
      "message",
      "Reply",
      async () => new Response("Unavailable", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
  await assert.rejects(
    editSupportMessage("ticket", "message", "Reply", async () =>
      Response.json({ data: {} }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
  assert.deepEqual(
    await editSupportMessage("ticket", "message", "Reply", async () =>
      Response.json({ data: { edited: false } }),
    ),
    { edited: false },
  );
});
