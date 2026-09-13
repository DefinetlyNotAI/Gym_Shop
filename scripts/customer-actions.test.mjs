import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { customerAction, reviewReportFromForm } = await loadProduction(
  new URL("../src/lib/customer-actions.ts", import.meta.url),
);

test("sign out and review actions use real POST contracts with encoded identifiers", async () => {
  const calls = [];
  const transport = async (url, init) => {
    calls.push({ url, init });
    return Response.json({
      data: { authenticated: false, reported: true, count: 2 },
    });
  };
  await customerAction({ kind: "logout" }, transport);
  await customerAction({ kind: "cancel", id: "ORD /?" }, transport);
  await customerAction(
    {
      kind: "report",
      id: "REV /?",
      input: { reason: "SPAM", details: "Duplicate content" },
    },
    transport,
  );
  await customerAction({ kind: "helpful", id: "REV /?" }, transport);
  assert.equal(calls[0].url, "/api/v1/auth/logout");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[1].url, "/api/v1/orders/ORD%20%2F%3F/cancel");
  assert.equal(calls[2].url, "/api/v1/reviews/REV%20%2F%3F/report");
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    reason: "SPAM",
    details: "Duplicate content",
  });
  assert.equal(calls[3].url, "/api/v1/reviews/REV%20%2F%3F/helpful");
});

test("report form only accepts API reasons and bounded trimmed details", () => {
  const form = new FormData();
  form.set("reason", "PERSONAL_INFO");
  form.set("details", "  Private phone number  ");
  assert.deepEqual(reviewReportFromForm(form), {
    reason: "PERSONAL_INFO",
    details: "Private phone number",
  });
  form.set("details", "");
  assert.deepEqual(reviewReportFromForm(form), { reason: "PERSONAL_INFO" });
  form.set("reason", "fake");
  assert.throws(() => reviewReportFromForm(form), /reason/i);
  form.set("reason", "OTHER");
  form.set("details", "x".repeat(1001));
  assert.throws(() => reviewReportFromForm(form), /1000/);
});

test("upstream failures are never presented as a successful action", async () => {
  await assert.rejects(
    customerAction({ kind: "logout" }, async () =>
      Response.json(
        { error: { code: "UNTRUSTED_ORIGIN", message: "Request rejected" } },
        { status: 403 },
      ),
    ),
    (error) => error.code === "UNTRUSTED_ORIGIN" && error.status === 403,
  );
  await assert.rejects(
    customerAction(
      { kind: "logout" },
      async () => new Response("Offline", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
  await assert.rejects(
    customerAction({ kind: "logout" }, async () => Response.json({})),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
