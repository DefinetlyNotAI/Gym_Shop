import { getRuntimeConfig, type RuntimeConfig } from "@/lib/config/env";

const ADMIN_PREFIXES = [
  "/api/v1/admin/",
  "/api/v1/deliveries",
  "/api/v1/recovery/",
  "/api/v1/setup/",
  "/api/v1/staff-enrollment/",
];
const STOREFRONT_PREFIXES = [
  "/api/v1/account",
  "/api/v1/cart",
  "/api/v1/checkout",
  "/api/v1/catalog/products/",
  "/api/v1/catalog/variants/",
  "/api/v1/orders",
  "/api/v1/reviews",
  "/api/v1/support",
  "/api/v1/subscriptions/",
];
const SHARED_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/media",
  "/api/v1/media/simulated-upload",
  "/api/v1/simulation/session",
]);
const STOREFRONT_PATHS = new Set([
  "/api/v1/auth/password-reset",
  "/api/v1/auth/register",
  "/api/v1/auth/verify-email",
  "/api/v1/payments/simulate",
]);
const ADMIN_PATHS = new Set(["/api/v1/auth/mfa", "/api/v1/catalog/products"]);

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix);
}

export function trustedMutationOrigins(pathname: string, config: RuntimeConfig): readonly string[] {
  if (SHARED_PATHS.has(pathname)) return [config.STOREFRONT_ORIGIN, config.ADMIN_ORIGIN];
  if (ADMIN_PATHS.has(pathname) || ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return [config.ADMIN_ORIGIN];
  if (STOREFRONT_PATHS.has(pathname) || STOREFRONT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return [config.STOREFRONT_ORIGIN];
  throw new Error("ORIGIN_POLICY_MISSING");
}

export type BrowserSurface = "STOREFRONT" | "ADMIN";

export function requireTrustedMutation(request: Request): BrowserSurface {
  const origin = request.headers.get("origin");
  if (!origin) throw new Error("ORIGIN_REQUIRED");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) throw new Error("FETCH_SITE_REJECTED");
  const config = getRuntimeConfig();
  const allowed = trustedMutationOrigins(new URL(request.url).pathname, config);
  if (!allowed.includes(origin)) throw new Error("ORIGIN_REJECTED");
  return origin === config.ADMIN_ORIGIN ? "ADMIN" : "STOREFRONT";
}
