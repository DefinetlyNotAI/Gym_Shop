import { cookies } from "next/headers";
import { randomToken, hashToken } from "@/lib/security/crypto";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";

const COOKIE_NAME = "gym_shop_session";
const CUSTOMER_SESSION_SECONDS = 60 * 60 * 24 * 14;

export type CurrentAccount = {
  id: string;
  publicId: string;
  email: string;
  displayName: string;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phone?: string | null;
  role: string;
  sessionId: string;
  authenticatedAt: Date;
  sessionKind: "NORMAL" | "EMERGENCY";
};

export async function createSession(accountId: string, metadata?: { userAgent?: string }): Promise<string> {
  const token = randomToken();
  await withDatabaseClient((client) => client.query(
    `INSERT INTO account_session(account_id, token_hash, expires_at, user_agent)
     SELECT $1,$2,now()+CASE WHEN EXISTS(SELECT 1 FROM staff_account WHERE account_id=$1) THEN interval '12 hours' ELSE ($3 * interval '1 second') END,$4`,
    [accountId, hashToken(token), CUSTOMER_SESSION_SECONDS, metadata?.userAgent?.slice(0, 500) ?? null],
  ).then(() => undefined));
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CUSTOMER_SESSION_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await withDatabaseClient((client) => client.query(
      "UPDATE account_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
      [hashToken(token)],
    ).then(() => undefined));
  }
  jar.delete(COOKIE_NAME);
}

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string; public_id: string; email_normalized: string; display_name: string; status: string;
      email_verified_at: Date | null; phone_verified_at: Date | null; phone_e164:string|null; role_id: string | null;
      session_id: string; authenticated_at: Date; session_kind:"NORMAL"|"EMERGENCY";
    }>(
      `SELECT account.id, account.public_id, account.email_normalized, account.display_name,
              account.status, account.email_verified_at, account.phone_verified_at,account.phone_e164,
              staff.role_id, session.id AS session_id, session.authenticated_at, session.kind AS session_kind
       FROM account_session AS session
       JOIN account ON account.id = session.account_id
       LEFT JOIN staff_account AS staff ON staff.account_id = account.id
       WHERE session.token_hash = $1 AND session.revoked_at IS NULL AND session.expires_at > now()
         AND (staff.account_id IS NULL OR (staff.status='ACTIVE' AND session.last_seen_at > now()-interval '30 minutes'))
       FOR UPDATE OF session`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row || ["LOCKED", "DISABLED", "DELETED"].includes(row.status)) return null;
    await client.query("UPDATE account_session SET last_seen_at = now() WHERE id = $1", [row.session_id]);
    return {
      id: row.id, publicId: row.public_id, email: row.email_normalized, displayName: row.display_name,
      status: row.status, emailVerified: Boolean(row.email_verified_at), phoneVerified: Boolean(row.phone_verified_at),phone:row.phone_e164,
      role: row.role_id ?? "CUSTOMER", sessionId: row.session_id, authenticatedAt: row.authenticated_at,
      sessionKind: row.session_kind,
    };
  });
}
