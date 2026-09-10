import { afterEach, describe, expect, it, vi } from "vitest";

const APS_ENV_KEYS = [
  "APP_ENV",
  "SIM_MODE",
  "STOREFRONT_ORIGIN",
  "APS_ACCESS_CODE",
  "APS_MERCHANT_IDENTIFIER",
  "APS_SHA_REQUEST_PHRASE",
  "APS_SHA_RESPONSE_PHRASE",
] as const;

afterEach(() => {
  for (const key of APS_ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

describe("Amazon Payment Services provider", () => {
  it("implements the documented sorted SHA-256 signature contract", async () => {
    const { calculateApsSignature } = await import("./provider");
    expect(calculateApsSignature({
      merchant_reference: "REF",
      ignored: null,
      amount: 1000,
      signature: "not-part-of-the-signature",
      access_code: "A",
    }, "phrase")).toBe("b9b17d761d0fc5486f9b5e28c3d7e4ac69c58d345811f0f08483ba2e7d24cc1a");
  });

  it("creates a local hosted-payment handoff without provider credentials", async () => {
    process.env.APP_ENV = "local";
    process.env.SIM_MODE = "1";
    process.env.STOREFRONT_ORIGIN = "http://localhost:3000";
    const { createHostedPayment } = await import("./provider");
    const payment = await createHostedPayment({
      operationKey: "op-1",
      amountFils: 20500,
      returnUrl: "http://localhost:3000/api/v1/payments/return",
      purpose: "ORDER",
      entityReference: "ord_example",
      customerEmail: "buyer@example.com",
    });
    expect(payment.hostedUrl).toBe("http://localhost:3000/api/v1/payments/simulate");
    expect(payment.formFields).toMatchObject({ merchant_reference: "sim_ord_example", outcome: "success" });
  });

  it("accepts only a correctly signed APS success response", async () => {
    process.env.APP_ENV = "local";
    process.env.APS_ACCESS_CODE = "access-code";
    process.env.APS_MERCHANT_IDENTIFIER = "merchant-id";
    process.env.APS_SHA_REQUEST_PHRASE = "request-phrase-123";
    process.env.APS_SHA_RESPONSE_PHRASE = "response-phrase-123";
    const { calculateApsSignature, verifyApsResponse } = await import("./provider");
    const response = {
      access_code: "access-code",
      merchant_identifier: "merchant-id",
      merchant_reference: "ord_example",
      amount: "20500",
      currency: "JOD",
      command: "PURCHASE",
      response_code: "14000",
      fort_id: "fort-1",
    };
    const signed = { ...response, signature: calculateApsSignature(response, "response-phrase-123") };
    expect(verifyApsResponse(signed)).toMatchObject({ reference: "ord_example", status: "CONFIRMED", amountFils: 20500 });
    expect(() => verifyApsResponse({ ...signed, amount: "20510" })).toThrow("APS_RESPONSE_SIGNATURE_INVALID");
  });
});
