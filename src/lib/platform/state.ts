import { randomUUID } from "node:crypto";
import { withDatabaseClient } from "@/lib/db/client";
import { launchBlockers } from "@/lib/platform/release-readiness";

export type PlatformState =
  | { kind: "operational" }
  | { kind: "maintenance"; reason: "not_initialized" | "disabled" | "lockdown" | "unavailable"; reference?: string };

export type PlatformGateState = { initialized:boolean; locked:boolean; storeEnabled:boolean; available:boolean; reference?:string };

export async function getPlatformGateState():Promise<PlatformGateState>{
  try{return await withDatabaseClient(async client=>{const result=await client.query<{cto_initialized_at:Date|null;normal_operations_locked:boolean;store_enabled:boolean}>(`SELECT state.cto_initialized_at,state.normal_operations_locked,COALESCE((setting.value #>> '{}')::boolean,false) AS store_enabled FROM platform_state AS state LEFT JOIN app_setting AS setting ON setting.key='platform.store_enabled' WHERE state.singleton=TRUE`);const row=result.rows[0];const blockers=row?.store_enabled?await launchBlockers(client):[];return{initialized:Boolean(row?.cto_initialized_at),locked:Boolean(row?.normal_operations_locked),storeEnabled:Boolean(row?.store_enabled)&&blockers.length===0,available:Boolean(row)};});}catch(error){const safeReference=randomUUID().slice(0,8);console.error(`Platform gate unavailable (${safeReference})`,error);return{initialized:false,locked:false,storeEnabled:false,available:false,reference:safeReference};}
}

export async function getPlatformState(): Promise<PlatformState> {
  const gate=await getPlatformGateState();
  if(!gate.available)return{kind:"maintenance",reason:"unavailable",reference:gate.reference};
  if(!gate.initialized)return{kind:"maintenance",reason:"not_initialized"};
  if(gate.locked)return{kind:"maintenance",reason:"lockdown"};
  if(!gate.storeEnabled)return{kind:"maintenance",reason:"disabled"};
  return{kind:"operational"};
}

export function requireOperational(state: PlatformState): void {
  if (state.kind !== "operational") throw new Error("PLATFORM_MAINTENANCE");
}
