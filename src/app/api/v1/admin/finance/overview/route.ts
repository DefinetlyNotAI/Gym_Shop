import{apiError,apiSuccess}from"@/lib/api/response";
import{requirePermission}from"@/lib/auth/authorization";
import{getCurrentAccount}from"@/lib/auth/session";
import{withDatabaseClient}from"@/lib/db/client";
import{getFinanceOverview}from"@/lib/finance/service";

export async function GET(){
  try{
    const actor=await getCurrentAccount();
    try{await requirePermission(actor,"cash.reconcile");}catch{await requirePermission(actor,"refund.execute");}
    return apiSuccess(await withDatabaseClient(getFinanceOverview));
  }catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Finance access is denied."});}
}
