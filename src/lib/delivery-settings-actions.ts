import { ApiFailure, readApiData } from "@/lib/api-errors";

type Transport = typeof fetch;

export type DeliveryZoneInput = {
  nameEn: string;
  nameAr: string;
  feeFils: number;
  etaMinDays: number;
  etaMaxDays: number;
  policyReviewed: boolean;
  weekday: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
};

export type PickupLocationInput = {
  nameEn: string;
  nameAr: string;
  address: string;
  hours: string;
};

async function postWithId(
  path: string,
  body: unknown,
  transport: Transport,
): Promise<{ id: string }> {
  const data = await readApiData<unknown>(
    await transport(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { id?: unknown }).id !== "string" ||
    !(data as { id: string }).id
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return { id: (data as { id: string }).id };
}

export async function createDeliveryZone(
  input: DeliveryZoneInput,
  transport: Transport = fetch,
) {
  const value = {
    ...input,
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
  };
  if (
    value.nameEn.length < 2 ||
    value.nameAr.length < 2 ||
    !Number.isSafeInteger(value.feeFils) ||
    value.feeFils < 0 ||
    !Number.isSafeInteger(value.etaMinDays) ||
    value.etaMinDays < 0 ||
    !Number.isSafeInteger(value.etaMaxDays) ||
    value.etaMaxDays < value.etaMinDays ||
    !Number.isSafeInteger(value.weekday) ||
    value.weekday < 0 ||
    value.weekday > 6 ||
    !/^\d{2}:\d{2}$/.test(value.startsAt) ||
    !/^\d{2}:\d{2}$/.test(value.endsAt) ||
    value.startsAt >= value.endsAt ||
    !Number.isSafeInteger(value.capacity) ||
    value.capacity < 1
  ) {
    throw new ApiFailure("ZONE_CREATE_INVALID", 400);
  }
  return postWithId(
    "/api/v1/admin/delivery/zones",
    {
      nameEn: value.nameEn,
      nameAr: value.nameAr,
      feeFils: value.feeFils,
      etaMinDays: value.etaMinDays,
      etaMaxDays: value.etaMaxDays,
      policyReviewed: value.policyReviewed,
      windows: [
        {
          weekday: value.weekday,
          startsAt: value.startsAt,
          endsAt: value.endsAt,
          capacity: value.capacity,
        },
      ],
    },
    transport,
  );
}

export async function createPickupLocation(
  input: PickupLocationInput,
  transport: Transport = fetch,
) {
  const value = {
    nameEn: input.nameEn.trim(),
    nameAr: input.nameAr.trim(),
    address: input.address.trim(),
    hours: input.hours.trim(),
  };
  if (
    value.nameEn.length < 2 ||
    value.nameAr.length < 2 ||
    value.address.length < 3 ||
    value.address.length > 1000 ||
    value.hours.length < 3 ||
    value.hours.length > 1000
  ) {
    throw new ApiFailure("PICKUP_CREATE_INVALID", 400);
  }
  return postWithId(
    "/api/v1/admin/delivery/pickups",
    {
      nameEn: value.nameEn,
      nameAr: value.nameAr,
      address: { text: value.address },
      hours: { text: value.hours },
    },
    transport,
  );
}
