import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireCustomer } from "@/lib/auth/authorization";
import { checkout } from "@/lib/commerce/orders";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request:Request){try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());return apiSuccess(await checkout(account.id,await request.json()),{status:201});}catch(error){const code=error instanceof Error?error.message:"CHECKOUT_FAILED";return apiError(409,{code,message:"Checkout could not be completed."});}}
