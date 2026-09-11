import { z } from "zod";
import { withDatabaseClient } from "@/lib/db/client";
import { getPayoutProviderStatus } from "./provider";

const payoutInput = z.object({
  destinationId: z.string().uuid(),
  amountFils: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function getPayoutAvailability(accountId: string) {
  return withDatabaseClient(async (client) => {
    const result = await client.execute<{ verified: boolean; available: string }>(
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
              destination.alias_masked
       FROM wallet_payout AS payout JOIN payout_destination AS destination ON destination.id=payout.destination_id
       WHERE payout.account_id=$1 ORDER BY payout.requested_at DESC LIMIT 100`,
      [accountId],
    );
    return {
      verified,
      withdrawableFils: verified ? Number(result.rows[0].available) : 0,
      minimumFils: null,
      providerAvailable: false,
      provider: getPayoutProviderStatus(),
      history: history.rows,
    };
  });
}

export async function requestPayout(_accountId: string, raw: unknown) {
  payoutInput.parse(raw);
  const provider = getPayoutProviderStatus();
  if (!provider.available) throw new Error(provider.code);
  throw new Error("PAYOUT_PROVIDER_UNAVAILABLE");
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

const payoutDecisionInput = z.object({
  decision: z.enum(["REJECT", "CANCEL"]),
  reason: z.string().trim().min(3).max(2_000),
});

export async function decidePayout(actorId: string, publicId: string, raw: unknown) {
  const input = payoutDecisionInput.parse(raw);
  return withDatabaseClient(async (client) => {
    await client.execute("BEGIN");
    try {
      const result = await client.execute<{ id: string; account_id: string; status: string; wallet_hold_id: string | null }>(
        "SELECT id,account_id,status,wallet_hold_id FROM wallet_payout WHERE public_id=$1 FOR UPDATE",
        [publicId],
      );
      const payout = result.rows[0];
      if (!payout) throw new Error("PAYOUT_NOT_FOUND");
      if (payout.account_id === actorId) throw new Error("PAYOUT_SELF_REVIEW_DENIED");
      if (!["REQUESTED", "UNDER_REVIEW", "UNKNOWN"].includes(payout.status)) throw new Error("PAYOUT_NOT_REVIEWABLE");
      if (payout.wallet_hold_id) throw new Error("PAYOUT_HOLD_REQUIRES_PROVIDER_RECONCILIATION");
      const nextStatus = input.decision === "REJECT" ? "REJECTED" : "CANCELLED";
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
