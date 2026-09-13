import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const { readCheckoutResult, readReferralResult, readPricingPreview } =
  await loadProduction(
    new URL("../src/lib/checkout-responses.ts", import.meta.url),
  );
test("checkout rejects malformed parsed success without fabricating order confirmation", async () => {
  for (const data of [
    "oops",
    [],
    {},
    { orderId: "ord_test", status: "PAID" },
    { orderId: "ord_test", status: "PAYMENT_REQUIRED" },
    {
      orderId: "ord_test",
      status: ["PAYMENT_REQUIRED"],
      paymentUrl: "https://checkout.payfort.com/FortAPI/paymentPage",
      paymentFields: { merchant_reference: "reference" },
    },
  ]) {
    await assert.rejects(
      readCheckoutResult(Response.json({ data })),
      (error) => error.code === "INVALID_RESPONSE",
    );
  }
  assert.equal(
    (
      await readCheckoutResult(
        Response.json({ data: { orderId: "ord_test", status: "CONFIRMED" } }),
      )
    ).orderId,
    "ord_test",
  );
  assert.equal(
    (
      await readCheckoutResult(
        Response.json({
          data: {
            orderId: "ord_test",
            status: "PAYMENT_REQUIRED",
            paymentUrl: "https://checkout.payfort.com/FortAPI/paymentPage",
            paymentFields: { merchant_reference: "reference" },
          },
        }),
      )
    ).status,
    "PAYMENT_REQUIRED",
  );
});
test("referral results require an actual returned code", async () => {
  await assert.rejects(
    readReferralResult(Response.json({ data: {} })),
    (error) => error.code === "INVALID_RESPONSE",
  );
  assert.equal(
    (await readReferralResult(Response.json({ data: { code: "SIMCODE" } })))
      .code,
    "SIMCODE",
  );
});
test("pricing preview requires nonnegative integer amounts and real rejection rows", async () => {
  const data = {
    merchandiseFils: 1000,
    discountFils: 0,
    deliveryFils: 250,
    taxFils: 0,
    totalFils: 1250,
    walletAvailableFils: 0,
    walletTenderFils: 0,
    externalDueFils: 1250,
    rejections: [],
  };
  assert.deepEqual(await readPricingPreview(Response.json({ data })), data);
  for (const invalid of [
    {},
    { ...data, totalFils: -1 },
    { ...data, rejections: [{}] },
  ])
    await assert.rejects(
      readPricingPreview(Response.json({ data: invalid })),
      (error) => error.code === "INVALID_RESPONSE",
    );
});
