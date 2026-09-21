import { access, readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pgliteDatabase } from "./database.mjs";

const slices = {
  "R02-01": ["src/lib/pricing/service.ts", "src/lib/pricing/admin.ts", "src/app/api/v1/checkout/quote/route.ts"],
  "R02-02": ["src/lib/wallet/service.ts", "src/app/api/v1/account/rewards/route.ts"],
  "R02-03": ["src/lib/referrals/service.ts", "src/app/api/v1/account/referrals/route.ts"],
  "R02-04": ["src/lib/reviews/service.ts", "src/app/api/v1/account/reviews/route.ts"],
  "R02-05": ["db/migrations/0005_v02_payout_simulation.sql", "src/lib/verification/service.ts", "src/lib/payouts/provider.ts", "src/app/api/v1/account/payouts/route.ts", "src/app/api/v1/admin/finance/payouts/[id]/execute/route.ts"],
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

process.stdout.write("Local/test payout simulation is accepted as proof-of-concept evidence; preview/production remain fail-closed until APS beneficiary-disbursement capability is verified.\n");

const { client, raw } = await pgliteDatabase();
try {
  for (const file of (await readdir(resolve("db/migrations"))).filter((name) => name.endsWith(".sql")).sort()) {
    await client.executeRaw(await readFile(resolve("db/migrations", file), "utf8"));
  }
  const tables = await client.execute("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public'");
  if (tables.rows[0].count < 70) { process.stderr.write(`Schema evidence incomplete: ${tables.rows[0].count} tables\n`); failed = true; }
  else process.stdout.write(`Migrated v0.2 schema evidence: ${tables.rows[0].count} tables\n`);
  await client.executeRaw(await readFile(resolve("db/simmode-seed.sql"), "utf8"));
  const payoutSeed = await client.execute(
    `SELECT EXISTS(SELECT 1 FROM verification_application WHERE account_id=account.id AND status='APPROVED') AS verified,
            COALESCE((SELECT sum(available_fils) FROM wallet_lot WHERE account_id=account.id AND settled AND NOT disputed),0)::int AS available_fils
     FROM account WHERE email_normalized='customer@sim.gym-shop.local'`,
  );
  if (!payoutSeed.rows[0]?.verified || payoutSeed.rows[0].available_fils < 1) {
    process.stderr.write("Simulation customer is not ready to exercise the payout proof of concept.\n");
    failed = true;
  } else {
    process.stdout.write(`Simulation payout fixture ready: ${payoutSeed.rows[0].available_fils} fils available.\n`);
  }
} finally { await raw.close(); }

const test = spawnSync(process.execPath, [resolve("node_modules/vitest/vitest.mjs"), "run", "src/lib/v02.integration.test.ts", "src/lib/pricing/service.test.ts", "src/lib/wallet/service.test.ts", "src/lib/verification/service.test.ts", "src/lib/payouts/service.test.ts", "src/lib/notifications/subscriptions.test.ts", "src/lib/analytics/service.test.ts"], { stdio: "inherit" });
if (test.status !== 0) failed = true;
if (failed) process.exit(1);
process.stdout.write("v0.2 software and payout proof-of-concept acceptance passed; this does not authorize APS wallet withdrawal activation.\n");
