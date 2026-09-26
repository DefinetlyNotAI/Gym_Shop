import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { ensureAnonymousCartToken, readAnonymousCartToken } from "@/lib/auth/cart-cookie";
import { getCurrentAccount } from "@/lib/auth/session";
import { getCart, removeCartLine, upsertCartLine, type CartOwner } from "@/lib/commerce/cart";
import { requireTrustedMutation } from "@/lib/security/request";

async function owner(create:boolean):Promise<CartOwner|null>{const account=await getCurrentAccount();if(account)return{accountId:requireCustomer(account).id};const token=create?await ensureAnonymousCartToken():await readAnonymousCartToken();return token?{anonymousToken:token}:null;}
export async function GET(){try{const cartOwner=await owner(false);return apiSuccess({lines:cartOwner?await getCart(cartOwner):[]});}catch{return apiError(403,{code:"CART_UNAVAILABLE",message:"Cart access is unavailable."});}}
export async function PUT(request:Request){try{requireTrustedMutation(request);const cartOwner=await owner(true);if(!cartOwner)throw new Error();await upsertCartLine(cartOwner,await request.json());return apiSuccess({lines:await getCart(cartOwner)});}catch{return apiError(422,{code:"CART_UPDATE_FAILED",message:"The cart could not be updated."});}}
export async function DELETE(request:Request){try{requireTrustedMutation(request);const cartOwner=await owner(false);const lineId=new URL(request.url).searchParams.get("lineId");if(!cartOwner||!lineId)throw new Error();await removeCartLine(cartOwner,lineId);return apiSuccess({removed:true});}catch{return apiError(422,{code:"CART_UPDATE_FAILED",message:"The cart could not be updated."});}}
