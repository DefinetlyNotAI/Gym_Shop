import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { requireTrustedMutation } from "@/lib/security/request";

const input=z.object({eventType:z.string().regex(/^[a-z][a-z0-9_.-]+\.v[1-9][0-9]*$/),channel:z.enum(["IN_SITE","EMAIL","WHATSAPP"]),language:z.enum(["ar","en"]),subject:z.string().max(200).nullable().optional(),body:z.string().min(1).max(10000),allowedVariables:z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/)).max(30)});

export async function GET(){try{await requirePermission(await getCurrentAccount(),"notifications.manage");const templates=await withDatabaseClient(async client=>(await client.query("SELECT id,event_type,channel,language,version,subject,body,allowed_variables,enabled,updated_by,updated_at FROM notification_template ORDER BY event_type,channel,language,version DESC")).rows);return apiSuccess({templates});}catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Template access is denied."});}}

export async function POST(request:Request){try{requireTrustedMutation(request);const actor=await requirePermission(await getCurrentAccount(),"notifications.manage");const value=input.parse(await request.json());const placeholders=[...value.body.matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g),...(value.subject??"").matchAll(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g)].map(match=>match[1]);if(placeholders.some(name=>!value.allowedVariables.includes(name)))throw new Error("TEMPLATE_VARIABLE_NOT_ALLOWED");const template=await withTransaction(async client=>(await client.query<{id:string;version:number}>(`INSERT INTO notification_template(event_type,channel,language,version,subject,body,allowed_variables,updated_by) SELECT $1,$2,$3,COALESCE(max(version),0)+1,$4,$5,$6,$7 FROM notification_template WHERE event_type=$1 AND channel=$2 AND language=$3 RETURNING id,version`,[value.eventType,value.channel,value.language,value.subject??null,value.body,value.allowedVariables,actor.id])).rows[0]);return apiSuccess(template,{status:201});}catch(error){return apiError(422,{code:error instanceof Error?error.message:"TEMPLATE_INVALID",message:"The template could not be saved."});}}
