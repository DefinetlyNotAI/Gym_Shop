import { randomUUID, timingSafeEqual } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getRuntimeConfig } from "@/lib/config/env";
import { claimEvents, markDelivered, markFailed, type ClaimedEvent } from "@/lib/events/outbox";
import { finalizeDueDeletions, purgeClosedAttachments, purgeExpiredDeliveryProofs, queueDeletionReminders } from "@/lib/support/service";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatcher";
import { reconcileExpiredCardOrders } from "@/lib/commerce/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 50;

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function dispatch(event: ClaimedEvent): Promise<void> {
  await dispatchNotificationEvent(event);
}

export async function GET(request: Request) {
  const config = getRuntimeConfig();
  if (!authorized(request, config.CRON_SECRET)) {
    return apiError(401, { code: "UNAUTHORIZED", message: "Authentication is required." });
  }

  const workerId = randomUUID();
  const events = await claimEvents(workerId, config.OUTBOX_BATCH_SIZE);
  const retention = {
    expiredCardOrders: await reconcileExpiredCardOrders(),
    deletionReminders: await queueDeletionReminders(),
    deletions: await finalizeDueDeletions(),
    attachments: await purgeClosedAttachments(),
    deliveryProofs: await purgeExpiredDeliveryProofs(),
  };
  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await dispatch(event);
      await markDelivered(event.id, workerId);
      delivered += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "UNKNOWN_EVENT_FAILURE";
      await markFailed(event.id, workerId, event.attempt_count, reason);
      failed += 1;
    }
  }

  return apiSuccess({ claimed: events.length, delivered, failed, retention });
}
