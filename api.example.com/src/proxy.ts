import { NextRequest, NextResponse } from "next/server";
import { getPlatformGateState } from "@/lib/platform/state";

const setup = ["/api/v1/setup", "/api/v1/readiness", "/api/v1/platform", "/api/v1/health", "/api/v1/simulation"];
const recovery = ["/api/v1/recovery"];
const lockdown = ["/api/v1/jobs", "/api/v1/payments/webhook", "/api/v1/payments/return"];
const commerce = ["/api/v1/cart", "/api/v1/checkout", "/api/v1/orders", "/api/v1/deliveries", "/api/v1/payments/simulate", "/media"];
const providerBrowserCallbacks = new Set(["/api/v1/payments/return"]);
const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const maximumBrowserBodyBytes = 256 * 1024;

function starts(path: string, prefixes: string[]) {
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function unavailable(reason: string) {
  return NextResponse.json(
    { error: { code: "PLATFORM_MAINTENANCE", message: "Service is temporarily unavailable.", reason } },
    { status: 503, headers: { "cache-control": "private, no-store", "retry-after": "60" } },
  );
}

function reject(status: number, code: string) {
  return NextResponse.json(
    { error: { code, message: "Request rejected." } },
    { status, headers: { "cache-control": "private, no-store" } },
  );
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" && !providerBrowserCallbacks.has(path)) return reject(403, "CROSS_SITE_REQUEST_REJECTED");
  if (unsafeMethods.has(request.method)) {
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maximumBrowserBodyBytes) return reject(413, "REQUEST_TOO_LARGE");
  }
  if (starts(path, setup)) return NextResponse.next();
  const gate = await getPlatformGateState();
  if (!gate.available) return unavailable("unavailable");
  if (!gate.initialized) return unavailable("not_initialized");
  if (gate.locked && !starts(path, [...recovery, ...lockdown])) return unavailable("lockdown");
  if (!gate.storeEnabled && starts(path, commerce)) return unavailable("disabled");
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*", "/media/:path*"] };
