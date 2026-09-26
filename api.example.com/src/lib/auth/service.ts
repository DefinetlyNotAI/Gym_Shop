import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/service";
import { appendDomainEvent } from "@/lib/events/outbox";
import { hashToken, normalizeEmail, randomToken } from "@/lib/security/crypto";
import { getRuntimeConfig } from "@/lib/config/env";
import { storeOutboundSecret } from "@/lib/notifications/secrets";

const registrationSchema = z.object({
  email: z.string().email().max(254), displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(1024), termsDocumentId: z.string().uuid(),
  language: z.enum(["ar", "en"]), marketing: z.boolean().default(false),
});

export async function registerAccount(raw: unknown) {
  const input = registrationSchema.parse(raw);
  const email = normalizeEmail(input.email);
  const passwordHash = await hash(input.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const verificationToken = randomToken();
  const account = await withTransaction(async (client) => {
    const terms = await client.execute<{ id: string }>(
      "SELECT id FROM terms_document WHERE id = $1 AND language = $2 AND published_at IS NOT NULL",
      [input.termsDocumentId, input.language],
    );
    if (!terms.rowCount) throw new Error("TERMS_VERSION_INVALID");
    const inserted = await client.execute<{ id: string; public_id: string }>(
      `INSERT INTO account(email_normalized,password_hash,display_name)
       VALUES ($1,$2,$3) RETURNING id, public_id`,
      [email, passwordHash, input.displayName],
    );
    const row = inserted.rows[0];
    await client.execute(
      `INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at)
       VALUES ($1,'EMAIL_VERIFY',$2,now() + interval '30 minutes')`,
      [row.id, hashToken(verificationToken)],
    );
    await client.execute(
      `INSERT INTO consent_event(account_id,purpose,document_id,granted,affirmative_action)
       VALUES ($1,'TERMS',$2,true,'registration_checkbox'),
              ($1,'MARKETING_EMAIL',$2,$3,'registration_checkbox')`,
      [row.id, input.termsDocumentId, input.marketing],
    );
    await appendAudit(client, { actorId: row.id, action: "account.registered", targetType: "account", targetId: row.id, domain: "identity" });
    const eventId = await appendDomainEvent(client, { eventType: "identity.account.registered.v1", aggregateType: "account", aggregateId: row.id, payload: { accountId: row.id } });
    const actionUrl = new URL("/account", getRuntimeConfig().STOREFRONT_ORIGIN);
    actionUrl.searchParams.set("verifyEmail", verificationToken);
    await storeOutboundSecret(client, eventId, { destination: email, token: verificationToken, actionUrl: actionUrl.toString() }, new Date(Date.now() + 30 * 60 * 1000));
    return row;
  });
  return { ...account, developmentVerificationToken: ["local","test"].includes(getRuntimeConfig().APP_ENV) ? verificationToken : undefined };
}

export async function verifyEmailToken(token: string): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.execute<{ id: string; account_id: string }>(
      `SELECT id, account_id FROM auth_token
       WHERE verifier_hash=$1 AND purpose='EMAIL_VERIFY' AND consumed_at IS NULL
         AND superseded_at IS NULL AND expires_at > now() FOR UPDATE`,
      [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row) throw new Error("TOKEN_INVALID");
    await client.execute("UPDATE auth_token SET consumed_at=now() WHERE id=$1", [row.id]);
    await client.execute("UPDATE account SET email_verified_at=now(), status='ACTIVE', updated_at=now() WHERE id=$1", [row.account_id]);
    await appendDomainEvent(client, { eventType: "identity.email.verified.v1", aggregateType: "account", aggregateId: row.account_id, payload: { accountId: row.account_id } });
  });
}

export async function resendEmailVerification(emailInput:string){
  const email=normalizeEmail(emailInput);const verificationToken=randomToken();
  await withTransaction(async client=>{const account=await client.execute<{id:string}>("SELECT id FROM account WHERE email_normalized=$1 AND email_verified_at IS NULL AND status='PENDING_VERIFICATION' FOR UPDATE",[email]);if(!account.rows[0])return;await client.execute("UPDATE auth_token SET superseded_at=now() WHERE account_id=$1 AND purpose='EMAIL_VERIFY' AND consumed_at IS NULL AND superseded_at IS NULL",[account.rows[0].id]);await client.execute("INSERT INTO auth_token(account_id,purpose,verifier_hash,expires_at) VALUES($1,'EMAIL_VERIFY',$2,now()+interval '30 minutes')",[account.rows[0].id,hashToken(verificationToken)]);const eventId=await appendDomainEvent(client,{eventType:"identity.account.registered.v1",aggregateType:"account",aggregateId:account.rows[0].id,payload:{accountId:account.rows[0].id,resend:true}});const actionUrl=new URL("/account",getRuntimeConfig().STOREFRONT_ORIGIN);actionUrl.searchParams.set("verifyEmail",verificationToken);await storeOutboundSecret(client,eventId,{destination:email,token:verificationToken,actionUrl:actionUrl.toString()},new Date(Date.now()+30*60*1000));});
  return{accepted:true,developmentToken:["local","test"].includes(getRuntimeConfig().APP_ENV)?verificationToken:undefined};
}

export async function authenticate(emailInput: string, password: string, audience: "CUSTOMER" | "STAFF") {
  const email = normalizeEmail(emailInput);
  const result = await withDatabaseClient((client) => client.execute<{ id: string; password_hash: string; status: string; role_id:string|null; staff_status:string|null }>(
    "SELECT account.id,account.password_hash,account.status,staff_account.role_id,staff_account.status AS staff_status FROM account LEFT JOIN staff_account ON staff_account.account_id=account.id WHERE account.email_normalized=$1", [email],
  ));
  const row = result.rows[0];
  if (!row || !(await verify(row.password_hash, password)) || ["DISABLED", "DELETED", "LOCKED"].includes(row.status) || (row.staff_status!==null&&row.staff_status!=="ACTIVE")) {
    throw new Error("INVALID_CREDENTIALS");
  }
  if ((audience === "STAFF") !== Boolean(row.role_id)) throw new Error("INVALID_CREDENTIALS");
  if(row.role_id){const credentials=await withDatabaseClient(async client=>(await client.execute<{id:string}>("SELECT id FROM webauthn_credential WHERE account_id=$1",[row.id])).rows);if(!credentials.length)throw new Error('MFA_ENROLLMENT_REQUIRED');const config=getRuntimeConfig();const options=await generateAuthenticationOptions({rpID:config.WEBAUTHN_RP_ID,userVerification:'required',allowCredentials:credentials.map(item=>({id:item.id}))});const pendingToken=randomToken();await withDatabaseClient(async client=>{const challenge=await client.execute<{id:string}>("INSERT INTO webauthn_challenge(account_id,ceremony,challenge,expires_at) VALUES($1,'AUTHENTICATION',$2,now()+interval '5 minutes') RETURNING id",[row.id,options.challenge]);await client.execute("INSERT INTO pending_login(account_id,token_hash,challenge_id,expires_at) VALUES($1,$2,$3,now()+interval '5 minutes')",[row.id,hashToken(pendingToken),challenge.rows[0].id]);});return{mfaRequired:true as const,pendingToken,options};}
  await withDatabaseClient((client) => client.execute("UPDATE account SET last_login_at=now() WHERE id=$1", [row.id]).then(() => undefined));
  return { mfaRequired:false as const,accountId: row.id };
}

export async function completeStaffMfa(pendingToken:string,response:AuthenticationResponseJSON){const config=getRuntimeConfig();return withTransaction(async client=>{const pending=await client.execute<{id:string;account_id:string;challenge_id:string;challenge:string}>(`SELECT pending.id,pending.account_id,pending.challenge_id,challenge.challenge FROM pending_login AS pending JOIN webauthn_challenge AS challenge ON challenge.id=pending.challenge_id WHERE pending.token_hash=$1 AND pending.consumed_at IS NULL AND pending.expires_at>now() AND challenge.consumed_at IS NULL FOR UPDATE OF pending,challenge`,[hashToken(pendingToken)]);const row=pending.rows[0];if(!row)throw new Error('MFA_CHALLENGE_INVALID');const credentialResult=await client.execute<{id:string;public_key:Uint8Array;counter:number;transports:string[]}>("SELECT id,public_key,counter,transports FROM webauthn_credential WHERE account_id=$1 AND id=$2 FOR UPDATE",[row.account_id,response.id]);const credential=credentialResult.rows[0];if(!credential)throw new Error('MFA_CHALLENGE_INVALID');const transports=z.array(z.enum(['ble','hybrid','internal','nfc','usb'])).parse(credential.transports);const verified=await verifyAuthenticationResponse({response,expectedChallenge:row.challenge,expectedOrigin:config.ADMIN_ORIGIN,expectedRPID:config.WEBAUTHN_RP_ID,credential:{id:credential.id,publicKey:Uint8Array.from(credential.public_key),counter:credential.counter,transports},requireUserVerification:true});if(!verified.verified)throw new Error('MFA_CHALLENGE_INVALID');await client.execute("UPDATE pending_login SET consumed_at=now() WHERE id=$1",[row.id]);await client.execute("UPDATE webauthn_challenge SET consumed_at=now() WHERE id=$1",[row.challenge_id]);await client.execute("UPDATE webauthn_credential SET counter=$2,last_used_at=now() WHERE id=$1",[credential.id,verified.authenticationInfo.newCounter]);await client.execute("UPDATE account SET last_login_at=now() WHERE id=$1",[row.account_id]);return{accountId:row.account_id};});}
