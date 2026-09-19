import{headers}from"next/headers";
import { configuredServerApiOrigin } from "@/lib/runtime-origin";
export type Session={publicId:string;email:string;displayName:string;phone?:string|null;status:string;emailVerified:boolean;phoneVerified:boolean;role:string;sessionKind:string};
type Envelope<T>={data:T};
export async function apiGet<T>(path:string,optional=false):Promise<T|null>{if(!path.startsWith("/api/v1/"))throw new Error("API_PATH_REJECTED");const incoming=await headers();const origin=new URL(configuredServerApiOrigin(process.env));const target=new URL(path,origin);if(target.origin!==origin.origin||!target.pathname.startsWith("/api/v1/"))throw new Error("API_ORIGIN_REJECTED");const response=await fetch(target,{headers:{accept:"application/json",cookie:incoming.get("cookie")??""},cache:"no-store",redirect:"error"});if(!response.ok){if(optional)return null;throw new Error(`API_${response.status}`);}if(!response.headers.get("content-type")?.startsWith("application/json"))throw new Error("API_CONTENT_TYPE_REJECTED");return((await response.json())as Envelope<T>).data;}
export function getSession(){return apiGet<Session>("/api/v1/auth/session",true);}
