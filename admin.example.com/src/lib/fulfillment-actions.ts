import { ApiFailure, readApiData } from "@/lib/api-errors";
export type FulfillmentAction = "pack" | "dispatch" | "pickup" | "reassign";
const confirmation = {
  pack: "packed",
  dispatch: "dispatched",
  pickup: "collected",
  reassign: "reassigned",
} as const;
export async function fulfillOrder(
  id: string,
  action: FulfillmentAction,
  body: unknown = {},
  transport: typeof fetch = fetch,
): Promise<void> {
  const response = await transport(
    `/api/v1/admin/orders/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await readApiData<unknown>(response);
  if (
    !result ||
    typeof result !== "object" ||
    !(confirmation[action] in result) ||
    Reflect.get(result, confirmation[action]) !== true
  )
    throw new ApiFailure("INVALID_RESPONSE", response.status);
}
