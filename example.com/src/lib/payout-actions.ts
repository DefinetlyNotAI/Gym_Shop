import { ApiFailure } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

type Requester = <T>(
  path: string,
  options: { method: "POST"; body: unknown },
) => Promise<T>;

type PayoutResponse = {
  publicId?: unknown;
  amountFils?: unknown;
  status?: unknown;
  providerReference?: unknown;
};

function exactFils(value: string): number {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) throw new ApiFailure("PAYOUT_AMOUNT_INVALID", 422);
  const amount = Number(match[1]) * 1_000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApiFailure("PAYOUT_AMOUNT_INVALID", 422);
  }
  return amount;
}

export async function requestSimulatedPayout(
  input: { destinationAlias: string; amountJod: string },
  requester: Requester = requestApi,
  createIdempotencyKey: () => string = () => crypto.randomUUID(),
) {
  const destinationAlias = input.destinationAlias.trim();
  if (destinationAlias.length < 4 || destinationAlias.length > 80) {
    throw new ApiFailure("PAYOUT_DESTINATION_REQUIRED", 422);
  }
  const amountFils = exactFils(input.amountJod);
  const response = await requester<PayoutResponse>("/api/v1/account/payouts", {
    method: "POST",
    body: {
      destinationAlias,
      amountFils,
      idempotencyKey: createIdempotencyKey(),
    },
  });
  if (
    typeof response.publicId !== "string" ||
    !response.publicId.startsWith("pay_") ||
    response.amountFils !== amountFils ||
    response.status !== "REQUESTED"
  ) {
    throw new ApiFailure("INVALID_RESPONSE", 200);
  }
  return { publicId: response.publicId, status: response.status };
}
