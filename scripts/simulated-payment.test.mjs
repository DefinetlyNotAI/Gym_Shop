import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/lib/simulated-payment.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { simulateHostedPayment } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);
const origin = "http://localhost:3000";
const result = {
  orderId: "ord_test",
  paymentUrl: `${origin}/api/v1/payments/simulate`,
  paymentFields: {
    merchant_reference: "sim_ord_test",
    amount: "21000",
    outcome: "success",
    return_url: `${origin}/checkout/success`,
  },
};
function completedResponse(payment = "confirmed", order = "ord_test") {
  const response = new Response("Payment result", { status: 200 });
  Object.defineProperty(response, "url", {
    value: `${origin}/checkout/success?order=${order}&payment=${payment}`,
  });
  return response;
}
test("SIM uses a credentialed CORS-mode POST while retaining provider fields and selected outcome", async () => {
  const calls = [];
  const destination = await simulateHostedPayment(
    result,
    "failure",
    origin,
    async (url, init) => {
      calls.push({ url, init });
      return completedResponse("failed");
    },
  );
  assert.equal(destination, "/checkout/success?order=ord_test&payment=failed");
  assert.equal(calls[0].url, `${origin}/api/v1/payments/simulate`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.mode, "cors");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.deepEqual(Object.fromEntries(calls[0].init.body), {
    ...result.paymentFields,
    outcome: "failure",
  });
});
test("SIM handoff rejects foreign destinations and mismatched merchant references before transmission", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return completedResponse();
  };
  await assert.rejects(
    simulateHostedPayment(
      { ...result, paymentUrl: "https://evil.test/api/v1/payments/simulate" },
      "success",
      origin,
      transport,
    ),
    /destination/i,
  );
  await assert.rejects(
    simulateHostedPayment(
      {
        ...result,
        paymentFields: {
          ...result.paymentFields,
          merchant_reference: "sim_other",
        },
      },
      "success",
      origin,
      transport,
    ),
    /reference/i,
  );
  assert.equal(calls, 0);
});
test("SIM failures or unrelated redirects never produce a confirmed-order destination", async () => {
  await assert.rejects(
    simulateHostedPayment(
      result,
      "success",
      origin,
      async () => new Response("Forbidden", { status: 403 }),
    ),
    /403/,
  );
  await assert.rejects(
    simulateHostedPayment(result, "success", origin, async () =>
      completedResponse("confirmed", "ord_other"),
    ),
    /response/i,
  );
  await assert.rejects(
    simulateHostedPayment(result, "success", origin, async () =>
      completedResponse("pretend-success"),
    ),
    /response/i,
  );
});
