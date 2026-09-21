import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const actions = await loadProduction(
  new URL("../src/lib/payout-actions.ts", import.meta.url),
);

test("Finance review encodes the payout ID and validates the resulting state", async () => {
  const result = await actions.reviewPayout(
    "pay/id?unsafe",
    "APPROVE",
    "Independent Finance review",
    async (path, init) => {
      assert.equal(path, "/api/v1/admin/finance/payouts/pay%2Fid%3Funsafe/decision");
      assert.deepEqual(init, {
        method: "POST",
        body: { decision: "APPROVE", reason: "Independent Finance review" },
      });
      return { publicId: "pay/id?unsafe", status: "APPROVED" };
    },
  );
  assert.deepEqual(result, { publicId: "pay/id?unsafe", status: "APPROVED" });
});

test("Finance execution sends one explicit simulation outcome", async () => {
  const result = await actions.executeSimulatedPayout(
    "pay_simulated",
    "UNKNOWN",
    async (path, init) => {
      assert.equal(path, "/api/v1/admin/finance/payouts/pay_simulated/execute");
      assert.deepEqual(init, {
        method: "POST",
        body: { simulationOutcome: "UNKNOWN" },
      });
      return {
        publicId: "pay_simulated",
        status: "UNKNOWN",
        providerReference: "sim_payout_pay_simulated",
      };
    },
  );
  assert.deepEqual(result, {
    publicId: "pay_simulated",
    status: "UNKNOWN",
    providerReference: "sim_payout_pay_simulated",
  });
});

test("payout actions reject malformed success responses", async () => {
  await assert.rejects(
    actions.reviewPayout("pay_x", "REJECT", "Reviewed", async () => ({ status: "REJECTED" })),
    (error) => error.code === "INVALID_RESPONSE",
  );
  await assert.rejects(
    actions.executeSimulatedPayout("pay_x", "COMPLETED", async () => ({ publicId: "pay_x", status: "FAILED" })),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
