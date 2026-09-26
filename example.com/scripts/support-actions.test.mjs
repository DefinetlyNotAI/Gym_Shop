import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const [actionsSource, errorsSource] = await Promise.all([
  readFile(new URL("../src/lib/support-actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api-errors.ts", import.meta.url), "utf8"),
]);
const errorsUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(errorsSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText,
).toString("base64")}`;
const compiled = ts.transpileModule(
  actionsSource.replace('"@/lib/api-errors"', `"${errorsUrl}"`),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const { loadSupportConversation, loadSupportTickets } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("customer ticket loading preserves the safe damage-claim outcome", async () => {
  const claim = {
    id: "claim-1",
    status: "REJECTED",
    order_line_id: "line-1",
    quantity: 1,
    description: "The shoulder seam arrived torn.",
    customer_safe_reason: "The evidence does not show delivery damage.",
    sku: "SIM-SHIRT-M",
    name_snapshot: { en: "Training shirt", ar: "قميص تدريب" },
    replacement_order_public_id: null,
  };
  const transport = async (url, init) => {
    assert.equal(url, "/api/v1/support/tickets/tkt_claim");
    assert.equal(init, undefined);
    return Response.json({
      data: {
        public_id: "tkt_claim",
        status: "OPEN",
        subject: "Damage claim",
        messages: [],
        claim,
      },
    });
  };

  assert.deepEqual(await loadSupportConversation("tkt_claim", transport), {
    public_id: "tkt_claim",
    status: "OPEN",
    subject: "Damage claim",
    messages: [],
    claim,
  });
});

test("ticket lists reject malformed success and retain typed API errors", async () => {
  await assert.rejects(
    loadSupportTickets(async () => Response.json({ data: { tickets: null } })),
    (error) => error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    loadSupportTickets(async () =>
      Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 }),
    ),
    (error) => error.code === "AUTH_REQUIRED" && error.status === 401,
  );
});
