import { access, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pgliteDatabase } from "./database.mjs";

const slices = {
  "R02-01": ["src/lib/pricing/service.ts", "src/lib/pricing/admin.ts", "src/app/api/v1/checkout/quote/route.ts"],
  "R02-02": ["src/lib/wallet/service.ts", "src/app/api/v1/account/rewards/route.ts"],
  "R02-03": ["src/lib/referrals/service.ts", "src/app/api/v1/account/referrals/route.ts"],
  "R02-04": ["src/lib/reviews/service.ts", "src/app/api/v1/account/reviews/route.ts"],
  "R02-05": ["src/lib/verification/service.ts", "src/lib/payouts/provider.ts", "src/app/api/v1/account/payouts/route.ts"],
  "R02-06": ["src/lib/notifications/subscriptions.ts", "src/lib/notifications/campaigns.ts", "src/app/api/v1/subscriptions/newsletter/route.ts"],
  "R02-07": ["src/lib/analytics/service.ts", "src/app/api/v1/admin/analytics/route.ts", "src/app/api/v1/admin/analytics/export/route.ts"],
  "R02-08": ["src/lib/v02.integration.test.ts", "scripts/verify-v02.mjs", "src/lib/platform/release-readiness.ts"],
};

let failed = false;
for (const [slice, files] of Object.entries(slices)) {
  const missing = [];
  for (const file of files) try { await access(resolve(file)); } catch { missing.push(file); }
  process.stdout.write(`${slice}: ${missing.length ? `MISSING ${missing.join(", ")}` : "software evidence present"}\n`);
  failed ||= missing.length > 0;
}

const providerSource = await readFile(resolve("src/lib/payouts/provider.ts"), "utf8");
if (!providerSource.includes("PAYOUT_PROVIDER_UNAVAILABLE") || !providerSource.includes("available: false")) {
  process.stderr.write("R02-05: CliQ provider gate is not explicitly unavailable\n");
  failed = true;
} else process.stdout.write("External activation: BUSINESS_CLIQ_PROVIDER_UNAVAILABLE (expected blocker; not mocked)\n");

const { client, raw } = await pgliteDatabase();
try {
  for (const file of (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort()) {
    await client.executeRaw(await readFile(resolve("db/migrations", file), "utf8"));
  }
  const tables = await client.execute("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  if (tables.rows[0].count < 70) { process.stderr.write(`Schema evidence incomplete: ${tables.rows[0].count} tables\n`); failed = true; }
  else process.stdout.write(`Migrated v0.2 schema evidence: ${tables.rows[0].count} tables\n`);
} finally { await raw.close(); }

const test = spawnSync(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", "src/lib/v02.integration.test.ts", "src/lib/pricing/service.test.ts", "src/lib/wallet/service.test.ts", "src/lib/verification/service.test.ts", "src/lib/payouts/service.test.ts", "src/lib/notifications/subscriptions.test.ts", "src/lib/analytics/service.test.ts"], { stdio: "inherit" });
if (test.status !== 0) failed = true;
if (failed) process.exit(1);
process.stdout.write("v0.2 software acceptance passed; activation remains blocked only by the real business CliQ provider dependency.\n");
