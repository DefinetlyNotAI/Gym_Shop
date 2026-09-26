import { z } from "zod";
import type { DatabaseClient } from "@/lib/db/client";
import { withDatabaseClient } from "@/lib/db/client";
import {
  executePayoutProvider,
  getPayoutProviderStatus,
} from "./provider";

const payoutInput = z
  .object({
    destinationId: z.string().uuid().optional(),
    destinationAlias: z.string().trim().min(4).max(80).optional(),
    amountFils: z.number().int().positive(),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .refine((input) => Boolean(input.destinationId || input.destinationAlias), {
    message: "PAYOUT_DESTINATION_REQUIRED",
  });

const payoutDecisionInput = z.object({
  decision: z.enum(["APPROVE", "REJECT", "CANCEL"]),
  reason: z.string().trim().min(3).max(2_000),
});

const payoutExecutionInput = z.object({
  simulationOutcome: z.enum(["COMPLETED", "FAILED", "UNKNOWN"]),
});

type PayoutRow = {
  id: string;
  public_id: string;
  account_id: string;
  destination_id: string;
  amount_fils: string;
  status: string;
  provider_reference: string | null;
  alias_masked: string;
};

function publicPayout(payout: PayoutRow) {
  return {
    publicId: payout.public_id,
    amountFils: Number(payout.amount_fils),
    status: payout.status,
    providerReference: payout.provider_reference,
  };
}

async function loadPayoutForUpdate(client: DatabaseClient, publicId: string) {
  const result = await client.execute<PayoutRow>(
    `SELECT payout.id,payout.public_id,payout.account_id,payout.destination_id,
            payout.amount_fils::text,payout.status,payout.provider_reference,
            destination.alias_masked
     FROM wallet_payout AS payout
     JOIN payout_destination AS destination ON destination.id=payout.destination_id
     WHERE payout.public_id=$1 FOR UPDATE OF payout`,
    [publicId],
  );
  if (!result.rows[0]) throw new Error("PAYOUT_NOT_FOUND");
  return result.rows[0];
}

async function releasePayoutAllocations(
  client: DatabaseClient,
  payout: PayoutRow,
  actorId: string,
  reason: string,
) {
  const allocations = await client.execute<{
    lot_id: string;
    amount_fils: string;
  }>(
    "SELECT lot_id,amount_fils::text FROM wallet_payout_allocation WHERE payout_id=$1 ORDER BY lot_id",
    [payout.id],
  );
  for (const allocation of allocations.rows) {
    const amount = Number(allocation.amount_fils);
    const updated = await client.execute(
      `UPDATE wallet_lot
       SET held_fils=held_fils-$2,available_fils=available_fils+$2
       WHERE id=$1 AND held_fils>=$2`,
      [allocation.lot_id, amount],
    );
    if (!updated.rowCount) throw new Error("WALLET_LOT_INVARIANT");
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,direction,kind,amount_fils,source_type,source_id,operation_key,reason,actor_id)
       VALUES($1,$2,'CREDIT','RELEASE',$3,'PAYOUT',$4,$5,$6,$7)
       ON CONFLICT(operation_key) DO NOTHING`,
      [
        payout.account_id,
        allocation.lot_id,
        amount,
        payout.id,
        `payout:release:${payout.id}:${allocation.lot_id}`,
        reason,
        actorId,
      ],
    );
  }
}

async function capturePayoutAllocations(
  client: DatabaseClient,
  payout: PayoutRow,
  actorId: string,
) {
  const allocations = await client.execute<{
    lot_id: string;
    amount_fils: string;
  }>(
    "SELECT lot_id,amount_fils::text FROM wallet_payout_allocation WHERE payout_id=$1 ORDER BY lot_id",
    [payout.id],
  );
  for (const allocation of allocations.rows) {
    const amount = Number(allocation.amount_fils);
    const updated = await client.execute(
      "UPDATE wallet_lot SET held_fils=held_fils-$2 WHERE id=$1 AND held_fils>=$2",
      [allocation.lot_id, amount],
    );
    if (!updated.rowCount) throw new Error("WALLET_LOT_INVARIANT");
    await client.execute(
      `INSERT INTO wallet_ledger(account_id,lot_id,direction,kind,amount_fils,source_type,source_id,operation_key,actor_id)
       VALUES($1,$2,'DEBIT','PAYOUT',$3,'PAYOUT',$4,$5,$6)
       ON CONFLICT(operation_key) DO NOTHING`,
      [
        payout.account_id,
        allocation.lot_id,
        amount,
        payout.id,
        `payout:capture:${payout.id}:${allocation.lot_id}`,
        actorId,
      ],
    );
  }
}

export async function getPayoutAvailability(accountId: string) {
  return withDatabaseClient(async (client) => {
    const result = await client.execute<{
      verified: boolean;
      available: string;
    }>(
      `SELECT EXISTS(
         SELECT 1 FROM verification_application WHERE account_id=$1 AND status='APPROVED'
       ) AS verified,
       COALESCE((SELECT sum(available_fils) FROM wallet_lot
                 WHERE account_id=$1 AND settled AND NOT disputed),0)::text AS available`,
      [accountId],
    );
    const verified = result.rows[0].verified;
    const history = await client.execute(
      `SELECT payout.public_id,payout.amount_fils::text,payout.status,payout.requested_at,payout.completed_at,
              payout.provider_reference,destination.alias_masked
       FROM wallet_payout AS payout JOIN payout_destination AS destination ON destination.id=payout.destination_id
       WHERE payout.account_id=$1 ORDER BY payout.requested_at DESC LIMIT 100`,
      [accountId],
    );
    const provider = getPayoutProviderStatus();
    return {
      verified,
      withdrawableFils: verified ? Number(result.rows[0].available) : 0,
      minimumFils: null,
      providerAvailable: provider.available,
      provider,
      history: history.rows,
    };
  });
}

export async function requestPayout(accountId: string, raw: unknown) {
  const input = payoutInput.parse(raw);
  const provider = getPayoutProviderStatus();
  if (!provider.available) throw new Error(provider.code);
  if (provider.mode === "SIMULATION" && !input.destinationAlias) {
    throw new Error("PAYOUT_SIMULATION_DESTINATION_REQUIRED");
  }

  return withDatabaseClient(async (client) => {
    await client.execute("BEGIN");
    try {
      await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [
        accountId,
      ]);
      const replay = await client.execute<PayoutRow>(
        `SELECT payout.id,payout.public_id,payout.account_id,payout.destination_id,
                payout.amount_fils::text,payout.status,payout.provider_reference,
                destination.alias_masked
         FROM wallet_payout AS payout
         JOIN payout_destination AS destination ON destination.id=payout.destination_id
         WHERE payout.account_id=$1 AND payout.idempotency_key=$2`,
        [accountId, input.idempotencyKey],
      );
      if (replay.rows[0]) {
        await client.execute("COMMIT");
        return publicPayout(replay.rows[0]);
      }
      const eligible = await client.execute<{ eligible: boolean }>(
        `SELECT EXISTS(
           SELECT 1 FROM verification_application
           WHERE account_id=$1 AND status='APPROVED'
         ) AND EXISTS(
           SELECT 1 FROM account_session
           WHERE account_id=$1 AND revoked_at IS NULL AND expires_at>now()
             AND authenticated_at>=now()-interval '15 minutes'
         ) AS eligible`,
        [accountId],
      );
      if (!eligible.rows[0]?.eligible) {
        throw new Error("PAYOUT_VERIFICATION_OR_RECENT_AUTH_REQUIRED");
      }

      let destinationId = input.destinationId;
      if (provider.mode === "SIMULATION") {
        const destination = await client.execute<{ id: string }>(
          `INSERT INTO payout_destination(account_id,alias_masked,ownership_verified,cooldown_until)
           VALUES($1,$2,true,now())
           ON CONFLICT(account_id,alias_masked) DO UPDATE
             SET active=true,ownership_verified=true,cooldown_until=now(),changed_at=now()
           RETURNING id`,
          [accountId, input.destinationAlias],
        );
        destinationId = destination.rows[0].id;
      }
      const destination = await client.execute<{ id: string }>(
        `SELECT id FROM payout_destination
         WHERE id=$1 AND account_id=$2 AND active AND ownership_verified AND cooldown_until<=now()`,
        [destinationId, accountId],
      );
      if (!destination.rows[0]) throw new Error("PAYOUT_DESTINATION_UNAVAILABLE");

      const lots = await client.execute<{
        id: string;
        available_fils: string;
      }>(
        `SELECT id,available_fils::text FROM wallet_lot
         WHERE account_id=$1 AND settled AND NOT disputed AND available_fils>0
         ORDER BY created_at,id FOR UPDATE`,
        [accountId],
      );
      const total = lots.rows.reduce(
        (sum, lot) => sum + Number(lot.available_fils),
        0,
      );
      if (total < input.amountFils) throw new Error("WALLET_BALANCE_INSUFFICIENT");

      const payout = await client.execute<{
        id: string;
        public_id: string;
      }>(
        `INSERT INTO wallet_payout(account_id,destination_id,amount_fils,status,idempotency_key)
         VALUES($1,$2,$3,'REQUESTED',$4) RETURNING id,public_id`,
        [accountId, destinationId, input.amountFils, input.idempotencyKey],
      );
      await client.execute(
        `INSERT INTO wallet_payout_transition(payout_id,from_status,to_status,reason,provider_evidence)
         VALUES($1,NULL,'REQUESTED','Customer requested simulated payout',$2::jsonb)`,
        [
          payout.rows[0].id,
          JSON.stringify({ providerMode: provider.mode }),
        ],
      );
      let remaining = input.amountFils;
      for (const lot of lots.rows) {
        if (!remaining) break;
        const amount = Math.min(remaining, Number(lot.available_fils));
        await client.execute(
          "UPDATE wallet_lot SET available_fils=available_fils-$2,held_fils=held_fils+$2 WHERE id=$1",
          [lot.id, amount],
        );
        await client.execute(
          "INSERT INTO wallet_payout_allocation(payout_id,lot_id,amount_fils) VALUES($1,$2,$3)",
          [payout.rows[0].id, lot.id, amount],
        );
        await client.execute(
          `INSERT INTO wallet_ledger(account_id,lot_id,direction,kind,amount_fils,source_type,source_id,operation_key)
           VALUES($1,$2,'DEBIT','HOLD',$3,'PAYOUT',$4,$5)`,
          [
            accountId,
            lot.id,
            amount,
            payout.rows[0].id,
            `payout:hold:${payout.rows[0].id}:${lot.id}`,
          ],
        );
        remaining -= amount;
      }
      await client.execute("COMMIT");
      return {
        publicId: payout.rows[0].public_id,
        amountFils: input.amountFils,
        status: "REQUESTED",
        providerReference: null,
      };
    } catch (error) {
      await client.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function listPayoutOperations(status?: string) {
  return withDatabaseClient(async (client) => {
    const filter = status?.trim() || null;
    const payouts = await client.execute(
      `SELECT payout.public_id,payout.amount_fils::text,payout.status,payout.requested_at,payout.completed_at,
              payout.provider_reference,account.public_id AS account_public_id,destination.alias_masked
       FROM wallet_payout AS payout
       JOIN account ON account.id=payout.account_id
       JOIN payout_destination AS destination ON destination.id=payout.destination_id
       WHERE $1::text IS NULL OR payout.status=$1
       ORDER BY CASE payout.status WHEN 'UNKNOWN' THEN 0 WHEN 'UNDER_REVIEW' THEN 1 WHEN 'REQUESTED' THEN 2 ELSE 3 END,payout.requested_at ASC
       LIMIT 200`,
      [filter],
    );
    return { payouts: payouts.rows, provider: getPayoutProviderStatus() };
  });
}

export async function decidePayout(
  actorId: string,
  publicId: string,
  raw: unknown,
) {
  const input = payoutDecisionInput.parse(raw);
  return withDatabaseClient(async (client) => {
    await client.execute("BEGIN");
    try {
      const payout = await loadPayoutForUpdate(client, publicId);
      if (payout.account_id === actorId) {
        throw new Error("PAYOUT_SELF_REVIEW_DENIED");
      }
      if (!["REQUESTED", "UNDER_REVIEW"].includes(payout.status)) {
        throw new Error("PAYOUT_NOT_REVIEWABLE");
      }
      const nextStatus =
        input.decision === "APPROVE"
          ? "APPROVED"
          : input.decision === "REJECT"
            ? "REJECTED"
            : "CANCELLED";
      if (nextStatus !== "APPROVED") {
        await releasePayoutAllocations(client, payout, actorId, input.reason);
      }
      await client.execute(
        "UPDATE wallet_payout SET status=$2,reviewed_by=$3,updated_at=now() WHERE id=$1",
        [payout.id, nextStatus, actorId],
      );
      await client.execute(
        "INSERT INTO wallet_payout_transition(payout_id,from_status,to_status,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
        [payout.id, payout.status, nextStatus, input.reason, actorId],
      );
      await client.execute("COMMIT");
      return { publicId, status: nextStatus };
    } catch (error) {
      await client.execute("ROLLBACK");
      throw error;
    }
  });
}

export async function executePayout(
  actorId: string,
  publicId: string,
  raw: unknown,
) {
  const input = payoutExecutionInput.parse(raw);
  const provider = getPayoutProviderStatus();
  if (!provider.available || provider.mode !== "SIMULATION") {
    throw new Error("PAYOUT_PROVIDER_UNAVAILABLE");
  }
  return withDatabaseClient(async (client) => {
    await client.execute("BEGIN");
    try {
      const payout = await loadPayoutForUpdate(client, publicId);
      if (payout.account_id === actorId) {
        throw new Error("PAYOUT_SELF_EXECUTION_DENIED");
      }
      if (!["APPROVED", "UNKNOWN"].includes(payout.status)) {
        throw new Error("PAYOUT_NOT_EXECUTABLE");
      }
      await client.execute(
        "UPDATE wallet_payout SET status='PROCESSING',executed_by=$2,updated_at=now() WHERE id=$1",
        [payout.id, actorId],
      );
      await client.execute(
        `INSERT INTO wallet_payout_transition(payout_id,from_status,to_status,reason,actor_id)
         VALUES($1,$2,'PROCESSING','Simulation execution started',$3)`,
        [payout.id, payout.status, actorId],
      );
      const result = await executePayoutProvider({
        publicId: payout.public_id,
        amountFils: Number(payout.amount_fils),
        destinationAlias: payout.alias_masked,
        simulationOutcome: input.simulationOutcome,
      });
      if (result.status === "COMPLETED") {
        await capturePayoutAllocations(client, payout, actorId);
      } else if (result.status === "FAILED") {
        await releasePayoutAllocations(
          client,
          payout,
          actorId,
          "Simulated provider failure",
        );
      }
      await client.execute(
        `UPDATE wallet_payout
         SET status=$2,provider_reference=$3,completed_at=CASE WHEN $2='COMPLETED' THEN now() ELSE NULL END,updated_at=now()
         WHERE id=$1`,
        [payout.id, result.status, result.reference],
      );
      await client.execute(
        `INSERT INTO wallet_payout_transition(payout_id,from_status,to_status,reason,actor_id,provider_evidence)
         VALUES($1,'PROCESSING',$2,'Simulation provider result',$3,$4::jsonb)`,
        [payout.id, result.status, actorId, JSON.stringify(result.evidence)],
      );
      await client.execute("COMMIT");
      return {
        publicId,
        status: result.status,
        providerReference: result.reference,
      };
    } catch (error) {
      await client.execute("ROLLBACK");
      throw error;
    }
  });
}
