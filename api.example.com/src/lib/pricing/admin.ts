import { z } from "zod";
import { appendAudit } from "@/lib/audit/service";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendDomainEvent } from "@/lib/events/outbox";

const scopeInput = z.object({
  effect: z.enum(["INCLUDE", "EXCLUDE"]),
  scopeType: z.enum(["PRODUCT", "VARIANT", "CATEGORY", "COLLECTION", "ACCOUNT", "ACCOUNT_GROUP"]),
  scopeId: z.string().uuid(),
});

const ruleInput = z.object({
  internalName: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  descriptionEn: z.string().trim().max(1_000).optional(),
  descriptionAr: z.string().trim().max(1_000).optional(),
  enabled: z.boolean().default(false),
  kind: z.enum(["SALE", "COUPON", "AUTOMATIC", "REFERRAL"]),
  applicationMethod: z.enum(["MANUAL", "AUTOMATIC", "ACCOUNT_ASSIGNED", "ADMIN_ISSUED", "REFERRAL"]),
  reductionKind: z.enum(["PERCENTAGE", "FIXED", "FIXED_FINAL_PRICE"]),
  reductionValue: z.number().int().positive(),
  maximumReductionFils: z.number().int().positive().optional(),
  minimumMerchandiseFils: z.number().int().nonnegative().default(0),
  priority: z.number().int().default(0),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).default([]),
  localStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  localEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  allowSaleCombination: z.boolean().default(false),
  allowCouponCombination: z.boolean().default(false),
  maximumUsesGlobal: z.number().int().positive().optional(),
  maximumUsesPerAccount: z.number().int().positive().optional(),
  maximumUsesPerOrder: z.number().int().positive().default(1),
  budgetFils: z.number().int().positive().optional(),
  eligibility: z.record(z.string(), z.unknown()).default({}),
  scopes: z.array(scopeInput).default([]),
  codes: z.array(z.string().trim().min(3).max(64)).default([]),
}).superRefine((value, context) => {
  if ((value.localStartTime === undefined) !== (value.localEndTime === undefined)) {
    context.addIssue({ code: "custom", message: "Both local time boundaries are required" });
  }
  if (value.reductionKind === "PERCENTAGE" && value.reductionValue > 10_000) {
    context.addIssue({ code: "custom", message: "Percentage cannot exceed 100%", path: ["reductionValue"] });
  }
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({ code: "custom", message: "The end must be after the start", path: ["endsAt"] });
  }
});

const campaignInput = z.object({
  internalName: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  descriptionEn: z.string().trim().max(1_000).optional(),
  descriptionAr: z.string().trim().max(1_000).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE"]).default("DRAFT"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  budgetFils: z.number().int().positive().optional(),
  rules: z.array(ruleInput).min(1).max(100),
}).superRefine((value, context) => {
  if (value.startsAt && value.endsAt && new Date(value.endsAt) <= new Date(value.startsAt)) {
    context.addIssue({ code: "custom", message: "The end must be after the start", path: ["endsAt"] });
  }
});

const rulePatch = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  maximumUsesGlobal: z.number().int().positive().nullable().optional(),
  maximumUsesPerAccount: z.number().int().positive().nullable().optional(),
  budgetFils: z.number().int().positive().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

const duplicateInput = z.object({
  internalName: z.string().trim().min(2).max(160),
  nameEn: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
});

export async function createCampaign(actorId: string, raw: unknown) {
  const input = campaignInput.parse(raw);
  return withTransaction(async (client) => {
    const campaign = await client.execute<{ id: string; public_id: string }>(
      `INSERT INTO campaign(internal_name,name_en,name_ar,description_en,description_ar,status,starts_at,ends_at,budget_fils,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id,public_id`,
      [input.internalName, input.nameEn, input.nameAr, input.descriptionEn ?? null, input.descriptionAr ?? null,
        input.status, input.startsAt ?? null, input.endsAt ?? null, input.budgetFils ?? null, actorId],
    );
    const rulePublicIds: string[] = [];
    for (const rule of input.rules) {
      const created = await client.execute<{ id: string; public_id: string }>(
        `INSERT INTO promotion_rule(campaign_id,internal_name,name_en,name_ar,description_en,description_ar,enabled,rule_kind,
          application_method,reduction_kind,reduction_value,maximum_reduction_fils,minimum_merchandise_fils,priority,
          starts_at,ends_at,weekdays,local_start_time,local_end_time,allow_sale_combination,allow_coupon_combination,
          maximum_uses_global,maximum_uses_per_account,maximum_uses_per_order,budget_fils,eligibility,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::smallint[],$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27,$27)
         RETURNING id,public_id`,
        [campaign.rows[0].id, rule.internalName, rule.nameEn, rule.nameAr, rule.descriptionEn ?? null,
          rule.descriptionAr ?? null, rule.enabled, rule.kind, rule.applicationMethod, rule.reductionKind,
          rule.reductionValue, rule.maximumReductionFils ?? null, rule.minimumMerchandiseFils, rule.priority,
          rule.startsAt ?? null, rule.endsAt ?? null, rule.weekdays, rule.localStartTime ?? null, rule.localEndTime ?? null,
          rule.allowSaleCombination, rule.allowCouponCombination, rule.maximumUsesGlobal ?? null,
          rule.maximumUsesPerAccount ?? null, rule.maximumUsesPerOrder, rule.budgetFils ?? null,
          JSON.stringify(rule.eligibility), actorId],
      );
      rulePublicIds.push(created.rows[0].public_id);
      for (const scope of rule.scopes) {
        await client.execute(
          "INSERT INTO promotion_scope(rule_id,effect,scope_type,scope_id) VALUES($1,$2,$3,$4)",
          [created.rows[0].id, scope.effect, scope.scopeType, scope.scopeId],
        );
      }
      for (const code of rule.codes) {
        await client.execute(
          "INSERT INTO promotion_code(rule_id,code,created_by) VALUES($1,$2,$3)",
          [created.rows[0].id, code, actorId],
        );
      }
    }
    await appendAudit(client, {
      actorId,
      action: "campaign.created",
      targetType: "campaign",
      targetId: campaign.rows[0].id,
      domain: "promotions",
      after: { status: input.status, rules: input.rules.length },
    });
    await appendDomainEvent(client, {
      eventType: "promotions.campaign.created.v1",
      aggregateType: "campaign",
      aggregateId: campaign.rows[0].id,
      payload: { campaignId: campaign.rows[0].id, status: input.status },
    });
    return { publicId: campaign.rows[0].public_id, rulePublicIds };
  });
}

export async function listCampaigns() {
  return withDatabaseClient(async (client) => (await client.execute<{
    public_id: string;
    internal_name: string;
    name_en: string;
    name_ar: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    budget_fils: string | null;
    rule_count: number;
    used_fils: string;
    rules: { publicId: string; nameEn: string; nameAr: string; enabled: boolean; priority: number; version: number }[];
  }>(
    `SELECT campaign.public_id,campaign.internal_name,campaign.name_en,campaign.name_ar,campaign.status,
            campaign.starts_at,campaign.ends_at,campaign.budget_fils,
            (SELECT count(*)::int FROM promotion_rule WHERE campaign_id=campaign.id) AS rule_count,
            COALESCE((SELECT sum(usage.reduction_fils)
              FROM promotion_usage AS usage
              JOIN promotion_rule AS used_rule ON used_rule.id=usage.rule_id
              WHERE used_rule.campaign_id=campaign.id AND usage.state IN('RESERVED','CONSUMED')),0)::text AS used_fils,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'publicId',rule.public_id,'nameEn',rule.name_en,'nameAr',rule.name_ar,
              'enabled',rule.enabled,'priority',rule.priority,'version',rule.version
            ) ORDER BY rule.priority DESC,rule.id) FROM promotion_rule AS rule WHERE rule.campaign_id=campaign.id),'[]'::jsonb) AS rules
     FROM campaign
     ORDER BY campaign.created_at DESC`,
  )).rows);
}

export async function updatePromotionRule(actorId: string, publicId: string, raw: unknown) {
  const patch = rulePatch.parse(raw);
  return withTransaction(async (client) => {
    const current = await client.execute<{
      id: string;
      enabled: boolean;
      priority: number;
      starts_at: string | null;
      ends_at: string | null;
      maximum_uses_global: number | null;
      maximum_uses_per_account: number | null;
      budget_fils: string | null;
      version: number;
    }>("SELECT id,enabled,priority,starts_at,ends_at,maximum_uses_global,maximum_uses_per_account,budget_fils,version FROM promotion_rule WHERE public_id=$1 FOR UPDATE", [publicId]);
    if (!current.rows[0]) throw new Error("PROMOTION_NOT_FOUND");
    const before = current.rows[0];
    const updated = await client.execute<{ enabled: boolean; priority: number; version: number }>(
      `UPDATE promotion_rule SET enabled=$2,priority=$3,starts_at=$4,ends_at=$5,maximum_uses_global=$6,
        maximum_uses_per_account=$7,budget_fils=$8,version=version+1,updated_by=$9,updated_at=now()
       WHERE id=$1 RETURNING enabled,priority,version`,
      [before.id, patch.enabled ?? before.enabled, patch.priority ?? before.priority,
        patch.startsAt === undefined ? before.starts_at : patch.startsAt,
        patch.endsAt === undefined ? before.ends_at : patch.endsAt,
        patch.maximumUsesGlobal === undefined ? before.maximum_uses_global : patch.maximumUsesGlobal,
        patch.maximumUsesPerAccount === undefined ? before.maximum_uses_per_account : patch.maximumUsesPerAccount,
        patch.budgetFils === undefined ? before.budget_fils : patch.budgetFils, actorId],
    );
    await appendAudit(client, {
      actorId,
      action: "promotion.updated",
      targetType: "promotion_rule",
      targetId: before.id,
      domain: "promotions",
      before,
      after: updated.rows[0],
    });
    await appendDomainEvent(client, {
      eventType: "promotions.rule.updated.v1",
      aggregateType: "promotion_rule",
      aggregateId: before.id,
      payload: { ruleId: before.id, version: updated.rows[0].version },
    });
    return updated.rows[0];
  });
}

export async function updateCampaignLifecycle(
  actorId: string,
  publicId: string,
  nextStatus: "DRAFT" | "SCHEDULED" | "ACTIVE" | "PAUSED" | "ENDED" | "ARCHIVED",
) {
  const transitions: Record<string, string[]> = {
    DRAFT: ["SCHEDULED", "ACTIVE"],
    SCHEDULED: ["DRAFT", "ACTIVE", "PAUSED", "ENDED"],
    ACTIVE: ["PAUSED", "ENDED"],
    PAUSED: ["ACTIVE", "ENDED"],
    ENDED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return withTransaction(async (client) => {
    const current = await client.execute<{ id: string; status: string }>(
      "SELECT id,status FROM campaign WHERE public_id=$1 FOR UPDATE",
      [publicId],
    );
    if (!current.rows[0]) throw new Error("CAMPAIGN_NOT_FOUND");
    if (!transitions[current.rows[0].status]?.includes(nextStatus)) throw new Error("CAMPAIGN_TRANSITION_INVALID");
    await client.execute(
      "UPDATE campaign SET status=$2,updated_by=$3,updated_at=now() WHERE id=$1",
      [current.rows[0].id, nextStatus, actorId],
    );
    await appendAudit(client, {
      actorId,
      action: "campaign.lifecycle_changed",
      targetType: "campaign",
      targetId: current.rows[0].id,
      domain: "promotions",
      before: { status: current.rows[0].status },
      after: { status: nextStatus },
    });
    await appendDomainEvent(client, {
      eventType: "promotions.campaign.lifecycle_changed.v1",
      aggregateType: "campaign",
      aggregateId: current.rows[0].id,
      payload: { campaignId: current.rows[0].id, from: current.rows[0].status, to: nextStatus },
    });
    return { publicId, status: nextStatus };
  });
}

type DuplicatedRule = {
  id: string;
  internal_name: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  rule_kind: string;
  application_method: string;
  reduction_kind: string;
  reduction_value: number;
  maximum_reduction_fils: string | null;
  minimum_merchandise_fils: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  weekdays: number[];
  local_start_time: string | null;
  local_end_time: string | null;
  allow_sale_combination: boolean;
  allow_coupon_combination: boolean;
  maximum_uses_global: number | null;
  maximum_uses_per_account: number | null;
  maximum_uses_per_order: number;
  budget_fils: string | null;
  eligibility: Record<string, unknown>;
};

export async function duplicateCampaign(actorId: string, publicId: string, raw: unknown) {
  const input = duplicateInput.parse(raw);
  return withTransaction(async (client) => {
    const source = await client.execute<{
      id: string;
      description_en: string | null;
      description_ar: string | null;
      budget_fils: string | null;
    }>("SELECT id,description_en,description_ar,budget_fils FROM campaign WHERE public_id=$1 FOR SHARE", [publicId]);
    if (!source.rows[0]) throw new Error("CAMPAIGN_NOT_FOUND");
    const campaign = await client.execute<{ id: string; public_id: string }>(
      `INSERT INTO campaign(internal_name,name_en,name_ar,description_en,description_ar,status,budget_fils,created_by,updated_by)
       VALUES($1,$2,$3,$4,$5,'DRAFT',$6,$7,$7) RETURNING id,public_id`,
      [input.internalName, input.nameEn, input.nameAr, source.rows[0].description_en,
        source.rows[0].description_ar, source.rows[0].budget_fils, actorId],
    );
    const rules = await client.execute<DuplicatedRule>(
      `SELECT id,internal_name,name_en,name_ar,description_en,description_ar,rule_kind,application_method,reduction_kind,
              reduction_value,maximum_reduction_fils,minimum_merchandise_fils,priority,starts_at,ends_at,weekdays,
              local_start_time::text,local_end_time::text,allow_sale_combination,allow_coupon_combination,
              maximum_uses_global,maximum_uses_per_account,maximum_uses_per_order,budget_fils,eligibility
       FROM promotion_rule WHERE campaign_id=$1 ORDER BY id`,
      [source.rows[0].id],
    );
    const rulePublicIds: string[] = [];
    for (const rule of rules.rows) {
      const copy = await client.execute<{ id: string; public_id: string }>(
        `INSERT INTO promotion_rule(campaign_id,internal_name,name_en,name_ar,description_en,description_ar,enabled,rule_kind,
          application_method,reduction_kind,reduction_value,maximum_reduction_fils,minimum_merchandise_fils,priority,
          starts_at,ends_at,weekdays,local_start_time,local_end_time,allow_sale_combination,allow_coupon_combination,
          maximum_uses_global,maximum_uses_per_account,maximum_uses_per_order,budget_fils,eligibility,version,created_by,updated_by)
         VALUES($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::smallint[],$17,$18,$19,$20,$21,$22,$23,$24,$25::jsonb,1,$26,$26)
         RETURNING id,public_id`,
        [campaign.rows[0].id, rule.internal_name, rule.name_en, rule.name_ar, rule.description_en, rule.description_ar,
          rule.rule_kind, rule.application_method, rule.reduction_kind, rule.reduction_value,
          rule.maximum_reduction_fils, rule.minimum_merchandise_fils, rule.priority, rule.starts_at, rule.ends_at,
          rule.weekdays, rule.local_start_time, rule.local_end_time, rule.allow_sale_combination,
          rule.allow_coupon_combination, rule.maximum_uses_global, rule.maximum_uses_per_account,
          rule.maximum_uses_per_order, rule.budget_fils, JSON.stringify(rule.eligibility), actorId],
      );
      rulePublicIds.push(copy.rows[0].public_id);
      await client.execute(
        "INSERT INTO promotion_scope(rule_id,effect,scope_type,scope_id) SELECT $1,effect,scope_type,scope_id FROM promotion_scope WHERE rule_id=$2",
        [copy.rows[0].id, rule.id],
      );
      await client.execute(
        "INSERT INTO promotion_code(rule_id,code,enabled,created_by) SELECT $1,substr(code,1,57) || '-' || substr($1::text,1,6),false,$3 FROM promotion_code WHERE rule_id=$2",
        [copy.rows[0].id, rule.id, actorId],
      );
    }
    await appendAudit(client, {
      actorId,
      action: "campaign.duplicated",
      targetType: "campaign",
      targetId: campaign.rows[0].id,
      domain: "promotions",
      after: { sourceCampaignId: source.rows[0].id, rules: rules.rowCount },
    });
    await appendDomainEvent(client, {
      eventType: "promotions.campaign.duplicated.v1",
      aggregateType: "campaign",
      aggregateId: campaign.rows[0].id,
      payload: { campaignId: campaign.rows[0].id, sourceCampaignId: source.rows[0].id },
    });
    return { publicId: campaign.rows[0].public_id, rulePublicIds };
  });
}
