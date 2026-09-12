import{apiError,apiSuccess}from"@/lib/api/response";
import{requirePermission}from"@/lib/auth/authorization";
import{getCurrentAccount}from"@/lib/auth/session";
import { getStaffCatalog } from "@/lib/commerce/catalog-admin";

export async function GET(){
  try{
    const actor = await requirePermission(await getCurrentAccount(),"catalog.read");
    return apiSuccess(await getStaffCatalog(actor.id));
  }catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Catalog access is denied."});}
}
