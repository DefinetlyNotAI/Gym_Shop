import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const { requestPhoneCode, verifyPhoneCode } = await loadProduction(
  new URL("../src/lib/account-phone.ts", import.meta.url),
);

test("phone-code requests preserve the WhatsApp request and validated SIM code", async () => {
  const result = await requestPhoneCode("+962790000123", async (path, init) => {
    assert.equal(path, "/api/v1/account/phone-verification");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      phone: "+962790000123",
      channel: "WHATSAPP",
    });
    return Response.json({
      data: {
        status: "SENT",
        requestId: "sim-request",
        developmentCode: "123456",
      },
    });
  });
  assert.deepEqual(result, {
    requestId: "sim-request",
    developmentCode: "123456",
  });
});
test("real phone requests do not fabricate a development code", async () => {
  assert.deepEqual(
    await requestPhoneCode("+962790000123", async () =>
      Response.json({ data: { status: "SENT", requestId: "request" } }),
    ),
    { requestId: "request", developmentCode: undefined },
  );
});
test("phone requests reject malformed acceptance and unsafe development-code values", async () => {
  for (const data of [
    [],
    {},
    { status: "SENT", requestId: "" },
    { status: "FAILED", requestId: "request" },
    { status: "SENT", requestId: "request", developmentCode: "<private>" },
  ]) {
    await assert.rejects(
      requestPhoneCode("+962790000123", async () =>
        Response.json({ data }, { status: 201 }),
      ),
      (error) => error.code === "INVALID_RESPONSE" && error.status === 201,
    );
  }
});
test("phone verification submits the linked request and requires true verification", async () => {
  await verifyPhoneCode("sim-request", "123456", async (path, init) => {
    assert.equal(path, "/api/v1/account/phone-verification");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), {
      requestId: "sim-request",
      code: "123456",
    });
    return Response.json({ data: { verified: true } });
  });
  for (const data of [{}, { verified: false }, { verified: "true" }, []])
    await assert.rejects(
      verifyPhoneCode("request", "123456", async () => Response.json({ data })),
      (error) => error.code === "INVALID_RESPONSE" && error.status === 200,
    );
});
test("phone errors retain safe diagnostics and never retry attempts", async () => {
  let attempts = 0;
  await assert.rejects(
    verifyPhoneCode("request", "000000", async () => {
      attempts++;
      return Response.json(
        { error: { code: "PHONE_CODE_INVALID", message: "private token" } },
        { status: 409 },
      );
    }),
    (error) =>
      error.code === "PHONE_CODE_INVALID" &&
      error.status === 409 &&
      !error.message.includes("private token"),
  );
  assert.equal(attempts, 1);
  await assert.rejects(
    requestPhoneCode(
      "+962790000123",
      async () => new Response("private upstream", { status: 503 }),
    ),
    (error) =>
      error.status === 503 && !error.message.includes("private upstream"),
  );
  await assert.rejects(
    verifyPhoneCode("request", "123456", async () => {
      throw new TypeError("offline");
    }),
    TypeError,
  );
});
