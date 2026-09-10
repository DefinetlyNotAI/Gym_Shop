import{headers}from"next/headers";
export type Session={publicId:string;email:string;displayName:string;phone?:string|null;status:string;emailVerified:boolean;phoneVerified:boolean;role:string;sessionKind:string};
type Envelope<T>={data:T};
export async function apiGet<T>(path:string,optional=false):Promise<T|null>{const incoming=await headers();const response=await fetch(new URL(path,process.env.API_ORIGIN??"https://api.example.com"),{headers:{cookie:incoming.get("cookie")??""},cache:"no-store"});if(!response.ok){if(optional)return null;throw new Error(`API_${response.status}`);}return((await response.json())as Envelope<T>).data;}
export function getSession(){return apiGet<Session>("/api/v1/auth/session",true);}
