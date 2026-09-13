import { ApiFailure, readApiData } from "@/lib/api-errors";
type Transport = typeof fetch;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
async function request(
  path: string,
  method: string,
  body: unknown,
  transport: Transport,
) {
  const response = await transport(path, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readApiData<unknown>(response);
  if (!record(data)) throw new ApiFailure("INVALID_RESPONSE", response.status);
  return { data, status: response.status };
}
export async function saveProfile(
  body: { displayName: string; phone: string },
  transport: Transport = fetch,
) {
  const { data, status } = await request(
    "/api/v1/account",
    "PATCH",
    body,
    transport,
  );
  if (
    data.updated !== true ||
    typeof data.phoneVerificationRequired !== "boolean"
  )
    throw new ApiFailure("INVALID_RESPONSE", status);
  return {
    updated: true,
    phoneVerificationRequired: data.phoneVerificationRequired,
  };
}
export async function saveAccountAddress(
  body: ReturnType<typeof addressInput>,
  id?: string,
  transport: Transport = fetch,
) {
  const { data, status } = await request(
    "/api/v1/account/addresses",
    id ? "PATCH" : "POST",
    id ? { ...body, id } : body,
    transport,
  );
  if (
    typeof data.id !== "string" ||
    !data.id ||
    (id !== undefined && data.id !== id)
  )
    throw new ApiFailure("INVALID_RESPONSE", status);
  return { id: data.id };
}
export async function removeAccountAddress(
  id: string,
  transport: Transport = fetch,
) {
  const { data, status } = await request(
    `/api/v1/account/addresses?id=${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    transport,
  );
  if (data.deleted !== true) throw new ApiFailure("INVALID_RESPONSE", status);
}
export function addressInput(form: FormData) {
  const text = (key: string) => String(form.get(key) ?? "");
  return {
    recipient: text("recipient"),
    phone: text("phone"),
    country: text("country") || "Jordan",
    city: text("city"),
    area: text("area"),
    street: text("street"),
    building: text("building") || undefined,
    floor: text("floor") || undefined,
    unit: text("unit") || undefined,
    landmark: text("landmark") || undefined,
    latitude: text("latitude") ? Number(text("latitude")) : undefined,
    longitude: text("longitude") ? Number(text("longitude")) : undefined,
    shippingDefault: form.get("shippingDefault") === "on",
    billingDefault: form.get("billingDefault") === "on",
  };
}
