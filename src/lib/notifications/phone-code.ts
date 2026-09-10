import { randomInt } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { getRuntimeConfig } from "@/lib/config/env";
import { appendDomainEvent } from "@/lib/events/outbox";
import { storeOutboundSecret } from "@/lib/notifications/secrets";
import { hashToken } from "@/lib/security/crypto";

export async function queuePhoneVerificationCode(client: PoolClient, input: {
  requestId: string;
  accountId: string;
  phone: string;
}) {
  const code = String(randomInt(100000, 1000000));
  const token = await client.query<{ id: string }>(
    "INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'PHONE_VERIFY',$2,now()+interval '5 minutes') RETURNING id",
    [input.accountId, hashToken(code)],
  );
  const local = ["local", "test"].includes(getRuntimeConfig().APP_ENV);
  await client.query(
    "UPDATE phone_verification_request SET token_id=$2,status=$3,expires_at=now()+interval '5 minutes' WHERE id=$1",
    [input.requestId, token.rows[0].id, local ? "SENT" : "QUEUED"],
  );
  const eventId = await appendDomainEvent(client, {
    eventType: "identity.phone.verification_requested.v1",
    aggregateType: "phone_verification_request",
    aggregateId: input.requestId,
    payload: { accountId: input.accountId, channel: "WHATSAPP" },
  });
  await storeOutboundSecret(client, eventId, { destination: input.phone, token: code }, new Date(Date.now() + 5 * 60 * 1000));
  return { developmentCode: local ? code : undefined };
}
