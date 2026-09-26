import { z } from "zod";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendDomainEvent } from "@/lib/events/outbox";
import { launchBlockers } from "@/lib/platform/release-readiness";

const definitions = {
  "platform.store_enabled": z.boolean(),
  "platform.default_locale": z.enum(["ar", "en"]),
  "platform.business_timezone": z.literal("Asia/Amman"),
  "platform.currency": z.literal("JOD"),
  "checkout.tax_policy": z.enum(["UNCONFIGURED", "NONE_REVIEWED"]),
  "delivery.cod_redelivery_policy_reviewed": z.boolean(),
} as const;

export type SettingKey = keyof typeof definitions;
export type SettingValue = boolean | number | "ar" | "en" | "Asia/Amman" | "JOD" | "UNCONFIGURED" | "NONE_REVIEWED";

export type SettingUpdate =
  | { key: "platform.store_enabled"; value: boolean; actorId: string; reason: string }
  | { key: "platform.default_locale"; value: "ar" | "en"; actorId: string; reason: string }
  | { key: "platform.business_timezone"; value: "Asia/Amman"; actorId: string; reason: string }
  | { key: "platform.currency"; value: "JOD"; actorId: string; reason: string }
  | { key: "checkout.tax_policy"; value: "UNCONFIGURED" | "NONE_REVIEWED"; actorId: string; reason: string }
  | { key: "delivery.cod_redelivery_policy_reviewed"; value: boolean; actorId: string; reason: string };

export const settingUpdateSchema = z.discriminatedUnion("key", [
  z.object({ key:z.literal("platform.store_enabled"),value:z.boolean(),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
  z.object({ key:z.literal("platform.default_locale"),value:z.enum(["ar","en"]),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
  z.object({ key:z.literal("platform.business_timezone"),value:z.literal("Asia/Amman"),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
  z.object({ key:z.literal("platform.currency"),value:z.literal("JOD"),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
  z.object({ key:z.literal("checkout.tax_policy"),value:z.enum(["UNCONFIGURED","NONE_REVIEWED"]),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
  z.object({ key:z.literal("delivery.cod_redelivery_policy_reviewed"),value:z.boolean(),actorId:z.string().uuid(),reason:z.string().min(1).max(500) }),
]);

export async function readSetting(key: SettingKey): Promise<SettingValue> {
  return withDatabaseClient(async (client) => {
    const result = await client.execute<{ value: unknown }>("SELECT value FROM app_setting WHERE key = $1", [key]);
    if (!result.rows[0]) throw new Error("SETTING_NOT_FOUND");
    return definitions[key].parse(result.rows[0].value);
  });
}

export async function updateSetting(input: SettingUpdate): Promise<void> {
  const value = definitions[input.key].parse(input.value);
  await withTransaction(async (client) => {
    if(input.key==="platform.store_enabled"&&input.value===true){const blockers=await launchBlockers(client);if(blockers.length)throw new Error(`STOREFRONT_ACTIVATION_BLOCKED:${blockers.join(",")}`);}
    const current = await client.execute<{ value: unknown; version: number }>(
      "SELECT value, version FROM app_setting WHERE key = $1 FOR UPDATE",
      [input.key],
    );
    if (!current.rows[0]) throw new Error("SETTING_NOT_FOUND");

    const nextVersion = current.rows[0].version + 1;
    await client.execute("UPDATE app_setting SET value = $2::jsonb, version = $3, updated_at = now() WHERE key = $1", [
      input.key,
      JSON.stringify(value),
      nextVersion,
    ]);
    await client.execute(
      `INSERT INTO setting_change
       (setting_key, old_value, new_value, version, actor_id, reason)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)`,
      [input.key, JSON.stringify(current.rows[0].value), JSON.stringify(value), nextVersion, input.actorId, input.reason],
    );
    await appendDomainEvent(client, {
      eventType: "platform.setting.updated.v1",
      aggregateType: "setting",
      aggregateId: input.key,
      payload: { key: input.key, version: nextVersion },
    });
  });
}
