import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { getOrderDetail } from "@/lib/commerce/orders";
export async function GET(_request:Request,{params}:{params:Promise<{publicId:string}>}){try{const account=requireCustomer(await getCurrentAccount());return apiSuccess(await getOrderDetail(account.id,(await params).publicId));}catch{return apiError(404,{code:"ORDER_NOT_FOUND",message:"Order not found."});}}
