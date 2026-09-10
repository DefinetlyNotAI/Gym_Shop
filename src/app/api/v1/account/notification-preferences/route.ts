import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient } from "@/lib/db/client";
import { requireTrustedMutation } from "@/lib/security/request";

const input=z.object({category:z.string().regex(/^marketing(?:[._-][a-z0-9_-]+)?$/),channel:z.enum(["EMAIL","WHATSAPP"]),enabled:z.boolean()});
export async function GET(){try{const account=requireCustomer(await getCurrentAccount());const preferences=await withDatabaseClient(async client=>(await client.query("SELECT category,channel,enabled,updated_at FROM notification_preference WHERE account_id=$1 ORDER BY category,channel",[account.id])).rows);return apiSuccess({preferences});}catch{return apiError(401,{code:"AUTH_REQUIRED",message:"Authentication is required."});}}
export async function POST(request:Request){try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());const value=input.parse(await request.json());await withDatabaseClient(client=>client.query("INSERT INTO notification_preference(account_id,category,channel,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,category,channel) DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=now()",[account.id,value.category,value.channel,value.enabled]).then(()=>undefined));return apiSuccess({updated:true});}catch(error){return apiError(422,{code:error instanceof Error?error.message:"PREFERENCE_INVALID",message:"The preference could not be changed."});}}
