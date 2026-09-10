import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RuntimeConfig } from "@/lib/config/env";
import { requireTrustedMutation, trustedMutationOrigins } from "./request";

const config = {
  STOREFRONT_ORIGIN: "https://shop.example.test",
  ADMIN_ORIGIN: "https://admin.example.test",
} as RuntimeConfig;

async function routeFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? routeFiles(resolve(directory, entry.name))
    : Promise.resolve(entry.name === "route.ts" ? [resolve(directory, entry.name)] : [])))).flat();
}

describe("browser request boundaries", () => {
  it("separates customer and staff mutation origins", () => {
    expect(trustedMutationOrigins("/api/v1/cart", config)).toEqual([config.STOREFRONT_ORIGIN]);
    expect(trustedMutationOrigins("/api/v1/admin/orders/abc/pack", config)).toEqual([config.ADMIN_ORIGIN]);
    expect(trustedMutationOrigins("/api/v1/recovery/start", config)).toEqual([config.ADMIN_ORIGIN]);
    expect(trustedMutationOrigins("/api/v1/auth/mfa", config)).toEqual([config.ADMIN_ORIGIN]);
  });

  it("shares only explicitly dual-surface operations", () => {
    expect(trustedMutationOrigins("/api/v1/auth/login", config)).toEqual([config.STOREFRONT_ORIGIN, config.ADMIN_ORIGIN]);
    expect(trustedMutationOrigins("/api/v1/media", config)).toEqual([config.STOREFRONT_ORIGIN, config.ADMIN_ORIGIN]);
  });

  it("fails closed for a mutation route without a policy", () => {
    expect(() => trustedMutationOrigins("/api/v1/future-dangerous-action", config)).toThrow("ORIGIN_POLICY_MISSING");
  });

  it("rejects missing, cross-site, and wrong-surface origins", () => {
    expect(() => requireTrustedMutation(new Request("http://localhost:3001/api/v1/cart", { method: "PUT" }))).toThrow("ORIGIN_REQUIRED");
    expect(() => requireTrustedMutation(new Request("http://localhost:3001/api/v1/cart", { method: "PUT", headers: { origin: "https://evil.test", "sec-fetch-site": "cross-site" } }))).toThrow("FETCH_SITE_REJECTED");
    expect(() => requireTrustedMutation(new Request("http://localhost:3001/api/v1/cart", { method: "PUT", headers: { origin: "http://localhost:3002", "sec-fetch-site": "same-site" } }))).toThrow("ORIGIN_REJECTED");
  });

  it("protects every browser mutation and classifies every origin-checked route", async () => {
    const root = resolve("src/app/api");
    const machineAuthenticated = new Set([
      "/api/v1/media/scan-result",
      "/api/v1/payments/return",
      "/api/v1/payments/webhook",
    ]);
    for (const file of await routeFiles(root)) {
      const source = await readFile(file, "utf8");
      if (!/export async function (POST|PUT|PATCH|DELETE)/.test(source)) continue;
      const pathname = `/api/${relative(root, file).replaceAll("\\", "/").replace(/\/route\.ts$/, "").replace(/\[[^/]+\]/g, "sample")}`;
      if (source.includes("requireTrustedMutation")) expect(() => trustedMutationOrigins(pathname, config), pathname).not.toThrow();
      else expect(machineAuthenticated.has(pathname), `${pathname} has no browser-origin or machine authentication policy`).toBe(true);
    }
  });
});
