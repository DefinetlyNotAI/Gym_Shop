import { randomInt } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import type { PoolClient } from "@neondatabase/serverless";
import { appendAudit } from "@/lib/audit/service";
import { getRuntimeConfig } from "@/lib/config/env";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { queueSecureDelivery } from "@/lib/notifications/secure-delivery";
import { verifyCaptcha } from "@/lib/security/captcha";
import { hashToken, normalizeEmail, randomToken } from "@/lib/security/crypto";

const proofInput=z.object({step:z.enum(["EMAIL_OTP","PASSPHRASE","PHONE_OTP"]),value:z.string().min(1).max(2048)});
const failureColumn={EMAIL_OTP:"email_failure_count",PASSPHRASE:"secret_failure_count",PHONE_OTP:"phone_failure_count",WEBAUTHN:"webauthn_failure_count"} as const;

export async function recordPublicRecoveryAttempt(result:"PENDING"|"FAILED",reason:string){
  await withTransaction(async client=>{await appendAudit(client,{action:"cto.recovery.public_attempt",targetType:"recovery_claim",targetId:randomToken(12),domain:"security",sensitive:true,result,requestContext:{step:"CAPTCHA",reason}});});
}

export async function recordRecoveryFailure(id:string|undefined,step:string){
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))return;
  const column=failureColumn[step as keyof typeof failureColumn];
  await withTransaction(async client=>{
    if(column){
      await client.query(`UPDATE recovery_transaction SET ${column}=${column}+1,failure_count=failure_count+1,aborted_at=CASE WHEN ${column}>=4 OR expires_at<=now() THEN now() ELSE aborted_at END WHERE id=$1`,[id]);
      const channel=step==="EMAIL_OTP"?"EMAIL":step==="PHONE_OTP"?"PHONE":null;
      if(channel)await client.query("UPDATE recovery_otp SET failed_attempts=failed_attempts+1 WHERE id=(SELECT id FROM recovery_otp WHERE recovery_id=$1 AND channel=$2 AND consumed_at IS NULL AND superseded_at IS NULL ORDER BY created_at DESC LIMIT 1)",[id,channel]);
    }
    await appendAudit(client,{action:"cto.recovery.proof_failed",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,result:"FAILED",requestContext:{step}});
  });
}

export async function startRecovery(email:string,captcha:string,browserBinding:string,remoteAddress?:string){
  if(!(await verifyCaptcha(captcha,remoteAddress)))throw new Error("RECOVERY_UNAVAILABLE");
  const account=await withDatabaseClient(async client=>(await client.query<{id:string;email_normalized:string}>("SELECT account.id,account.email_normalized FROM account JOIN staff_account ON staff_account.account_id=account.id AND staff_account.role_id='CTO' WHERE account.email_normalized=$1",[normalizeEmail(email)])).rows[0]);
  if(!account)return{accepted:true,recoveryId:randomToken(18)};
  const code=String(randomInt(100000,1000000));
  const expiresAt=new Date(Date.now()+30*60*1000);
  return withTransaction(async client=>{
    const recovery=await client.query<{id:string}>("INSERT INTO recovery_transaction(account_id,browser_binding_hash,step,expires_at) VALUES($1,$2,2,$3) RETURNING id",[account.id,hashToken(browserBinding),expiresAt]);
    await client.query("INSERT INTO recovery_otp(recovery_id,channel,verifier_hash,expires_at) VALUES($1,'EMAIL',$2,LEAST(now()+interval '5 minutes',$3))",[recovery.rows[0].id,hashToken(code),expiresAt]);
    await queueSecureDelivery(client,{eventType:"security.cto.recovery_email_otp.v1",aggregateType:"recovery_transaction",aggregateId:recovery.rows[0].id,accountId:account.id,channel:"EMAIL",destination:account.email_normalized,token:code,expiresAt:new Date(Math.min(expiresAt.getTime(),Date.now()+5*60*1000))});
    await appendAudit(client,{action:"cto.recovery.started",targetType:"recovery_transaction",targetId:recovery.rows[0].id,domain:"security",sensitive:true,requestContext:{claimant:"unknown",challengeExpiresAt:new Date(Date.now()+5*60*1000).toISOString(),transactionExpiresAt:expiresAt.toISOString()},result:"PENDING"});
    return{accepted:true,recoveryId:recovery.rows[0].id,developmentEmailCode:["local","test"].includes(getRuntimeConfig().APP_ENV)?code:undefined};
  });
}

async function transactionForUpdate(client:PoolClient,id:string,binding:string){
  const result=await client.query<{id:string;account_id:string;step:number;expires_at:Date}>("SELECT id,account_id,step,expires_at FROM recovery_transaction WHERE id=$1 AND browser_binding_hash=$2 AND consumed_at IS NULL AND aborted_at IS NULL FOR UPDATE",[id,hashToken(binding)]);
  const row=result.rows[0];
  if(!row||new Date(row.expires_at).getTime()<=Date.now()){
    if(row)await client.query("UPDATE recovery_transaction SET aborted_at=now() WHERE id=$1",[id]);
    throw new Error("RECOVERY_EXPIRED");
  }
  return row;
}

async function verifyOtp(client:PoolClient,recoveryId:string,channel:"EMAIL"|"PHONE",code:string){
  const result=await client.query<{id:string}>("SELECT id FROM recovery_otp WHERE recovery_id=$1 AND channel=$2 AND verifier_hash=$3 AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[recoveryId,channel,hashToken(code)]);
  if(!result.rows[0])throw new Error("RECOVERY_PROOF_INVALID");
  await client.query("UPDATE recovery_otp SET consumed_at=now() WHERE id=$1",[result.rows[0].id]);
}

export async function advanceRecoveryProof(id:string,binding:string,raw:unknown){
  const input=proofInput.parse(raw);
  return withTransaction(async client=>{
    const tx=await transactionForUpdate(client,id,binding);
    if(input.step==="EMAIL_OTP"){
      if(tx.step!==2)throw new Error("RECOVERY_STEP_OUT_OF_ORDER");
      await verifyOtp(client,id,"EMAIL",input.value);
      await client.query("UPDATE recovery_transaction SET step=3,email_verified_at=now() WHERE id=$1",[id]);
      await appendAudit(client,{action:"cto.recovery.email_verified",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,requestContext:{step:"EMAIL_OTP"}});
      return{step:"PASSPHRASE" as const};
    }
    if(input.step==="PASSPHRASE"){
      if(tx.step!==3)throw new Error("RECOVERY_STEP_OUT_OF_ORDER");
      const secret=await client.query<{verifier_hash:string;consumed_at:Date|null}>("SELECT verifier_hash,consumed_at FROM recovery_secret WHERE account_id=$1 FOR UPDATE",[tx.account_id]);
      if(!secret.rows[0]||secret.rows[0].consumed_at||!(await verify(secret.rows[0].verifier_hash,input.value)))throw new Error("RECOVERY_PROOF_INVALID");
      const account=await client.query<{phone_e164:string|null}>("SELECT phone_e164 FROM account WHERE id=$1",[tx.account_id]);
      if(!account.rows[0]?.phone_e164)throw new Error("RECOVERY_FACTOR_UNAVAILABLE");
      const code=String(randomInt(100000,1000000));
      const otpExpiresAt=new Date(Math.min(new Date(tx.expires_at).getTime(),Date.now()+5*60*1000));
      await client.query("INSERT INTO recovery_otp(recovery_id,channel,verifier_hash,expires_at) VALUES($1,'PHONE',$2,$3)",[id,hashToken(code),otpExpiresAt]);
      await queueSecureDelivery(client,{eventType:"security.cto.recovery_phone_otp.v1",aggregateType:"recovery_transaction",aggregateId:id,accountId:tx.account_id,channel:"PHONE",destination:account.rows[0].phone_e164,token:code,expiresAt:otpExpiresAt});
      await client.query("UPDATE recovery_transaction SET step=4,secret_verified_at=now() WHERE id=$1",[id]);
      await appendAudit(client,{action:"cto.recovery.passphrase_verified",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,requestContext:{step:"PASSPHRASE"}});
      return{step:"PHONE_OTP" as const,developmentPhoneCode:["local","test"].includes(getRuntimeConfig().APP_ENV)?code:undefined};
    }
    if(tx.step!==4)throw new Error("RECOVERY_STEP_OUT_OF_ORDER");
    await verifyOtp(client,id,"PHONE",input.value);
    const credentials=await client.query<{id:string}>("SELECT id FROM webauthn_credential WHERE account_id=$1",[tx.account_id]);
    const config=getRuntimeConfig();
    const options=await generateAuthenticationOptions({rpID:config.WEBAUTHN_RP_ID,userVerification:"required",allowCredentials:credentials.rows.map(item=>({id:item.id}))});
    await client.query("INSERT INTO webauthn_challenge(account_id,ceremony,challenge,expires_at) VALUES($1,'AUTHENTICATION',$2,LEAST(now()+interval '5 minutes',$3))",[tx.account_id,options.challenge,tx.expires_at]);
    await client.query("UPDATE recovery_transaction SET step=5,phone_verified_at=now() WHERE id=$1",[id]);
    await appendAudit(client,{action:"cto.recovery.phone_verified",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,requestContext:{step:"PHONE_OTP"}});
    return{step:"WEBAUTHN" as const,options};
  });
}

export async function completeRecoveryAssertion(id:string,binding:string,response:AuthenticationResponseJSON){
  const config=getRuntimeConfig();
  return withTransaction(async client=>{
    const tx=await transactionForUpdate(client,id,binding);
    if(tx.step!==5)throw new Error("RECOVERY_STEP_OUT_OF_ORDER");
    const stored=await client.query<{id:string;public_key:Uint8Array;counter:number;transports:string[]}>("SELECT id,public_key,counter,transports FROM webauthn_credential WHERE account_id=$1 AND id=$2 FOR UPDATE",[tx.account_id,response.id]);
    const credential=stored.rows[0];
    if(!credential)throw new Error("RECOVERY_PROOF_INVALID");
    const challenge=await client.query<{id:string;challenge:string}>("SELECT id,challenge FROM webauthn_challenge WHERE account_id=$1 AND ceremony='AUTHENTICATION' AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[tx.account_id]);
    if(!challenge.rows[0])throw new Error("RECOVERY_PROOF_INVALID");
    const transports=z.array(z.enum(["ble","hybrid","internal","nfc","usb"])).parse(credential.transports);
    const result=await verifyAuthenticationResponse({response,expectedChallenge:challenge.rows[0].challenge,expectedOrigin:[config.STOREFRONT_ORIGIN,config.ADMIN_ORIGIN],expectedRPID:config.WEBAUTHN_RP_ID,credential:{id:credential.id,publicKey:Uint8Array.from(credential.public_key),counter:credential.counter,transports},requireUserVerification:true});
    if(!result.verified)throw new Error("RECOVERY_PROOF_INVALID");
    const sessionToken=randomToken();
    await client.query("UPDATE webauthn_credential SET counter=$2,last_used_at=now() WHERE id=$1",[credential.id,result.authenticationInfo.newCounter]);
    await client.query("UPDATE webauthn_challenge SET consumed_at=now() WHERE id=$1",[challenge.rows[0].id]);
    const consumed=await client.query("UPDATE recovery_secret SET consumed_at=now() WHERE account_id=$1 AND consumed_at IS NULL",[tx.account_id]);
    if(!consumed.rowCount)throw new Error("RECOVERY_SECRET_ALREADY_CONSUMED");
    await client.query("UPDATE recovery_transaction SET step=6,webauthn_verified_at=now(),consumed_at=now() WHERE id=$1",[id]);
    const session=await client.query<{id:string}>("INSERT INTO account_session(account_id,token_hash,kind,expires_at) VALUES($1,$2,'EMERGENCY',now()+interval '1 hour') RETURNING id",[tx.account_id,hashToken(sessionToken)]);
    await appendAudit(client,{actorId:tx.account_id,actorRole:"CTO",action:"cto.recovery.emergency_session_created",targetType:"account_session",targetId:session.rows[0].id,domain:"security",sensitive:true,requestContext:{recoveryTransactionId:id,credentialId:credential.id,expiresInSeconds:3600}});
    return{sessionToken,expiresInSeconds:3600};
  });
}
