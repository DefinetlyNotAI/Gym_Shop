import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const {
  updateLaunchSetting,
  publishBilingualTerms,
  recordRecoveryDrill,
} = await loadProduction(
  new URL("../src/lib/launch-settings-actions.ts", import.meta.url),
);

test("launch settings send an explicit audited reason", async () => {
  let call;
  await updateLaunchSetting(
    "checkout.tax_policy",
    "NONE_REVIEWED",
    "Owner reviewed launch tax treatment",
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { updated: true } });
    },
  );
  assert.equal(call.url, "/api/v1/admin/settings");
  assert.deepEqual(JSON.parse(call.body), {
    key: "checkout.tax_policy",
    value: "NONE_REVIEWED",
    reason: "Owner reviewed launch tax treatment",
  });
});

test("bilingual terms require substantive reviewed content", async () => {
  let call;
  const result = await publishBilingualTerms(
    {
      version: "2026-09-20",
      titleEn: "Terms of sale",
      bodyEn: "Reviewed English terms of sale.",
      titleAr: "شروط البيع",
      bodyAr: "شروط البيع العربية المعتمدة.",
    },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: [{ id: "terms-en" }, { id: "terms-ar" }] });
    },
  );
  assert.equal(result.published, 2);
  assert.equal(call.url, "/api/v1/admin/terms");
  assert.equal(JSON.parse(call.body).publish, true);
});

test("recovery evidence validates notes and confirms its immutable id", async () => {
  let call;
  const result = await recordRecoveryDrill(
    { result: "PASSED", notes: "Two independent keys recovered access successfully." },
    async (url, init) => {
      call = { url, ...init };
      return Response.json({ data: { evidenceId: "evidence-1", result: "PASSED" } });
    },
  );
  assert.equal(result.evidenceId, "evidence-1");
  assert.equal(call.url, "/api/v1/admin/readiness");
});

test("invalid launch inputs and malformed successes are rejected", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    return Response.json({ data: {} });
  };
  await assert.rejects(
    publishBilingualTerms(
      { version: "", titleEn: "T", bodyEn: "short", titleAr: "ش", bodyAr: "قصير" },
      transport,
    ),
    (error) => error.code === "TERMS_CREATE_INVALID",
  );
  await assert.rejects(
    recordRecoveryDrill({ result: "PASSED", notes: "short" }, transport),
    (error) => error.code === "EVIDENCE_INVALID",
  );
  assert.equal(calls, 0);
  await assert.rejects(
    updateLaunchSetting(
      "platform.store_enabled",
      true,
      "Readiness review complete",
      transport,
    ),
    (error) => error.code === "INVALID_RESPONSE",
  );
});
