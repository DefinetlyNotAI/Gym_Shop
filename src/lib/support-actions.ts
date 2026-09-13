import { apiErrorFromPayload, ApiFailure } from "@/lib/api-errors";
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
