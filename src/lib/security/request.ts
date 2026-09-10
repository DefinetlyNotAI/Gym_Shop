import { getRuntimeConfig } from "@/lib/config/env";

export function requireTrustedMutation(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("ORIGIN_REQUIRED");
  const config = getRuntimeConfig();
  const allowed = new Set([config.STOREFRONT_ORIGIN, config.ADMIN_ORIGIN, config.API_ORIGIN]);
  if (!allowed.has(origin)) throw new Error("ORIGIN_REJECTED");
}
