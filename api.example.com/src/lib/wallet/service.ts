import type { DatabaseClient } from "@/lib/db/client";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";

const POINT_MILLI_PER_BLOCK = 100_000;
const WALLET_FILS_PER_BLOCK = 1_000;
const WEEKLY_BLOCK_LIMIT = 5;

type ConversionInput = { blocks: number; idempotencyKey: string };

function assertPositiveInteger(value: number, code: string) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
}

export async function availableWalletFils(client: DatabaseClient, accountId: string) {
  const result = await client.execute<{ available: string }>(
    "SELECT COALESCE(sum(available_fils),0)::text AS available FROM wallet_lot WHERE account_id=$1 AND settled AND NOT disputed",
    [accountId],
  );
  return Number(result.rows[0].available);
}

async function currentAmmanWeek(client: DatabaseClient) {
  const result = await client.execute<{ week_start: string | Date }>(
    "SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Amman')::date AS week_start",
  );
  return String(result.rows[0].week_start).slice(0, 10);
}

export async function getWalletSummary(accountId: string) {
  return withDatabaseClient(async (client) => {
    const [points, wallet, lifetime, history, weekStart, used] = await Promise.all([
      client.execute<{ balance: string; earned: string; spent: string }>(
        `SELECT COALESCE(sum(CASE WHEN direction='CREDIT' THEN milli_points ELSE -milli_points END),0)::text AS balance,
                COALESCE(sum(milli_points) FILTER (WHERE direction='CREDIT'),0)::text AS earned,
                COALESCE(sum(milli_points) FILTER (WHERE direction='DEBIT'),0)::text AS spent
         FROM point_ledger WHERE account_id=$1`,
        [accountId],
      ),
      client.execute<{ available: string; held: string; pending: string }>(
        `SELECT COALESCE(sum(available_fils) FILTER (WHERE settled AND NOT disputed),0)::text AS available,
                COALESCE(sum(held_fils),0)::text AS held,
                COALESCE(sum(available_fils) FILTER (WHERE NOT settled AND NOT disputed),0)::text AS pending
         FROM wallet_lot WHERE account_id=$1`,
        [accountId],
      ),
      client.execute<{ earned: string; spent: string; paid_out: string }>(
        `SELECT COALESCE(sum(amount_fils) FILTER (WHERE kind IN('CREDIT','REVERSAL') AND direction='CREDIT'),0)::text AS earned,
                COALESCE(sum(amount_fils) FILTER (WHERE kind='DEBIT' AND direction='DEBIT'),0)::text AS spent,
                COALESCE(sum(amount_fils) FILTER (WHERE kind='PAYOUT' AND direction='DEBIT'),0)::text AS paid_out
         FROM wallet_ledger WHERE account_id=$1`,
        [accountId],
      ),
      client.execute(
        `SELECT 'WALLET' AS ledger,kind,direction,amount_fils::text AS amount,source_type,source_id,created_at
         FROM wallet_ledger WHERE account_id=$1
         UNION ALL
         SELECT 'POINTS',kind,direction,milli_points::text,source_type,source_id,created_at
         FROM point_ledger WHERE account_id=$1
         ORDER BY created_at DESC LIMIT 100`,
        [accountId],
      ),
      currentAmmanWeek(client),
      client.execute<{ blocks: number }>(
        `SELECT COALESCE(sum(blocks),0)::int AS blocks FROM point_conversion
         WHERE account_id=$1 AND week_start=date_trunc('week', now() AT TIME ZONE 'Asia/Amman')::date`,
        [accountId],
      ),
    ]);
    return {
      pointMilliBalance: Number(points.rows[0].balance),
      pointMilliLifetimeEarned: Number(points.rows[0].earned),
      pointMilliLifetimeSpent: Number(points.rows[0].spent),
      walletAvailableFils: Number(wallet.rows[0].available),
      walletHeldFils: Number(wallet.rows[0].held),
      walletPendingFils: Number(wallet.rows[0].pending),
      walletLifetimeEarnedFils: Number(lifetime.rows[0].earned),
      walletLifetimeSpentFils: Number(lifetime.rows[0].spent),
      walletLifetimePaidOutFils: Number(lifetime.rows[0].paid_out),
      conversionWeekStart: weekStart,
      weeklyBlocksRemaining: WEEKLY_BLOCK_LIMIT - used.rows[0].blocks,
      expires: false,
      history: history.rows,
    };
  });
}

export async function convertPoints(accountId: string, input: ConversionInput) {
  assertPositiveInteger(input.blocks, "POINT_CONVERSION_BLOCKS_INVALID");
  if (input.blocks > WEEKLY_BLOCK_LIMIT) throw new Error("POINT_CONVERSION_WEEKLY_LIMIT");
  if (input.idempotencyKey.length < 16 || input.idempotencyKey.length > 100) {
    throw new Error("IDEMPOTENCY_KEY_INVALID");
  }
  const requestHash = JSON.stringify({ accountId, blocks: input.blocks });
  return withTransaction(async (client) => {
    const replay = await client.execute<{
      id: string; blocks: number; point_milli_debit: string; wallet_fils_credit: string; week_start: string | Date; request_hash: string;
    }>("SELECT id,blocks,point_milli_debit,wallet_fils_credit,week_start,request_hash FROM point_conversion WHERE operation_key=$1", [input.idempotencyKey]);
    if (replay.rows[0]) {
      if (replay.rows[0].request_hash !== requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
      const used = await client.execute<{ blocks: number }>(
        "SELECT COALESCE(sum(blocks),0)::int AS blocks FROM point_conversion WHERE account_id=$1 AND week_start=$2",
        [accountId, replay.rows[0].week_start],
      );
      return {
        conversionId: replay.rows[0].id,
        blocks: replay.rows[0].blocks,
        pointsDebited: Number(replay.rows[0].point_milli_debit) / 1_000,
        walletFilsCredited: Number(replay.rows[0].wallet_fils_credit),
        weekStart: String(replay.rows[0].week_start).slice(0, 10),
        weeklyBlocksRemaining: WEEKLY_BLOCK_LIMIT - used.rows[0].blocks,
      };
    }
    const account = await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [accountId]);
    if (!account.rowCount) throw new Error("ACCOUNT_NOT_FOUND");
    const weekStart = await currentAmmanWeek(client);
    const used = await client.execute<{ blocks: number }>(
      "SELECT COALESCE(sum(blocks),0)::int AS blocks FROM point_conversion WHERE account_id=$1 AND week_start=$2",
      [accountId, weekStart],
    );
    if (used.rows[0].blocks + input.blocks > WEEKLY_BLOCK_LIMIT) throw new Error("POINT_CONVERSION_WEEKLY_LIMIT");
    const balance = await client.execute<{ balance: string }>(
      "SELECT COALESCE(sum(CASE WHEN direction='CREDIT' THEN milli_points ELSE -milli_points END),0)::text AS balance FROM point_ledger WHERE account_id=$1",
      [accountId],
    );
    const pointMilliDebit = input.blocks * POINT_MILLI_PER_BLOCK;
    if (Number(balance.rows[0].balance) < pointMilliDebit) throw new Error("POINT_BALANCE_INSUFFICIENT");
    const walletFilsCredit = input.blocks * WALLET_FILS_PER_BLOCK;
    const conversion = await client.execute<{ id: string }>(
      `INSERT INTO point_conversion(account_id,week_start,blocks,point_milli_debit,wallet_fils_credit,operation_key,request_hash)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [accountId, weekStart, input.blocks, pointMilliDebit, walletFilsCredit, input.idempotencyKey, requestHash],
    );
    await client.execute(
      `INSERT INTO point_ledger(account_id,direction,kind,milli_points,source_type,source_id,operation_key)
       VALUES($1,'DEBIT','DEBIT',$2,'POINT_CONVERSION',$3,$4)`,
      [accountId, pointMilliDebit, conversion.rows[0].id, `point:${input.idempotencyKey}`],
    );
    const lot = await client.execute<{ id: string }>(
      `INSERT INTO wallet_lot(account_id,source_type,source_id,original_fils,available_fils)
       VALUES($1,'POINT_CONVERSION',$2,$3,$3) RETURNING id`,
      [accountId, conversion.rows[0].id, walletFilsCredit],
    );
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,direction,kind,amount_fils,source_type,source_id,operation_key)
       VALUES($1,$2,'CREDIT','CREDIT',$3,'POINT_CONVERSION',$4,$5)`,
      [accountId, lot.rows[0].id, walletFilsCredit, conversion.rows[0].id, `wallet:${input.idempotencyKey}`],
    );
    return {
      conversionId: conversion.rows[0].id,
      blocks: input.blocks,
      pointsDebited: pointMilliDebit / 1_000,
      walletFilsCredited: walletFilsCredit,
      weekStart,
      weeklyBlocksRemaining: WEEKLY_BLOCK_LIMIT - used.rows[0].blocks - input.blocks,
    };
  });
}

export async function creditWalletLot(client: DatabaseClient, input: {
  accountId: string; amountFils: number; sourceType: string; sourceId: string; operationKey: string; settled?: boolean;
}) {
  assertPositiveInteger(input.amountFils, "WALLET_AMOUNT_INVALID");
  const existing = await client.execute<{ id: string }>("SELECT id FROM wallet_lot WHERE source_type=$1 AND source_id=$2", [input.sourceType, input.sourceId]);
  if (existing.rows[0]) return existing.rows[0].id;
  const lot = await client.execute<{ id: string }>(
    `INSERT INTO wallet_lot(account_id,source_type,source_id,original_fils,available_fils,settled)
     VALUES($1,$2,$3,$4,$4,$5) RETURNING id`,
    [input.accountId, input.sourceType, input.sourceId, input.amountFils, input.settled ?? true],
  );
  await client.execute(
    `INSERT INTO wallet_ledger(account_id,lot_id,direction,kind,amount_fils,source_type,source_id,operation_key)
     VALUES($1,$2,'CREDIT','CREDIT',$3,$4,$5,$6)`,
    [input.accountId, lot.rows[0].id, input.amountFils, input.sourceType, input.sourceId, input.operationKey],
  );
  return lot.rows[0].id;
}

export async function creditPoints(client: DatabaseClient, input: {
  accountId: string; milliPoints: number; sourceType: string; sourceId: string; operationKey: string;
}) {
  assertPositiveInteger(input.milliPoints, "POINT_AMOUNT_INVALID");
  return client.execute(
    `INSERT INTO point_ledger(account_id,direction,kind,milli_points,source_type,source_id,operation_key)
     VALUES($1,'CREDIT','CREDIT',$2,$3,$4,$5) ON CONFLICT(operation_key) DO NOTHING`,
    [input.accountId, input.milliPoints, input.sourceType, input.sourceId, input.operationKey],
  );
}

export async function holdWalletTender(client: DatabaseClient, input: { accountId: string; orderId: string; amountFils: number }) {
  assertPositiveInteger(input.amountFils, "WALLET_AMOUNT_INVALID");
  await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [input.accountId]);
  const existing = await client.execute<{ id: string; amount_fils: string; status: string }>(
    "SELECT id,amount_fils,status FROM wallet_hold WHERE order_id=$1",
    [input.orderId],
  );
  if (existing.rows[0]) {
    if (Number(existing.rows[0].amount_fils) !== input.amountFils) throw new Error("WALLET_HOLD_CONFLICT");
    return { holdId: existing.rows[0].id, amountFils: input.amountFils, status: existing.rows[0].status };
  }
  const lots = await client.execute<{ id: string; available_fils: string }>(
    `SELECT id,available_fils FROM wallet_lot
     WHERE account_id=$1 AND settled AND NOT disputed AND available_fils>0
     ORDER BY created_at,id FOR UPDATE`,
    [input.accountId],
  );
  if (lots.rows.reduce((sum, lot) => sum + Number(lot.available_fils), 0) < input.amountFils) {
    throw new Error("WALLET_BALANCE_INSUFFICIENT");
  }
  const hold = await client.execute<{ id: string }>(
    "INSERT INTO wallet_hold(account_id,order_id,amount_fils,status) VALUES($1,$2,$3,'HELD') RETURNING id",
    [input.accountId, input.orderId, input.amountFils],
  );
  let remaining = input.amountFils;
  for (const lot of lots.rows) {
    if (!remaining) break;
    const amount = Math.min(remaining, Number(lot.available_fils));
    await client.execute("UPDATE wallet_lot SET available_fils=available_fils-$2,held_fils=held_fils+$2 WHERE id=$1", [lot.id, amount]);
    await client.execute("INSERT INTO wallet_hold_allocation(hold_id,lot_id,amount_fils) VALUES($1,$2,$3)", [hold.rows[0].id, lot.id, amount]);
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,order_id,direction,kind,amount_fils,source_type,source_id,operation_key)
       VALUES($1,$2,$3,'DEBIT','HOLD',$4,'ORDER',$3,$5)`,
      [input.accountId, lot.id, input.orderId, amount, `wallet:hold:${input.orderId}:${lot.id}`],
    );
    remaining -= amount;
  }
  return { holdId: hold.rows[0].id, amountFils: input.amountFils, status: "HELD" };
}

export async function captureWalletHold(client: DatabaseClient, orderId: string) {
  const hold = await client.execute<{ id: string; account_id: string; status: string }>(
    "SELECT id,account_id,status FROM wallet_hold WHERE order_id=$1 FOR UPDATE",
    [orderId],
  );
  if (!hold.rows[0] || hold.rows[0].status === "CAPTURED") return;
  if (hold.rows[0].status !== "HELD") throw new Error("WALLET_HOLD_NOT_CAPTURABLE");
  const allocations = await client.execute<{ lot_id: string; amount_fils: string }>(
    "SELECT lot_id,amount_fils FROM wallet_hold_allocation WHERE hold_id=$1 ORDER BY lot_id",
    [hold.rows[0].id],
  );
  for (const allocation of allocations.rows) {
    const amount = Number(allocation.amount_fils);
    const updated = await client.execute("UPDATE wallet_lot SET held_fils=held_fils-$2 WHERE id=$1 AND held_fils>=$2", [allocation.lot_id, amount]);
    if (!updated.rowCount) throw new Error("WALLET_LOT_INVARIANT");
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,order_id,direction,kind,amount_fils,source_type,source_id,operation_key)
       VALUES($1,$2,$3,'DEBIT','DEBIT',$4,'ORDER',$3,$5)`,
      [hold.rows[0].account_id, allocation.lot_id, orderId, amount, `wallet:capture:${orderId}:${allocation.lot_id}`],
    );
  }
  await client.execute("UPDATE wallet_hold SET status='CAPTURED',captured_at=now() WHERE id=$1", [hold.rows[0].id]);
}

export async function releaseWalletHold(client: DatabaseClient, orderId: string) {
  const hold = await client.execute<{ id: string; account_id: string; status: string }>(
    "SELECT id,account_id,status FROM wallet_hold WHERE order_id=$1 FOR UPDATE",
    [orderId],
  );
  if (!hold.rows[0] || ["RELEASED", "RESTORED"].includes(hold.rows[0].status)) return;
  const allocations = await client.execute<{ lot_id: string; amount_fils: string }>(
    "SELECT lot_id,amount_fils FROM wallet_hold_allocation WHERE hold_id=$1 ORDER BY lot_id",
    [hold.rows[0].id],
  );
  for (const allocation of allocations.rows) {
    const amount = Number(allocation.amount_fils);
    if (hold.rows[0].status === "HELD") {
      const updated = await client.execute("UPDATE wallet_lot SET held_fils=held_fils-$2,available_fils=available_fils+$2 WHERE id=$1 AND held_fils>=$2", [allocation.lot_id, amount]);
      if (!updated.rowCount) throw new Error("WALLET_LOT_INVARIANT");
    } else if (hold.rows[0].status === "CAPTURED") {
      await client.execute("UPDATE wallet_lot SET available_fils=available_fils+$2 WHERE id=$1", [allocation.lot_id, amount]);
    }
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,order_id,direction,kind,amount_fils,source_type,source_id,operation_key)
       VALUES($1,$2,$3,'CREDIT',$4,$5,'ORDER',$3,$6)`,
      [hold.rows[0].account_id, allocation.lot_id, orderId, hold.rows[0].status === "HELD" ? "RELEASE" : "REVERSAL", amount,
        `wallet:${hold.rows[0].status === "HELD" ? "release" : "restore"}:${orderId}:${allocation.lot_id}`],
    );
  }
  await client.execute(
    "UPDATE wallet_hold SET status=$2,released_at=now() WHERE id=$1",
    [hold.rows[0].id, hold.rows[0].status === "HELD" ? "RELEASED" : "RESTORED"],
  );
}

export async function awardDeliveryPoints(client: DatabaseClient, orderId: string) {
  const result = await client.execute<{
    account_id: string; status: string; fulfillment_status: string; payment_method: string; payment_status: string;
    external_due_fils: string; collected_fils: string; wallet_tender_fils: string; merchandise_fils: string; discount_fils: string;
    replacement: boolean; wallet_captured: boolean;
  }>(
    `SELECT orders.account_id,orders.status,orders.fulfillment_status,orders.payment_method,orders.payment_status,
            orders.external_due_fils,orders.collected_fils,orders.wallet_tender_fils,orders.merchandise_fils,orders.discount_fils,
            EXISTS(SELECT 1 FROM damage_claim WHERE replacement_order_id=orders.id) AS replacement,
            EXISTS(SELECT 1 FROM wallet_hold WHERE order_id=orders.id AND status='CAPTURED') AS wallet_captured
     FROM shop_order AS orders WHERE orders.id=$1 FOR UPDATE`,
    [orderId],
  );
  const order = result.rows[0];
  if (!order || order.status !== "COMPLETED" || order.fulfillment_status !== "DELIVERED" || order.replacement) return false;
  const externalCollected = Number(order.external_due_fils) === Number(order.collected_fils) && order.payment_status === "PAID";
  const walletCollected = Number(order.wallet_tender_fils) === 0 || order.wallet_captured;
  if (!externalCollected || !walletCollected) return false;
  const milliPoints = Number(order.merchandise_fils) - Number(order.discount_fils);
  if (milliPoints <= 0) return false;
  const inserted = await creditPoints(client, {
    accountId: order.account_id,
    milliPoints,
    sourceType: "PURCHASE",
    sourceId: orderId,
    operationKey: `points:purchase:${orderId}`,
  });
  return inserted.rowCount > 0;
}
