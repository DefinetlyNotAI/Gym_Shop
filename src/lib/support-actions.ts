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
  if (!response.ok)
    throw new Error(
      payload?.error?.code
        ? `${payload.error.message ?? "Message could not be edited"} (${payload.error.code})`
        : `Message could not be edited (HTTP ${response.status}).`,
    );
  if (typeof payload?.data?.edited !== "boolean")
    throw new Error(
      "Unexpected API response. Refresh the conversation to check its status.",
    );
  return { edited: payload.data.edited };
}
