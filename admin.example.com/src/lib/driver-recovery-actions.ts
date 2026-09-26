import { ApiFailure, readApiData } from "@/lib/api-errors";

type Transport = typeof fetch;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function postData(
  path: string,
  body: unknown,
  transport: Transport,
): Promise<unknown> {
  return readApiData(
    await transport(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export type DriverDeliveryAction = "accept" | "complete" | "fail";

export async function runDriverDeliveryAction(
  publicId: string,
  action: DriverDeliveryAction,
  body: unknown,
  transport: Transport = fetch,
): Promise<void> {
  const orderId = publicId.trim();
  if (!orderId) throw new ApiFailure("DELIVERY_ACTION_INVALID", 400);
  const data = await postData(
    `/api/v1/deliveries/${encodeURIComponent(orderId)}/${action}`,
    body,
    transport,
  );
  const confirmed =
    data &&
    typeof data === "object" &&
    ((action === "accept" &&
      (data as { accepted?: unknown }).accepted === true) ||
      (action === "complete" &&
        (data as { delivered?: unknown }).delivered === true) ||
      (action === "fail" &&
        Number.isSafeInteger((data as { attempt?: unknown }).attempt) &&
        Number((data as { attempt: number }).attempt) >= 1 &&
        Number((data as { attempt: number }).attempt) <= 3));
  if (!confirmed) throw new ApiFailure("INVALID_RESPONSE");
}

export async function handoverDriverCash(
  amountFils: number,
  transport: Transport = fetch,
): Promise<{ handoverId: string }> {
  if (!Number.isSafeInteger(amountFils) || amountFils <= 0) {
    throw new ApiFailure("AMOUNT_INVALID", 400);
  }
  const data = await postData(
    "/api/v1/deliveries/cash/handover",
    { amountFils },
    transport,
  );
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { handoverId?: unknown }).handoverId !== "string" ||
    !(data as { handoverId: string }).handoverId.trim()
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return { handoverId: (data as { handoverId: string }).handoverId };
}

export type RecoveryResendInput = {
  recoveryId: string;
  browserBinding: string;
  channel: "EMAIL" | "PHONE";
};

export async function resendRecoveryCode(
  input: RecoveryResendInput,
  transport: Transport = fetch,
): Promise<{ sent: true; developmentCode?: string }> {
  const value = {
    id: input.recoveryId.trim(),
    browserBinding: input.browserBinding.trim(),
    channel: input.channel,
  };
  if (
    !uuidPattern.test(value.id) ||
    value.browserBinding.length < 16 ||
    value.browserBinding.length > 200 ||
    !["EMAIL", "PHONE"].includes(value.channel)
  ) {
    throw new ApiFailure("RECOVERY_RESEND_INVALID", 400);
  }
  const data = await postData("/api/v1/recovery/resend", value, transport);
  const code = (data as { developmentCode?: unknown } | null)?.developmentCode;
  if (
    !data ||
    typeof data !== "object" ||
    (data as { sent?: unknown }).sent !== true ||
    (code !== undefined &&
      (typeof code !== "string" || !/^[0-9]{6}$/.test(code)))
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return {
    sent: true,
    ...(typeof code === "string" ? { developmentCode: code } : {}),
  };
}
