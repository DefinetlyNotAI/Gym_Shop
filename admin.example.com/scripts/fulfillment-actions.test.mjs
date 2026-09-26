import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const { fulfillOrder } = await loadProduction(
  new URL("../src/lib/fulfillment-actions.ts", import.meta.url),
);
test("fulfillment actions use actual POST paths, encoded order IDs and bodies", async () => {
  const cases = [
    { kind: "pack", body: {}, key: "packed" },
    { kind: "dispatch", body: { driverId: "driver" }, key: "dispatched" },
    {
      kind: "pickup",
      body: { pin: "123456", collectedFils: 12000 },
      key: "collected",
    },
    { kind: "reassign", body: { driverId: "driver" }, key: "reassigned" },
  ];
  for (const row of cases)
    await fulfillOrder("ord/a", row.kind, row.body, async (path, init) => {
      assert.equal(path, `/api/v1/admin/orders/ord%2Fa/${row.kind}`);
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), row.body);
      return Response.json({ data: { [row.key]: true } });
    });
});
test("unconfirmed fulfillment success is rejected", async () => {
  for (const data of [{}, { packed: false }, "packed"])
    await assert.rejects(
      fulfillOrder("ord", "pack", {}, async () => Response.json({ data })),
      (error) => error.code === "INVALID_RESPONSE",
    );
});
test("fulfillment failures retain guidance and never retry a mutation", async () => {
  let calls = 0;
  await assert.rejects(
    fulfillOrder("ord", "dispatch", { driverId: "driver" }, async () => {
      calls++;
      return Response.json(
        { error: { code: "DRIVER_INVALID", message: "private" } },
        { status: 409 },
      );
    }),
    (error) =>
      error.code === "DRIVER_INVALID" &&
      error.status === 409 &&
      !error.message.includes("private"),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    fulfillOrder(
      "ord",
      "pack",
      {},
      async () => new Response("offline", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
});
