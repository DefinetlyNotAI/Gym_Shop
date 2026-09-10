import { apiError, apiSuccess } from "@/lib/api/response";
import { appendAudit } from "@/lib/audit/service";
import { completeStaffMfa } from "@/lib/auth/service";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/client";
import { hashToken } from "@/lib/security/crypto";
import { checkRateLimit, requestRateKey } from "@/lib/security/rate-limit";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request:Request){let pendingToken="";try{requireTrustedMutation(request);const body=await request.json();pendingToken=String(body.pendingToken??"");await checkRateLimit("staff-mfa",requestRateKey(request,pendingToken),5,300);const{accountId}=await completeStaffMfa(pendingToken,body.response);const token=await createSession(accountId,{userAgent:request.headers.get("user-agent")??undefined});await setSessionCookie(token);return apiSuccess({authenticated:true});}catch{if(pendingToken){try{await withTransaction(async client=>{await appendAudit(client,{action:"staff.mfa.failed",targetType:"pending_login",targetId:hashToken(pendingToken),domain:"security",sensitive:true,result:"FAILED"});});}catch{}}return apiError(401,{code:"MFA_FAILED",message:"Multi-factor authentication failed."});}}
