import type { DatabaseClient } from "@/lib/db/client";
import { appendDomainEvent } from "@/lib/events/outbox";
import { storeOutboundSecret } from "@/lib/notifications/secrets";

export async function queueSecureDelivery(client:DatabaseClient,input:{eventType:string;aggregateType:string;aggregateId:string;accountId:string;channel:"EMAIL"|"PHONE";destination:string;token:string;expiresAt:Date;payload?:Record<string,unknown>}){
  const eventId=await appendDomainEvent(client,{eventType:input.eventType,aggregateType:input.aggregateType,aggregateId:input.aggregateId,payload:{...input.payload,accountId:input.accountId,channel:input.channel}});
  await storeOutboundSecret(client,eventId,{destination:input.destination,token:input.token},input.expiresAt);
  return eventId;
}
