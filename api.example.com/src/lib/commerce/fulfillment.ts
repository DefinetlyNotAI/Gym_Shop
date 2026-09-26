import{randomInt}from"node:crypto";
import type{DatabaseClient}from"@/lib/db/client";
import{withDatabaseClient,withTransaction}from"@/lib/db/client";
import{appendAudit}from"@/lib/audit/service";
import{appendDomainEvent}from"@/lib/events/outbox";
import{hashToken}from"@/lib/security/crypto";
import{queueSecureDelivery}from"@/lib/notifications/secure-delivery";
import{awardDeliveryPoints}from"@/lib/wallet/service";
import{qualifyReferralReward}from"@/lib/referrals/service";

export async function listOperationalOrders(){return withDatabaseClient(async client=>(await client.execute("SELECT public_id,status,payment_status,fulfillment_status,payment_method,delivery_snapshot->>'mode' AS fulfillment_mode,external_due_fils,collected_fils,placed_at FROM shop_order ORDER BY created_at DESC LIMIT 200")).rows);}
export async function listDriverAssignments(driverId:string){return withDatabaseClient(async client=>(await client.execute(`SELECT orders.public_id,shipment.internal_reference,shipment.state,shipment.attempt_number,shipment.doorstep_authorized,shipment.expected_cash_fils,orders.payment_method,orders.external_due_fils,orders.recipient_snapshot,orders.delivery_snapshot FROM shipment JOIN shop_order AS orders ON orders.id=shipment.order_id WHERE shipment.driver_id=$1 AND shipment.state IN ('ASSIGNED','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','DELIVERY_FAILED','CUSTOMER_UNAVAILABLE','ADDRESS_PROBLEM','RESCHEDULED') ORDER BY COALESCE((orders.delivery_snapshot->>'date')::date,CURRENT_DATE),shipment.assigned_at`,[driverId])).rows);}
export async function assertDeliveryMode(publicId:string){const valid=await withDatabaseClient(async client=>(await client.execute("SELECT 1 FROM shop_order WHERE public_id=$1 AND delivery_snapshot->>'mode'='DELIVERY'",[publicId])).rowCount);if(!valid)throw new Error("DELIVERY_MODE_REQUIRED");}

async function consumeCommittedAllocations(client:DatabaseClient,orderId:string,actorId:string){
  const allocations=await client.execute<{id:string;variant_id:string;quantity:number}>("SELECT allocation.id,allocation.variant_id,allocation.quantity FROM stock_allocation AS allocation JOIN order_line ON order_line.id=allocation.order_line_id WHERE order_line.order_id=$1 AND allocation.status='COMMITTED' FOR UPDATE",[orderId]);
  for(const allocation of allocations.rows){
    const moved=await client.execute("UPDATE inventory_balance SET on_hand=on_hand-$2,reserved=reserved-$2,updated_at=now() WHERE variant_id=$1 AND on_hand>=reserved AND reserved>=$2",[allocation.variant_id,allocation.quantity]);
    if(!moved.rowCount)throw new Error("INVENTORY_INVARIANT");
    await client.execute("UPDATE stock_allocation SET status='DISPATCHED',updated_at=now() WHERE id=$1",[allocation.id]);
    await client.execute(`INSERT INTO stock_movement(variant_id,kind,on_hand_delta,reserved_delta,on_hand_after,reserved_after,source_type,source_id,actor_id) SELECT variant_id,'DISPATCH',-($2::integer),-($2::integer),on_hand,reserved,'ORDER',$3,$4 FROM inventory_balance WHERE variant_id=$1`,[allocation.variant_id,allocation.quantity,orderId,actorId]);
  }
}

export async function packOrder(publicId:string,actorId:string){return withTransaction(async client=>{
  const order=await client.execute<{id:string;status:string;payment_status:string;fulfillment_status:string}>("SELECT id,status,payment_status,fulfillment_status FROM shop_order WHERE public_id=$1 FOR UPDATE",[publicId]);
  const row=order.rows[0];
  if(!row||!["CONFIRMED","PROCESSING"].includes(row.status)||row.fulfillment_status!=="UNFULFILLED")throw new Error("ORDER_NOT_PACKABLE");
  if(!["PAID","UNPAID"].includes(row.payment_status))throw new Error("PAYMENT_NOT_READY");
  await client.execute("UPDATE shop_order SET status='PROCESSING',fulfillment_status='PACKED',packed_at=now(),updated_at=now() WHERE id=$1",[row.id]);
  await client.execute("UPDATE shipment SET prepared_by=$2,prepared_at=now(),package_count=1,weight_grams=(SELECT CASE WHEN count(*)=count(variant.weight_grams) THEN SUM(variant.weight_grams*line.quantity)::int ELSE NULL END FROM order_line AS line JOIN product_variant AS variant ON variant.id=line.variant_id WHERE line.order_id=$1),updated_at=now() WHERE order_id=$1",[row.id,actorId]);
  await appendAudit(client,{actorId,action:"order.packed",targetType:"order",targetId:row.id,domain:"orders"});
  await appendDomainEvent(client,{eventType:"orders.order.packed.v1",aggregateType:"order",aggregateId:row.id,payload:{orderId:row.id}});
  return{packed:true};
});}

export async function dispatchOrder(publicId:string,driverId:string,actorId:string){return withTransaction(async client=>{
  const order=await client.execute<{id:string;account_id:string;fulfillment_status:string;payment_method:string;external_due_fils:string;phone_e164:string|null}>("SELECT orders.id,orders.account_id,orders.fulfillment_status,orders.payment_method,orders.external_due_fils,account.phone_e164 FROM shop_order AS orders JOIN account ON account.id=orders.account_id WHERE orders.public_id=$1 AND orders.delivery_snapshot->>'mode'='DELIVERY' FOR UPDATE OF orders",[publicId]);
  const row=order.rows[0];if(!row||row.fulfillment_status!=="PACKED")throw new Error("ORDER_NOT_DISPATCHABLE");
  const driver=await client.execute("SELECT 1 FROM staff_account WHERE account_id=$1 AND role_id='DELIVERY_AGENT' AND status='ACTIVE'",[driverId]);if(!driver.rowCount)throw new Error("DRIVER_INVALID");
  const exposure=await client.execute<{held:string;ceiling:string}>(`SELECT COALESCE(SUM(CASE WHEN kind='COLLECTION' THEN amount_fils WHEN kind='FINANCE_VERIFICATION' THEN -amount_fils ELSE 0 END),0) AS held,(SELECT value #>> '{}' FROM app_setting WHERE key='delivery.driver_cash_ceiling_fils') AS ceiling FROM cash_ledger WHERE driver_id=$1`,[driverId]);
  if(row.payment_method==="COD"){
    if(Number(exposure.rows[0].held)+Number(row.external_due_fils)>Number(exposure.rows[0].ceiling))throw new Error("DRIVER_CASH_LIMIT");
    const reviewed=await client.execute<{value:unknown}>("SELECT value FROM app_setting WHERE key='delivery.cod_redelivery_policy_reviewed'");
    if(reviewed.rows[0]?.value!==true)throw new Error("COD_REDELIVERY_POLICY_UNCONFIGURED");
  }
  const pin=String(randomInt(100000,1000000));
  const assigned=await client.execute<{id:string;package_count:number;weight_grams:number|null;expected_cash_fils:string}>("UPDATE shipment SET driver_id=$2,state='ASSIGNED',assigned_at=now(),delivery_pin_hash=$3,pin_expires_at=now()+interval '48 hours',custody_accepted_at=NULL,updated_at=now() WHERE order_id=$1 AND driver_id IS NULL RETURNING id,package_count,weight_grams,expected_cash_fils",[row.id,driverId,hashToken(pin)]);
  if(!assigned.rowCount)throw new Error("SHIPMENT_ALREADY_ASSIGNED");
  await client.execute("INSERT INTO delivery_custody_event(shipment_id,event_type,to_driver_id,actor_id,package_count,weight_grams,expected_cash_fils) VALUES($1,'ASSIGNED',$2,$3,$4,$5,$6)",[assigned.rows[0].id,driverId,actorId,assigned.rows[0].package_count,assigned.rows[0].weight_grams,Number(assigned.rows[0].expected_cash_fils)]);
  await consumeCommittedAllocations(client,row.id,actorId);
  await client.execute("UPDATE shop_order SET fulfillment_status='SHIPPED',updated_at=now() WHERE id=$1",[row.id]);
  await client.execute("UPDATE damage_claim SET status='REPLACEMENT_SHIPPED',updated_at=now() WHERE replacement_order_id=$1 AND status='REPLACEMENT_CREATED'",[row.id]);
  await appendAudit(client,{actorId,action:"order.dispatched",targetType:"order",targetId:row.id,domain:"delivery",after:{driverId}});
  await appendDomainEvent(client,{eventType:"delivery.order.dispatched.v1",aggregateType:"order",aggregateId:row.id,payload:{orderId:row.id}});
  if(row.phone_e164)await queueSecureDelivery(client,{eventType:"delivery.customer_pin.v1",aggregateType:"order",aggregateId:row.id,accountId:row.account_id,channel:"PHONE",destination:row.phone_e164,token:pin,expiresAt:new Date(Date.now()+48*60*60*1000)});
  return{dispatched:true};
});}

export async function acceptDeliveryCustody(publicId:string,driverId:string){return withTransaction(async client=>{const shipment=await client.execute<{id:string;package_count:number;weight_grams:number|null;expected_cash_fils:string}>("UPDATE shipment SET custody_accepted_at=COALESCE(custody_accepted_at,now()),updated_at=now() WHERE order_id=(SELECT id FROM shop_order WHERE public_id=$1) AND driver_id=$2 AND state='ASSIGNED' RETURNING id,package_count,weight_grams,expected_cash_fils",[publicId,driverId]);if(!shipment.rows[0])throw new Error("ASSIGNMENT_NOT_FOUND");const existing=await client.execute("SELECT 1 FROM delivery_custody_event WHERE shipment_id=$1 AND event_type='ACCEPTED' AND to_driver_id=$2",[shipment.rows[0].id,driverId]);if(!existing.rowCount)await client.execute("INSERT INTO delivery_custody_event(shipment_id,event_type,to_driver_id,actor_id,package_count,weight_grams,expected_cash_fils) VALUES($1,'ACCEPTED',$2,$2,$3,$4,$5)",[shipment.rows[0].id,driverId,shipment.rows[0].package_count,shipment.rows[0].weight_grams,Number(shipment.rows[0].expected_cash_fils)]);return{accepted:true};});}

export async function reassignDelivery(publicId:string,newDriverId:string,actorId:string){return withTransaction(async client=>{const driver=await client.execute("SELECT 1 FROM staff_account WHERE account_id=$1 AND role_id='DELIVERY_AGENT' AND status='ACTIVE'",[newDriverId]);if(!driver.rowCount)throw new Error("DRIVER_INVALID");const shipment=await client.execute<{id:string;driver_id:string;package_count:number;weight_grams:number|null;expected_cash_fils:string}>(`SELECT shipment.id,shipment.driver_id,shipment.package_count,shipment.weight_grams,shipment.expected_cash_fils FROM shipment JOIN shop_order ON shop_order.id=shipment.order_id WHERE shop_order.public_id=$1 AND shipment.driver_id IS NOT NULL AND shipment.state IN ('ASSIGNED','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','RESCHEDULED') FOR UPDATE OF shipment`,[publicId]);const row=shipment.rows[0];if(!row||row.driver_id===newDriverId)throw new Error("REASSIGNMENT_INVALID");await client.execute("UPDATE shipment SET driver_id=$2,state='ASSIGNED',assigned_at=now(),custody_accepted_at=NULL,updated_at=now() WHERE id=$1",[row.id,newDriverId]);await client.execute("INSERT INTO delivery_custody_event(shipment_id,event_type,from_driver_id,to_driver_id,actor_id,package_count,weight_grams,expected_cash_fils) VALUES($1,'REASSIGNED',$2,$3,$4,$5,$6,$7)",[row.id,row.driver_id,newDriverId,actorId,row.package_count,row.weight_grams,Number(row.expected_cash_fils)]);await appendAudit(client,{actorId,action:"delivery.reassigned",targetType:"shipment",targetId:row.id,domain:"delivery",before:{driverId:row.driver_id},after:{driverId:newDriverId}});return{reassigned:true};});}

export async function completePickup(publicId:string,actorId:string,input:{pin:string;collectedFils?:number}){return withTransaction(async client=>{
  const result=await client.execute<{order_id:string;shipment_id:string;payment_method:string;external_due_fils:string;payment_status:string;delivery_pin_hash:string|null;pin_expires_at:Date|null}>(`SELECT orders.id AS order_id,shipment.id AS shipment_id,orders.payment_method,orders.external_due_fils,orders.payment_status,shipment.delivery_pin_hash,shipment.pin_expires_at FROM shipment JOIN shop_order AS orders ON orders.id=shipment.order_id WHERE orders.public_id=$1 AND orders.fulfillment_status='PACKED' AND orders.delivery_snapshot->>'mode'='PICKUP' FOR UPDATE OF shipment,orders`,[publicId]);
  const row=result.rows[0];if(!row)throw new Error("PICKUP_NOT_READY");
  if(!row.delivery_pin_hash||row.delivery_pin_hash!==hashToken(input.pin)||!row.pin_expires_at||row.pin_expires_at.getTime()<Date.now())throw new Error("PICKUP_PIN_INVALID");
  if(row.payment_method==="CARD"&&row.payment_status!=="PAID")throw new Error("PAYMENT_NOT_READY");
  if(row.payment_method==="COD"&&input.collectedFils!==Number(row.external_due_fils))throw new Error("COLLECTION_MISMATCH");
  await consumeCommittedAllocations(client,row.order_id,actorId);
  await client.execute("UPDATE shipment SET state='DELIVERED',delivery_pin_hash=NULL,pin_expires_at=NULL,delivered_at=now(),updated_at=now() WHERE id=$1",[row.shipment_id]);
  await client.execute("UPDATE shop_order SET status='COMPLETED',fulfillment_status='DELIVERED',payment_status=CASE WHEN payment_method='COD' THEN 'PAID' ELSE payment_status END,collected_fils=CASE WHEN payment_method='COD' THEN external_due_fils ELSE collected_fils END,delivered_at=now(),updated_at=now() WHERE id=$1",[row.order_id]);
  await client.execute("UPDATE damage_claim SET status='REPLACEMENT_DELIVERED',updated_at=now() WHERE replacement_order_id=$1 AND status IN('REPLACEMENT_CREATED','REPLACEMENT_SHIPPED')",[row.order_id]);
  if(row.payment_method==="COD")await client.execute("INSERT INTO cash_ledger(driver_id,order_id,kind,amount_fils,state,source_id) VALUES($1,$2,'COLLECTION',$3,'COLLECTED_BY_DRIVER',$4)",[actorId,row.order_id,Number(row.external_due_fils),row.shipment_id]);
  await awardDeliveryPoints(client,row.order_id);
  await qualifyReferralReward(client,row.order_id);
  await appendAudit(client,{actorId,action:"pickup.completed",targetType:"order",targetId:row.order_id,domain:"delivery"});
  await appendDomainEvent(client,{eventType:"pickup.order.collected.v1",aggregateType:"order",aggregateId:row.order_id,payload:{orderId:row.order_id}});
  return{collected:true};
});}

async function applyThirdAttemptCharge(client:DatabaseClient,row:{order_id:string;shipment_id:string;payment_method:string;original_delivery_fils:string},attempt:number){
  if(row.payment_method!=="COD"||attempt!==3)return 0;
  const fee=Number(row.original_delivery_fils)*2;
  if(!Number.isSafeInteger(fee)||fee<=0)throw new Error("COD_REDELIVERY_POLICY_UNCONFIGURED");
  const applied=await client.execute("UPDATE shop_order SET delivery_fils=delivery_fils+$2,external_due_fils=external_due_fils+$2,delivery_snapshot=jsonb_set(delivery_snapshot,'{thirdAttemptFeeAppliedFils}',to_jsonb($2::bigint),true),updated_at=now() WHERE id=$1 AND NOT (delivery_snapshot ? 'thirdAttemptFeeAppliedFils')",[row.order_id,fee]);
  if(!applied.rowCount)return 0;
  await client.execute("UPDATE shipment SET expected_cash_fils=expected_cash_fils+$2,updated_at=now() WHERE id=$1",[row.shipment_id,fee]);
  return fee;
}

export async function completeDelivery(publicId:string,driverId:string,input:{pin?:string;collectedFils?:number;doorstep?:boolean;proofMediaId?:string;location?:{latitude:number;longitude:number}}){return withTransaction(async client=>{
  const result=await client.execute<{order_id:string;shipment_id:string;payment_method:string;external_due_fils:string;original_delivery_fils:string;attempt_number:number;delivery_pin_hash:string|null;pin_expires_at:Date|null;doorstep_authorized:boolean}>(`SELECT orders.id AS order_id,shipment.id AS shipment_id,orders.payment_method,orders.external_due_fils,orders.quote_snapshot->>'deliveryFils' AS original_delivery_fils,shipment.attempt_number,shipment.delivery_pin_hash,shipment.pin_expires_at,shipment.doorstep_authorized FROM shipment JOIN shop_order AS orders ON orders.id=shipment.order_id WHERE orders.public_id=$1 AND orders.delivery_snapshot->>'mode'='DELIVERY' AND shipment.driver_id=$2 AND shipment.custody_accepted_at IS NOT NULL AND shipment.state IN ('ASSIGNED','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','RESCHEDULED') FOR UPDATE OF shipment,orders`,[publicId,driverId]);
  const row=result.rows[0];if(!row)throw new Error("ASSIGNMENT_NOT_FOUND");
  const attempt=row.attempt_number+1;if(attempt>3)throw new Error("ATTEMPT_LIMIT");
  const additionalFee=await applyThirdAttemptCharge(client,row,attempt);const amountDue=Number(row.external_due_fils)+additionalFee;
  const pinOk=Boolean(input.pin&&row.delivery_pin_hash===hashToken(input.pin)&&row.pin_expires_at&&new Date(row.pin_expires_at).getTime()>=Date.now());
  if(row.payment_method==="COD"&&!pinOk)throw new Error("PIN_REQUIRED");
  if(row.payment_method==="COD"&&input.collectedFils!==amountDue)throw new Error("COLLECTION_MISMATCH");
  if(row.payment_method==="COD"){const exposure=await client.execute<{held:string;ceiling:string}>(`SELECT COALESCE(SUM(CASE WHEN kind='COLLECTION' THEN amount_fils WHEN kind='FINANCE_VERIFICATION' THEN -amount_fils ELSE 0 END),0) AS held,(SELECT value #>> '{}' FROM app_setting WHERE key='delivery.driver_cash_ceiling_fils') AS ceiling FROM cash_ledger WHERE driver_id=$1`,[driverId]);if(Number(exposure.rows[0].held)+amountDue>Number(exposure.rows[0].ceiling))throw new Error("DRIVER_CASH_LIMIT");}
  if(input.doorstep&&(row.payment_method!=="CARD"||!row.doorstep_authorized))throw new Error("DOORSTEP_NOT_ALLOWED");
  if(input.doorstep&&(!input.proofMediaId||!input.location))throw new Error("DOORSTEP_PROOF_REQUIRED");
  if(!pinOk&&!input.doorstep)throw new Error("PROOF_REQUIRED");
  if(input.proofMediaId){const proof=await client.execute("UPDATE media_object SET owner_type='DELIVERY_PROOF',owner_id=$2 WHERE id=$1 AND owner_type='ACCOUNT_UPLOAD' AND owner_id=$3 AND access_class='PRIVATE' AND scan_status='CLEAN' AND deleted_at IS NULL",[input.proofMediaId,row.shipment_id,driverId]);if(!proof.rowCount)throw new Error("DELIVERY_PROOF_INVALID");}
  await client.execute("INSERT INTO delivery_attempt(shipment_id,attempt_number,driver_id,result,proof_media_id,pin_verified,doorstep_used,location_snapshot,proof_purge_at) VALUES($1,$2,$3,'DELIVERED',$4,$5,$6,$7::jsonb,CASE WHEN $6 THEN now()+interval '30 days' ELSE NULL END)",[row.shipment_id,attempt,driverId,input.proofMediaId??null,pinOk,Boolean(input.doorstep),input.location?JSON.stringify(input.location):null]);
  await client.execute("UPDATE shipment SET state='DELIVERED',attempt_number=$2,delivered_at=now(),delivery_pin_hash=NULL,pin_expires_at=NULL,updated_at=now() WHERE id=$1",[row.shipment_id,attempt]);
  await client.execute("UPDATE shop_order SET status='COMPLETED',fulfillment_status='DELIVERED',payment_status=CASE WHEN payment_method='COD' THEN 'PAID' ELSE payment_status END,collected_fils=CASE WHEN payment_method='COD' THEN external_due_fils ELSE collected_fils END,delivered_at=now(),updated_at=now() WHERE id=$1",[row.order_id]);
  await client.execute("UPDATE damage_claim SET status='REPLACEMENT_DELIVERED',updated_at=now() WHERE replacement_order_id=$1 AND status IN('REPLACEMENT_CREATED','REPLACEMENT_SHIPPED')",[row.order_id]);
  if(row.payment_method==="COD")await client.execute("INSERT INTO cash_ledger(driver_id,order_id,kind,amount_fils,state,source_id) VALUES($1,$2,'COLLECTION',$3,'COLLECTED_BY_DRIVER',$4)",[driverId,row.order_id,amountDue,row.shipment_id]);
  await awardDeliveryPoints(client,row.order_id);
  await qualifyReferralReward(client,row.order_id);
  await appendAudit(client,{actorId:driverId,actorRole:"DELIVERY_AGENT",action:"delivery.completed",targetType:"order",targetId:row.order_id,domain:"delivery",after:{attempt,pinVerified:pinOk,doorstep:Boolean(input.doorstep),collectedFils:row.payment_method==="COD"?amountDue:0}});
  await appendDomainEvent(client,{eventType:"delivery.order.delivered.v1",aggregateType:"order",aggregateId:row.order_id,payload:{orderId:row.order_id}});
  return{delivered:true,attempt,collectedFils:row.payment_method==="COD"?amountDue:0};
});}

export async function recordFailedDelivery(publicId:string,driverId:string,input:{reason:string;contactEffort:string}){return withTransaction(async client=>{
  const result=await client.execute<{order_id:string;shipment_id:string;payment_method:string;original_delivery_fils:string;attempt_number:number;state:string}>(`SELECT orders.id AS order_id,shipment.id AS shipment_id,orders.payment_method,orders.quote_snapshot->>'deliveryFils' AS original_delivery_fils,shipment.attempt_number,shipment.state FROM shipment JOIN shop_order AS orders ON orders.id=shipment.order_id WHERE orders.public_id=$1 AND shipment.driver_id=$2 AND shipment.custody_accepted_at IS NOT NULL AND shipment.state IN ('ASSIGNED','READY_FOR_DELIVERY','OUT_FOR_DELIVERY','RESCHEDULED') FOR UPDATE OF shipment,orders`,[publicId,driverId]);
  const row=result.rows[0];if(!row)throw new Error("ASSIGNMENT_NOT_FOUND");const attempt=row.attempt_number+1;if(attempt>3)throw new Error("ATTEMPT_LIMIT");
  await client.execute("INSERT INTO delivery_attempt(shipment_id,attempt_number,driver_id,result,reason,contact_effort) VALUES($1,$2,$3,'FAILED',$4,$5)",[row.shipment_id,attempt,driverId,input.reason,input.contactEffort]);
  const additionalFee=await applyThirdAttemptCharge(client,row,attempt);
  if(row.payment_method==="COD"&&attempt===2){const redeliveryFeeFils=Number(row.original_delivery_fils)*2;await appendDomainEvent(client,{eventType:"delivery.third_attempt_quote.v1",aggregateType:"order",aggregateId:row.order_id,payload:{orderId:row.order_id,redeliveryFeeFils}});}
  if(attempt===3){await client.execute("UPDATE shipment SET state='CANCELLED',attempt_number=$2,updated_at=now() WHERE id=$1",[row.shipment_id,attempt]);await client.execute("UPDATE shop_order SET status='CANCELLED',fulfillment_status='CANCELLED',updated_at=now() WHERE id=$1",[row.order_id]);await client.execute("UPDATE stock_allocation SET status='RETURN_PENDING',updated_at=now() WHERE order_line_id IN(SELECT id FROM order_line WHERE order_id=$1) AND status='DISPATCHED'",[row.order_id]);}else await client.execute("UPDATE shipment SET state='RESCHEDULED',attempt_number=$2,updated_at=now() WHERE id=$1",[row.shipment_id,attempt]);
  await appendDomainEvent(client,{eventType:"delivery.attempt.failed.v1",aggregateType:"order",aggregateId:row.order_id,payload:{orderId:row.order_id,attempt}});
  await appendAudit(client,{actorId:driverId,actorRole:"DELIVERY_AGENT",action:"delivery.attempt.failed",targetType:"order",targetId:row.order_id,domain:"delivery",after:{attempt,reason:input.reason,additionalFeeFils:additionalFee}});
  return{attempt,cancelled:attempt===3,additionalFeeFils:additionalFee};
});}
