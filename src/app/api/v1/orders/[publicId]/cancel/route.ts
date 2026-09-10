import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireCustomer } from "@/lib/auth/authorization";
import { cancelOrder } from "@/lib/commerce/orders";
import { requireTrustedMutation } from "@/lib/security/request";
export async function POST(request:Request,{params}:{params:Promise<{publicId:string}>}){try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());return apiSuccess(await cancelOrder(account.id,(await params).publicId));}catch(error){const code=error instanceof Error?error.message:"CANCEL_FAILED";return apiError(409,{code,message:"The order cannot be cancelled."});}}
