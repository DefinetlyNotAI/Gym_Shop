import{withDatabaseClient}from"@/lib/db/client";
import type{CurrentAccount}from"@/lib/auth/session";

export async function auditFeed(actor:CurrentAccount){return withDatabaseClient(async client=>{
  const level=await client.query<{privilege_level:number}>("SELECT privilege_level FROM role WHERE id=$1",[actor.role]);
  const actorLevel=level.rows[0]?.privilege_level??0;
  const domainRows=await client.query<{domain:string}>("SELECT DISTINCT permission.domain FROM role_permission JOIN permission ON permission.id=role_permission.permission_id WHERE role_permission.role_id=$1",[actor.role]);
  const allowedDomains=actor.role==="CTO"?(await client.query<{domain:string}>("SELECT DISTINCT domain FROM audit_event")).rows.map(row=>row.domain):[...new Set(domainRows.rows.map(row=>row.domain).filter(domain=>domain!=="audit"))];
  const fresh=Date.now()-new Date(actor.authenticatedAt).getTime()<=2*60*60*1000;
  if(!allowedDomains.length)return[];
  const result=await client.query<{id:string;actor_role:string|null;action:string;target_type:string;target_id:string;domain:string;before_value:unknown;after_value:unknown;reason:string|null;result:string;sensitive:boolean;occurred_at:Date;privilege_level:number|null}>(`SELECT audit.id,COALESCE(audit.actor_role,actor_staff.role_id) AS actor_role,audit.action,audit.target_type,audit.target_id,audit.domain,audit.before_value,audit.after_value,audit.reason,audit.result,audit.sensitive,audit.occurred_at,role.privilege_level FROM audit_event AS audit LEFT JOIN staff_account AS actor_staff ON actor_staff.account_id=audit.actor_id LEFT JOIN role ON role.id=COALESCE(audit.actor_role,actor_staff.role_id) WHERE audit.domain=ANY($1::text[]) ORDER BY audit.occurred_at DESC LIMIT 200`,[allowedDomains]);
  return result.rows.map(row=>{
    if((row.privilege_level??0)>actorLevel)return{id:row.id,occurredAt:row.occurred_at,locked:true,reason:"HIGHER_ROLE"};
    if(row.sensitive&&!fresh)return{id:row.id,occurredAt:row.occurred_at,locked:true,reason:"RECENT_AUTH_REQUIRED"};
    return{id:row.id,occurredAt:row.occurred_at,actorRole:row.actor_role,action:row.action,targetType:row.target_type,targetId:row.target_id,domain:row.domain,before:row.before_value,after:row.after_value,reason:row.reason,result:row.result};
  });
});}
