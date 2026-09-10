import { NextRequest, NextResponse } from "next/server";

function optionalHttpsOrigin(name: "R2_ENDPOINT" | "R2_PUBLIC_BASE_URL"): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const url = new URL(value);
  if (url.origin !== value || url.protocol !== "https:" || url.username || url.password) throw new Error(`${name} must be an exact HTTPS origin`);
  return value;
}

function contentSecurityPolicy(nonce: string): string {
  const development = process.env.NODE_ENV === "development";
  const uploadOrigin = optionalHttpsOrigin("R2_ENDPOINT");
  const mediaOrigin = optionalHttpsOrigin("R2_PUBLIC_BASE_URL");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `style-src-attr ${development ? "'unsafe-inline'" : "'none'"}`,
    `connect-src 'self'${development ? " ws:" : ""}${uploadOrigin ? ` ${uploadOrigin}` : ""}`,
    `img-src 'self' data: blob:${uploadOrigin ? ` ${uploadOrigin}` : ""}${mediaOrigin ? ` ${mediaOrigin}` : ""}`,
    "font-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self' https://sbcheckout.payfort.com https://checkout.payfort.com",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [{
    source: "/((?!api|media|\.well-known|_next/static|_next/image|favicon.ico).*)",
    missing: [
      { type: "header", key: "next-router-prefetch" },
      { type: "header", key: "purpose", value: "prefetch" },
    ],
  }],
};
