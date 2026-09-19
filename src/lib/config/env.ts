import { z } from "zod";

const optionalUrl = z.string().url().optional();

const runtimeSchema = z.object({
  APP_ENV: z.enum(["local", "test", "preview", "production"]).default("local"),
  SIM_MODE: z.enum(["0", "1"]).default("0").transform((value) => value === "1"),
  DATABASE_URL: optionalUrl,
  STOREFRONT_ORIGIN: z.string().url().default("http://localhost:3030"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:4000"),
  API_ORIGIN: z.string().url().default("http://localhost:5000"),
  CRON_SECRET: z.string().min(32).optional(),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
  CTO_OWNER_EMAIL: z.string().email().optional(),
  WEBAUTHN_RP_ID: z.string().min(1).default("localhost"),
  WEBAUTHN_RP_NAME: z.string().min(1).default("Gym Shop"),
  APS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  APS_ACCESS_CODE: z.string().min(1).max(20).optional(),
  APS_MERCHANT_IDENTIFIER: z.string().min(1).max(20).optional(),
  APS_SHA_REQUEST_PHRASE: z.string().min(16).optional(),
  APS_SHA_RESPONSE_PHRASE: z.string().min(16).optional(),
  NOTIFICATION_PROVIDER_API_URL: optionalUrl,
  NOTIFICATION_PROVIDER_API_TOKEN: z.string().min(32).optional(),
  NOTIFICATION_FROM_EMAIL: z.string().email().optional(),
  SECURITY_ALERT_EMAIL: z.string().email().optional(),
  OUTBOUND_SECRET_KEY: z.string().min(43).optional(),
  CAPTCHA_VERIFY_URL: optionalUrl,
  CAPTCHA_API_TOKEN: z.string().min(32).optional(),
  R2_ENDPOINT: optionalUrl,
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: optionalUrl,
  MEDIA_SCAN_SECRET: z.string().min(32).optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeSchema>;

let cachedConfig: RuntimeConfig | undefined;

function exactOrigin(name: string, value: string): URL {
  const url = new URL(value);
  if (url.origin !== value || url.username || url.password) throw new Error(`${name} must be an exact origin without credentials or a path`);
  return url;
}

function requireHttps(name: string, value: string | undefined, originOnly = false): void {
  if (!value) return;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS outside local development`);
  if (url.username || url.password || url.hash) throw new Error(`${name} cannot contain credentials or a fragment`);
  if (originOnly && url.origin !== value) throw new Error(`${name} must be an exact HTTPS origin`);
}

function rpIdMatches(origin: URL, rpId: string): boolean {
  return origin.hostname === rpId || origin.hostname.endsWith(`.${rpId}`);
}

export function parseRuntimeConfig(environment: Record<string, string | undefined>): RuntimeConfig {
  const config = runtimeSchema.parse(environment);
  const storefront = exactOrigin("STOREFRONT_ORIGIN", config.STOREFRONT_ORIGIN);
  const admin = exactOrigin("ADMIN_ORIGIN", config.ADMIN_ORIGIN);
  const api = exactOrigin("API_ORIGIN", config.API_ORIGIN);
  if (new Set([storefront.origin, admin.origin, api.origin]).size !== 3) throw new Error("Application origins must be distinct");
  if (!rpIdMatches(admin, config.WEBAUTHN_RP_ID)) throw new Error("WEBAUTHN_RP_ID must cover the admin host");
  if (config.SIM_MODE && !["local", "test"].includes(config.APP_ENV)) throw new Error("SIM_MODE is restricted to local and test environments");
  if(config.SIM_MODE&&[
    "DATABASE_URL","APS_ACCESS_CODE","APS_MERCHANT_IDENTIFIER","APS_SHA_REQUEST_PHRASE","APS_SHA_RESPONSE_PHRASE",
    "NOTIFICATION_PROVIDER_API_URL","NOTIFICATION_PROVIDER_API_TOKEN","CAPTCHA_VERIFY_URL","CAPTCHA_API_TOKEN",
    "R2_ENDPOINT","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET","MEDIA_SCAN_SECRET",
  ].some(key=>Boolean(environment[key])))throw new Error("SIM_MODE refuses external database and provider credentials");
  if (config.APP_ENV === "production" || config.APP_ENV === "preview") {
    const missing = [
      !environment.STOREFRONT_ORIGIN && "STOREFRONT_ORIGIN",
      !environment.ADMIN_ORIGIN && "ADMIN_ORIGIN",
      !environment.API_ORIGIN && "API_ORIGIN",
      !config.DATABASE_URL && "DATABASE_URL",
      !config.CRON_SECRET && "CRON_SECRET",
      !config.APS_ACCESS_CODE && "APS_ACCESS_CODE",
      !config.APS_MERCHANT_IDENTIFIER && "APS_MERCHANT_IDENTIFIER",
      !config.APS_SHA_REQUEST_PHRASE && "APS_SHA_REQUEST_PHRASE",
      !config.APS_SHA_RESPONSE_PHRASE && "APS_SHA_RESPONSE_PHRASE",
      !config.NOTIFICATION_PROVIDER_API_URL && "NOTIFICATION_PROVIDER_API_URL",
      !config.NOTIFICATION_PROVIDER_API_TOKEN && "NOTIFICATION_PROVIDER_API_TOKEN",
      !config.NOTIFICATION_FROM_EMAIL && "NOTIFICATION_FROM_EMAIL",
      !config.SECURITY_ALERT_EMAIL && "SECURITY_ALERT_EMAIL",
      !config.OUTBOUND_SECRET_KEY && "OUTBOUND_SECRET_KEY",
      !config.CAPTCHA_VERIFY_URL && "CAPTCHA_VERIFY_URL",
      !config.CAPTCHA_API_TOKEN && "CAPTCHA_API_TOKEN",
      !config.R2_ENDPOINT && "R2_ENDPOINT",
      !config.R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
      !config.R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
      !config.R2_BUCKET && "R2_BUCKET",
      !config.MEDIA_SCAN_SECRET && "MEDIA_SCAN_SECRET",
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Missing required ${config.APP_ENV} configuration: ${missing.join(", ")}`);
    }
    if ([storefront, admin, api].some((origin) => origin.hostname.includes("localhost") || origin.protocol !== "https:")) throw new Error(`${config.APP_ENV} origins must use non-local HTTPS hosts`);
    if (new Set([storefront.hostname, admin.hostname, api.hostname]).size !== 3) throw new Error(`${config.APP_ENV} applications require separate hostnames`);
    requireHttps("NOTIFICATION_PROVIDER_API_URL", config.NOTIFICATION_PROVIDER_API_URL, true);
    requireHttps("CAPTCHA_VERIFY_URL", config.CAPTCHA_VERIFY_URL);
    requireHttps("R2_ENDPOINT", config.R2_ENDPOINT, true);
    requireHttps("R2_PUBLIC_BASE_URL", config.R2_PUBLIC_BASE_URL, true);
    const databaseUrl = new URL(config.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol) || databaseUrl.searchParams.get("sslmode") !== "require") throw new Error("DATABASE_URL must be PostgreSQL with sslmode=require");
    if (!config.OUTBOUND_SECRET_KEY || !/^[A-Za-z0-9_-]{43}$/.test(config.OUTBOUND_SECRET_KEY) || Buffer.from(config.OUTBOUND_SECRET_KEY, "base64url").length !== 32) throw new Error("OUTBOUND_SECRET_KEY must be an unpadded base64url encoding of exactly 32 random bytes");
    if (config.APP_ENV === "production" && config.APS_ENVIRONMENT !== "production") throw new Error("Production requires APS_ENVIRONMENT=production");
  }
  return config;
}

export function getRuntimeConfig(): RuntimeConfig {
  cachedConfig ??= parseRuntimeConfig(process.env);
  return cachedConfig;
}

export function requireDatabaseUrl(config = getRuntimeConfig()): string {
  if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required for database operations");
  return config.DATABASE_URL;
}
