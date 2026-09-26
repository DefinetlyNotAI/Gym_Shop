import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const actions = await loadProduction(
  new URL("../src/lib/commerce-actions.ts", import.meta.url),
);
const line = {
  id: "line",
  variant_id: "variant",
  quantity: 2,
  selected: true,
  sku: "SKU",
  option_values: {},
  slug: "top",
  name_en: "Top",
  name_ar: "قميص",
  unit_price_fils: "1000",
  available: 3,
};
test("cart accepts safe numeric prices from PGlite and normalizes its client contract", async () => {
  const result = await actions.updateCartLine(
    { variantId: "variant", quantity: 2, selected: true },
    async () =>
      Response.json({ data: { lines: [{ ...line, unit_price_fils: 1000 }] } }),
  );
  assert.deepEqual(result, [line]);
  for (const price of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "invalid"])
    await assert.rejects(
      actions.updateCartLine(
        { variantId: "variant", quantity: 2, selected: true },
        async () =>
          Response.json({
            data: { lines: [{ ...line, unit_price_fils: price }] },
          }),
      ),
      (error) => error.code === "INVALID_RESPONSE",
    );
});
test("cart changes use authoritative lines and encoded removal identifiers", async () => {
  let call;
  const lines = await actions.updateCartLine(
    { variantId: "variant", quantity: 2, selected: true },
    async (path, init) => {
      call = { path, method: init.method, body: JSON.parse(init.body) };
      return Response.json({ data: { lines: [line] } });
    },
  );
  assert.deepEqual(lines, [line]);
  assert.deepEqual(call, {
    path: "/api/v1/cart",
    method: "PUT",
    body: { variantId: "variant", quantity: 2, selected: true },
  });
  await actions.removeSavedLine("line/a?", async (path, init) => {
    assert.equal(path, "/api/v1/cart?lineId=line%2Fa%3F");
    assert.equal(init.method, "DELETE");
    return Response.json({ data: { removed: true } });
  });
});
test("subscription actions require the requested persisted preference", async () => {
  for (const subscribed of [true, false])
    await actions.updateNewsletter(subscribed, async (path, init) => {
      assert.equal(path, "/api/v1/subscriptions/newsletter");
      assert.deepEqual(JSON.parse(init.body), {
        subscribed,
        source: "HOMEPAGE_NEWSLETTER",
      });
      return Response.json({
        data: { status: subscribed ? "SUBSCRIBED" : "UNSUBSCRIBED" },
      });
    });
  await actions.subscribeVariant("v/a", async (path, init) => {
    assert.equal(path, "/api/v1/catalog/variants/v%2Fa/restock-subscription");
    assert.deepEqual(JSON.parse(init.body), { subscribed: true });
    return Response.json({ data: { status: "ACTIVE" } });
  });
  await assert.rejects(
    actions.updateNewsletter(true, async () =>
      Response.json({ data: { status: "UNSUBSCRIBED" } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
test("conversion retains its operation key and rejects unconfirmed credit", async () => {
  const result = await actions.convertRewardBlocks(
    2,
    "stable-conversion-key",
    async (path, init) => {
      assert.equal(path, "/api/v1/account/rewards/convert");
      assert.deepEqual(JSON.parse(init.body), {
        blocks: 2,
        idempotencyKey: "stable-conversion-key",
      });
      return Response.json({
        data: {
          conversionId: "conversion",
          blocks: 2,
          pointsDebited: 200,
          walletFilsCredited: 2000,
          weekStart: "2026-09-13",
          weeklyBlocksRemaining: 3,
        },
      });
    },
  );
  assert.equal(result.walletFilsCredited, 2000);
  await assert.rejects(
    actions.convertRewardBlocks(2, "stable-conversion-key", async () =>
      Response.json({ data: {} }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
test("reorder preserves rejected lines and never implies a new paid order", async () => {
  const result = await actions.copyOrderToCart("ord/a", async (path, init) => {
    assert.equal(path, "/api/v1/orders/ord%2Fa/reorder");
    assert.equal(init.method, "POST");
    return Response.json({
      data: {
        added: [{ sku: "SKU", quantity: 1, currentPriceFils: 1000 }],
        rejected: [{ sku: "OLD", reason: "UNAVAILABLE" }],
        selectionConfirmationRequired: true,
      },
    });
  });
  assert.equal(result.added.length, 1);
  assert.equal(result.rejected.length, 1);
});
test("commerce failures retain typed diagnostics without retries or fabricated success", async () => {
  let calls = 0;
  await assert.rejects(
    actions.updateNewsletter(true, async () => {
      calls++;
      return Response.json(
        { error: { code: "AUTH_REQUIRED", message: "private" } },
        { status: 422 },
      );
    }),
    (error) =>
      error.code === "AUTH_REQUIRED" && !error.message.includes("private"),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    actions.updateCartLine(
      { variantId: "v", quantity: 1, selected: true },
      async () => new Response("<html>error</html>", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
  await assert.rejects(
    actions.updateCartLine(
      { variantId: "v", quantity: 1, selected: true },
      async () => Response.json({ data: { lines: [{}] } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
