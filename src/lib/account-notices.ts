import { ApiFailure, readApiData } from "@/lib/api-errors";

export type NotificationItem = {
  id: string;
  category: string;
  entity_type: string | null;
  entity_id: string | null;
  event_type: string;
  read_at: string | null;
  created_at: string;
};
export type NotificationPage = {
  notifications: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};
export type NotificationPreference = {
  category: string;
  channel: "EMAIL" | "WHATSAPP";
  enabled: boolean;
  updated_at: string;
};
export type SimulatedMessage = {
  eventType: string;
  channel: string;
  destination: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}
function notification(value: unknown): value is NotificationItem {
  return (
    record(value) &&
    ["id", "category", "event_type"].every(
      (key) => typeof value[key] === "string" && value[key].length > 0,
    ) &&
    ["entity_type", "entity_id"].every(
      (key) => value[key] === null || typeof value[key] === "string",
    ) &&
    date(value.created_at) &&
    (value.read_at === null || date(value.read_at))
  );
}
async function request(
  path: string,
  init: RequestInit,
  transport: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await transport(path, init);
  const result = await readApiData<unknown>(response);
  if (!record(result))
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  return result;
}
const json = (method: "POST" | "PATCH", body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
export async function loadNotifications(
  before?: string,
  transport: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<NotificationPage> {
  const result = await request(
    `/api/v1/account/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`,
    { signal },
    transport,
  );
  if (
    !Array.isArray(result.notifications) ||
    !result.notifications.every(notification) ||
    typeof result.unreadCount !== "number" ||
    !Number.isSafeInteger(result.unreadCount) ||
    result.unreadCount < 0 ||
    !(result.nextCursor === null || date(result.nextCursor))
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return {
    notifications: result.notifications,
    unreadCount: result.unreadCount,
    nextCursor: result.nextCursor,
  };
}
export async function markNotifications(
  input: { all: true } | { id: string },
  transport: typeof fetch = fetch,
): Promise<void> {
  const result = await request(
    "/api/v1/account/notifications",
    json("POST", input),
    transport,
  );
  if (result.read !== true) throw new ApiFailure("INVALID_RESPONSE");
}
export async function loadNotificationPreferences(
  transport: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<NotificationPreference[]> {
  const result = await request(
    "/api/v1/account/notification-preferences",
    { signal },
    transport,
  );
  if (
    !Array.isArray(result.preferences) ||
    !result.preferences.every(
      (value): value is NotificationPreference =>
        record(value) &&
        typeof value.category === "string" &&
        /^marketing(?:[._-][a-z0-9_-]+)?$/.test(value.category) &&
        (value.channel === "EMAIL" || value.channel === "WHATSAPP") &&
        typeof value.enabled === "boolean" &&
        date(value.updated_at),
    )
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return result.preferences;
}
export async function updateMarketingPreference(
  channel: "EMAIL" | "WHATSAPP",
  enabled: boolean,
  transport: typeof fetch = fetch,
): Promise<void> {
  const result = await request(
    "/api/v1/account/notification-preferences",
    json("POST", { category: "marketing", channel, enabled }),
    transport,
  );
  if (result.updated !== true) throw new ApiFailure("INVALID_RESPONSE");
}
export async function updateReferralCode(
  requested: string,
  transport: typeof fetch = fetch,
): Promise<{ id: string; code: string }> {
  const code = requested.trim().toUpperCase();
  const result = await request(
    "/api/v1/account/referrals",
    json("PATCH", { code }),
    transport,
  );
  if (
    typeof result.id !== "string" ||
    !result.id ||
    result.code !== code ||
    !/^[A-Z0-9_-]{6,24}$/.test(code)
  )
    throw new ApiFailure("INVALID_RESPONSE");
  return { id: result.id, code };
}
export async function loadSimulationInbox(
  transport: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<SimulatedMessage[]> {
  const response = await transport("/api/v1/simulation/inbox", { signal });
  if (response.status === 404) return [];
  const result = await readApiData<unknown>(response);
  if (
    !record(result) ||
    !Array.isArray(result.messages) ||
    !result.messages.every(
      (value): value is SimulatedMessage =>
        record(value) &&
        ["eventType", "channel", "destination", "token"].every(
          (key) => typeof value[key] === "string",
        ) &&
        date(value.expiresAt) &&
        date(value.createdAt),
    )
  )
    throw new ApiFailure("INVALID_RESPONSE", response.status);
  return result.messages;
}
