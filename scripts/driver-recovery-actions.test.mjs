import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { handoverDriverCash, resendRecoveryCode, runDriverDeliveryAction } = await loadProduction(
  new URL("../src/lib/driver-recovery-actions.ts", import.meta.url),
);

test("delivery actions encode order references and require endpoint confirmation", async () => {
  const cases = [
    { action: "accept", body: {}, data: { accepted: true } },
    { action: "complete", body: { pin: "123456" }, data: { delivered: true } },
    {
      action: "fail",
      body: { reason: "OTHER", contactEffort: "Called twice." },
      data: { attempt: 2, cancelled: false, additionalFeeFils: 0 },
    },
  ];
  for (const row of cases) {
    let call;
    await runDriverDeliveryAction(
      "ord/42",
      row.action,
      row.body,
      async (url, init) => {
        call = { url, ...init };
        return Response.json({ data: row.data });
      },
    );
    assert.equal(call.url, `/api/v1/deliveries/ord%2F42/${row.action}`);
    assert.deepEqual(JSON.parse(call.body), row.body);
  }

  await assert.rejects(
    runDriverDeliveryAction("ord-1", "complete", {}, async () =>
      Response.json({ data: { delivered: false } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});

test("cash handover sends integer fils and requires a handover reference", async () => {
  let call;
  const result = await handoverDriverCash(12500, async (url, init) => {
    call = { url, ...init };
    return Response.json({ data: { handoverId: "cash-handover-1" } });
  });

  assert.deepEqual(result, { handoverId: "cash-handover-1" });
  assert.equal(call.url, "/api/v1/deliveries/cash/handover");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { amountFils: 12500 });
});

test("recovery resend preserves the active proof and channel", async () => {
  let call;
  const result = await resendRecoveryCode(
    {
      recoveryId: "00000000-0000-4000-8000-000000000002",
      browserBinding: "00000000-0000-4000-8000-000000000003",
      channel: "PHONE",
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({
        data: { sent: true, developmentCode: "654321" },
      });
    },
  );

  assert.deepEqual(result, { sent: true, developmentCode: "654321" });
  assert.equal(call.url, "/api/v1/recovery/resend");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), {
    id: "00000000-0000-4000-8000-000000000002",
    browserBinding: "00000000-0000-4000-8000-000000000003",
    channel: "PHONE",
  });
});

test("invalid handovers and recovery resends never reach the API", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return Response.json({ data: {} });
  };

  for (const amount of [0, -1, 10.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      handoverDriverCash(amount, transport),
      (error) => error.code === "AMOUNT_INVALID",
    );
  }
  await assert.rejects(
    resendRecoveryCode(
      {
        recoveryId: "bad-id",
        browserBinding: "short",
        channel: "EMAIL",
      },
      transport,
    ),
    (error) => error.code === "RECOVERY_RESEND_INVALID",
  );
  assert.equal(calls, 0);
});

test("malformed mutation success and API failures remain explicit", async () => {
  await assert.rejects(
    handoverDriverCash(5000, async () => Response.json({ data: {} })),
    (error) => error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    resendRecoveryCode(
      {
        recoveryId: "00000000-0000-4000-8000-000000000002",
        browserBinding: "00000000-0000-4000-8000-000000000003",
        channel: "EMAIL",
      },
      async () =>
        Response.json(
          { error: { code: "RECOVERY_SEND_COOLDOWN", message: "private" } },
          { status: 429 },
        ),
    ),
    (error) =>
      error.code === "RECOVERY_SEND_COOLDOWN" &&
      error.status === 429 &&
      !error.message.includes("private"),
  );
});
