import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireCustomer } from "@/lib/auth/authorization";
import { listOrders } from "@/lib/commerce/orders";
export async function GET(){try{const account=requireCustomer(await getCurrentAccount());return apiSuccess({orders:await listOrders(account.id)});}catch{return apiError(401,{code:"AUTH_REQUIRED",message:"Authentication is required."});}}
