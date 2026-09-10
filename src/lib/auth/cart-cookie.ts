import { cookies } from "next/headers";
import { randomToken } from "@/lib/security/crypto";
const CART_COOKIE="gym_shop_cart";
export async function readAnonymousCartToken(){return (await cookies()).get(CART_COOKIE)?.value;}
export async function ensureAnonymousCartToken(){const jar=await cookies();const existing=jar.get(CART_COOKIE)?.value;if(existing)return existing;const token=randomToken();jar.set(CART_COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*24*30});return token;}
export async function clearAnonymousCartToken(){(await cookies()).delete(CART_COOKIE);}
