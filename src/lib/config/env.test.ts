import { describe, expect, it } from "vitest";
import { parseRuntimeConfig, requireDatabaseUrl } from "./env";

function productionEnvironment(): Record<string, string> {
  return {
    APP_ENV: "production",
    STOREFRONT_ORIGIN: "https://shop.example.com",
    ADMIN_ORIGIN: "https://admin.example.com",
    API_ORIGIN: "https://api.example.com",
    DATABASE_URL: "postgresql://app:secret@database.example.com/shop?sslmode=require",
    CRON_SECRET: "c".repeat(32),
    APS_ENVIRONMENT: "production",
    APS_ACCESS_CODE: "access-code",
    APS_MERCHANT_IDENTIFIER: "merchant",
    APS_SHA_REQUEST_PHRASE: "r".repeat(32),
    APS_SHA_RESPONSE_PHRASE: "s".repeat(32),
    NOTIFICATION_PROVIDER_API_URL: "https://messages.example.net",
    NOTIFICATION_PROVIDER_API_TOKEN: "n".repeat(32),
    NOTIFICATION_FROM_EMAIL: "orders@example.com",
    SECURITY_ALERT_EMAIL: "security@example.com",
    OUTBOUND_SECRET_KEY: "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc",
    CAPTCHA_VERIFY_URL: "https://captcha.example.net/v1/verify",
    CAPTCHA_API_TOKEN: "a".repeat(32),
    R2_ENDPOINT: "https://account.r2.cloudflarestorage.com",
    R2_ACCESS_KEY_ID: "access",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "gym-shop",
    R2_PUBLIC_BASE_URL: "https://media.example.com",
    MEDIA_SCAN_SECRET: "m".repeat(32),
    WEBAUTHN_RP_ID: "example.com",
  };
}

describe("runtime configuration", () => {
  it("uses safe local defaults without pretending a database is configured", () => {
    const config = parseRuntimeConfig({});
    expect(config.APP_ENV).toBe("local");
    expect(config.DATABASE_URL).toBeUndefined();
    expect(() => requireDatabaseUrl(config)).toThrow("DATABASE_URL");
  });

  it("fails closed when production activation secrets are absent", () => {
    expect(() => parseRuntimeConfig({ APP_ENV: "production" })).toThrow("DATABASE_URL");
  });

  it("requires the complete commerce provider set outside local development", () => {
    expect(() =>
      parseRuntimeConfig({
        APP_ENV: "preview",
        STOREFRONT_ORIGIN:"https://preview.example.com",
        ADMIN_ORIGIN:"https://admin.preview.example.com",
        API_ORIGIN:"https://api.preview.example.com",
        WEBAUTHN_RP_ID: "preview.example.com",
        DATABASE_URL: "postgresql://example.com/shop",
        CRON_SECRET: "x".repeat(32),
      }),
    ).toThrow("APS_ACCESS_CODE");
  });

  it("rejects an oversized worker batch", () => {
    expect(() => parseRuntimeConfig({ OUTBOX_BATCH_SIZE: "101" })).toThrow();
  });

  it("keeps simulation isolated from inherited provider credentials", () => {
    expect(() => parseRuntimeConfig({ SIM_MODE:"1",APS_ACCESS_CODE:"real-account-value" })).toThrow("refuses external");
  });

  it("requires exact and distinct application origins with an admin-scoped WebAuthn RP ID", () => {
    expect(() => parseRuntimeConfig({ STOREFRONT_ORIGIN: "http://localhost:3000/path" })).toThrow("exact origin");
    expect(() => parseRuntimeConfig({ ADMIN_ORIGIN: "http://localhost:3000" })).toThrow("distinct");
    expect(() => parseRuntimeConfig({ WEBAUTHN_RP_ID: "unrelated.test" })).toThrow("admin host");
  });

  it("requires encrypted production communications", () => {
    expect(() => parseRuntimeConfig({ ...productionEnvironment(), STOREFRONT_ORIGIN: "http://shop.example.com" })).toThrow("HTTPS");
    expect(() => parseRuntimeConfig({ ...productionEnvironment(), DATABASE_URL: "postgresql://app:secret@database.example.com/shop" })).toThrow("sslmode=require");
    expect(() => parseRuntimeConfig({ ...productionEnvironment(), OUTBOUND_SECRET_KEY: "!".repeat(43) })).toThrow("base64url");
  });
});
