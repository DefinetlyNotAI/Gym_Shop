import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const actions = await loadProduction(
  new URL("../src/lib/account-notices.ts", import.meta.url),
);
const item = {
  id: "notification",
  category: "orders",
  entity_type: "shop_order",
  entity_id: "order",
  event_type: "ORDER_CONFIRMED",
  read_at: null,
  created_at: "2026-09-13T12:00:00Z",
};
test("notification loading validates its page and encodes pagination", async () => {
  const page = await actions.loadNotifications(
    "2026-09-13T12:00:00+03:00",
    async (path) => {
      assert.equal(
        path,
        "/api/v1/account/notifications?before=2026-09-13T12%3A00%3A00%2B03%3A00",
      );
      return Response.json({
        data: { notifications: [item], unreadCount: 1, nextCursor: null },
      });
    },
  );
  assert.deepEqual(page, {
    notifications: [item],
    unreadCount: 1,
    nextCursor: null,
  });
  for (const data of [
    {},
    { notifications: [item], unreadCount: -1, nextCursor: null },
    {
      notifications: [{ ...item, created_at: "invalid" }],
      unreadCount: 1,
      nextCursor: null,
    },
    { notifications: [], unreadCount: 0, nextCursor: "invalid" },
  ])
    await assert.rejects(
      actions.loadNotifications(undefined, async () => Response.json({ data })),
      (error) => error.code === "INVALID_RESPONSE",
    );
});
test("unlinked notification rows remain readable under the nullable API contract", async () => {
  const unlinked = { ...item, entity_type: null, entity_id: null };
  const page = await actions.loadNotifications(undefined, async () =>
    Response.json({
      data: { notifications: [unlinked], unreadCount: 1, nextCursor: null },
    }),
  );
  assert.deepEqual(page.notifications, [unlinked]);
});
test("read mutations require actual read confirmation and retain typed errors", async () => {
  for (const input of [{ all: true }, { id: "notification" }])
    await actions.markNotifications(input, async (path, init) => {
      assert.equal(path, "/api/v1/account/notifications");
      assert.equal(init.method, "POST");
      assert.deepEqual(JSON.parse(init.body), input);
      return Response.json({ data: { read: true } });
    });
  await assert.rejects(
    actions.markNotifications({ all: true }, async () =>
      Response.json({ data: { read: false } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    actions.markNotifications({ all: true }, async () =>
      Response.json(
        { error: { code: "AUTH_REQUIRED", message: "private" } },
        { status: 422 },
      ),
    ),
    (error) =>
      error.code === "AUTH_REQUIRED" &&
      error.status === 422 &&
      !error.message.includes("private"),
  );
});
test("preference loading and updates use persisted marketing confirmation", async () => {
  const rows = [
    {
      category: "marketing",
      channel: "EMAIL",
      enabled: false,
      updated_at: "2026-09-13T12:00:00Z",
    },
  ];
  assert.deepEqual(
    await actions.loadNotificationPreferences(async (path) => {
      assert.equal(path, "/api/v1/account/notification-preferences");
      return Response.json({ data: { preferences: rows } });
    }),
    rows,
  );
  for (const enabled of [false, true])
    await actions.updateMarketingPreference(
      "EMAIL",
      enabled,
      async (path, init) => {
        assert.equal(path, "/api/v1/account/notification-preferences");
        assert.equal(init.method, "POST");
        assert.deepEqual(JSON.parse(init.body), {
          category: "marketing",
          channel: "EMAIL",
          enabled,
        });
        return Response.json({ data: { updated: true } });
      },
    );
  await assert.rejects(
    actions.updateMarketingPreference("EMAIL", false, async () =>
      Response.json({ data: {} }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    actions.loadNotificationPreferences(async () =>
      Response.json({
        data: { preferences: [{ ...rows[0], enabled: "false" }] },
      }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
test("referral customization accepts only a confirmed matching code", async () => {
  const value = await actions.updateReferralCode(
    "  CODE_123  ",
    async (path, init) => {
      assert.equal(path, "/api/v1/account/referrals");
      assert.equal(init.method, "PATCH");
      assert.deepEqual(JSON.parse(init.body), { code: "CODE_123" });
      return Response.json({ data: { id: "code-id", code: "CODE_123" } });
    },
  );
  assert.equal(value.code, "CODE_123");
  for (const data of [
    {},
    { id: "code-id", code: "DIFFERENT" },
    { id: "", code: "CODE_123" },
  ])
    await assert.rejects(
      actions.updateReferralCode("CODE_123", async () =>
        Response.json({ data }),
      ),
      (error) => error.code === "INVALID_RESPONSE",
    );
  await assert.rejects(
    actions.updateReferralCode("CODE_123", async () =>
      Response.json(
        { error: { code: "VERIFICATION_REQUIRED", message: "private" } },
        { status: 422 },
      ),
    ),
    (error) => error.code === "VERIFICATION_REQUIRED",
  );
});
test("notification reads preserve cancellation and non-JSON HTTP failures", async () => {
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(
    actions.loadNotifications(
      undefined,
      async (path, init) => {
        calls++;
        assert.equal(init.signal, controller.signal);
        return new Response("<html>unavailable</html>", { status: 503 });
      },
      controller.signal,
    ),
    (error) => error.status === 503,
  );
  assert.equal(calls, 1);
});
test("optional simulator inbox is absent only on 404 and validates recipient messages", async () => {
  assert.deepEqual(
    await actions.loadSimulationInbox(
      async () => new Response(null, { status: 404 }),
    ),
    [],
  );
  const message = {
    eventType: "PHONE_VERIFICATION",
    channel: "WHATSAPP",
    destination: "0790***23",
    token: "synthetic",
    expiresAt: "2026-09-13T12:10:00Z",
    createdAt: "2026-09-13T12:00:00Z",
  };
  assert.deepEqual(
    await actions.loadSimulationInbox(async () =>
      Response.json({ data: { messages: [message] } }),
    ),
    [message],
  );
  await assert.rejects(
    actions.loadSimulationInbox(
      async () => new Response(null, { status: 401 }),
    ),
    (error) => error.status === 401,
  );
  await assert.rejects(
    actions.loadSimulationInbox(async () =>
      Response.json({ data: { messages: [{}] } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
