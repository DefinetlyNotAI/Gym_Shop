import{apiError,apiSuccess}from"@/lib/api/response";
import{getCurrentAccount}from"@/lib/auth/session";
import{getRuntimeConfig}from"@/lib/config/env";
import{withDatabaseClient}from"@/lib/db/client";
import{decryptOutboundSecret}from"@/lib/notifications/secrets";

function mask(value:string){if(value.includes("@")){const[local,domain]=value.split("@");return `${local.slice(0,2)}***@${domain}`;}return `${value.slice(0,4)}***${value.slice(-2)}`;}

export async function GET(){
  if(!getRuntimeConfig().SIM_MODE)return apiError(404,{code:"NOT_FOUND",message:"Not found."});
  const account=await getCurrentAccount();if(!account)return apiError(401,{code:"AUTH_REQUIRED",message:"Authentication is required."});
  const rows=await withDatabaseClient(async client=>(await client.execute<{event_type:string;payload:Record<string,unknown>;ciphertext:string;expires_at:Date;occurred_at:Date}>(`SELECT event.event_type,event.payload,secret.ciphertext,secret.expires_at,event.occurred_at FROM outbound_secret AS secret JOIN domain_event_outbox AS event ON event.id=secret.event_id WHERE event.payload->>'accountId'=$1 AND secret.expires_at>now() ORDER BY event.occurred_at DESC LIMIT 50`,[account.id])).rows);
  return apiSuccess({messages:rows.map(row=>{const secret=decryptOutboundSecret(row.ciphertext);return{eventType:row.event_type,channel:row.payload.channel==="PHONE"?"WHATSAPP":String(row.payload.channel??"EMAIL"),destination:mask(secret.destination),token:secret.token,expiresAt:row.expires_at,createdAt:row.occurred_at};})});
}
