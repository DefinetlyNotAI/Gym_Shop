import { apiErrorFromPayload, ApiFailure } from "@/lib/api-errors";

export type DamageClaimInput = {
  orderLineId: string;
  quantity: number;
  description: string;
  mediaIds: string[];
};

export async function submitDamageClaim(
  input: DamageClaimInput,
  transport: typeof fetch = fetch,
): Promise<{ ticketId: string; claimId: string }> {
  const description = input.description.trim();
  if (
    !input.orderLineId ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    description.length < 10 ||
    description.length > 5000 ||
    input.mediaIds.length < 1 ||
    input.mediaIds.length > 5
  ) {
    throw new ApiFailure("CLAIM_INVALID", 400);
  }

  const response = await transport("/api/v1/support/claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...input, description }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  if (
    typeof payload?.data?.ticketId !== "string" ||
    !payload.data.ticketId ||
    typeof payload?.data?.claimId !== "string" ||
    !payload.data.claimId
  ) {
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  }
  return {
    ticketId: payload.data.ticketId,
    claimId: payload.data.claimId,
  };
}
