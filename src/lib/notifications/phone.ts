import { appendAudit } from "@/lib/audit/service";
import { withTransaction } from "@/lib/db/client";
import { queuePhoneVerificationCode } from "@/lib/notifications/phone-code";
import { hashToken } from "@/lib/security/crypto";

export async function requestPhoneVerification(accountId:string,input:{phone:string;channel?:"WHATSAPP"}) {
  if(!/^\+962[0-9]{8,9}$/.test(input.phone))throw new Error("PHONE_INVALID");
  const created=await withTransaction(async client=>{
    const account=await client.query<{email_verified_at:Date|null}>("SELECT email_verified_at FROM account WHERE id=$1 FOR UPDATE",[accountId]);
    if(!account.rows[0]?.email_verified_at)throw new Error("EMAIL_VERIFICATION_REQUIRED");
    await client.query("UPDATE auth_token SET superseded_at=now() WHERE account_id=$1 AND purpose='PHONE_VERIFY' AND consumed_at IS NULL AND superseded_at IS NULL",[accountId]);
    const request=await client.query<{id:string}>("INSERT INTO phone_verification_request(account_id,phone_e164,channel,status,expires_at) VALUES($1,$2,'WHATSAPP','QUEUED',now()+interval '5 minutes') RETURNING id",[accountId,input.phone]);
    const queued=await queuePhoneVerificationCode(client,{requestId:request.rows[0].id,accountId,phone:input.phone});
    await appendAudit(client,{actorId:accountId,action:"phone.verification_requested",targetType:"phone_verification_request",targetId:request.rows[0].id,domain:"identity"});
    return{requestId:request.rows[0].id,...queued};
  });
  return{status:"SENT" as const,requestId:created.requestId,developmentCode:created.developmentCode};
}

export async function confirmPhoneVerification(accountId:string,requestId:string,code:string){
  const result=await withTransaction(async client=>{
    const request=await client.query<{token_id:string;phone_e164:string;status:string}>("SELECT token_id,phone_e164,status FROM phone_verification_request WHERE id=$1 AND account_id=$2 AND expires_at>now() FOR UPDATE",[requestId,accountId]);
    const row=request.rows[0];
    if(!row||row.status!=="SENT")return{verified:false};
    const token=await client.query<{id:string;verifier_hash:string;attempt_count:number}>("SELECT id,verifier_hash,attempt_count FROM auth_token WHERE id=$1 AND consumed_at IS NULL AND superseded_at IS NULL AND expires_at>now() FOR UPDATE",[row.token_id]);
    if(!token.rows[0]||token.rows[0].verifier_hash!==hashToken(code)){
      if(token.rows[0])await client.query("UPDATE auth_token SET attempt_count=attempt_count+1,consumed_at=CASE WHEN attempt_count>=4 THEN now() END WHERE id=$1",[row.token_id]);
      return{verified:false};
    }
    await client.query("UPDATE auth_token SET consumed_at=now() WHERE id=$1",[row.token_id]);
    await client.query("UPDATE phone_verification_request SET status='VERIFIED' WHERE id=$1",[requestId]);
    await client.query("UPDATE account SET phone_e164=$2,phone_verified_at=now(),updated_at=now() WHERE id=$1",[accountId,row.phone_e164]);
    return{verified:true};
  });
  if(!result.verified)throw new Error("PHONE_CODE_INVALID");
  return result;
}
