import { apiErrorFromPayload, ApiFailure } from "@/lib/api-errors";
type ReportInput = {
  reason: "SPAM" | "OFFENSIVE" | "PERSONAL_INFO" | "IRRELEVANT" | "OTHER";
  details?: string;
};
type Action =
  | { kind: "logout" }
  | { kind: "cancel"; id: string }
  | { kind: "helpful"; id: string }
  | { kind: "report"; id: string; input: ReportInput };

export async function customerAction(
  action: Action,
  transport: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const url =
    action.kind === "logout"
      ? "/api/v1/auth/logout"
      : action.kind === "cancel"
        ? `/api/v1/orders/${encodeURIComponent(action.id)}/cancel`
        : `/api/v1/reviews/${encodeURIComponent(action.id)}/${action.kind}`;
  const response = await transport(url, {
    method: "POST",
    ...(action.kind === "report"
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action.input),
        }
      : {}),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(payload, response.status);
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !payload.data ||
    typeof payload.data !== "object" ||
    Array.isArray(payload.data)
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return payload.data as Record<string, unknown>;
}

export function reviewReportFromForm(form: FormData): ReportInput {
  const reason = String(form.get("reason") ?? "");
  if (
    !["SPAM", "OFFENSIVE", "PERSONAL_INFO", "IRRELEVANT", "OTHER"].includes(
      reason,
    )
  )
    throw new Error("Select a report reason");
  const details = String(form.get("details") ?? "").trim();
  if (details.length > 1000)
    throw new Error("Details must be 1000 characters or fewer");
  return {
    reason: reason as ReportInput["reason"],
    ...(details ? { details } : {}),
  };
}
