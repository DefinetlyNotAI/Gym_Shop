import { ApiFailure, readApiData } from "@/lib/api-errors";
export type CheckoutResult = {
  orderId: string;
  status: "CONFIRMED" | "PAYMENT_REQUIRED";
  paymentReference?: string;
  paymentUrl?: string;
  paymentFields?: Record<string, string>;
};
export type PricingPreview = {
  merchandiseFils: number;
  discountFils: number;
  deliveryFils: number;
  taxFils: number;
  totalFils: number;
  walletAvailableFils: number;
  walletTenderFils: number;
  externalDueFils: number;
  rejections: { ruleId: string; code: string }[];
};
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
async function validated<T>(
  response: Response,
  accepts: (value: unknown) => value is T,
): Promise<T> {
  const value = await readApiData<unknown>(response);
  if (!accepts(value))
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  return value;
}
export function readCheckoutResult(
  response: Response,
): Promise<CheckoutResult> {
  return validated(response, (value): value is CheckoutResult => {
    if (
      !record(value) ||
      !nonempty(value.orderId) ||
      (value.status !== "CONFIRMED" && value.status !== "PAYMENT_REQUIRED")
    )
      return false;
    if (value.status === "CONFIRMED") return true;
    if (
      !nonempty(value.paymentUrl) ||
      !record(value.paymentFields) ||
      !Object.keys(value.paymentFields).length ||
      !Object.values(value.paymentFields).every(
        (field) => typeof field === "string",
      )
    )
      return false;
    try {
      const url = new URL(value.paymentUrl);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  });
}
export function readReferralResult(
  response: Response,
): Promise<{ code: string }> {
  return validated(
    response,
    (value): value is { code: string } => record(value) && nonempty(value.code),
  );
}
export function readPricingPreview(
  response: Response,
): Promise<PricingPreview> {
  return validated(
    response,
    (value): value is PricingPreview =>
      record(value) &&
      [
        "merchandiseFils",
        "discountFils",
        "deliveryFils",
        "taxFils",
        "totalFils",
        "walletAvailableFils",
        "walletTenderFils",
        "externalDueFils",
      ].every(
        (key) =>
          typeof value[key] === "number" &&
          Number.isSafeInteger(value[key]) &&
          value[key] >= 0,
      ) &&
      Array.isArray(value.rejections) &&
      value.rejections.every(
        (row) => record(row) && nonempty(row.ruleId) && nonempty(row.code),
      ),
  );
}
