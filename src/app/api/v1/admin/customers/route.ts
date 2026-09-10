import{apiError,apiSuccess}from"@/lib/api/response";
import{requirePermission}from"@/lib/auth/authorization";
import{getCurrentAccount}from"@/lib/auth/session";
import{withDatabaseClient}from"@/lib/db/client";

export async function GET(request:Request){
  try{
    const actor=await getCurrentAccount();
    try{await requirePermission(actor,"support.manage");}catch{await requirePermission(actor,"orders.read");}
    const query=new URL(request.url).searchParams.get("q")?.trim()??"";
    const customers=await withDatabaseClient(async client=>(await client.query(`SELECT account.public_id,account.email_normalized,account.display_name,account.status,account.email_verified_at IS NOT NULL AS email_verified,account.phone_verified_at IS NOT NULL AS phone_verified,account.deletion_due_at,(SELECT count(*)::int FROM shop_order WHERE shop_order.account_id=account.id) AS order_count,(SELECT count(*)::int FROM support_ticket WHERE support_ticket.account_id=account.id AND support_ticket.status NOT IN ('RESOLVED','CLOSED')) AS open_ticket_count FROM account LEFT JOIN staff_account ON staff_account.account_id=account.id WHERE staff_account.account_id IS NULL AND ($1='' OR account.public_id ILIKE '%'||$1||'%' OR account.email_normalized ILIKE '%'||$1||'%' OR account.display_name ILIKE '%'||$1||'%') ORDER BY account.created_at DESC LIMIT 200`,[query])).rows);
    return apiSuccess({customers});
  }catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Customer access is denied."});}
}
