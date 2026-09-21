import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const actions = await loadProduction(
  new URL("../src/lib/payout-actions.ts", import.meta.url),
);

test("simulated payout converts exact JOD input to integer fils and posts once", async () => {
  let calls = 0;
  const result = await actions.requestSimulatedPayout(
    { destinationAlias: "Simulation bank ••0042", amountJod: "12.500" },
    async (path, init) => {
      calls++;
      assert.equal(path, "/api/v1/account/payouts");
      assert.equal(init.method, "POST");
      assert.deepEqual(init.body, {
        destinationAlias: "Simulation bank ••0042",
        amountFils: 12_500,
        idempotencyKey: "payout-ui-key",
      });
      return {
        publicId: "pay_customer_simulation",
        amountFils: 12_500,
        status: "REQUESTED",
        providerReference: null,
      };
    },
    () => "payout-ui-key",
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, {
    publicId: "pay_customer_simulation",
    status: "REQUESTED",
  });
});

test("simulated payout rejects ambiguous amounts and malformed success payloads", async () => {
  for (const amountJod of ["", "0", "-1", "1.0009", "1e3", "NaN"])
    await assert.rejects(
      actions.requestSimulatedPayout(
        { destinationAlias: "Simulation bank ••0042", amountJod },
        async () => {
          throw new Error("request must not run");
        },
        () => "unused-key",
      ),
      (error) => error.code === "PAYOUT_AMOUNT_INVALID",
    );

  await assert.rejects(
    actions.requestSimulatedPayout(
      { destinationAlias: "Simulation bank ••0042", amountJod: "1.000" },
      async () => ({ status: "REQUESTED" }),
      () => "payout-ui-key",
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
