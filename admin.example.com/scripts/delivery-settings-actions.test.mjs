import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { createDeliveryZone, createPickupLocation } = await loadProduction(
  new URL("../src/lib/delivery-settings-actions.ts", import.meta.url),
);

test("delivery zone creation preserves integer fils and window details", async () => {
  let call;
  const result = await createDeliveryZone(
    {
      nameEn: "West Amman",
      nameAr: "غرب عمان",
      feeFils: 2500,
      etaMinDays: 1,
      etaMaxDays: 2,
      policyReviewed: true,
      weekday: 1,
      startsAt: "09:00",
      endsAt: "17:00",
      capacity: 40,
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { id: "zone-1" } });
    },
  );

  assert.equal(result.id, "zone-1");
  assert.equal(call.url, "/api/v1/admin/delivery/zones");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), {
    nameEn: "West Amman",
    nameAr: "غرب عمان",
    feeFils: 2500,
    etaMinDays: 1,
    etaMaxDays: 2,
    policyReviewed: true,
    windows: [{ weekday: 1, startsAt: "09:00", endsAt: "17:00", capacity: 40 }],
  });
});

test("pickup creation sends structured address and opening-hours text", async () => {
  let call;
  const result = await createPickupLocation(
    {
      nameEn: "Sweifieh pickup",
      nameAr: "استلام الصويفية",
      address: "Wasfi Al Tal Street, building 12",
      hours: "Sun–Thu 09:00–18:00",
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { id: "pickup-1" } });
    },
  );

  assert.equal(result.id, "pickup-1");
  assert.equal(call.url, "/api/v1/admin/delivery/pickups");
  assert.deepEqual(JSON.parse(call.body), {
    nameEn: "Sweifieh pickup",
    nameAr: "استلام الصويفية",
    address: { text: "Wasfi Al Tal Street, building 12" },
    hours: { text: "Sun–Thu 09:00–18:00" },
  });
});

test("invalid delivery configuration never reaches the API", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return Response.json({ data: { id: "unexpected" } });
  };

  await assert.rejects(
    createDeliveryZone(
      {
        nameEn: "W",
        nameAr: "غ",
        feeFils: 10.5,
        etaMinDays: 4,
        etaMaxDays: 2,
        policyReviewed: false,
        weekday: 8,
        startsAt: "9am",
        endsAt: "17:00",
        capacity: 0,
      },
      transport,
    ),
    (error) => error.code === "ZONE_CREATE_INVALID",
  );
  await assert.rejects(
    createPickupLocation(
      { nameEn: "A", nameAr: "ب", address: "", hours: "" },
      transport,
    ),
    (error) => error.code === "PICKUP_CREATE_INVALID",
  );
  assert.equal(calls, 0);
});

test("malformed delivery configuration success is never confirmed", async () => {
  const transport = async () => Response.json({ data: {} });
  await assert.rejects(
    createPickupLocation(
      {
        nameEn: "Sweifieh pickup",
        nameAr: "استلام الصويفية",
        address: "Address",
        hours: "Daily 9–5",
      },
      transport,
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
