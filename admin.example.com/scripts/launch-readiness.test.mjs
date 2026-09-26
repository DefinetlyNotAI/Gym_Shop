import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { readinessBlockerCopy } = await loadProduction(
  new URL("../src/lib/launch-readiness.ts", import.meta.url),
);

test("every known launch blocker has concise bilingual recovery copy", () => {
  for (const code of [
    "CTO_SETUP_INCOMPLETE",
    "NORMAL_OPERATIONS_LOCKED",
    "TAX_POLICY_UNREVIEWED",
    "COD_REDELIVERY_POLICY_UNREVIEWED",
    "BILINGUAL_TERMS_MISSING",
    "FULFILLMENT_UNCONFIGURED",
    "CTO_RECOVERY_DRILL_NOT_PASSED",
    "PAYOUT_PROVIDER_SIMULATION_ONLY",
  ]) {
    const item = readinessBlockerCopy(code);
    assert.ok(item.title.en.length > 4);
    assert.ok(item.title.ar.length > 4);
    assert.ok(item.description.en.length > 12);
    assert.ok(item.description.ar.length > 12);
    assert.equal(item.title.en.includes(code), false);
  }
});

test("simulation-only payout readiness explains the production boundary", () => {
  const item = readinessBlockerCopy("PAYOUT_PROVIDER_SIMULATION_ONLY");
  assert.match(item.title.en, /simulation/i);
  assert.match(item.description.en, /production|APS/i);
  assert.doesNotMatch(item.description.en, /PAYOUT_PROVIDER_SIMULATION_ONLY/);
});

test("unknown launch blockers remain safe and non-technical", () => {
  const item = readinessBlockerCopy("SQL_PASSWORD_secret");
  assert.doesNotMatch(JSON.stringify(item), /password|secret|sql/i);
});
