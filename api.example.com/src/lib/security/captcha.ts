import { z } from "zod";
import { getRuntimeConfig } from "@/lib/config/env";

export async function verifyCaptcha(token:string,remoteAddress?:string):Promise<boolean>{
  const config=getRuntimeConfig();
  if(config.APP_ENV==="local"||config.APP_ENV==="test")return token==="local-human";
  if(!config.CAPTCHA_VERIFY_URL||!config.CAPTCHA_API_TOKEN)throw new Error("CAPTCHA_PROVIDER_UNCONFIGURED");
  const response=await fetch(config.CAPTCHA_VERIFY_URL,{method:"POST",headers:{authorization:`Bearer ${config.CAPTCHA_API_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({token,remoteAddress}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("CAPTCHA_PROVIDER_UNAVAILABLE");
  return z.object({success:z.boolean()}).parse(await response.json()).success;
}
