import type {
  AppliedPricingRule,
  CalculatePricingQuoteInput,
  PricingLineInput,
  PricingLineQuote,
  PricingQuote,
  PricingRejection,
  PricingRuleInput,
} from "./types";
import type { DatabaseClient } from "@/lib/db/client";

export type { PricingQuote, PricingRuleInput } from "./types";

type StoredPricingRule = {
  id: string;
  version: number;
  rule_kind: PricingRuleInput["kind"];
  reduction_kind: PricingRuleInput["reduction"]["kind"];
  reduction_value: number;
  maximum_reduction_fils: string | null;
  minimum_merchandise_fils: string;
  priority: number;
  allow_sale_combination: boolean;
  allow_coupon_combination: boolean;
  starts_at: string | Date | null;
  ends_at: string | Date | null;
  weekdays: number[];
  local_start_time: string | null;
  local_end_time: string | null;
  eligibility: Record<string, unknown>;
  campaign_status: string | null;
  campaign_starts_at: string | Date | null;
  campaign_ends_at: string | Date | null;
  assigned_account_id: string | null;
};

type PricingLineContext = {
  lineId: string;
  productId: string;
  variantId: string;
  categoryIds: string[];
  collectionIds: string[];
  quantity: number;
};

type PromotionScopeRow = {
  rule_id: string;
  effect: "INCLUDE" | "EXCLUDE";
  scope_type: "PRODUCT" | "VARIANT" | "CATEGORY" | "COLLECTION" | "ACCOUNT" | "ACCOUNT_GROUP";
  scope_id: string;
};

function asTimestamp(value: string | Date | null) {
  return value === null ? null : new Date(value).getTime();
}

function timeMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function scheduleActive(rule: StoredPricingRule, now: { instant: number; weekday: number; minutes: number }) {
  const startsAt = asTimestamp(rule.starts_at);
  const endsAt = asTimestamp(rule.ends_at);
  if ((startsAt !== null && startsAt > now.instant) || (endsAt !== null && endsAt <= now.instant)) return false;
  if (rule.campaign_status !== null && rule.campaign_status !== "ACTIVE") return false;
  const campaignStartsAt = asTimestamp(rule.campaign_starts_at);
  const campaignEndsAt = asTimestamp(rule.campaign_ends_at);
  if ((campaignStartsAt !== null && campaignStartsAt > now.instant)
    || (campaignEndsAt !== null && campaignEndsAt <= now.instant)) return false;
  if (rule.weekdays.length && !rule.weekdays.includes(now.weekday)) return false;
  if (rule.local_start_time && rule.local_end_time) {
    const start = timeMinutes(rule.local_start_time);
    const end = timeMinutes(rule.local_end_time);
    const inWindow = start <= end
      ? now.minutes >= start && now.minutes < end
      : now.minutes >= start || now.minutes < end;
    if (!inWindow) return false;
  }
  return true;
}

function accountEligible(
  rule: StoredPricingRule,
  account: { verified: boolean; createdAt: number; purchaseCount: number },
  quantity: number,
  now: number,
) {
  const eligibility = rule.eligibility;
  if (eligibility.verified === true && !account.verified) return false;
  if (eligibility.firstOrder === true && account.purchaseCount > 0) return false;
  if (typeof eligibility.maximumPurchaseCount === "number" && account.purchaseCount > eligibility.maximumPurchaseCount) return false;
  if (typeof eligibility.minimumQuantity === "number" && quantity < eligibility.minimumQuantity) return false;
  if (typeof eligibility.minimumAccountAgeDays === "number"
    && now - account.createdAt < eligibility.minimumAccountAgeDays * 86_400_000) return false;
  return true;
}

function scopeMatches(
  scope: PromotionScopeRow,
  line: PricingLineContext,
  accountId: string,
  accountGroupIds: Set<string>,
) {
  if (scope.scope_type === "PRODUCT") return scope.scope_id === line.productId;
  if (scope.scope_type === "VARIANT") return scope.scope_id === line.variantId;
  if (scope.scope_type === "CATEGORY") return line.categoryIds.includes(scope.scope_id);
  if (scope.scope_type === "COLLECTION") return line.collectionIds.includes(scope.scope_id);
  if (scope.scope_type === "ACCOUNT") return scope.scope_id === accountId;
  return accountGroupIds.has(scope.scope_id);
}

export async function loadPricingRulesForQuote(
  client: DatabaseClient,
  input: { accountId: string; lines: PricingLineContext[]; couponCode?: string },
) {
  const columns = `rule.id,rule.version,rule.rule_kind,rule.reduction_kind,rule.reduction_value,
            rule.maximum_reduction_fils,rule.minimum_merchandise_fils,rule.priority,
            rule.allow_sale_combination,rule.allow_coupon_combination,rule.starts_at,rule.ends_at,
            rule.weekdays,rule.local_start_time::text,rule.local_end_time::text,rule.eligibility,
            campaign.status AS campaign_status,campaign.starts_at AS campaign_starts_at,campaign.ends_at AS campaign_ends_at,
            NULL::uuid AS assigned_account_id`;
  const sales = await client.execute<StoredPricingRule>(
    `SELECT ${columns}
     FROM promotion_rule AS rule
     LEFT JOIN campaign ON campaign.id=rule.campaign_id
     WHERE rule.enabled AND rule.rule_kind='SALE' AND rule.application_method='AUTOMATIC'
     ORDER BY rule.priority DESC,rule.id`,
  );
  const coupons = input.couponCode
    ? await client.execute<StoredPricingRule>(
        `SELECT ${columns.replace("NULL::uuid AS assigned_account_id", "code.assigned_account_id")}
         FROM promotion_code AS code
         JOIN promotion_rule AS rule ON rule.id=code.rule_id
         LEFT JOIN campaign ON campaign.id=rule.campaign_id
         WHERE lower(code.code)=lower($1) AND code.enabled AND code.disabled_at IS NULL
           AND rule.enabled AND rule.rule_kind='COUPON'
         ORDER BY rule.priority DESC,rule.id`,
        [input.couponCode],
      )
    : { rows: [], rowCount: 0 };

  const candidates = [...sales.rows, ...coupons.rows];
  const scopes = candidates.length
    ? await client.execute<PromotionScopeRow>(
        "SELECT rule_id,effect,scope_type,scope_id FROM promotion_scope WHERE rule_id=ANY($1::uuid[]) ORDER BY rule_id,effect,scope_type,scope_id",
        [candidates.map((rule) => rule.id)],
      )
    : { rows: [], rowCount: 0 };
  const accountRow = await client.execute<{
    email_verified_at: string | Date | null;
    phone_verified_at: string | Date | null;
    created_at: string | Date;
    purchase_count: number;
  }>(
    `SELECT account.email_verified_at,account.phone_verified_at,account.created_at,
            count(orders.id) FILTER (WHERE orders.status='COMPLETED')::int AS purchase_count
     FROM account LEFT JOIN shop_order AS orders ON orders.account_id=account.id
     WHERE account.id=$1 GROUP BY account.id`,
    [input.accountId],
  );
  const accountValue = accountRow.rows[0];
  if (!accountValue) throw new Error("ACCOUNT_NOT_FOUND");
  const localNow = await client.execute<{ instant: string | Date; weekday: number; minutes: number }>(
    `SELECT now() AS instant,
            extract(isodow FROM now() AT TIME ZONE 'Asia/Amman')::int AS weekday,
            (extract(hour FROM now() AT TIME ZONE 'Asia/Amman')::int*60
              + extract(minute FROM now() AT TIME ZONE 'Asia/Amman')::int) AS minutes`,
  );
  const now = {
    instant: new Date(localNow.rows[0].instant).getTime(),
    weekday: localNow.rows[0].weekday,
    minutes: localNow.rows[0].minutes,
  };
  const account = {
    verified: accountValue.email_verified_at !== null && accountValue.phone_verified_at !== null,
    createdAt: new Date(accountValue.created_at).getTime(),
    purchaseCount: accountValue.purchase_count,
  };
  const groupRows = await client.execute<{ group_id: string }>(
    `SELECT membership.group_id
     FROM account_group_member AS membership
     JOIN account_group AS account_group ON account_group.id=membership.group_id
     WHERE membership.account_id=$1 AND account_group.active`,
    [input.accountId],
  );
  const accountGroupIds = new Set(groupRows.rows.map((membership) => membership.group_id));
  const rejections: PricingRejection[] = [];
  if (input.couponCode && coupons.rowCount === 0) {
    rejections.push({ ruleId: `coupon:${input.couponCode.toUpperCase()}`, code: "COUPON_NOT_FOUND" });
  }

  const mapRule = (rule: StoredPricingRule): PricingRuleInput | undefined => {
    if (rule.rule_kind === "COUPON" && rule.assigned_account_id !== null && rule.assigned_account_id !== input.accountId) {
      rejections.push({ ruleId: rule.id, code: "COUPON_ASSIGNED_ACCOUNT_MISMATCH" });
      return undefined;
    }
    if (!scheduleActive(rule, now)) {
      rejections.push({ ruleId: rule.id, code: "SCHEDULE_INACTIVE" });
      return undefined;
    }
    const quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0);
    if (!accountEligible(rule, account, quantity, now.instant)) {
      rejections.push({ ruleId: rule.id, code: "ACCOUNT_NOT_ELIGIBLE" });
      return undefined;
    }
    const ruleScopes = scopes.rows.filter((scope) => scope.rule_id === rule.id);
    const includes = ruleScopes.filter((scope) => scope.effect === "INCLUDE");
    const excludes = ruleScopes.filter((scope) => scope.effect === "EXCLUDE");
    const eligibleLineIds = input.lines
      .filter((line) => (!includes.length || includes.some((scope) => scopeMatches(scope, line, input.accountId, accountGroupIds)))
        && !excludes.some((scope) => scopeMatches(scope, line, input.accountId, accountGroupIds)))
      .map((line) => line.lineId);
    if (!eligibleLineIds.length) {
      rejections.push({ ruleId: rule.id, code: "SCOPE_NOT_ELIGIBLE" });
      return undefined;
    }
    return {
      id: rule.id,
      version: rule.version,
      kind: rule.rule_kind,
      reduction: { kind: rule.reduction_kind, value: rule.reduction_value },
      maximumReductionFils: rule.maximum_reduction_fils === null ? undefined : Number(rule.maximum_reduction_fils),
      minimumMerchandiseFils: Number(rule.minimum_merchandise_fils),
      priority: rule.priority,
      eligibleLineIds,
      allowSaleCombination: rule.allow_sale_combination,
      allowCouponCombination: rule.allow_coupon_combination,
    };
  };
  const mappedSales = sales.rows.map(mapRule).filter((rule): rule is PricingRuleInput => rule !== undefined);
  const mappedCoupons = coupons.rows.map(mapRule).filter((rule): rule is PricingRuleInput => rule !== undefined);
  return { sales: mappedSales, coupons: mappedCoupons, rejections };
}

export async function reservePromotionUsage(
  client: DatabaseClient,
  input: {
    accountId: string;
    orderId: string;
    appliedRules: AppliedPricingRule[];
    consume: boolean;
  },
) {
  for (const applied of input.appliedRules) {
    if (applied.kind === "REFERRAL") continue;
    const rule = await client.execute<{
      campaign_id: string | null;
      maximum_uses_global: number | null;
      maximum_uses_per_account: number | null;
      maximum_uses_per_order: number;
      budget_fils: string | null;
    }>(
      `SELECT campaign_id,maximum_uses_global,maximum_uses_per_account,maximum_uses_per_order,budget_fils
       FROM promotion_rule WHERE id=$1 FOR UPDATE`,
      [applied.id],
    );
    const limits = rule.rows[0];
    if (!limits) throw new Error("PROMOTION_RULE_MISSING");
    const operationKey = `order:${input.orderId}:promotion:${applied.id}`;
    const existing = await client.execute("SELECT 1 FROM promotion_usage WHERE operation_key=$1", [operationKey]);
    if (existing.rowCount) continue;
    const usage = await client.execute<{ global_count: number; account_count: number; global_reduction: string }>(
      `SELECT count(*)::int AS global_count,
              count(*) FILTER (WHERE account_id=$2)::int AS account_count,
              COALESCE(sum(reduction_fils),0)::text AS global_reduction
       FROM promotion_usage WHERE rule_id=$1 AND state IN('RESERVED','CONSUMED')`,
      [applied.id, input.accountId],
    );
    const counters = usage.rows[0];
    if (limits.maximum_uses_global !== null && counters.global_count >= limits.maximum_uses_global) {
      throw new Error("PROMOTION_GLOBAL_LIMIT_REACHED");
    }
    if (limits.maximum_uses_per_account !== null && counters.account_count >= limits.maximum_uses_per_account) {
      throw new Error("PROMOTION_ACCOUNT_LIMIT_REACHED");
    }
    if (limits.maximum_uses_per_order < 1) throw new Error("PROMOTION_ORDER_LIMIT_REACHED");
    if (limits.budget_fils !== null && Number(counters.global_reduction) + applied.amountFils > Number(limits.budget_fils)) {
      throw new Error("PROMOTION_BUDGET_REACHED");
    }
    if (limits.campaign_id) {
      const campaign = await client.execute<{ budget_fils: string | null; used_fils: string }>(
        `SELECT campaign.budget_fils,
                COALESCE(sum(usage.reduction_fils) FILTER (WHERE usage.state IN('RESERVED','CONSUMED')),0)::text AS used_fils
         FROM campaign
         LEFT JOIN promotion_rule AS rule ON rule.campaign_id=campaign.id
         LEFT JOIN promotion_usage AS usage ON usage.rule_id=rule.id
         WHERE campaign.id=$1 GROUP BY campaign.id`,
        [limits.campaign_id],
      );
      const campaignBudget = campaign.rows[0];
      if (campaignBudget?.budget_fils !== null
        && Number(campaignBudget.used_fils) + applied.amountFils > Number(campaignBudget.budget_fils)) {
        throw new Error("CAMPAIGN_BUDGET_REACHED");
      }
    }
    await client.execute(
      `INSERT INTO promotion_usage(rule_id,account_id,order_id,operation_key,state,reduction_fils,consumed_at)
       VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $5='CONSUMED' THEN now() ELSE NULL END)`,
      [applied.id, input.accountId, input.orderId, operationKey, input.consume ? "CONSUMED" : "RESERVED", applied.amountFils],
    );
  }
}

export async function consumePromotionUsage(client: DatabaseClient, orderId: string) {
  await client.execute(
    "UPDATE promotion_usage SET state='CONSUMED',consumed_at=now() WHERE order_id=$1 AND state='RESERVED'",
    [orderId],
  );
}

export async function releasePromotionUsage(client: DatabaseClient, orderId: string, reason: string) {
  await client.execute(
    "UPDATE promotion_usage SET state='RELEASED',released_at=now(),release_reason=$2 WHERE order_id=$1 AND state='RESERVED'",
    [orderId, reason],
  );
}

type LineState = PricingLineQuote & { saleRule?: PricingRuleInput; couponRules: PricingRuleInput[] };

function requireNonNegativeInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}

function validateLine(line: PricingLineInput) {
  if (!line.lineId) throw new Error("INVALID_LINE_ID");
  requireNonNegativeInteger(line.unitBaseFils, "unit_base_fils");
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("INVALID_QUANTITY");
}

function percentageReduction(amountFils: number, basisPoints: number) {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 1 || basisPoints > 10_000) {
    throw new Error("INVALID_PERCENTAGE");
  }
  return Math.floor((amountFils * basisPoints + 5_000) / 10_000);
}

function allocateProportionally(totalFils: number, balances: Map<string, number>) {
  const positive = [...balances.entries()].filter(([, amount]) => amount > 0);
  const available = positive.reduce((sum, [, amount]) => sum + amount, 0);
  const target = Math.min(totalFils, available);
  const allocations = new Map<string, number>();
  if (target === 0 || available === 0) return allocations;

  let allocated = 0;
  for (const [lineId, amount] of positive) {
    const share = Math.min(amount, Math.floor((target * amount) / available));
    allocations.set(lineId, share);
    allocated += share;
  }
  const stableIds = positive.map(([lineId]) => lineId).sort((left, right) => left.localeCompare(right));
  for (let index = 0; allocated < target; index += 1) {
    const lineId = stableIds[index % stableIds.length];
    const capacity = balances.get(lineId) ?? 0;
    const current = allocations.get(lineId) ?? 0;
    if (current < capacity) {
      allocations.set(lineId, current + 1);
      allocated += 1;
    }
  }
  return allocations;
}

function allocationsForRule(rule: PricingRuleInput, lines: LineState[], stage: "SALE" | "COUPON" | "REFERRAL") {
  const eligible = new Set(rule.eligibleLineIds);
  const balances = new Map<string, number>();
  for (const line of lines) {
    if (!eligible.has(line.lineId)) continue;
    const stageBalance = stage === "SALE" ? line.baseFils : line.netFils;
    if (stageBalance > 0) balances.set(line.lineId, stageBalance);
  }
  if (!balances.size) return new Map<string, number>();

  let allocations: Map<string, number>;
  if (rule.reduction.kind === "FIXED") {
    requireNonNegativeInteger(rule.reduction.value, "fixed_reduction");
    allocations = allocateProportionally(rule.reduction.value, balances);
  } else if (rule.reduction.kind === "PERCENTAGE") {
    allocations = new Map(
      [...balances].map(([lineId, amount]) => [lineId, Math.min(amount, percentageReduction(amount, rule.reduction.value))]),
    );
  } else {
    if (stage !== "SALE") throw new Error("FIXED_FINAL_PRICE_REQUIRES_SALE");
    requireNonNegativeInteger(rule.reduction.value, "fixed_final_price");
    allocations = new Map(
      lines
        .filter((line) => eligible.has(line.lineId))
        .map((line) => [line.lineId, Math.max(0, (line.unitBaseFils - rule.reduction.value) * line.quantity)]),
    );
  }

  if (rule.maximumReductionFils !== undefined) {
    requireNonNegativeInteger(rule.maximumReductionFils, "maximum_reduction");
    const total = [...allocations.values()].reduce((sum, amount) => sum + amount, 0);
    if (total > rule.maximumReductionFils) allocations = allocateProportionally(rule.maximumReductionFils, allocations);
  }
  return allocations;
}

function compareRules(left: PricingRuleInput, right: PricingRuleInput) {
  return right.priority - left.priority || left.id.localeCompare(right.id);
}

function snapshotRule(rule: PricingRuleInput, allocations: Map<string, number>): AppliedPricingRule {
  const values = [...allocations]
    .filter(([, amountFils]) => amountFils > 0)
    .map(([lineId, amountFils]) => ({ lineId, amountFils }))
    .sort((left, right) => left.lineId.localeCompare(right.lineId));
  return {
    id: rule.id,
    version: rule.version,
    kind: rule.kind,
    amountFils: values.reduce((sum, allocation) => sum + allocation.amountFils, 0),
    allocations: values,
  };
}

function applySales(lines: LineState[], sales: PricingRuleInput[], rejections: PricingRejection[]) {
  const candidates = sales.map((rule) => ({ rule, allocations: allocationsForRule(rule, lines, "SALE") }));
  for (const { rule, allocations } of candidates) {
    if (![...allocations.values()].some((amount) => amount > 0)) rejections.push({ ruleId: rule.id, code: "NO_ELIGIBLE_LINES" });
  }

  for (const line of lines) {
    const winner = candidates
      .map((candidate) => ({ ...candidate, amount: candidate.allocations.get(line.lineId) ?? 0 }))
      .filter((candidate) => candidate.amount > 0)
      .sort((left, right) => right.amount - left.amount || compareRules(left.rule, right.rule))[0];
    if (!winner) continue;
    line.saleFils = winner.amount;
    line.netFils -= winner.amount;
    line.saleRule = winner.rule;
  }

  return sales
    .map((rule) => snapshotRule(rule, new Map(lines.map((line) => [line.lineId, line.saleRule?.id === rule.id ? line.saleFils : 0]))))
    .filter((snapshot) => snapshot.amountFils > 0)
    .sort((left, right) => sales.findIndex((rule) => rule.id === left.id) - sales.findIndex((rule) => rule.id === right.id));
}

function applySequentialRule(
  lines: LineState[],
  rule: PricingRuleInput,
  stage: "COUPON" | "REFERRAL",
  rejections: PricingRejection[],
) {
  const merchandise = lines.reduce((sum, line) => sum + line.netFils, 0);
  if (merchandise < (rule.minimumMerchandiseFils ?? 0)) {
    rejections.push({ ruleId: rule.id, code: "MINIMUM_NOT_MET" });
    return undefined;
  }

  if (stage === "COUPON") {
    const eligible = new Set(rule.eligibleLineIds);
    const hasCombinationConflict = lines.some((line) => {
      if (!eligible.has(line.lineId)) return false;
      if (line.saleRule && (!line.saleRule.allowCouponCombination || !rule.allowSaleCombination)) return true;
      return line.couponRules.some((applied) => !applied.allowCouponCombination || !rule.allowCouponCombination);
    });
    if (hasCombinationConflict) {
      rejections.push({ ruleId: rule.id, code: "COMBINATION_NOT_ALLOWED" });
      return undefined;
    }
  }

  const allocations = allocationsForRule(rule, lines, stage);
  if (![...allocations.values()].some((amount) => amount > 0)) {
    rejections.push({ ruleId: rule.id, code: "NO_ELIGIBLE_LINES" });
    return undefined;
  }
  for (const line of lines) {
    const amount = Math.min(line.netFils, allocations.get(line.lineId) ?? 0);
    if (amount === 0) continue;
    if (stage === "COUPON") {
      line.couponFils += amount;
      line.couponRules.push(rule);
    } else {
      line.referralFils += amount;
    }
    line.netFils -= amount;
  }
  return snapshotRule(rule, allocations);
}

export function calculatePricingQuote(input: CalculatePricingQuoteInput): PricingQuote {
  requireNonNegativeInteger(input.shippingFils, "shipping_fils");
  requireNonNegativeInteger(input.taxFils, "tax_fils");
  if (new Set(input.lines.map((line) => line.lineId)).size !== input.lines.length) throw new Error("DUPLICATE_LINE_ID");
  const lines: LineState[] = input.lines.map((source) => {
    validateLine(source);
    const baseFils = source.unitBaseFils * source.quantity;
    requireNonNegativeInteger(baseFils, "line_base_fils");
    return {
      ...source,
      baseFils,
      saleFils: 0,
      couponFils: 0,
      referralFils: 0,
      netFils: baseFils,
      couponRules: [],
    };
  });
  const rejections: PricingRejection[] = [];
  const appliedRules = applySales(lines, [...input.sales].sort(compareRules), rejections);
  for (const coupon of [...input.coupons].sort(compareRules)) {
    const applied = applySequentialRule(lines, coupon, "COUPON", rejections);
    if (applied) appliedRules.push(applied);
  }
  if (input.referral) {
    const applied = applySequentialRule(lines, input.referral, "REFERRAL", rejections);
    if (applied) appliedRules.push(applied);
  }

  const merchandiseBaseFils = lines.reduce((sum, line) => sum + line.baseFils, 0);
  const saleFils = lines.reduce((sum, line) => sum + line.saleFils, 0);
  const couponFils = lines.reduce((sum, line) => sum + line.couponFils, 0);
  const referralFils = lines.reduce((sum, line) => sum + line.referralFils, 0);
  const merchandiseNetFils = lines.reduce((sum, line) => sum + line.netFils, 0);
  return {
    merchandiseBaseFils,
    saleFils,
    couponFils,
    referralFils,
    merchandiseNetFils,
    shippingFils: input.shippingFils,
    taxFils: input.taxFils,
    totalFils: merchandiseNetFils + input.shippingFils + input.taxFils,
    lines: lines.map((line) => ({
      lineId: line.lineId,
      quantity: line.quantity,
      unitBaseFils: line.unitBaseFils,
      baseFils: line.baseFils,
      saleFils: line.saleFils,
      couponFils: line.couponFils,
      referralFils: line.referralFils,
      netFils: line.netFils,
    })),
    appliedRules,
    rejections,
  };
}
