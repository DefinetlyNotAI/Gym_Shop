import type { DatabaseClient } from "@/lib/db/client";
import { getRuntimeConfig } from "@/lib/config/env";
import { getPayoutProviderStatus } from "@/lib/payouts/provider";

export async function launchBlockers(client: DatabaseClient): Promise<string[]> {
  const config = getRuntimeConfig();
  const blockers: string[] = [];
  const state = await client.execute<{ cto_initialized_at: Date | null; normal_operations_locked: boolean }>("SELECT cto_initialized_at,normal_operations_locked FROM platform_state WHERE singleton=true");
  if (!state.rows[0]?.cto_initialized_at) blockers.push("CTO_SETUP_INCOMPLETE");
  if (state.rows[0]?.normal_operations_locked) blockers.push("NORMAL_OPERATIONS_LOCKED");
  const settings = await client.execute<{ key: string; value: unknown }>("SELECT key,value FROM app_setting WHERE key IN ('checkout.tax_policy','delivery.cod_redelivery_policy_reviewed')");
  const values = new Map(settings.rows.map((item) => [item.key, item.value]));
  if (values.get("checkout.tax_policy") !== "NONE_REVIEWED") blockers.push("TAX_POLICY_UNREVIEWED");
  if (values.get("delivery.cod_redelivery_policy_reviewed") !== true) blockers.push("COD_REDELIVERY_POLICY_UNREVIEWED");
  const terms = await client.execute<{ language: string }>("SELECT DISTINCT language FROM terms_document WHERE kind='TERMS' AND published_at IS NOT NULL");
  if (!terms.rows.some((item) => item.language === "en") || !terms.rows.some((item) => item.language === "ar")) blockers.push("BILINGUAL_TERMS_MISSING");
  const fulfillment = await client.execute<{ ready: boolean }>("SELECT EXISTS(SELECT 1 FROM delivery_zone AS zone JOIN delivery_window AS delivery_slot ON delivery_slot.zone_id=zone.id WHERE zone.active AND zone.policy_reviewed AND delivery_slot.active) OR EXISTS(SELECT 1 FROM pickup_location WHERE active) AS ready");
  if (!fulfillment.rows[0]?.ready) blockers.push("FULFILLMENT_UNCONFIGURED");
  if (config.APP_ENV === "preview" || config.APP_ENV === "production") {
    const drill = await client.execute("SELECT 1 FROM release_evidence WHERE release_version='v0.1' AND evidence_type='CTO_RECOVERY_DRILL' AND result='PASSED' ORDER BY occurred_at DESC LIMIT 1");
    if (!drill.rowCount) blockers.push("CTO_RECOVERY_DRILL_NOT_PASSED");
  }
  return blockers;
}

const V02_TABLES = ["campaign", "wallet_lot", "referral_reward", "product_review", "verification_application", "wallet_payout", "marketing_subscription", "notification_campaign"];

export async function v02ReleaseReadiness(client: DatabaseClient) {
  const tables = await client.execute<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
    [V02_TABLES],
  );
  const found = new Set(tables.rows.map((entry) => entry.table_name));
  const missingSoftwareEvidence = V02_TABLES.filter((table) => !found.has(table));
  const provider = await client.execute<{ value: unknown }>("SELECT value FROM app_setting WHERE key='payout.provider'");
  const payoutProvider = getPayoutProviderStatus();
  const payoutSimulationAvailable = payoutProvider.available && payoutProvider.mode === "SIMULATION";
  const payoutProviderAvailable = payoutProvider.available && payoutProvider.mode !== "SIMULATION" && provider.rows[0]?.value === "ACTIVE";
  const softwareReady = missingSoftwareEvidence.length === 0;
  return {
    softwareReady,
    missingSoftwareEvidence,
    payoutSimulationAvailable,
    proofOfConceptReady: softwareReady && (payoutSimulationAvailable || payoutProviderAvailable),
    payoutProviderAvailable,
    activationReady: softwareReady && payoutProviderAvailable,
    blockers: payoutProviderAvailable
      ? []
      : [payoutSimulationAvailable ? "PAYOUT_PROVIDER_SIMULATION_ONLY" : payoutProvider.code],
  };
}
