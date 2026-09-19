import { apiErrorFromPayload, ApiFailure } from "@/lib/api-errors";

export type ClaimDecisionInput = {
  decision: "REPLACE" | "REFUND" | "REJECT";
  customerReason: string;
  privateNotes?: string;
};

export type ClaimDecisionResult = {
  status: "REPLACEMENT_CREATED" | "REFUND_REQUESTED" | "REJECTED";
  replacementOrderId?: string;
  refundId?: string;
};

export async function decideSupportClaim(
  claimId: string,
  input: ClaimDecisionInput,
  transport: typeof fetch = fetch,
): Promise<ClaimDecisionResult> {
  const customerReason = input.customerReason.trim();
  const privateNotes = input.privateNotes?.trim();
  if (
    !claimId ||
    !["REPLACE", "REFUND", "REJECT"].includes(input.decision) ||
    customerReason.length < 3 ||
    customerReason.length > 2000 ||
    (privateNotes?.length ?? 0) > 5000
  ) {
    throw new ApiFailure("CLAIM_DECISION_INVALID", 400);
  }

  const response = await transport(
    `/api/v1/admin/support/claims/${encodeURIComponent(claimId)}/decision`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision: input.decision,
        customerReason,
        ...(privateNotes ? { privateNotes } : {}),
      }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  const data = payload?.data;
  if (
    !data ||
    !["REPLACEMENT_CREATED", "REFUND_REQUESTED", "REJECTED"].includes(
      data.status,
    )
  ) {
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  }
  return {
    status: data.status,
    ...(typeof data.replacementOrderId === "string"
      ? { replacementOrderId: data.replacementOrderId }
      : {}),
    ...(typeof data.refundId === "string" ? { refundId: data.refundId } : {}),
  };
}

export async function editSupportMessage(
  ticketId: string,
  messageId: string,
  body: string,
  transport: typeof fetch = fetch,
): Promise<{ edited: boolean }> {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 10000)
    throw new Error("Enter between 1 and 10,000 characters.");
  const response = await transport(
    `/api/v1/admin/support/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: trimmed }),
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  if (typeof payload?.data?.edited !== "boolean")
    throw new ApiFailure("INVALID_RESPONSE");
  return { edited: payload.data.edited };
}
