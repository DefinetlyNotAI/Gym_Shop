import { randomInt } from "node:crypto";
import { appendAudit } from "@/lib/audit/service";
import { getRuntimeConfig } from "@/lib/config/env";
import { withTransaction } from "@/lib/db/client";
import { queueSecureDelivery } from "@/lib/notifications/secure-delivery";
import { hashToken } from "@/lib/security/crypto";

export async function resendRecoveryOtp(id:string,binding:string,channel:"EMAIL"|"PHONE"){
  const code=String(randomInt(100000,1000000));
  const result=await withTransaction(async client=>{
    const transaction=await client.execute<{account_id:string;step:number;expires_at:Date}>("SELECT account_id,step,expires_at FROM recovery_transaction WHERE id=$1 AND browser_binding_hash=$2 AND consumed_at IS NULL AND aborted_at IS NULL FOR UPDATE",[id,hashToken(binding)]);
    const row=transaction.rows[0];
    if(!row||new Date(row.expires_at).getTime()<=Date.now())return{error:"RECOVERY_EXPIRED"};
    if((channel==="EMAIL"&&row.step!==2)||(channel==="PHONE"&&row.step!==4))return{error:"RECOVERY_STEP_OUT_OF_ORDER"};
    const history=await client.execute<{count:number;last_sent:Date|null}>("SELECT count(*)::int AS count,max(created_at) AS last_sent FROM recovery_otp WHERE recovery_id=$1 AND channel=$2",[id,channel]);
    if(history.rows[0].count>=3){await client.execute("UPDATE recovery_transaction SET aborted_at=now() WHERE id=$1",[id]);await appendAudit(client,{action:"cto.recovery.otp_send_blocked",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,result:"BLOCKED",requestContext:{channel,reason:"SEND_LIMIT"}});return{error:"RECOVERY_SEND_LIMIT"};}
    if(history.rows[0].last_sent&&Date.now()-new Date(history.rows[0].last_sent).getTime()<60000){await appendAudit(client,{action:"cto.recovery.otp_send_blocked",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,result:"BLOCKED",requestContext:{channel,reason:"COOLDOWN"}});return{error:"RECOVERY_SEND_COOLDOWN"};}
    const account=await client.execute<{email_normalized:string;phone_e164:string|null}>("SELECT email_normalized,phone_e164 FROM account WHERE id=$1",[row.account_id]);
    const destination=channel==="EMAIL"?account.rows[0]?.email_normalized:account.rows[0]?.phone_e164;
    if(!destination)return{error:"RECOVERY_FACTOR_UNAVAILABLE"};
    await client.execute("UPDATE recovery_otp SET superseded_at=now() WHERE recovery_id=$1 AND channel=$2 AND consumed_at IS NULL AND superseded_at IS NULL",[id,channel]);
    const expiry=new Date(Math.min(new Date(row.expires_at).getTime(),Date.now()+5*60*1000));
    await client.execute("INSERT INTO recovery_otp(recovery_id,channel,verifier_hash,expires_at) VALUES($1,$2,$3,$4)",[id,channel,hashToken(code),expiry]);
    await queueSecureDelivery(client,{eventType:channel==="EMAIL"?"security.cto.recovery_email_otp.v1":"security.cto.recovery_phone_otp.v1",aggregateType:"recovery_transaction",aggregateId:id,accountId:row.account_id,channel,destination,token:code,expiresAt:expiry});
    await appendAudit(client,{action:"cto.recovery.otp_resent",targetType:"recovery_transaction",targetId:id,domain:"security",sensitive:true,result:"PENDING",requestContext:{channel,previousSuperseded:true,expiresAt:expiry.toISOString()}});
    return{sent:true,developmentCode:["local","test"].includes(getRuntimeConfig().APP_ENV)?code:undefined};
  });
  if("error"in result)throw new Error(result.error);
  return result;
}
