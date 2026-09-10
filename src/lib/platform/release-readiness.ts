import type { PoolClient } from "@neondatabase/serverless";
import { getRuntimeConfig } from "@/lib/config/env";

export async function launchBlockers(client: PoolClient): Promise<string[]> {
  const config = getRuntimeConfig();
  const blockers: string[] = [];
  const state = await client.query<{ cto_initialized_at: Date | null; normal_operations_locked: boolean }>("SELECT cto_initialized_at,normal_operations_locked FROM platform_state WHERE singleton=true");
  if (!state.rows[0]?.cto_initialized_at) blockers.push("CTO_SETUP_INCOMPLETE");
  if (state.rows[0]?.normal_operations_locked) blockers.push("NORMAL_OPERATIONS_LOCKED");
  const settings = await client.query<{ key: string; value: unknown }>("SELECT key,value FROM app_setting WHERE key IN ('checkout.tax_policy','delivery.cod_redelivery_policy_reviewed')");
  const values = new Map(settings.rows.map((item) => [item.key, item.value]));
  if (values.get("checkout.tax_policy") !== "NONE_REVIEWED") blockers.push("TAX_POLICY_UNREVIEWED");
  if (values.get("delivery.cod_redelivery_policy_reviewed") !== true) blockers.push("COD_REDELIVERY_POLICY_UNREVIEWED");
  const terms = await client.query<{ language: string }>("SELECT DISTINCT language FROM terms_document WHERE kind='TERMS' AND published_at IS NOT NULL");
  if (!terms.rows.some((item) => item.language === "en") || !terms.rows.some((item) => item.language === "ar")) blockers.push("BILINGUAL_TERMS_MISSING");
  const fulfillment = await client.query<{ ready: boolean }>("SELECT EXISTS(SELECT 1 FROM delivery_zone AS zone JOIN delivery_window AS delivery_slot ON delivery_slot.zone_id=zone.id WHERE zone.active AND zone.policy_reviewed AND delivery_slot.active) OR EXISTS(SELECT 1 FROM pickup_location WHERE active) AS ready");
  if (!fulfillment.rows[0]?.ready) blockers.push("FULFILLMENT_UNCONFIGURED");
  if (config.APP_ENV === "preview" || config.APP_ENV === "production") {
    const drill = await client.query("SELECT 1 FROM release_evidence WHERE release_version='v0.1' AND evidence_type='CTO_RECOVERY_DRILL' AND result='PASSED' ORDER BY occurred_at DESC LIMIT 1");
    if (!drill.rowCount) blockers.push("CTO_RECOVERY_DRILL_NOT_PASSED");
  }
  return blockers;
}
