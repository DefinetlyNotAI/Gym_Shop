import { createHash } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/api/response";
import { applyCardPaymentStatus } from "@/lib/commerce/orders";
import { withDatabaseClient } from "@/lib/db/client";
import { verifyProviderWebhook } from "@/lib/payments/provider";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const event = verifyProviderWebhook(rawBody);
    const provider = "AMAZON_PAYMENT_SERVICES";
    const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const recorded = await withDatabaseClient(async (client) => {
      const inserted = await client.query(
        `INSERT INTO payment_provider_event(provider,provider_event_id,provider_reference,event_type,payload_hash)
         VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider,provider_event_id) DO NOTHING`,
        [provider, event.eventId, event.reference, event.eventType, payloadHash],
      );
      if (inserted.rowCount) return "NEW" as const;
      const prior = await client.query<{ provider_reference: string; payload_hash: string; processed_at: Date | null }>(
        "SELECT provider_reference,payload_hash,processed_at FROM payment_provider_event WHERE provider=$1 AND provider_event_id=$2",
        [provider, event.eventId],
      );
      if (prior.rows[0]?.provider_reference !== event.reference || prior.rows[0]?.payload_hash !== payloadHash) throw new Error("WEBHOOK_REPLAY_MISMATCH");
      return prior.rows[0].processed_at ? "PROCESSED" as const : "RETRY" as const;
    });
    if (recorded === "PROCESSED") return apiSuccess({ accepted: true, replayed: true });
    const outcome = await applyCardPaymentStatus(event);
    await withDatabaseClient((client) => client.query(
      "UPDATE payment_provider_event SET processed_at=now(),outcome=$3 WHERE provider=$1 AND provider_event_id=$2 AND processed_at IS NULL",
      [provider, event.eventId, JSON.stringify(outcome)],
    ).then(() => undefined));
    return apiSuccess({ accepted: true, replayed: recorded === "RETRY" });
  } catch {
    return apiError(400, { code: "WEBHOOK_REJECTED", message: "The payment event could not be accepted." });
  }
}
