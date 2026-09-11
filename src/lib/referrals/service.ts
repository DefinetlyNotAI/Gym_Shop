import { randomBytes } from "node:crypto";
import type { DatabaseClient } from "@/lib/db/client";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import type { PricingRuleInput } from "@/lib/pricing/service";
import { creditWalletLot } from "@/lib/wallet/service";

const CODE_PATTERN = /^[A-Z0-9_-]{6,24}$/;

function randomCode() {
  return randomBytes(9).toString("base64url").toUpperCase();
}

export async function ensureReferralCode(accountId: string) {
  return withTransaction(async (client) => {
    const account = await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [accountId]);
    if (!account.rowCount) throw new Error("ACCOUNT_NOT_FOUND");
    const existing = await client.execute<{ id: string; code: string }>(
      "SELECT id,code FROM referral_code WHERE account_id=$1 AND active ORDER BY created_at DESC LIMIT 1",
      [accountId],
    );
    if (existing.rows[0]) return existing.rows[0];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomCode();
      try {
        return (await client.execute<{ id: string; code: string }>(
          "INSERT INTO referral_code(account_id,code) VALUES($1,$2) RETURNING id,code",
          [accountId, code],
        )).rows[0];
      } catch (error) {
        if (attempt === 4) throw error;
      }
    }
    throw new Error("REFERRAL_CODE_UNAVAILABLE");
  });
}

export async function backfillReferralCodes() {
  const accounts = await withDatabaseClient((client) => client.execute<{ id: string }>(
    "SELECT account.id FROM account LEFT JOIN referral_code ON referral_code.account_id=account.id AND referral_code.active WHERE referral_code.id IS NULL ORDER BY account.id",
  ));
  for (const account of accounts.rows) await ensureReferralCode(account.id);
  return { assigned: accounts.rowCount };
}

export async function setCheckoutReferral(accountId: string, input: { code: string; source: "LINK" | "MANUAL" }) {
  const normalized = input.code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) throw new Error("REFERRAL_CODE_INVALID");
  return withTransaction(async (client) => {
    await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [accountId]);
    const completed = await client.execute("SELECT 1 FROM shop_order WHERE account_id=$1 AND status='COMPLETED' LIMIT 1", [accountId]);
    if (completed.rowCount) throw new Error("REFERRAL_FIRST_ORDER_PASSED");
    const code = await client.execute<{ id: string; account_id: string; code: string }>(
      "SELECT id,account_id,code FROM referral_code WHERE lower(code)=lower($1) AND active FOR SHARE",
      [normalized],
    );
    if (!code.rows[0]) throw new Error("REFERRAL_CODE_NOT_FOUND");
    if (code.rows[0].account_id === accountId) throw new Error("REFERRAL_SELF_DENIED");
    const existing = await client.execute<{ id: string; code_id: string; status: string }>(
      "SELECT id,code_id,status FROM referral_attribution WHERE account_id=$1 FOR UPDATE",
      [accountId],
    );
    if (existing.rows[0]?.status === "LOCKED") throw new Error("REFERRAL_ATTRIBUTION_LOCKED");
    if (existing.rows[0]?.status === "ATTRIBUTED") {
      if (existing.rows[0].code_id === code.rows[0].id) return { attributionId: existing.rows[0].id, code: code.rows[0].code };
      throw new Error("REMOVE_EXISTING_REFERRAL_FIRST");
    }
    const retention = await client.execute<{ days: string }>(
      "SELECT value #>> '{}' AS days FROM app_setting WHERE key='referrals.link_retention_days'",
    );
    const days = Number(retention.rows[0]?.days ?? 30);
    const attribution = existing.rows[0]
      ? await client.execute<{ id: string }>(
          `UPDATE referral_attribution SET code_id=$2,used_code=$3,source=$4,status='ATTRIBUTED',attributed_at=now(),
             expires_at=now()+($5::text || ' days')::interval,locked_order_id=NULL,status_reason=NULL WHERE id=$1 RETURNING id`,
          [existing.rows[0].id, code.rows[0].id, code.rows[0].code, input.source, days],
        )
      : await client.execute<{ id: string }>(
          `INSERT INTO referral_attribution(account_id,code_id,used_code,source,expires_at)
           VALUES($1,$2,$3,$4,now()+($5::text || ' days')::interval) RETURNING id`,
          [accountId, code.rows[0].id, code.rows[0].code, input.source, days],
        );
    return { attributionId: attribution.rows[0].id, code: code.rows[0].code };
  });
}

export async function removeCheckoutReferral(accountId: string) {
  return withTransaction(async (client) => {
    const result = await client.execute(
      "UPDATE referral_attribution SET status='REJECTED',status_reason='REMOVED_BY_CUSTOMER' WHERE account_id=$1 AND status='ATTRIBUTED'",
      [accountId],
    );
    if (!result.rowCount) throw new Error("REFERRAL_NOT_REMOVABLE");
    return { removed: true };
  });
}

export async function getReferralPricingRule(client: DatabaseClient, accountId: string, eligibleLineIds: string[]): Promise<(PricingRuleInput & { usedCode: string }) | undefined> {
  const result = await client.execute<{
    id: string; used_code: string; buyer_rate_bps: string; buyer_cap_fils: string; minimum_fils: string;
  }>(
    `SELECT attribution.id,attribution.used_code,
            (SELECT value #>> '{}' FROM app_setting WHERE key='referrals.buyer_rate_bps') AS buyer_rate_bps,
            (SELECT value #>> '{}' FROM app_setting WHERE key='referrals.buyer_cap_fils') AS buyer_cap_fils,
            (SELECT value #>> '{}' FROM app_setting WHERE key='referrals.minimum_merchandise_fils') AS minimum_fils
     FROM referral_attribution AS attribution
     JOIN referral_code AS code ON code.id=attribution.code_id
     WHERE attribution.account_id=$1 AND attribution.status='ATTRIBUTED' AND attribution.expires_at>now() AND code.active
       AND NOT EXISTS(SELECT 1 FROM shop_order WHERE account_id=$1 AND status='COMPLETED')`,
    [accountId],
  );
  const referral = result.rows[0];
  if (!referral) return undefined;
  return {
    id: `referral:${referral.id}`,
    version: 1,
    kind: "REFERRAL",
    reduction: { kind: "PERCENTAGE", value: Number(referral.buyer_rate_bps) },
    maximumReductionFils: Number(referral.buyer_cap_fils),
    minimumMerchandiseFils: Number(referral.minimum_fils),
    priority: 0,
    eligibleLineIds,
    allowSaleCombination: true,
    allowCouponCombination: true,
    usedCode: referral.used_code,
  };
}

export async function lockOrderAttribution(client: DatabaseClient, input: {
  buyerAccountId: string; orderId: string; buyerDiscountFils: number; qualifyingMerchandiseFils: number;
}) {
  if (input.buyerDiscountFils <= 0) return null;
  await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [input.buyerAccountId]);
  const result = await client.execute<{ id: string; referrer_account_id: string }>(
    `SELECT attribution.id,code.account_id AS referrer_account_id
     FROM referral_attribution AS attribution JOIN referral_code AS code ON code.id=attribution.code_id
     WHERE attribution.account_id=$1 AND attribution.status='ATTRIBUTED' AND attribution.expires_at>now() AND code.active
     FOR UPDATE OF attribution`,
    [input.buyerAccountId],
  );
  const attribution = result.rows[0];
  if (!attribution) return null;
  const used = await client.execute("SELECT 1 FROM referral_reward WHERE buyer_account_id=$1 LIMIT 1", [input.buyerAccountId]);
  if (used.rowCount) throw new Error("REFERRAL_FIRST_ORDER_LOCKED");
  const rate = await client.execute<{ bps: string }>("SELECT value #>> '{}' AS bps FROM app_setting WHERE key='referrals.referrer_rate_bps'");
  const rewardFils = Math.floor((input.qualifyingMerchandiseFils * Number(rate.rows[0].bps) + 5_000) / 10_000);
  const reward = await client.execute<{ id: string }>(
    `INSERT INTO referral_reward(attribution_id,order_id,referrer_account_id,buyer_account_id,buyer_discount_fils,qualifying_merchandise_fils,reward_fils,status)
     VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING') RETURNING id`,
    [attribution.id, input.orderId, attribution.referrer_account_id, input.buyerAccountId, input.buyerDiscountFils,
      input.qualifyingMerchandiseFils, rewardFils],
  );
  await client.execute("UPDATE referral_attribution SET status='LOCKED',locked_order_id=$2 WHERE id=$1", [attribution.id, input.orderId]);
  await client.execute("INSERT INTO referral_reward_event(reward_id,status) VALUES($1,'PENDING')", [reward.rows[0].id]);
  return { rewardId: reward.rows[0].id, rewardFils, status: "PENDING" };
}

export async function qualifyReferralReward(client: DatabaseClient, orderId: string) {
  const result = await client.execute<{
    id: string; status: string; referrer_account_id: string; reward_fils: string; order_status: string;
    payment_status: string; fulfillment_status: string; external_due_fils: string; collected_fils: string;
  }>(
    `SELECT reward.id,reward.status,reward.referrer_account_id,reward.reward_fils,orders.status AS order_status,
            orders.payment_status,orders.fulfillment_status,orders.external_due_fils,orders.collected_fils
     FROM referral_reward AS reward JOIN shop_order AS orders ON orders.id=reward.order_id
     WHERE reward.order_id=$1 FOR UPDATE OF reward,orders`,
    [orderId],
  );
  const reward = result.rows[0];
  if (!reward || reward.status !== "PENDING") return false;
  if (reward.order_status !== "COMPLETED" || reward.fulfillment_status !== "DELIVERED"
    || reward.payment_status !== "PAID" || Number(reward.external_due_fils) !== Number(reward.collected_fils)) return false;
  await client.execute("UPDATE referral_reward SET status='QUALIFIED',updated_at=now() WHERE id=$1", [reward.id]);
  await client.execute("INSERT INTO referral_reward_event(reward_id,status) VALUES($1,'QUALIFIED')", [reward.id]);
  const lotId = await creditWalletLot(client, {
    accountId: reward.referrer_account_id,
    amountFils: Number(reward.reward_fils),
    sourceType: "REFERRAL",
    sourceId: reward.id,
    operationKey: `wallet:referral:${reward.id}`,
  });
  await client.execute("UPDATE referral_reward SET status='COMPLETED',wallet_lot_id=$2,completed_at=now(),updated_at=now() WHERE id=$1", [reward.id, lotId]);
  await client.execute("INSERT INTO referral_reward_event(reward_id,status) VALUES($1,'COMPLETED')", [reward.id]);
  return true;
}

export async function rejectReferralReward(client: DatabaseClient, orderId: string, reason: string) {
  const result = await client.execute<{ id: string }>(
    "UPDATE referral_reward SET status='REJECTED',status_reason=$2,updated_at=now() WHERE order_id=$1 AND status='PENDING' RETURNING id",
    [orderId, reason],
  );
  if (result.rows[0]) await client.execute("INSERT INTO referral_reward_event(reward_id,status,reason) VALUES($1,'REJECTED',$2)", [result.rows[0].id, reason]);
}

export async function reverseReferralReward(client: DatabaseClient, orderId: string, reason: string, actorId?: string) {
  const result = await client.execute<{ id: string; wallet_lot_id: string | null; reward_fils: string; referrer_account_id: string; status: string }>(
    "SELECT id,wallet_lot_id,reward_fils,referrer_account_id,status FROM referral_reward WHERE order_id=$1 FOR UPDATE",
    [orderId],
  );
  const reward = result.rows[0];
  if (!reward || ["REJECTED", "REVOKED"].includes(reward.status)) return false;
  if (reward.status === "PENDING") {
    await rejectReferralReward(client, orderId, reason);
    return true;
  }
  if (!reward.wallet_lot_id) throw new Error("REFERRAL_WALLET_LOT_MISSING");
  const lot = await client.execute<{ available_fils: string }>("SELECT available_fils FROM wallet_lot WHERE id=$1 FOR UPDATE", [reward.wallet_lot_id]);
  const recoverable = Number(lot.rows[0].available_fils) >= Number(reward.reward_fils);
  if (recoverable) {
    await client.execute("UPDATE wallet_lot SET available_fils=available_fils-$2 WHERE id=$1", [reward.wallet_lot_id, Number(reward.reward_fils)]);
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,order_id,direction,kind,amount_fils,source_type,source_id,operation_key,reason,actor_id)
       VALUES($1,$2,$3,'DEBIT','REVERSAL',$4,'REFERRAL',$5,$6,$7,$8)`,
      [reward.referrer_account_id, reward.wallet_lot_id, orderId, Number(reward.reward_fils), reward.id,
        `wallet:referral-reversal:${reward.id}`, reason, actorId ?? null],
    );
  } else {
    await client.execute("UPDATE wallet_lot SET disputed=true WHERE id=$1", [reward.wallet_lot_id]);
  }
  await client.execute(
    "UPDATE referral_reward SET status='REVOKED',recovery_required=$2,status_reason=$3,updated_at=now() WHERE id=$1",
    [reward.id, !recoverable, reason],
  );
  await client.execute("INSERT INTO referral_reward_event(reward_id,status,reason,actor_id) VALUES($1,'REVOKED',$2,$3)", [reward.id, reason, actorId ?? null]);
  return true;
}

export async function getReferralSummary(accountId: string) {
  await ensureReferralCode(accountId);
  return withDatabaseClient(async (client) => {
    const code = (await client.execute<{ code: string }>("SELECT code FROM referral_code WHERE account_id=$1 AND active", [accountId])).rows[0];
    const counts = (await client.execute<{ pending: number; completed: number; rejected: number; earnings: string }>(
      `SELECT count(*) FILTER (WHERE status IN('PENDING','QUALIFIED'))::int AS pending,
              count(*) FILTER (WHERE status='COMPLETED')::int AS completed,
              count(*) FILTER (WHERE status IN('REJECTED','REVOKED'))::int AS rejected,
              COALESCE(sum(reward_fils) FILTER (WHERE status='COMPLETED'),0)::text AS earnings
       FROM referral_reward WHERE referrer_account_id=$1`,
      [accountId],
    )).rows[0];
    const history = (await client.execute(
      "SELECT id,status,reward_fils::text,created_at,completed_at,status_reason FROM referral_reward WHERE referrer_account_id=$1 ORDER BY created_at DESC LIMIT 100",
      [accountId],
    )).rows;
    return { code: code.code, sharePath: `/?ref=${code.code}`, ...counts, earningsFils: Number(counts.earnings), history };
  });
}

export async function customizeReferralCode(accountId: string, requestedCode: string) {
  const code = requestedCode.trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) throw new Error("REFERRAL_CODE_INVALID");
  return withTransaction(async (client) => {
    const account = await client.execute<{ email_verified_at: string | null; phone_verified_at: string | null }>(
      "SELECT email_verified_at,phone_verified_at FROM account WHERE id=$1 FOR UPDATE",
      [accountId],
    );
    if (!account.rows[0]?.email_verified_at || !account.rows[0].phone_verified_at) throw new Error("VERIFICATION_REQUIRED");
    await client.execute("UPDATE referral_code SET active=false,disabled_at=now(),disable_reason='CUSTOMIZED' WHERE account_id=$1 AND active", [accountId]);
    return (await client.execute<{ id: string; code: string }>(
      "INSERT INTO referral_code(account_id,code,custom) VALUES($1,$2,true) RETURNING id,code",
      [accountId, code],
    )).rows[0];
  });
}

export async function listReferralOperations(search?: string) {
  return withDatabaseClient(async (client) => {
    const parameter = search?.trim() || null;
    const codes = await client.execute(
      `SELECT code.id,code.code,code.active,code.custom,account.public_id AS owner_public_id,
              count(reward.id)::int AS reward_count,
              COALESCE(sum(reward.reward_fils) FILTER (WHERE reward.status='COMPLETED'),0)::text AS completed_fils
       FROM referral_code AS code JOIN account ON account.id=code.account_id
       LEFT JOIN referral_reward AS reward ON reward.referrer_account_id=code.account_id
       WHERE $1::text IS NULL OR code.code ILIKE '%' || $1 || '%' OR account.public_id ILIKE '%' || $1 || '%'
       GROUP BY code.id,account.public_id ORDER BY code.created_at DESC LIMIT 200`,
      [parameter],
    );
    const rewards = await client.execute(
      `SELECT reward.id,reward.status,reward.reward_fils::text,reward.recovery_required,reward.status_reason,
              referrer.public_id AS referrer_public_id,orders.public_id AS order_public_id
       FROM referral_reward AS reward
       JOIN account AS referrer ON referrer.id=reward.referrer_account_id
       JOIN shop_order AS orders ON orders.id=reward.order_id
       WHERE $1::text IS NULL OR referrer.public_id ILIKE '%' || $1 || '%' OR orders.public_id ILIKE '%' || $1 || '%'
       ORDER BY reward.created_at DESC LIMIT 200`,
      [parameter],
    );
    return { codes: codes.rows, rewards: rewards.rows };
  });
}

export async function invalidateReferralReward(actorId: string, rewardId: string, reason: string) {
  if (!reason.trim()) throw new Error("REASON_REQUIRED");
  return withTransaction(async (client) => {
    const reward = await client.execute<{ order_id: string }>("SELECT order_id FROM referral_reward WHERE id=$1 FOR UPDATE", [rewardId]);
    if (!reward.rows[0]) throw new Error("REFERRAL_REWARD_NOT_FOUND");
    const changed = await reverseReferralReward(client, reward.rows[0].order_id, reason.trim(), actorId);
    const state = await client.execute<{ recovery_required: boolean }>("SELECT recovery_required FROM referral_reward WHERE id=$1", [rewardId]);
    return { invalidated: changed, recoveryRequired: state.rows[0].recovery_required };
  });
}

export async function disableReferralCode(actorId: string, codeId: string, reason: string) {
  if (!reason.trim()) throw new Error("REASON_REQUIRED");
  return withTransaction(async (client) => {
    const result = await client.execute(
      "UPDATE referral_code SET active=false,disabled_at=now(),disabled_by=$2,disable_reason=$3 WHERE id=$1 AND active",
      [codeId, actorId, reason.trim()],
    );
    if (!result.rowCount) throw new Error("REFERRAL_CODE_NOT_ACTIVE");
    await client.execute(
      "UPDATE referral_attribution SET status='REVOKED',status_reason=$2 WHERE code_id=$1 AND status='ATTRIBUTED'",
      [codeId, reason.trim()],
    );
    return { disabled: true };
  });
}
