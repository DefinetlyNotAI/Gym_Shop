import { ApiFailure, readApiData } from "@/lib/api-errors";

export type SupportTicket = {
  public_id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
};

export type SupportMessage = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_name: string;
  editable: boolean;
  revision_count: number;
};

export type CustomerClaim = {
  id: string;
  status: string;
  order_line_id: string;
  quantity: number;
  description: string;
  customer_safe_reason: string | null;
  sku: string;
  name_snapshot: unknown;
  replacement_order_public_id: string | null;
};

export type SupportConversation = {
  public_id: string;
  status: string;
  subject: string;
  messages: SupportMessage[];
  claim: CustomerClaim | null;
};

export async function loadSupportTickets(
  transport: typeof fetch = fetch,
): Promise<SupportTicket[]> {
  const data = await readApiData<unknown>(
    await transport("/api/v1/support/tickets"),
  );
  if (
    !data ||
    typeof data !== "object" ||
    !("tickets" in data) ||
    !Array.isArray(data.tickets)
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return data.tickets as SupportTicket[];
}

export async function loadSupportConversation(
  publicId: string,
  transport: typeof fetch = fetch,
): Promise<SupportConversation> {
  const data = await readApiData<unknown>(
    await transport(`/api/v1/support/tickets/${encodeURIComponent(publicId)}`),
  );
  if (
    !data ||
    typeof data !== "object" ||
    !("public_id" in data) ||
    typeof data.public_id !== "string" ||
    !("status" in data) ||
    typeof data.status !== "string" ||
    !("subject" in data) ||
    typeof data.subject !== "string" ||
    !("messages" in data) ||
    !Array.isArray(data.messages) ||
    !("claim" in data) ||
    (data.claim !== null && typeof data.claim !== "object")
  ) {
    throw new ApiFailure("INVALID_RESPONSE");
  }
  return data as SupportConversation;
}
