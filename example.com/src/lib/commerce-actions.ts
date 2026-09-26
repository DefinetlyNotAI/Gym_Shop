import { ApiFailure, readApiData } from "@/lib/api-errors";
import type { CartLine } from "@/lib/contracts";
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
async function request(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  transport: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await transport(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = await readApiData<unknown>(response);
  if (!record(result))
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  return result;
}
function cartLine(value: unknown): value is CartLine {
  return (
    record(value) &&
    ["id", "variant_id", "sku", "slug", "name_en", "name_ar"].every(
      (key) => typeof value[key] === "string",
    ) &&
    (integer(value.unit_price_fils) ||
      (typeof value.unit_price_fils === "string" &&
        /^\d+$/.test(value.unit_price_fils) &&
        integer(Number(value.unit_price_fils)))) &&
    integer(value.quantity) &&
    value.quantity > 0 &&
    typeof value.selected === "boolean" &&
    record(value.option_values) &&
    (value.available === null ||
      (typeof value.available === "number" &&
        Number.isSafeInteger(value.available)))
  );
}
export async function updateCartLine(
  input: { variantId: string; quantity: number; selected: boolean },
  transport: typeof fetch = fetch,
): Promise<CartLine[]> {
  const result = await request("/api/v1/cart", "PUT", input, transport);
  if (!Array.isArray(result.lines) || !result.lines.every(cartLine))
    throw new ApiFailure("INVALID_RESPONSE");
  return result.lines.map((line) => ({
    ...line,
    unit_price_fils: String(line.unit_price_fils),
  }));
}
export async function removeSavedLine(
  id: string,
  transport: typeof fetch = fetch,
): Promise<void> {
  const result = await request(
    `/api/v1/cart?lineId=${encodeURIComponent(id)}`,
    "DELETE",
    undefined,
    transport,
  );
  if (result.removed !== true) throw new ApiFailure("INVALID_RESPONSE");
}
export async function updateNewsletter(
  subscribed: boolean,
  transport: typeof fetch = fetch,
): Promise<void> {
  const result = await request(
    "/api/v1/subscriptions/newsletter",
    "POST",
    { subscribed, source: "HOMEPAGE_NEWSLETTER" },
    transport,
  );
  if (result.status !== (subscribed ? "SUBSCRIBED" : "UNSUBSCRIBED"))
    throw new ApiFailure("INVALID_RESPONSE");
}
export async function subscribeVariant(
  id: string,
  transport: typeof fetch = fetch,
): Promise<void> {
  const result = await request(
    `/api/v1/catalog/variants/${encodeURIComponent(id)}/restock-subscription`,
    "POST",
    { subscribed: true },
    transport,
  );
  if (result.status !== "ACTIVE") throw new ApiFailure("INVALID_RESPONSE");
}
export async function convertRewardBlocks(
  blocks: number,
  idempotencyKey: string,
  transport: typeof fetch = fetch,
) {
  const result = await request(
    "/api/v1/account/rewards/convert",
    "POST",
    { blocks, idempotencyKey },
    transport,
  );
  if (
    typeof result.conversionId !== "string" ||
    !result.conversionId ||
    result.blocks !== blocks ||
    !integer(result.walletFilsCredited) ||
    !integer(result.pointsDebited) ||
    !integer(result.weeklyBlocksRemaining) ||
    typeof result.weekStart !== "string"
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return {
    conversionId: result.conversionId,
    walletFilsCredited: result.walletFilsCredited,
    pointsDebited: result.pointsDebited,
    weeklyBlocksRemaining: result.weeklyBlocksRemaining,
  };
}
type ReorderResult = {
  added: { sku: string; quantity: number; currentPriceFils: number }[];
  rejected: { sku: string; reason: string }[];
  selectionConfirmationRequired: boolean;
};
export async function copyOrderToCart(
  id: string,
  transport: typeof fetch = fetch,
): Promise<ReorderResult> {
  const result = await request(
    `/api/v1/orders/${encodeURIComponent(id)}/reorder`,
    "POST",
    undefined,
    transport,
  );
  if (
    !Array.isArray(result.added) ||
    !result.added.every(
      (row): row is ReorderResult["added"][number] =>
        record(row) &&
        typeof row.sku === "string" &&
        integer(row.quantity) &&
        row.quantity > 0 &&
        integer(row.currentPriceFils),
    ) ||
    !Array.isArray(result.rejected) ||
    !result.rejected.every(
      (row): row is ReorderResult["rejected"][number] =>
        record(row) &&
        typeof row.sku === "string" &&
        typeof row.reason === "string",
    ) ||
    typeof result.selectionConfirmationRequired !== "boolean"
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return {
    added: result.added,
    rejected: result.rejected,
    selectionConfirmationRequired: result.selectionConfirmationRequired,
  };
}
