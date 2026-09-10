import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { appendAudit } from "@/lib/audit/service";
import { getRuntimeConfig } from "@/lib/config/env";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendDomainEvent } from "@/lib/events/outbox";
import { storeOutboundSecret } from "@/lib/notifications/secrets";
import { hashToken, normalizeEmail, randomToken } from "@/lib/security/crypto";

const passwordSchema = z.string().min(12).max(1024);
const argonOptions = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const token = randomToken();
  await withTransaction(async (client) => {
    const account = await client.query<{ id: string }>(
      "SELECT id FROM account WHERE email_normalized=$1 AND status NOT IN('DISABLED','DELETED')",
      [email],
    );
    if (!account.rows[0]) return;
    await client.query(
      "UPDATE auth_token SET superseded_at=now() WHERE account_id=$1 AND purpose='PASSWORD_RESET' AND consumed_at IS NULL",
      [account.rows[0].id],
    );
    await client.query(
      "INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'PASSWORD_RESET',$2,now()+interval '30 minutes')",
      [account.rows[0].id, hashToken(token)],
    );
    const eventId = await appendDomainEvent(client, {
      eventType: "identity.password.reset_requested.v1",
      aggregateType: "account",
      aggregateId: account.rows[0].id,
      payload: { accountId: account.rows[0].id },
    });
    const actionUrl = new URL("/account", getRuntimeConfig().STOREFRONT_ORIGIN);
    actionUrl.searchParams.set("resetToken", token);
    await storeOutboundSecret(client, eventId, { destination: email, token, actionUrl: actionUrl.toString() }, new Date(Date.now() + 30 * 60 * 1000));
  });
  return { accepted: true, developmentToken: process.env.APP_ENV === "production" ? undefined : token };
}

export async function completePasswordReset(token: string, nextPassword: string) {
  const passwordHash = await hash(passwordSchema.parse(nextPassword), argonOptions);
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string; account_id: string }>(
      "SELECT id,account_id FROM auth_token WHERE purpose='PASSWORD_RESET' AND verifier_hash=$1 AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at>now() FOR UPDATE",
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row) throw new Error("RESET_TOKEN_INVALID");
    await client.query("UPDATE auth_token SET consumed_at=now() WHERE id=$1", [row.id]);
    await client.query("UPDATE account SET password_hash=$2,password_changed_at=now(),updated_at=now() WHERE id=$1", [row.account_id, passwordHash]);
    await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL", [row.account_id]);
    await appendAudit(client, { actorId: row.account_id, action: "account.password.reset", targetType: "account", targetId: row.account_id, domain: "identity", sensitive: true });
    await appendDomainEvent(client, { eventType: "identity.password.changed.v1", aggregateType: "account", aggregateId: row.account_id, payload: { accountId: row.account_id } });
    return { changed: true };
  });
}

export async function changePassword(accountId: string, sessionId: string, currentPassword: string, nextPassword: string) {
  const nextHash = await hash(passwordSchema.parse(nextPassword), argonOptions);
  return withTransaction(async (client) => {
    const account = await client.query<{ password_hash: string }>("SELECT password_hash FROM account WHERE id=$1 FOR UPDATE", [accountId]);
    if (!account.rows[0] || !(await verify(account.rows[0].password_hash, currentPassword))) throw new Error("INVALID_CREDENTIALS");
    await client.query("UPDATE account SET password_hash=$2,password_changed_at=now(),updated_at=now() WHERE id=$1", [accountId, nextHash]);
    await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND id<>$2 AND revoked_at IS NULL", [accountId, sessionId]);
    await appendAudit(client, { actorId: accountId, action: "account.password.changed", targetType: "account", targetId: accountId, domain: "identity", sensitive: true });
    await appendDomainEvent(client, { eventType: "identity.password.changed.v1", aggregateType: "account", aggregateId: accountId, payload: { accountId } });
    return { changed: true, otherSessionsRevoked: true };
  });
}

export async function requestEmailChange(accountId: string, currentPassword: string, emailInput: string) {
  const email = normalizeEmail(emailInput);
  const token = randomToken();
  return withTransaction(async (client) => {
    const account = await client.query<{ password_hash: string }>("SELECT password_hash FROM account WHERE id=$1 FOR UPDATE", [accountId]);
    if (!account.rows[0] || !(await verify(account.rows[0].password_hash, currentPassword))) throw new Error("INVALID_CREDENTIALS");
    await client.query("UPDATE account SET pending_email_normalized=$2 WHERE id=$1", [accountId, email]);
    await client.query("UPDATE auth_token SET superseded_at=now() WHERE account_id=$1 AND purpose='EMAIL_CHANGE' AND consumed_at IS NULL", [accountId]);
    await client.query("INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'EMAIL_CHANGE',$2,now()+interval '30 minutes')", [accountId, hashToken(token)]);
    const eventId = await appendDomainEvent(client, { eventType: "identity.email.change_requested.v1", aggregateType: "account", aggregateId: accountId, payload: { accountId } });
    const actionUrl = new URL("/account/settings", getRuntimeConfig().STOREFRONT_ORIGIN);
    actionUrl.searchParams.set("emailChangeToken", token);
    await storeOutboundSecret(client, eventId, { destination: email, token, actionUrl: actionUrl.toString() }, new Date(Date.now() + 30 * 60 * 1000));
    return { pending: true, developmentToken: process.env.APP_ENV === "production" ? undefined : token };
  });
}

export async function confirmEmailChange(token: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ id: string; account_id: string; pending_email_normalized: string }>(
      "SELECT auth_token.id,account.id AS account_id,account.pending_email_normalized FROM auth_token JOIN account ON account.id=auth_token.account_id WHERE auth_token.purpose='EMAIL_CHANGE' AND auth_token.verifier_hash=$1 AND auth_token.consumed_at IS NULL AND auth_token.superseded_at IS NULL AND auth_token.expires_at>now() FOR UPDATE OF auth_token,account",
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row?.pending_email_normalized) throw new Error("TOKEN_INVALID");
    await client.query("UPDATE account SET email_normalized=pending_email_normalized,pending_email_normalized=NULL,email_verified_at=now(),updated_at=now() WHERE id=$1", [row.account_id]);
    await client.query("UPDATE auth_token SET consumed_at=now() WHERE id=$1", [row.id]);
    await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL", [row.account_id]);
    await appendAudit(client, { actorId: row.account_id, action: "account.email.changed", targetType: "account", targetId: row.account_id, domain: "identity", sensitive: true });
    return { changed: true, loginRequired: true };
  });
}

export async function listSessions(accountId: string) {
  return withDatabaseClient(async (client) => (await client.query(
    "SELECT id,user_agent,created_at,last_seen_at,authenticated_at,expires_at FROM account_session WHERE account_id=$1 AND revoked_at IS NULL AND expires_at>now() ORDER BY last_seen_at DESC",
    [accountId],
  )).rows);
}

export async function revokeSessions(accountId: string, currentSessionId: string, scope: "CURRENT" | "OTHER" | "ALL", sessionId?: string) {
  return withDatabaseClient(async (client) => {
    const result = scope === "ALL"
      ? await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL", [accountId])
      : scope === "OTHER"
        ? await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND id<>$2 AND revoked_at IS NULL", [accountId, currentSessionId])
        : await client.query("UPDATE account_session SET revoked_at=now() WHERE account_id=$1 AND id=$2 AND revoked_at IS NULL", [accountId, sessionId ?? currentSessionId]);
    return { revoked: result.rowCount ?? 0 };
  });
}
