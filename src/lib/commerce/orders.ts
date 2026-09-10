import { randomInt } from "node:crypto";
import type { PoolClient } from "@neondatabase/serverless";
import { z } from "zod";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { appendAudit } from "@/lib/audit/service";
import { appendDomainEvent } from "@/lib/events/outbox";
import { hashToken } from "@/lib/security/crypto";
import { nextAmmanDeliveryDate } from "@/lib/domain/policies";
import { getRuntimeConfig } from "@/lib/config/env";
import { createHostedPayment, queryHostedPayment, type ProviderWebhook } from "@/lib/payments/provider";
import { queueSecureDelivery } from "@/lib/notifications/secure-delivery";

const checkoutInput = z.object({
  paymentMethod: z.enum(["CARD","COD"]), fulfillmentMode:z.enum(["DELIVERY","PICKUP"]).default("DELIVERY"), deliveryZoneId: z.string().uuid().optional(), deliveryWindowId: z.string().uuid().optional(), pickupLocationId:z.string().uuid().optional(),
  recipient: z.object({ name:z.string().min(2), phone:z.string().min(8), city:z.string().min(2), area:z.string().min(2), street:z.string().min(2), building:z.string().optional(), notes:z.string().max(500).optional() }),
  termsDocumentId: z.string().uuid(), idempotencyKey: z.string().min(16).max(100), doorstepAuthorized: z.boolean().default(false),
}).refine(value=>value.fulfillmentMode==='DELIVERY'?Boolean(value.deliveryZoneId&&value.deliveryWindowId):Boolean(value.pickupLocationId),{message:'Fulfillment selection is incomplete'});

const checkoutResult = z.object({
  orderId: z.string(), status: z.enum(["CONFIRMED","PAYMENT_REQUIRED"]), totalFils: z.number().int(), currency: z.literal("JOD"),
  paymentReference: z.string().optional(), paymentUrl: z.string().url().optional(), paymentFields: z.record(z.string(),z.string()).optional(),
});
type CheckoutResult = z.infer<typeof checkoutResult>;

export async function quoteSelectedCart(accountId: string, zoneId: string) {
  return withDatabaseClient(async (client) => {
    const lines = await client.query<{ id:string; quantity:number; unit_price_fils:string; available:number|null }>(
      `SELECT line.id,line.quantity,COALESCE(variant.price_override_fils,product.base_price_fils) AS unit_price_fils,
              CASE WHEN variant.inventory_tracking THEN balance.on_hand-balance.reserved ELSE NULL END AS available
       FROM cart JOIN cart_line AS line ON line.cart_id=cart.id JOIN product_variant AS variant ON variant.id=line.variant_id
       JOIN product ON product.id=variant.product_id JOIN inventory_balance AS balance ON balance.variant_id=variant.id
       WHERE cart.account_id=$1 AND line.selected AND product.status='ACTIVE' AND variant.enabled AND variant.purchasable`, [accountId],
    );
    if (!lines.rowCount) throw new Error("CART_EMPTY");
    const zone = await client.query<{ id:string; fee_fils:string; eta_min_days:number; eta_max_days:number }>(
      "SELECT id,fee_fils,eta_min_days,eta_max_days FROM delivery_zone WHERE id=$1 AND active AND policy_reviewed", [zoneId],
    );
    if (!zone.rowCount) throw new Error("DELIVERY_UNAVAILABLE");
    const merchandiseFils = lines.rows.reduce((sum,line)=>sum + Number(line.unit_price_fils)*line.quantity,0);
    const deliveryFils = Number(zone.rows[0].fee_fils);
    return { currency:"JOD",merchandiseFils,discountFils:0,taxFils:0,deliveryFils,totalFils:merchandiseFils+deliveryFils,lines:lines.rows,zone:zone.rows[0] };
  });
}

export async function checkout(accountId: string, raw: unknown) {
  const input = checkoutInput.parse(raw);
  const result = await withTransaction<CheckoutResult>(async (client) => {
    const prior = await client.query<{ response_body: unknown; request_hash: string }>("SELECT response_body,request_hash FROM idempotency_record WHERE scope='CHECKOUT' AND idempotency_key=$1 FOR UPDATE",[input.idempotencyKey]);
    const requestHash = JSON.stringify(input);
    if (prior.rows[0]) {
      if (prior.rows[0].request_hash !== requestHash) throw new Error("IDEMPOTENCY_CONFLICT");
      return checkoutResult.parse(prior.rows[0].response_body);
    }
    await client.query(`INSERT INTO idempotency_record(scope,idempotency_key,request_hash,status,expires_at) VALUES('CHECKOUT',$1,$2,'PROCESSING',now()+interval '24 hours')`,[input.idempotencyKey,requestHash]);
    const account = await client.query<{ phone_verified_at:Date|null; phone_e164:string|null; status:string }>("SELECT phone_verified_at,phone_e164,status FROM account WHERE id=$1 FOR UPDATE",[accountId]);
    if (!account.rows[0]?.phone_verified_at) throw new Error("PHONE_VERIFICATION_REQUIRED");
    if (account.rows[0].status !== "ACTIVE") throw new Error("ACCOUNT_INACTIVE");
    const terms = await client.query("SELECT 1 FROM terms_document WHERE id=$1 AND published_at IS NOT NULL",[input.termsDocumentId]);
    if (!terms.rowCount) throw new Error("TERMS_VERSION_INVALID");
    if(input.paymentMethod==='CARD'&&input.fulfillmentMode==='DELIVERY'&&!input.doorstepAuthorized)throw new Error('DOORSTEP_TERMS_REQUIRED');
    let deliveryFee=0;let scheduledDate:string|undefined;
    if(input.fulfillmentMode==='DELIVERY'){const zone = await client.query<{ fee_fils:string; policy_reviewed:boolean }>("SELECT fee_fils,policy_reviewed FROM delivery_zone WHERE id=$1 AND active FOR SHARE",[input.deliveryZoneId]);if (!zone.rows[0]?.policy_reviewed) throw new Error("DELIVERY_UNAVAILABLE");deliveryFee=Number(zone.rows[0].fee_fils);if(input.paymentMethod==='COD'){const reviewed=await client.query<{value:unknown}>("SELECT value FROM app_setting WHERE key='delivery.cod_redelivery_policy_reviewed'");if(reviewed.rows[0]?.value!==true||deliveryFee<=0)throw new Error("COD_REDELIVERY_POLICY_UNCONFIGURED");}const window = await client.query<{weekday:number;capacity:number}>("SELECT weekday,capacity FROM delivery_window WHERE id=$1 AND zone_id=$2 AND active FOR UPDATE",[input.deliveryWindowId,input.deliveryZoneId]);if (!window.rows[0]) throw new Error("WINDOW_UNAVAILABLE");scheduledDate=nextAmmanDeliveryDate(window.rows[0].weekday);const booked=await client.query<{count:number}>("SELECT count(*)::int AS count FROM shop_order WHERE delivery_snapshot->>'windowId'=$1 AND delivery_snapshot->>'scheduledDate'=$2 AND status NOT IN('CANCELLED','FAILED')",[input.deliveryWindowId,scheduledDate]);if(booked.rows[0].count>=window.rows[0].capacity)throw new Error("WINDOW_FULL");}else{const pickup=await client.query("SELECT 1 FROM pickup_location WHERE id=$1 AND active FOR SHARE",[input.pickupLocationId]);if(!pickup.rowCount)throw new Error('PICKUP_UNAVAILABLE');}
    const tax = await client.query<{ value:unknown }>("SELECT value FROM app_setting WHERE key='checkout.tax_policy'");
    if (tax.rows[0]?.value !== "NONE_REVIEWED") throw new Error("TAX_POLICY_UNCONFIGURED");
    const lines = await client.query<{ line_id:string;variant_id:string;product_id:string;sku:string;option_values:unknown;quantity:number;name_en:string;name_ar:string;unit_price_fils:string;inventory_tracking:boolean;on_hand:number;reserved:number;image_id:string|null;image_alt_en:string|null;image_alt_ar:string|null }>(
      `SELECT line.id AS line_id,variant.id AS variant_id,product.id AS product_id,variant.sku,variant.option_values,line.quantity,
              product.name_en,product.name_ar,COALESCE(variant.price_override_fils,product.base_price_fils) AS unit_price_fils,
              variant.inventory_tracking,balance.on_hand,balance.reserved,media.id AS image_id,media.alt_en AS image_alt_en,media.alt_ar AS image_alt_ar
       FROM cart JOIN cart_line AS line ON line.cart_id=cart.id JOIN product_variant AS variant ON variant.id=line.variant_id
       JOIN product ON product.id=variant.product_id JOIN inventory_balance AS balance ON balance.variant_id=variant.id
       LEFT JOIN LATERAL (SELECT object.id,object.alt_en,object.alt_ar FROM media_object AS object WHERE object.owner_type='PRODUCT' AND object.owner_id=product.id AND object.access_class='PUBLIC' AND object.scan_status='CLEAN' AND object.deleted_at IS NULL ORDER BY object.position,object.id LIMIT 1) AS media ON true
       WHERE cart.account_id=$1 AND line.selected AND product.status='ACTIVE' AND variant.enabled AND variant.purchasable
       FOR UPDATE OF line,variant,balance`,[accountId]);
    if (!lines.rowCount) throw new Error("CART_EMPTY");
    for (const line of lines.rows) if (line.inventory_tracking && line.on_hand-line.reserved < line.quantity) throw new Error("INSUFFICIENT_STOCK");
    const merchandise = lines.rows.reduce((sum,line)=>sum+Number(line.unit_price_fils)*line.quantity,0);
    const delivery = deliveryFee; const total=merchandise+delivery;
    if(input.paymentMethod==='CARD'&&total%10!==0)throw new Error('CARD_AMOUNT_REQUIRES_TEN_FILS_PRECISION');
    const order = await client.query<{id:string;public_id:string}>(
      `INSERT INTO shop_order(account_id,status,payment_status,fulfillment_status,payment_method,merchandise_fils,delivery_fils,external_due_fils,
        quote_snapshot,recipient_snapshot,delivery_snapshot,terms_document_id,placed_at)
       VALUES($1,$2,$3,'UNFULFILLED',$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,now()) RETURNING id,public_id`,
      [accountId,input.paymentMethod==='COD'?'CONFIRMED':'CREATED',input.paymentMethod==='COD'?'UNPAID':'PENDING',input.paymentMethod,merchandise,delivery,total,
       JSON.stringify({currency:'JOD',merchandiseFils:merchandise,discountFils:0,taxFils:0,deliveryFils:delivery,totalFils:total}),JSON.stringify(input.recipient),JSON.stringify({mode:input.fulfillmentMode,zoneId:input.deliveryZoneId,windowId:input.deliveryWindowId,scheduledDate,pickupLocationId:input.pickupLocationId,doorstepAuthorized:input.doorstepAuthorized,codRedelivery:input.paymentMethod==='COD'&&input.fulfillmentMode==='DELIVERY'?{additionalFeeMultiplier:2,chargeTrigger:'THIRD_ATTEMPT_MADE'}:null}),input.termsDocumentId],
    );
    for (const line of lines.rows) {
      const ol = await client.query<{id:string}>(`INSERT INTO order_line(order_id,variant_id,product_id,sku,name_snapshot,options_snapshot,image_snapshot,quantity,unit_base_fils,unit_net_fils) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$9) RETURNING id`,[order.rows[0].id,line.variant_id,line.product_id,line.sku,JSON.stringify({en:line.name_en,ar:line.name_ar}),JSON.stringify(line.option_values),line.image_id?JSON.stringify({mediaId:line.image_id,alt:{en:line.image_alt_en,ar:line.image_alt_ar}}):null,line.quantity,Number(line.unit_price_fils)]);
      if (line.inventory_tracking) {
        await client.query("UPDATE inventory_balance SET reserved=reserved+$2,updated_at=now() WHERE variant_id=$1",[line.variant_id,line.quantity]);
        await client.query(`INSERT INTO stock_movement(variant_id,kind,reserved_delta,on_hand_after,reserved_after,source_type,source_id,actor_id) SELECT variant_id,'RESERVE',$2,on_hand,reserved,'ORDER',$3,$4 FROM inventory_balance WHERE variant_id=$1`,[line.variant_id,line.quantity,order.rows[0].id,accountId]);
      }
      await client.query("INSERT INTO stock_allocation(order_line_id,variant_id,quantity,status,expires_at) VALUES($1,$2,$3,$4,$5)",[ol.rows[0].id,line.variant_id,line.quantity,input.paymentMethod==='COD'?'COMMITTED':'HELD',input.paymentMethod==='CARD'?new Date(Date.now()+15*60*1000):null]);
    }
    await client.query("DELETE FROM cart_line WHERE id=ANY($1::uuid[])",[lines.rows.map(line=>line.line_id)]);
    await client.query("INSERT INTO consent_event(account_id,order_id,purpose,document_id,granted,affirmative_action) VALUES($1,$2,'ORDER_TERMS',$3,true,'checkout_checkbox')",[accountId,order.rows[0].id,input.termsDocumentId]);
    const pickupPin=input.fulfillmentMode==='PICKUP'?String(randomInt(100000,1000000)):undefined;
    await client.query("INSERT INTO shipment(order_id,internal_reference,expected_cash_fils,delivery_pin_hash,pin_expires_at,doorstep_authorized) VALUES($1,$2,$3,$4,CASE WHEN $4::text IS NULL THEN NULL ELSE now()+interval '7 days' END,$5)",[order.rows[0].id,`SHP-${order.rows[0].public_id.slice(4).toUpperCase()}`,input.paymentMethod==='COD'?total:0,pickupPin?hashToken(pickupPin):null,input.doorstepAuthorized]);
    if(pickupPin&&account.rows[0].phone_e164)await queueSecureDelivery(client,{eventType:"delivery.customer_pin.v1",aggregateType:"order",aggregateId:order.rows[0].id,accountId,channel:"PHONE",destination:account.rows[0].phone_e164,token:pickupPin,expiresAt:new Date(Date.now()+7*24*60*60*1000)});
    if (input.paymentMethod==='CARD') {
      const config=getRuntimeConfig();
      await client.query("INSERT INTO payment(order_id,purpose,method,provider,amount_fils,status,operation_key,expires_at,reconcile_after) VALUES($1,'ORDER','CARD',$2,$3,'CREATED',$4,now()+interval '15 minutes',now()+interval '2 minutes')",[order.rows[0].id,config.SIM_MODE||config.APP_ENV==='test'?'SIMULATED_APS':'AMAZON_PAYMENT_SERVICES',total,`order:${order.rows[0].id}`]);
    }
    await appendAudit(client,{actorId:accountId,action:"order.created",targetType:"order",targetId:order.rows[0].id,domain:"orders",after:{method:input.paymentMethod,total}});
    await appendDomainEvent(client,{eventType:"orders.order.created.v1",aggregateType:"order",aggregateId:order.rows[0].id,payload:{orderId:order.rows[0].id,paymentMethod:input.paymentMethod}});
    const response:CheckoutResult={orderId:order.rows[0].public_id,status:input.paymentMethod==='COD'?'CONFIRMED':'PAYMENT_REQUIRED',totalFils:total,currency:'JOD'};
    await client.query("UPDATE idempotency_record SET status='COMPLETED',response_status=201,response_body=$2::jsonb WHERE scope='CHECKOUT' AND idempotency_key=$1",[input.idempotencyKey,JSON.stringify(response)]);
    return response;
  });
  if (input.paymentMethod === "COD" || result.paymentReference) return result;
  const payment = await initializeOrderCardPayment(accountId, result.orderId);
  const completed = { ...result, paymentReference: payment.reference, paymentUrl: payment.hostedUrl, paymentFields: payment.formFields };
  await withDatabaseClient((client) => client.query(
    "UPDATE idempotency_record SET response_body=$2::jsonb WHERE scope='CHECKOUT' AND idempotency_key=$1 AND status='COMPLETED'",
    [input.idempotencyKey, JSON.stringify(completed)],
  ).then(() => undefined));
  return completed;
}

async function initializeOrderCardPayment(accountId:string, orderPublicId:string){
  const row=await withDatabaseClient(async client=>(await client.query<{id:string;operation_key:string;amount_fils:string;provider_reference:string|null;hosted_url:string|null;email_normalized:string}>(`SELECT payment.id,payment.operation_key,payment.amount_fils,payment.provider_reference,payment.hosted_url,account.email_normalized FROM payment JOIN shop_order ON shop_order.id=payment.order_id JOIN account ON account.id=shop_order.account_id WHERE shop_order.public_id=$1 AND shop_order.account_id=$2 AND payment.purpose='ORDER'`,[orderPublicId,accountId])).rows[0]);
  if(!row)throw new Error("PAYMENT_NOT_FOUND");
  const returnUrl=new URL(`/api/v1/payments/return`,getRuntimeConfig().API_ORIGIN).toString();
  const session=await createHostedPayment({operationKey:row.operation_key,amountFils:Number(row.amount_fils),returnUrl,purpose:"ORDER",entityReference:orderPublicId,customerEmail:row.email_normalized});
  await withDatabaseClient(async client=>{const updated=await client.query("UPDATE payment SET provider_reference=$2,hosted_url=$3,status='PENDING',expires_at=COALESCE($4::timestamptz,expires_at),updated_at=now() WHERE id=$1 AND (provider_reference IS NULL OR provider_reference=$2)",[row.id,session.reference,session.hostedUrl,session.expiresAt??null]);if(!updated.rowCount)throw new Error("PAYMENT_SESSION_CONFLICT");});
  return{reference:session.reference,hostedUrl:session.hostedUrl,formFields:session.formFields};
}

export async function applyCardPaymentStatus(input: Pick<ProviderWebhook,"reference"|"status"|"amountFils"|"currency"|"evidence">) {
  return withTransaction(async (client) => {
    const payment = await client.query<{ id:string; order_id:string|null; amount_fils:string; status:string }>(
      `SELECT id,order_id,amount_fils,status FROM payment
       WHERE provider_reference=$1 FOR UPDATE`,
      [input.reference],
    );
    const row=payment.rows[0];
    if(!row||Number(row.amount_fils)!==input.amountFils||input.currency!=="JOD")throw new Error("PAYMENT_EVIDENCE_MISMATCH");
    const orderStatus=row.order_id?(await client.query<{status:string}>("SELECT status FROM shop_order WHERE id=$1 FOR UPDATE",[row.order_id])).rows[0]?.status:null;
    if(input.status!=="CONFIRMED"){
      if(input.status==="FAILED"&&row.status!=="CONFIRMED"&&row.order_id&&orderStatus==="CREATED"){
        await failUnconfirmedOrder(client,row.id,row.order_id,"payments.card.failed.v1",input.evidence);
        return{confirmed:false,status:input.status};
      }
      if(row.status!=="CONFIRMED")await client.query("UPDATE payment SET status=$2,signed_evidence=$3::jsonb,updated_at=now() WHERE id=$1",[row.id,input.status,JSON.stringify(input.evidence)]);
      return{confirmed:false,status:input.status};
    }
    if(row.status==="CONFIRMED"&&orderStatus!=="CREATED")return{confirmed:true,replayed:true};
    await client.query("UPDATE payment SET status='CONFIRMED',signed_evidence=$2::jsonb,updated_at=now() WHERE id=$1",[row.id,JSON.stringify(input.evidence)]);
    if(!row.order_id)throw new Error("PAYMENT_ORDER_MISSING");
    if(orderStatus==="CANCELLED"){
      await client.query("UPDATE shop_order SET payment_status='PAID',collected_fils=external_due_fils,updated_at=now() WHERE id=$1",[row.order_id]);
      await client.query("INSERT INTO refund(order_id,payment_id,amount_fils,reason,status) VALUES($1,$2,$3,'LATE_PAYMENT_AFTER_CANCELLATION','REQUIRED') ON CONFLICT DO NOTHING",[row.order_id,row.id,Number(row.amount_fils)]);
      return{confirmed:true,replayed:false,refundRequired:true};
    }
    if(orderStatus!=="CREATED")throw new Error("PAYMENT_ORDER_STATE_INVALID");
    const allocation=await client.query("UPDATE stock_allocation SET status='COMMITTED',expires_at=NULL,updated_at=now() WHERE order_line_id IN(SELECT id FROM order_line WHERE order_id=$1) AND status='HELD'",[row.order_id]);
    if(!allocation.rowCount)throw new Error("PAYMENT_ALLOCATION_MISSING");
    await client.query("UPDATE shop_order SET status='CONFIRMED',payment_status='PAID',collected_fils=external_due_fils,updated_at=now() WHERE id=$1",[row.order_id]);
    await appendDomainEvent(client,{eventType:"payments.card.confirmed.v1",aggregateType:"order",aggregateId:row.order_id,payload:{orderId:row.order_id}});
    return{confirmed:true,replayed:false};
  });
}

export async function confirmLocalCardPayment(accountId:string,orderPublicId:string,providerReference:string){
  if(process.env.APP_ENV==="production"||process.env.APP_ENV==="preview")throw new Error("NOT_FOUND");
  const payment=await withDatabaseClient(async client=>(await client.query<{amount_fils:string}>(`SELECT payment.amount_fils FROM payment JOIN shop_order ON shop_order.id=payment.order_id WHERE payment.provider='SIMULATED_APS' AND payment.provider_reference=$1 AND shop_order.public_id=$2 AND shop_order.account_id=$3`,[providerReference,orderPublicId,accountId])).rows[0]);
  if(!payment)throw new Error("PAYMENT_NOT_FOUND");
  return applyCardPaymentStatus({reference:providerReference,status:"CONFIRMED",amountFils:Number(payment.amount_fils),currency:"JOD",evidence:{source:"local-sandbox",confirmedAt:new Date().toISOString()}});
}

export async function listOrders(accountId:string){return withDatabaseClient(async client=>(await client.query("SELECT public_id,status,payment_status,fulfillment_status,payment_method,merchandise_fils,delivery_fils,external_due_fils,collected_fils,refunded_fils,placed_at FROM shop_order WHERE account_id=$1 ORDER BY created_at DESC",[accountId])).rows);}

export async function getOrderDetail(accountId:string,publicId:string){return withDatabaseClient(async client=>{const order=await client.query<{id:string;public_id:string;status:string;payment_status:string;fulfillment_status:string;payment_method:string;currency:string;merchandise_fils:string;delivery_fils:string;tax_fils:string;discount_fils:string;external_due_fils:string;collected_fils:string;refunded_fils:string;quote_snapshot:unknown;recipient_snapshot:unknown;delivery_snapshot:unknown;placed_at:Date;packed_at:Date|null;delivered_at:Date|null;cancelled_at:Date|null}>("SELECT id,public_id,status,payment_status,fulfillment_status,payment_method,currency,merchandise_fils,delivery_fils,tax_fils,discount_fils,external_due_fils,collected_fils,refunded_fils,quote_snapshot,recipient_snapshot,delivery_snapshot,placed_at,packed_at,delivered_at,cancelled_at FROM shop_order WHERE account_id=$1 AND public_id=$2",[accountId,publicId]);if(!order.rows[0])throw new Error("ORDER_NOT_FOUND");const id=order.rows[0].id;const[lines,shipment,payments,attempts,timeline]=await Promise.all([client.query("SELECT sku,name_snapshot,options_snapshot,image_snapshot,quantity,unit_base_fils,unit_net_fils,refunded_quantity FROM order_line WHERE order_id=$1 ORDER BY id",[id]),client.query("SELECT internal_reference,state,attempt_number,doorstep_authorized,delivered_at FROM shipment WHERE order_id=$1",[id]),client.query("SELECT method,provider_reference,amount_fils,currency,status,created_at,updated_at FROM payment WHERE order_id=$1 ORDER BY created_at",[id]),client.query("SELECT attempt_number,result,reason,contact_effort,pin_verified,doorstep_used,occurred_at FROM delivery_attempt WHERE shipment_id=(SELECT id FROM shipment WHERE order_id=$1) ORDER BY attempt_number",[id]),client.query("SELECT event_type,occurred_at FROM domain_event_outbox WHERE aggregate_type='order' AND aggregate_id=$1 ORDER BY occurred_at",[id])]);const{id:_internalId,...customerOrder}=order.rows[0];void _internalId;return{order:customerOrder,lines:lines.rows,shipment:shipment.rows[0]??null,payments:payments.rows,attempts:attempts.rows,timeline:timeline.rows};});}

export async function reorderToSavedCart(accountId:string,publicId:string){return withTransaction(async client=>{const order=await client.query<{id:string}>("SELECT id FROM shop_order WHERE account_id=$1 AND public_id=$2",[accountId,publicId]);if(!order.rows[0])throw new Error("ORDER_NOT_FOUND");const lines=await client.query<{variant_id:string;sku:string;quantity:number;active:boolean;available:number|null;current_price_fils:string}>(`SELECT line.variant_id,line.sku,line.quantity,(product.status='ACTIVE' AND variant.enabled AND variant.purchasable) AS active,CASE WHEN variant.inventory_tracking THEN balance.on_hand-balance.reserved ELSE NULL END AS available,COALESCE(variant.price_override_fils,product.base_price_fils) AS current_price_fils FROM order_line AS line JOIN product_variant AS variant ON variant.id=line.variant_id JOIN product ON product.id=variant.product_id LEFT JOIN inventory_balance AS balance ON balance.variant_id=variant.id WHERE line.order_id=$1`,[order.rows[0].id]);const cart=await client.query<{id:string}>("INSERT INTO cart(account_id) VALUES($1) ON CONFLICT(account_id) DO UPDATE SET updated_at=now() RETURNING id",[accountId]);const added=[];const rejected=[];for(const line of lines.rows){const available=line.available??line.quantity;if(!line.active||available<1){rejected.push({sku:line.sku,reason:line.active?"OUT_OF_STOCK":"UNAVAILABLE"});continue;}const quantity=Math.min(line.quantity,available,99);await client.query("INSERT INTO cart_line(cart_id,variant_id,quantity,selected) VALUES($1,$2,$3,false) ON CONFLICT(cart_id,variant_id) DO UPDATE SET quantity=LEAST(99,cart_line.quantity+EXCLUDED.quantity),selected=false,updated_at=now()",[cart.rows[0].id,line.variant_id,quantity]);added.push({sku:line.sku,quantity,currentPriceFils:Number(line.current_price_fils)});}return{added,rejected,selectionConfirmationRequired:added.length>0};});}

export async function reconcileExpiredCardOrders(){
  const candidates=await withDatabaseClient(async client=>(await client.query<{id:string;order_id:string;provider:string;provider_reference:string|null;amount_fils:string;currency:"JOD"}>(`SELECT payment.id,payment.order_id,payment.provider,payment.provider_reference,payment.amount_fils,payment.currency FROM payment JOIN shop_order ON shop_order.id=payment.order_id WHERE shop_order.status='CREATED' AND payment.purpose='ORDER' AND payment.status IN('CREATED','PENDING','UNKNOWN') AND (payment.reconcile_after<=now() OR payment.expires_at<=now()) ORDER BY payment.created_at LIMIT 100`)).rows);
  let confirmed=0,failed=0,unknown=0;
  for(const candidate of candidates){
    if(candidate.provider!=="SIMULATED_APS"&&candidate.provider_reference){
      try{
        const provider=await queryHostedPayment(candidate.provider_reference);
        if(provider.status==="CONFIRMED"){await applyCardPaymentStatus(provider);confirmed+=1;continue;}
        if(provider.status!=="FAILED"){
          await withDatabaseClient(client=>client.query("UPDATE payment SET status=$2,reconcile_count=reconcile_count+1,reconcile_after=now()+interval '2 minutes',updated_at=now() WHERE id=$1 AND status<>'CONFIRMED'",[candidate.id,provider.status]).then(()=>undefined));
          unknown+=1;continue;
        }
      }catch{
        await withDatabaseClient(client=>client.query("UPDATE payment SET status='UNKNOWN',reconcile_count=reconcile_count+1,reconcile_after=now()+interval '2 minutes',updated_at=now() WHERE id=$1 AND status<>'CONFIRMED'",[candidate.id]).then(()=>undefined));
        unknown+=1;continue;
      }
    }else if(candidate.provider!=="SIMULATED_APS"){
      await withDatabaseClient(client=>client.query("UPDATE payment SET status='UNKNOWN',reconcile_count=reconcile_count+1,reconcile_after=now()+interval '2 minutes',updated_at=now() WHERE id=$1",[candidate.id]).then(()=>undefined));
      unknown+=1;continue;
    }
    await expireUnconfirmedOrder(candidate.id,candidate.order_id);failed+=1;
  }
  return{checked:candidates.length,confirmed,failed,unknown};
}

async function expireUnconfirmedOrder(paymentId:string,orderId:string){
  return withTransaction(client=>failUnconfirmedOrder(client,paymentId,orderId,"payments.card.expired.v1",null));
}

async function failUnconfirmedOrder(client:PoolClient,paymentId:string,orderId:string,eventType:"payments.card.failed.v1"|"payments.card.expired.v1",evidence:unknown){
  const order=await client.query("SELECT id FROM shop_order WHERE id=$1 AND status='CREATED' FOR UPDATE",[orderId]);
  if(!order.rowCount)return;
  const allocations=await client.query<{id:string;variant_id:string;quantity:number}>("SELECT allocation.id,allocation.variant_id,allocation.quantity FROM stock_allocation AS allocation JOIN order_line ON order_line.id=allocation.order_line_id WHERE order_line.order_id=$1 AND allocation.status='HELD' FOR UPDATE",[orderId]);
  for(const allocation of allocations.rows){
    const released=await client.query("UPDATE inventory_balance SET reserved=reserved-$2,updated_at=now() WHERE variant_id=$1 AND reserved>=$2",[allocation.variant_id,allocation.quantity]);
    if(!released.rowCount)throw new Error("INVENTORY_INVARIANT");
    await client.query("UPDATE stock_allocation SET status='RELEASED',updated_at=now() WHERE id=$1",[allocation.id]);
    await client.query(`INSERT INTO stock_movement(variant_id,kind,reserved_delta,on_hand_after,reserved_after,source_type,source_id,reason) SELECT variant_id,'RELEASE',-($2::integer),on_hand,reserved,$4,$3,'Card provider reported definitive failure' FROM inventory_balance WHERE variant_id=$1`,[allocation.variant_id,allocation.quantity,allocation.id,eventType==="payments.card.expired.v1"?"PAYMENT_EXPIRY":"PAYMENT_FAILURE"]);
  }
  await client.query("UPDATE payment SET status='FAILED',signed_evidence=COALESCE($2::jsonb,signed_evidence),updated_at=now() WHERE id=$1 AND status<>'CONFIRMED'",[paymentId,evidence===null?null:JSON.stringify(evidence)]);
  await client.query("UPDATE shop_order SET status='CANCELLED',payment_status='FAILED',fulfillment_status='CANCELLED',cancelled_at=now(),updated_at=now() WHERE id=$1",[orderId]);
  await client.query("UPDATE shipment SET state='CANCELLED',delivery_pin_hash=NULL,pin_expires_at=NULL,updated_at=now() WHERE order_id=$1",[orderId]);
  await appendDomainEvent(client,{eventType,aggregateType:"order",aggregateId:orderId,payload:{orderId}});
}

export async function cancelOrder(accountId:string, publicId:string){
  return withTransaction(async client=>{
    const order=await client.query<{id:string;fulfillment_status:string;payment_method:string;collected_fils:string}>("SELECT id,fulfillment_status,payment_method,collected_fils FROM shop_order WHERE public_id=$1 AND account_id=$2 FOR UPDATE",[publicId,accountId]);
    const row=order.rows[0]; if(!row) throw new Error("ORDER_NOT_FOUND"); if(row.fulfillment_status==='PACKED'||row.fulfillment_status==='SHIPPED'||row.fulfillment_status==='DELIVERED') throw new Error("ORDER_ALREADY_PACKED");
    const allocations=await client.query<{id:string;variant_id:string;quantity:number;status:string}>("SELECT stock_allocation.id,stock_allocation.variant_id,stock_allocation.quantity,stock_allocation.status FROM stock_allocation JOIN order_line ON order_line.id=stock_allocation.order_line_id WHERE order_line.order_id=$1 FOR UPDATE OF stock_allocation",[row.id]);
    for(const allocation of allocations.rows){if(['HELD','COMMITTED'].includes(allocation.status)){const released=await client.query("UPDATE inventory_balance SET reserved=reserved-$2,updated_at=now() WHERE variant_id=$1 AND reserved>=$2",[allocation.variant_id,allocation.quantity]);if(!released.rowCount)throw new Error("INVENTORY_INVARIANT");await client.query("UPDATE stock_allocation SET status='RELEASED',updated_at=now() WHERE id=$1",[allocation.id]);await client.query(`INSERT INTO stock_movement(variant_id,kind,reserved_delta,on_hand_after,reserved_after,source_type,source_id,actor_id,reason) SELECT variant_id,'RELEASE',-($2::integer),on_hand,reserved,'ORDER_CANCEL',$3,$4,'Customer cancelled before packing' FROM inventory_balance WHERE variant_id=$1`,[allocation.variant_id,allocation.quantity,allocation.id,accountId]);}}
    await client.query("UPDATE shop_order SET status='CANCELLED',payment_status=CASE WHEN collected_fils>0 THEN 'PARTIALLY_REFUNDED' ELSE 'CANCELLED' END,fulfillment_status='CANCELLED',cancelled_at=now(),updated_at=now() WHERE id=$1",[row.id]);
    await client.query("UPDATE shipment SET state='CANCELLED',delivery_pin_hash=NULL,pin_expires_at=NULL,updated_at=now() WHERE order_id=$1",[row.id]);
    if(Number(row.collected_fils)>0) await client.query("INSERT INTO refund(order_id,payment_id,amount_fils,reason,status) SELECT $1,id,$2,'PRE_PACK_CANCELLATION','REQUIRED' FROM payment WHERE order_id=$1 AND status='CONFIRMED' ORDER BY created_at LIMIT 1",[row.id,Number(row.collected_fils)]);
    await appendDomainEvent(client,{eventType:"orders.order.cancelled.v1",aggregateType:"order",aggregateId:row.id,payload:{orderId:row.id}}); return {cancelled:true};
  });
}
