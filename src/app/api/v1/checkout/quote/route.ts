import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireCustomer } from "@/lib/auth/authorization";
import { quoteSelectedCart } from "@/lib/commerce/orders";

export async function GET(request:Request){try{const account=requireCustomer(await getCurrentAccount());const parameters=new URL(request.url).searchParams;const zoneId=parameters.get("zoneId");if(!zoneId)throw new Error();const couponCode=parameters.get("couponCode")?.trim()||undefined;return apiSuccess(await quoteSelectedCart(account.id,zoneId,{couponCode}));}catch{return apiError(409,{code:"QUOTE_UNAVAILABLE",message:"A quote is not available for the selected cart and delivery zone."});}}
