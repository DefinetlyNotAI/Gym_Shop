import { getRuntimeConfig } from "@/lib/config/env";

export type OutboundMessage = {
  idempotencyKey: string;
  channel: "EMAIL" | "WHATSAPP";
  to: string;
  subject?: string;
  body: string;
  category: string;
};

export type ProviderDeliveryResult = {
  messageId: string;
  status: "SENT" | "DELIVERED";
};

export class PermanentNotificationError extends Error {}

export async function sendOutboundMessage(message: OutboundMessage): Promise<ProviderDeliveryResult> {
  const config = getRuntimeConfig();
  if (!config.NOTIFICATION_PROVIDER_API_URL || !config.NOTIFICATION_PROVIDER_API_TOKEN) {
    if (config.APP_ENV === "local" || config.APP_ENV === "test") {
      return { messageId: `local-${message.idempotencyKey}`, status: "DELIVERED" };
    }
    throw new Error("NOTIFICATION_PROVIDER_UNCONFIGURED");
  }
  const response = await fetch(new URL("/v1/messages", config.NOTIFICATION_PROVIDER_API_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.NOTIFICATION_PROVIDER_API_TOKEN}`,
      "content-type": "application/json",
      "idempotency-key": message.idempotencyKey,
    },
    body: JSON.stringify({ ...message, fromEmail: config.NOTIFICATION_FROM_EMAIL }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status >= 400 && response.status < 500 && response.status !== 429) {
    throw new PermanentNotificationError(`PROVIDER_REJECTED_${response.status}`);
  }
  if (!response.ok) throw new Error(`PROVIDER_UNAVAILABLE_${response.status}`);
  const body = (await response.json()) as { messageId?: unknown; status?: unknown };
  if (typeof body.messageId !== "string" || !["SENT", "DELIVERED"].includes(String(body.status))) {
    throw new Error("PROVIDER_RESPONSE_INVALID");
  }
  return { messageId: body.messageId, status: body.status as ProviderDeliveryResult["status"] };
}
