import { apiErrorFromPayload, ApiFailure } from "@/lib/api-errors";

type Transport = typeof fetch;

async function postData(
  path: string,
  body: unknown,
  transport: Transport,
): Promise<unknown> {
  const response = await transport(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  return payload?.data;
}

export async function inspectInventoryReturn(
  orderPublicId: string,
  input: { sellable: boolean; reason: string },
  transport: Transport = fetch,
): Promise<{ inspected: number; sellable: boolean }> {
  const orderId = orderPublicId.trim();
  const reason = input.reason.trim();
  if (!orderId || reason.length < 3 || reason.length > 500) {
    throw new ApiFailure("RETURN_INSPECTION_INVALID", 400);
  }
  const data = await postData(
    `/api/v1/admin/inventory/returns/${encodeURIComponent(orderId)}`,
    { sellable: input.sellable, reason },
    transport,
  );
  if (
    !data ||
    typeof data !== "object" ||
    !Number.isSafeInteger((data as { inspected?: unknown }).inspected) ||
    Number((data as { inspected: number }).inspected) <= 0 ||
    typeof (data as { sellable?: unknown }).sellable !== "boolean"
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return {
    inspected: (data as { inspected: number }).inspected,
    sellable: (data as { sellable: boolean }).sellable,
  };
}

export type CashDiscrepancyInput = {
  driverId: string;
  expectedFils: number;
  actualFils: number;
  sourceId: string;
  reason: string;
};

export async function recordCashDiscrepancy(
  input: CashDiscrepancyInput,
  transport: Transport = fetch,
): Promise<{ discrepancyId: string; differenceFils: number }> {
  const value = {
    ...input,
    driverId: input.driverId.trim(),
    sourceId: input.sourceId.trim(),
    reason: input.reason.trim(),
  };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.driverId,
    ) ||
    !Number.isSafeInteger(value.expectedFils) ||
    value.expectedFils < 0 ||
    !Number.isSafeInteger(value.actualFils) ||
    value.actualFils < 0 ||
    !value.sourceId ||
    value.sourceId.length > 200 ||
    value.reason.length < 3 ||
    value.reason.length > 500
  ) {
    throw new ApiFailure("DISCREPANCY_INVALID", 400);
  }
  const data = await postData(
    "/api/v1/admin/finance/discrepancies",
    value,
    transport,
  );
  if (
    !data ||
    typeof data !== "object" ||
    (data as { recorded?: unknown }).recorded !== true ||
    typeof (data as { discrepancyId?: unknown }).discrepancyId !== "string" ||
    !Number.isSafeInteger((data as { differenceFils?: unknown }).differenceFils)
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return {
    discrepancyId: (data as { discrepancyId: string }).discrepancyId,
    differenceFils: (data as { differenceFils: number }).differenceFils,
  };
}

export type NotificationTemplateInput = {
  eventType: string;
  channel: "IN_SITE" | "EMAIL" | "WHATSAPP";
  language: "ar" | "en";
  subject?: string;
  body: string;
  allowedVariables: string[];
};

export async function createNotificationTemplate(
  input: NotificationTemplateInput,
  transport: Transport = fetch,
): Promise<{ id: string; version: number }> {
  const value = {
    ...input,
    eventType: input.eventType.trim(),
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    allowedVariables: [
      ...new Set(input.allowedVariables.map((item) => item.trim())),
    ],
  };
  if (
    !/^[a-z][a-z0-9_.-]+\.v[1-9][0-9]*$/.test(value.eventType) ||
    !["IN_SITE", "EMAIL", "WHATSAPP"].includes(value.channel) ||
    !["ar", "en"].includes(value.language) ||
    (value.subject?.length ?? 0) > 200 ||
    !value.body ||
    value.body.length > 10000 ||
    value.allowedVariables.length > 30 ||
    value.allowedVariables.some((name) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(name))
  ) {
    throw new ApiFailure("TEMPLATE_INVALID", 400);
  }
  const data = await postData(
    "/api/v1/admin/notifications/templates",
    value,
    transport,
  );
  if (
    !data ||
    typeof data !== "object" ||
    typeof (data as { id?: unknown }).id !== "string" ||
    !Number.isSafeInteger((data as { version?: unknown }).version) ||
    Number((data as { version: number }).version) < 1
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return {
    id: (data as { id: string }).id,
    version: (data as { version: number }).version,
  };
}
