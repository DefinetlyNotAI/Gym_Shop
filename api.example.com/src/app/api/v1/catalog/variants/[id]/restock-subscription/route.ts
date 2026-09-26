import { z } from "zod";
import { apiError,apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { subscribeRestock,unsubscribeRestock } from "@/lib/notifications/subscriptions";
import { requireTrustedMutation } from "@/lib/security/request";
const input=z.object({subscribed:z.boolean()});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());const {id}=await params;const parsed=input.parse(await request.json());return apiSuccess(parsed.subscribed?await subscribeRestock(account.id,id):await unsubscribeRestock(account.id,id));}catch(error){return apiError(422,{code:error instanceof Error?error.message:"RESTOCK_SUBSCRIPTION_FAILED",message:"Restock preference could not be updated."});}}
