import { withTransaction } from "@/lib/db/client";
import type { ClaimedEvent } from "@/lib/events/outbox";
import { PermanentNotificationError, sendOutboundMessage } from "@/lib/notifications/provider";
import { decryptOutboundSecret } from "@/lib/notifications/secrets";

type Channel = "EMAIL" | "WHATSAPP";
type Delivery = { id: string; eventId: string; aggregateType: string; aggregateId: string; channel: Channel; category: string; destination: string; subject?: string; body: string; attemptCount: number };

const eventChannels: Record<string, Channel> = {
  "identity.account.registered.v1": "EMAIL",
  "identity.password.reset_requested.v1": "EMAIL",
  "identity.email.change_requested.v1": "EMAIL",
  "identity.phone.verification_requested.v1": "WHATSAPP",
  "security.cto.recovery_email_otp.v1": "EMAIL",
  "security.cto.recovery_phone_otp.v1": "WHATSAPP",
  "security.cto.setup_contact.v1": "EMAIL",
  "security.cto.emergency_contact.v1": "EMAIL",
  "security.cto.recovery_warning.v1": "EMAIL",
  "orders.order.created.v1": "EMAIL",
  "orders.order.cancelled.v1": "EMAIL",
  "payments.card.confirmed.v1": "EMAIL",
  "delivery.order.dispatched.v1": "EMAIL",
  "delivery.order.delivered.v1": "EMAIL",
  "delivery.third_attempt_quote.v1": "EMAIL",
  "delivery.customer_pin.v1": "WHATSAPP",
  "support.ticket.replied.v1": "EMAIL",
  "privacy.account.deletion_requested.v1": "EMAIL",
  "privacy.account.deletion_reminder.v1": "EMAIL",
  "privacy.account.deletion_finalized.v1": "EMAIL",
};

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_match, key: string) => variables[key] ?? "");
}

async function prepare(event: ClaimedEvent): Promise<Delivery[]> {
  return withTransaction(async (client) => {
    let accountId = typeof event.payload.accountId === "string" ? event.payload.accountId : null;
    if (!accountId && typeof event.payload.orderId === "string") {
      accountId = (await client.query<{ account_id: string }>("SELECT account_id FROM shop_order WHERE id=$1", [event.payload.orderId])).rows[0]?.account_id ?? null;
    }
    if (!accountId && typeof event.payload.ticketId === "string") {
      accountId = (await client.query<{ account_id: string }>("SELECT account_id FROM support_ticket WHERE id=$1", [event.payload.ticketId])).rows[0]?.account_id ?? null;
    }
    if (!accountId) return [];

    const category = event.event_type.split(".")[0];
    await client.query(
      `INSERT INTO notification(event_id,recipient_id,channel,category,entity_type,entity_id,status,delivered_at)
       VALUES($1,$2,'IN_SITE',$3,$4,$5,'DELIVERED',now())
       ON CONFLICT(event_id,recipient_id,channel) DO NOTHING`,
      [event.id, accountId, category, event.aggregate_type, event.aggregate_id],
    );

    let channel = eventChannels[event.event_type];
    const encrypted = await client.query<{ ciphertext: string }>(
      "SELECT ciphertext FROM outbound_secret WHERE event_id=$1 AND consumed_at IS NULL AND expires_at>now() FOR UPDATE",
      [event.id],
    );
    const secret = encrypted.rows[0] ? decryptOutboundSecret(encrypted.rows[0].ciphertext) : undefined;
    if ((event.event_type === "security.cto.setup_contact.v1" || event.event_type === "security.cto.emergency_contact.v1") && event.payload.channel === "PHONE") channel = "WHATSAPP";
    if (!channel) return [];

    const account = await client.query<{ email_normalized: string; phone_e164: string | null; status:string }>(
      "SELECT email_normalized,phone_e164,status FROM account WHERE id=$1",
      [accountId],
    );
    const destination = secret?.destination ?? (channel === "EMAIL" ? account.rows[0]?.email_normalized : account.rows[0]?.phone_e164);
    if (!destination) throw new Error("NOTIFICATION_DESTINATION_MISSING");

    const template = await client.query<{ id: string; subject: string | null; body: string }>(
      `SELECT id,subject,body FROM notification_template
       WHERE event_type=$1 AND channel=$2 AND language='en' AND enabled
       ORDER BY version DESC LIMIT 1`,
      [event.event_type, channel],
    );
    const selected = template.rows[0];
    if (!selected) return [];

    if(category==="marketing"){
      const preference=await client.query<{enabled:boolean}>("SELECT enabled FROM notification_preference WHERE account_id=$1 AND category=$2 AND channel=$3",[accountId,category,channel]);
      const consent=channel==="EMAIL"?await client.query<{granted:boolean}>("SELECT granted FROM consent_event WHERE account_id=$1 AND purpose='MARKETING_EMAIL' ORDER BY occurred_at DESC LIMIT 1",[accountId]):null;
      const allowed=account.rows[0]?.status==="ACTIVE"&&preference.rows[0]?.enabled!==false&&(channel!=="EMAIL"||consent?.rows[0]?.granted===true);
      if(!allowed){
        const suppressed=await client.query<{id:string}>(`INSERT INTO notification(event_id,recipient_id,channel,category,entity_type,entity_id,template_id,status,permanent_failure,failure_code) VALUES($1,$2,$3,$4,$5,$6,$7,'SUPPRESSED',true,'PREFERENCE_OR_STATUS') ON CONFLICT(event_id,recipient_id,channel) DO UPDATE SET updated_at=notification.updated_at RETURNING id`,[event.id,accountId,channel,category,event.aggregate_type,event.aggregate_id,selected.id]);
        await client.query("INSERT INTO notification_attempt(notification_id,attempt_number,result,failure_code) VALUES($1,1,'SUPPRESSED','PREFERENCE_OR_STATUS') ON CONFLICT DO NOTHING",[suppressed.rows[0].id]);
        return[];
      }
    }

    const variables: Record<string, string> = {
      entityReference: event.aggregate_id,
      dueAt: typeof event.payload.dueAt === "string" ? event.payload.dueAt : "",
      placeholder: typeof event.payload.placeholder === "string" ? event.payload.placeholder : "",
      redeliveryFeeJod: typeof event.payload.redeliveryFeeFils === "number" ? (event.payload.redeliveryFeeFils/1000).toFixed(3) : "",
      pinPurpose: event.payload.purpose === "PICKUP" ? "pickup" : "delivery",
      code: secret?.token ?? "",
      actionUrl: secret?.actionUrl ?? "",
    };
    const subject = selected.subject ? interpolate(selected.subject, variables) : undefined;
    const body = interpolate(selected.body, variables);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO notification(event_id,recipient_id,channel,category,entity_type,entity_id,template_id,status,subject_snapshot,body_snapshot)
       VALUES($1,$2,$3,$4,$5,$6,$7,'QUEUED',$8,$9)
       ON CONFLICT(event_id,recipient_id,channel) DO UPDATE SET updated_at=notification.updated_at
       RETURNING id`,
      [event.id, accountId, channel, category, event.aggregate_type, event.aggregate_id, selected.id, subject ?? null, secret ? selected.body : body],
    );
    const pending = await client.query<{ attempt_count: number; status: string; permanent_failure: boolean }>(
      "SELECT attempt_count,status,permanent_failure FROM notification WHERE id=$1 FOR UPDATE",
      [inserted.rows[0].id],
    );
    if (!["QUEUED", "FAILED"].includes(pending.rows[0].status) || pending.rows[0].permanent_failure) return [];
    return [{ id: inserted.rows[0].id, eventId: event.id, aggregateType: event.aggregate_type, aggregateId: event.aggregate_id, channel, category, destination, subject, body, attemptCount: pending.rows[0].attempt_count }];
  });
}

async function recordResult(
  delivery: Delivery,
  result: "SENT" | "DELIVERED" | "TRANSIENT_FAILURE" | "PERMANENT_FAILURE",
  providerMessageId?: string,
  failureCode?: string,
): Promise<void> {
  await withTransaction(async (client) => {
    const attempt = delivery.attemptCount + 1;
    await client.query(
      `INSERT INTO notification_attempt(notification_id,attempt_number,result,provider_message_id,failure_code)
       VALUES($1,$2,$3,$4,$5) ON CONFLICT(notification_id,attempt_number) DO NOTHING`,
      [delivery.id, attempt, result, providerMessageId ?? null, failureCode ?? null],
    );
    await client.query(
      `UPDATE notification SET attempt_count=GREATEST(attempt_count,$2),status=$3,
       provider_message_id=COALESCE($4,provider_message_id),failure_code=$5,permanent_failure=$6,
       sent_at=CASE WHEN $3 IN ('SENT','DELIVERED') THEN COALESCE(sent_at,now()) ELSE sent_at END,
       delivered_at=CASE WHEN $3='DELIVERED' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,
       next_attempt_at=now()+(LEAST(3600,power(2,$2)) * interval '1 second'),updated_at=now()
       WHERE id=$1`,
      [delivery.id, attempt, result === "TRANSIENT_FAILURE" || result === "PERMANENT_FAILURE" ? "FAILED" : result, providerMessageId ?? null, failureCode ?? null, result === "PERMANENT_FAILURE"],
    );
    if (result !== "TRANSIENT_FAILURE") await client.query("DELETE FROM outbound_secret WHERE event_id=$1", [delivery.eventId]);
    if ((result === "SENT" || result === "DELIVERED") && delivery.aggregateType === "phone_verification_request") {
      await client.query("UPDATE phone_verification_request SET status='SENT' WHERE id=$1 AND status='QUEUED'", [delivery.aggregateId]);
    }
    if (result === "PERMANENT_FAILURE" && delivery.aggregateType === "phone_verification_request") await client.query("UPDATE phone_verification_request SET status='FAILED' WHERE id=$1",[delivery.aggregateId]);
  });
}

export async function dispatchNotificationEvent(event: ClaimedEvent): Promise<void> {
  for (const delivery of await prepare(event)) {
    try {
      const result = await sendOutboundMessage({
        idempotencyKey: delivery.id,
        channel: delivery.channel,
        to: delivery.destination,
        subject: delivery.subject,
        body: delivery.body,
        category: delivery.category,
      });
      await recordResult(delivery, result.status, result.messageId);
    } catch (error) {
      const permanent = error instanceof PermanentNotificationError || delivery.attemptCount >= 4;
      const reason = error instanceof Error ? error.message.slice(0, 120) : "PROVIDER_FAILURE";
      await recordResult(delivery, permanent ? "PERMANENT_FAILURE" : "TRANSIENT_FAILURE", undefined, reason);
      if (!permanent) throw error;
    }
  }
}
