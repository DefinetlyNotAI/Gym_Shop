import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";
const actions = await loadProduction(
  new URL("../src/lib/account-profile.ts", import.meta.url),
);

test("profile save requires confirmed update and phone-verification state", async () => {
  const result = await actions.saveProfile(
    { displayName: "SIM Customer", phone: "+962790000123" },
    async (path, init) => {
      assert.equal(path, "/api/v1/account");
      assert.equal(init.method, "PATCH");
      assert.deepEqual(JSON.parse(init.body), {
        displayName: "SIM Customer",
        phone: "+962790000123",
      });
      return Response.json({
        data: { updated: true, phoneVerificationRequired: true },
      });
    },
  );
  assert.equal(result.phoneVerificationRequired, true);
  for (const data of [
    {},
    { updated: false, phoneVerificationRequired: false },
    { updated: true, phoneVerificationRequired: "false" },
  ])
    await assert.rejects(
      actions.saveProfile({}, async () => Response.json({ data })),
      (error) => error.code === "INVALID_RESPONSE",
    );
});

test("address creation and edits preserve methods and require matching saved IDs", async () => {
  for (const id of [undefined, "address/id"])
    assert.equal(
      (
        await actions.saveAccountAddress(
          { recipient: "SIM" },
          id,
          async (path, init) => {
            assert.equal(path, "/api/v1/account/addresses");
            assert.equal(init.method, id ? "PATCH" : "POST");
            assert.deepEqual(
              JSON.parse(init.body),
              id ? { recipient: "SIM", id } : { recipient: "SIM" },
            );
            return Response.json({ data: { id: id ?? "created" } });
          },
        )
      ).id,
      id ?? "created",
    );
  for (const data of [{}, { id: "" }, { id: "another" }])
    await assert.rejects(
      actions.saveAccountAddress({}, "saved", async () =>
        Response.json({ data }),
      ),
      (error) => error.code === "INVALID_RESPONSE",
    );
});

test("address deletion encodes ownership ID and needs true deletion confirmation", async () => {
  await actions.removeAccountAddress("id/&?", async (path, init) => {
    assert.equal(path, "/api/v1/account/addresses?id=id%2F%26%3F");
    assert.equal(init.method, "DELETE");
    assert.equal(init.body, undefined);
    return Response.json({ data: { deleted: true } });
  });
  await assert.rejects(
    actions.removeAccountAddress("id", async () =>
      Response.json({ data: { deleted: false } }),
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});

test("malformed address creation retains its actual HTTP diagnostic status", async () => {
  await assert.rejects(
    actions.saveAccountAddress({}, undefined, async () =>
      Response.json({ data: {} }, { status: 201 }),
    ),
    (error) => error.code === "INVALID_RESPONSE" && error.status === 201,
  );
});

test("profile and address errors retain safe code/status without retries", async () => {
  let calls = 0;
  await assert.rejects(
    actions.saveProfile({}, async () => {
      calls++;
      return Response.json(
        {
          error: { code: "RECENT_AUTH_REQUIRED", message: "private identity" },
        },
        { status: 422 },
      );
    }),
    (error) =>
      error.code === "RECENT_AUTH_REQUIRED" &&
      error.status === 422 &&
      !error.message.includes("private identity"),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    actions.saveAccountAddress(
      {},
      undefined,
      async () => new Response("unavailable", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
  await assert.rejects(
    actions.removeAccountAddress("id", async () => {
      throw new TypeError("network");
    }),
    TypeError,
  );
});

test("address form serializes defaults and clears optional address details", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    recipient: "SIM Customer",
    phone: "+962790000123",
    city: "Amman",
    area: "SIM Area",
    street: "SIM Street",
    shippingDefault: "on",
  }))
    form.set(key, value);
  assert.deepEqual(actions.addressInput(form), {
    recipient: "SIM Customer",
    phone: "+962790000123",
    country: "Jordan",
    city: "Amman",
    area: "SIM Area",
    street: "SIM Street",
    building: undefined,
    floor: undefined,
    unit: undefined,
    landmark: undefined,
    latitude: undefined,
    longitude: undefined,
    shippingDefault: true,
    billingDefault: false,
  });
  form.set("latitude", "31.95");
  form.set("longitude", "35.91");
  assert.equal(actions.addressInput(form).latitude, 31.95);
  assert.equal(actions.addressInput(form).longitude, 35.91);
});
