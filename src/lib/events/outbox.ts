import type { PoolClient } from "@neondatabase/serverless";
import { withTransaction } from "@/lib/db/client";

export type DomainEventInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
};

export type ClaimedEvent = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

export async function appendDomainEvent(client: PoolClient, event: DomainEventInput): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO domain_event_outbox
      (event_type, aggregate_type, aggregate_id, payload, available_at)
     VALUES ($1, $2, $3, $4::jsonb, COALESCE($5, now()))
     RETURNING id`,
    [event.eventType, event.aggregateType, event.aggregateId, JSON.stringify(event.payload), event.availableAt ?? null],
  );
  return result.rows[0].id;
}

export async function claimEvents(workerId: string, batchSize: number): Promise<ClaimedEvent[]> {
  return withTransaction(async (client) => {
    const result = await client.query<ClaimedEvent>(
      `WITH candidates AS (
         SELECT id
         FROM domain_event_outbox
         WHERE delivered_at IS NULL
           AND dead_at IS NULL
           AND available_at <= now()
           AND (lease_until IS NULL OR lease_until < now())
         ORDER BY occurred_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE domain_event_outbox AS event
       SET lease_owner = $2,
           lease_until = now() + interval '60 seconds',
           attempt_count = attempt_count + 1,
           last_attempt_at = now()
       FROM candidates
       WHERE event.id = candidates.id
       RETURNING event.id, event.event_type, event.aggregate_type,
                 event.aggregate_id, event.payload, event.attempt_count`,
      [batchSize, workerId],
    );
    return result.rows;
  });
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(3600, 2 ** Math.min(Math.max(attempt, 1), 12));
}

export async function markDelivered(eventId: string, workerId: string): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE domain_event_outbox
       SET delivered_at = now(), lease_owner = NULL, lease_until = NULL
       WHERE id = $1 AND lease_owner = $2 AND delivered_at IS NULL`,
      [eventId, workerId],
    );
    if (result.rowCount !== 1) throw new Error("OUTBOX_LEASE_LOST");
  });
}

export async function markFailed(
  eventId: string,
  workerId: string,
  attempt: number,
  safeReason: string,
): Promise<void> {
  const dead = attempt >= 12;
  const delay = retryDelaySeconds(attempt);
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE domain_event_outbox
       SET last_error = left($3, 500),
           available_at = now() + ($4 * interval '1 second'),
           dead_at = CASE WHEN $5 THEN now() ELSE NULL END,
           lease_owner = NULL,
           lease_until = NULL
       WHERE id = $1 AND lease_owner = $2 AND delivered_at IS NULL`,
      [eventId, workerId, safeReason, delay, dead],
    );
    if (result.rowCount !== 1) throw new Error("OUTBOX_LEASE_LOST");
  });
}
