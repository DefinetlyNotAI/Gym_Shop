import { z } from "zod";
import { apiError,apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { subscribeNewsletter,unsubscribeNewsletter } from "@/lib/notifications/subscriptions";
import { requireTrustedMutation } from "@/lib/security/request";
const input=z.object({subscribed:z.boolean(),source:z.string().trim().min(2).max(100).default("STOREFRONT_NEWSLETTER")});
export async function POST(request:Request){try{requireTrustedMutation(request);const account=requireCustomer(await getCurrentAccount());const parsed=input.parse(await request.json());return apiSuccess(parsed.subscribed?await subscribeNewsletter(account.id,parsed.source):await unsubscribeNewsletter(account.id));}catch(error){return apiError(422,{code:error instanceof Error?error.message:"SUBSCRIPTION_FAILED",message:"Newsletter preference could not be updated."});}}
