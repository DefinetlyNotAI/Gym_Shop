import type { NextConfig } from "next";

function configuredApiOrigin(): string {
  const value = process.env.API_ORIGIN ?? "https://api.example.com";
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password) throw new Error("API_ORIGIN must be an exact origin without credentials or a path");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production API_ORIGIN must use HTTPS");
  return value;
}

const apiOrigin = configuredApiOrigin();
const securityHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), picture-in-picture=(), publickey-credentials-create=(self), publickey-credentials-get=(self), screen-wake-lock=(), serial=(), usb=()" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  allowedDevOrigins: process.env.NODE_ENV === "development" ? ["100.82.154.71"] : [],
  async headers() { return [{ source: "/:path*", headers: [...securityHeaders] }]; },
  async rewrites() { return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }, { source: "/media/:path*", destination: `${apiOrigin}/media/:path*` }]; },
};

export default nextConfig;
