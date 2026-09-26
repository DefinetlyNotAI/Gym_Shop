import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const {
  createNotificationTemplate,
  inspectInventoryReturn,
  recordCashDiscrepancy,
} = await loadProduction(
  new URL("../src/lib/backoffice-actions.ts", import.meta.url),
);

test("return inspection uses the encoded order route and confirmed result", async () => {
  let call;
  const result = await inspectInventoryReturn(
    "ord/returned",
    { sellable: false, reason: "Packaging and product are damaged." },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { inspected: 2, sellable: false } });
    },
  );

  assert.deepEqual(result, { inspected: 2, sellable: false });
  assert.equal(call.url, "/api/v1/admin/inventory/returns/ord%2Freturned");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), {
    sellable: false,
    reason: "Packaging and product are damaged.",
  });
});

test("cash discrepancy preserves integer fils and requires confirmation", async () => {
  let call;
  const result = await recordCashDiscrepancy(
    {
      driverId: "00000000-0000-4000-8000-000000000004",
      expectedFils: 12500,
      actualFils: 12000,
      sourceId: "handover-42",
      reason: "Verified count is short by half a dinar.",
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({
        data: {
          recorded: true,
          discrepancyId: "difference-1",
          differenceFils: 500,
        },
      });
    },
  );

  assert.deepEqual(result, {
    discrepancyId: "difference-1",
    differenceFils: 500,
  });
  assert.equal(call.url, "/api/v1/admin/finance/discrepancies");
  assert.equal(call.method, "POST");
  assert.equal(JSON.parse(call.body).expectedFils, 12500);
});

test("notification template creation sends bounded variables and version confirmation", async () => {
  let call;
  const result = await createNotificationTemplate(
    {
      eventType: "order.delivered.v1",
      channel: "EMAIL",
      language: "en",
      subject: "Order {{orderId}} delivered",
      body: "Hello {{name}}, your order is delivered.",
      allowedVariables: ["orderId", "name"],
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { id: "template-1", version: 3 } });
    },
  );

  assert.deepEqual(result, { id: "template-1", version: 3 });
  assert.equal(call.url, "/api/v1/admin/notifications/templates");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body).allowedVariables, ["orderId", "name"]);
});

test("invalid backoffice actions never reach the API and malformed success is rejected", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return Response.json({ data: {} });
  };

  await assert.rejects(
    inspectInventoryReturn("", { sellable: true, reason: "ok" }, transport),
    (error) => error.code === "RETURN_INSPECTION_INVALID",
  );
  await assert.rejects(
    recordCashDiscrepancy(
      {
        driverId: "not-a-driver",
        expectedFils: 10.5,
        actualFils: 0,
        sourceId: "source",
        reason: "Mismatch",
      },
      transport,
    ),
    (error) => error.code === "DISCREPANCY_INVALID",
  );
  await assert.rejects(
    createNotificationTemplate(
      {
        eventType: "bad event",
        channel: "EMAIL",
        language: "en",
        body: "Body",
        allowedVariables: [],
      },
      transport,
    ),
    (error) => error.code === "TEMPLATE_INVALID",
  );
  assert.equal(calls, 0);

  await assert.rejects(
    inspectInventoryReturn(
      "ord-1",
      { sellable: true, reason: "Verified sellable return." },
      transport,
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
  assert.equal(calls, 1);
});
