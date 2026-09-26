import { ApiFailure, readApiData } from "@/lib/api-errors";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function phoneRequest(body: unknown, transport: typeof fetch) {
  const response = await transport("/api/v1/account/phone-verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readApiData<unknown>(response);
  if (!record(data)) throw new ApiFailure("INVALID_RESPONSE", response.status);
  return { data, status: response.status };
}

export async function requestPhoneCode(
  phone: string,
  transport: typeof fetch = fetch,
) {
  const { data, status } = await phoneRequest(
    { phone, channel: "WHATSAPP" },
    transport,
  );
  const developmentCode = data.developmentCode;
  if (
    data.status !== "SENT" ||
    typeof data.requestId !== "string" ||
    !data.requestId.trim() ||
    (developmentCode !== undefined &&
      (typeof developmentCode !== "string" || !/^\d{6}$/.test(developmentCode)))
  )
    throw new ApiFailure("INVALID_RESPONSE", status);
  return { requestId: data.requestId, developmentCode };
}

export async function verifyPhoneCode(
  requestId: string,
  code: string,
  transport: typeof fetch = fetch,
): Promise<void> {
  const { data, status } = await phoneRequest({ requestId, code }, transport);
  if (data.verified !== true) throw new ApiFailure("INVALID_RESPONSE", status);
}
