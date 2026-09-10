import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient } from "@/lib/db/client";
import { requireTrustedMutation } from "@/lib/security/request";

const updateInput = z.union([z.object({ all: z.literal(true) }), z.object({ id: z.string().uuid() })]);

export async function GET(request: Request) {
  try {
    const account = requireCustomer(await getCurrentAccount());
    const cursor = new URL(request.url).searchParams.get("before");
    if (cursor && Number.isNaN(Date.parse(cursor))) throw new Error("CURSOR_INVALID");
    const result = await withDatabaseClient(async (client) => {
      const [rows, unread] = await Promise.all([
        client.query(`SELECT notification.id,notification.category,notification.entity_type,notification.entity_id,notification.read_at,notification.created_at,event.event_type FROM notification JOIN domain_event_outbox AS event ON event.id=notification.event_id WHERE notification.recipient_id=$1 AND notification.channel='IN_SITE' AND ($2::timestamptz IS NULL OR notification.created_at<$2) ORDER BY notification.created_at DESC LIMIT 26`, [account.id, cursor]),
        client.query<{ count: string }>("SELECT count(*) AS count FROM notification WHERE recipient_id=$1 AND channel='IN_SITE' AND read_at IS NULL", [account.id]),
      ]);
      const hasMore = rows.rows.length > 25;
      const notifications = rows.rows.slice(0, 25);
      return { notifications, unreadCount: Number(unread.rows[0].count), nextCursor: hasMore ? notifications.at(-1)?.created_at : null };
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(401, { code: error instanceof Error ? error.message : "AUTH_REQUIRED", message: "Notifications are unavailable." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const input = updateInput.parse(await request.json());
    await withDatabaseClient((client) => client.query("all" in input ? "UPDATE notification SET read_at=COALESCE(read_at,now()),updated_at=now() WHERE recipient_id=$1 AND channel='IN_SITE'" : "UPDATE notification SET read_at=COALESCE(read_at,now()),updated_at=now() WHERE recipient_id=$1 AND id=$2 AND channel='IN_SITE'", "all" in input ? [account.id] : [account.id, input.id]).then(() => undefined));
    return apiSuccess({ read: true });
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "NOTIFICATION_UPDATE_FAILED", message: "Notification state could not be updated." });
  }
}
