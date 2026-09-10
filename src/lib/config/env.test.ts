import { describe, expect, it } from "vitest";
import { parseRuntimeConfig, requireDatabaseUrl } from "./env";

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
});
