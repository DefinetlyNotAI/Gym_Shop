import { appendAudit } from "@/lib/audit/service";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { executeProviderRefund } from "@/lib/payments/provider";

export async function driverCashPosition(driverId:string){return withDatabaseClient(async client=>{const result=await client.execute<{held:string;pending:string}>("SELECT COALESCE(SUM(CASE WHEN kind='COLLECTION' THEN amount_fils WHEN kind='FINANCE_VERIFICATION' THEN -amount_fils ELSE 0 END),0) AS held,COALESCE(SUM(CASE WHEN kind='HANDOVER' THEN amount_fils WHEN kind='FINANCE_VERIFICATION' THEN -amount_fils ELSE 0 END),0) AS pending FROM cash_ledger WHERE driver_id=$1",[driverId]);return{heldFils:Number(result.rows[0].held),pendingHandoverFils:Number(result.rows[0].pending)};});}

export async function handoverCash(driverId:string,amountFils:number){
  if(!Number.isSafeInteger(amountFils)||amountFils<=0)throw new Error("AMOUNT_INVALID");
  return withTransaction(async client=>{const held=await client.execute<{available:string}>("SELECT COALESCE(SUM(CASE WHEN kind='COLLECTION' THEN amount_fils WHEN kind='HANDOVER' THEN -amount_fils ELSE 0 END),0) AS available FROM cash_ledger WHERE driver_id=$1",[driverId]);if(Number(held.rows[0].available)<amountFils)throw new Error("HANDOVER_EXCEEDS_HELD");const source=`handover:${crypto.randomUUID()}`;const row=await client.execute<{id:string}>("INSERT INTO cash_ledger(driver_id,kind,amount_fils,state,source_id) VALUES($1,'HANDOVER',$2,'HANDED_OVER',$3) RETURNING id",[driverId,amountFils,source]);return{handoverId:row.rows[0].id};});
}

export async function verifyHandover(handoverId:string,financeId:string){
  return withTransaction(async client=>{const handover=await client.execute<{driver_id:string;amount_fils:string;state:string}>("SELECT driver_id,amount_fils,state FROM cash_ledger WHERE id=$1 AND kind='HANDOVER' FOR SHARE",[handoverId]);const row=handover.rows[0];if(!row||row.state!=="HANDED_OVER"||row.driver_id===financeId)throw new Error("HANDOVER_INVALID");await client.execute("INSERT INTO cash_ledger(driver_id,kind,amount_fils,state,source_id,acknowledged_by) VALUES($1,'FINANCE_VERIFICATION',$2,'VERIFIED_BY_FINANCE',$3,$4)",[row.driver_id,Number(row.amount_fils),`verify:${handoverId}`,financeId]);await appendAudit(client,{actorId:financeId,action:"cash.handover.verified",targetType:"cash_ledger",targetId:handoverId,domain:"finance",sensitive:true});return{verified:true};});
}

export async function recordBankDeposit(verificationId:string,reviewerId:string,bankReference:string){
  if(!bankReference.trim())throw new Error("BANK_REFERENCE_REQUIRED");
  return withTransaction(async client=>{const verified=await client.execute<{driver_id:string;amount_fils:string;acknowledged_by:string|null}>("SELECT driver_id,amount_fils,acknowledged_by FROM cash_ledger WHERE id=$1 AND kind='FINANCE_VERIFICATION' AND state='VERIFIED_BY_FINANCE' FOR SHARE",[verificationId]);const row=verified.rows[0];if(!row||row.acknowledged_by===reviewerId||row.driver_id===reviewerId)throw new Error("INDEPENDENT_DEPOSIT_REVIEW_REQUIRED");const deposit=await client.execute<{id:string}>("INSERT INTO cash_ledger(driver_id,kind,amount_fils,state,source_id,reviewed_by,reason) VALUES($1,'DEPOSIT',$2,'DEPOSITED',$3,$4,$5) RETURNING id",[row.driver_id,Number(row.amount_fils),`deposit:${verificationId}`,reviewerId,bankReference.trim()]);await appendAudit(client,{actorId:reviewerId,action:"cash.deposit.recorded",targetType:"cash_ledger",targetId:deposit.rows[0].id,domain:"finance",sensitive:true,after:{verificationId,bankReference:bankReference.trim()}});return{deposited:true,depositId:deposit.rows[0].id};});
}

export async function recordCashDiscrepancy(input:{driverId:string;expectedFils:number;actualFils:number;sourceId:string;reason:string},financeId:string){
  if(input.driverId===financeId||![input.expectedFils,input.actualFils].every(Number.isSafeInteger)||input.expectedFils<0||input.actualFils<0||!input.sourceId.trim()||!input.reason.trim())throw new Error("DISCREPANCY_INVALID");
  return withTransaction(async client=>{const driver=await client.execute("SELECT 1 FROM staff_account WHERE account_id=$1 AND role_id='DELIVERY_AGENT'",[input.driverId]);if(!driver.rowCount)throw new Error("DRIVER_INVALID");const row=await client.execute<{id:string}>("INSERT INTO cash_ledger(driver_id,kind,amount_fils,state,source_id,acknowledged_by,reason) VALUES($1,'DISCREPANCY',$2,'DISPUTED',$3,$4,$5) RETURNING id",[input.driverId,input.expectedFils-input.actualFils,input.sourceId.trim(),financeId,input.reason.trim()]);await appendAudit(client,{actorId:financeId,action:"cash.discrepancy.recorded",targetType:"cash_ledger",targetId:row.rows[0].id,domain:"finance",sensitive:true,after:{expectedFils:input.expectedFils,actualFils:input.actualFils},reason:input.reason.trim()});return{recorded:true,discrepancyId:row.rows[0].id,differenceFils:input.expectedFils-input.actualFils};});
}

export async function executeRefund(refundId:string,financeId:string,manualReference?:string){
  const refund=await withDatabaseClient(async client=>(await client.execute<{order_id:string|null;payment_id:string|null;amount_fils:string;status:string;approved_by:string|null;provider:string|null;provider_reference:string|null;method:string|null}>(`SELECT refund.order_id,refund.payment_id,refund.amount_fils,refund.status,refund.approved_by,payment.provider,payment.provider_reference,payment.method FROM refund LEFT JOIN payment ON payment.id=refund.payment_id WHERE refund.id=$1`,[refundId])).rows[0]);
  if(!refund||!["REQUIRED","PENDING","UNKNOWN"].includes(refund.status)||refund.approved_by===financeId)throw new Error("REFUND_INVALID");
  let reference=manualReference?.trim();
  if(refund.method==="CARD"&&refund.provider!=="SIMULATED_APS"){
    if(!refund.provider_reference)throw new Error("PAYMENT_REFERENCE_MISSING");
    const provider=await executeProviderRefund({operationKey:`refund:${refundId}`,paymentReference:refund.provider_reference,amountFils:Number(refund.amount_fils)});
    reference=provider.reference;
    if(provider.status!=="CONFIRMED"){
      await withDatabaseClient(client=>client.execute("UPDATE refund SET status=$2,provider_reference=$3 WHERE id=$1 AND status<>'COMPLETED'",[refundId,provider.status==="FAILED"?"FAILED":provider.status,reference]).then(()=>undefined));
      return{completed:false,status:provider.status,reference};
    }
  }
  if(!reference)throw new Error("REFUND_EVIDENCE_REQUIRED");
  return withTransaction(async client=>{
    const locked=await client.execute<{order_id:string|null;payment_id:string|null;amount_fils:string;status:string;approved_by:string|null}>("SELECT order_id,payment_id,amount_fils,status,approved_by FROM refund WHERE id=$1 FOR UPDATE",[refundId]);
    const row=locked.rows[0];
    if(!row||!["REQUIRED","PENDING","UNKNOWN"].includes(row.status)||row.approved_by===financeId)throw new Error("REFUND_INVALID");
    if(row.order_id){const updated=await client.execute("UPDATE shop_order SET refunded_fils=refunded_fils+$2,payment_status=CASE WHEN refunded_fils+$2=collected_fils THEN 'REFUNDED' ELSE 'PARTIALLY_REFUNDED' END,updated_at=now() WHERE id=$1 AND refunded_fils+$2<=collected_fils",[row.order_id,Number(row.amount_fils)]);if(!updated.rowCount)throw new Error("REFUND_EXCEEDS_COLLECTED");}
    if(row.payment_id){
      const updated=await client.execute("UPDATE payment SET status=CASE WHEN (SELECT COALESCE(SUM(amount_fils),0) FROM refund WHERE payment_id=$1 AND (status='COMPLETED' OR id=$2))>=amount_fils THEN 'REFUNDED' ELSE status END,updated_at=now() WHERE id=$1 AND status IN('CONFIRMED','REFUNDED')",[row.payment_id,refundId]);
      if(!updated.rowCount)throw new Error("PAYMENT_NOT_REFUNDABLE");
    }
    await client.execute("UPDATE refund SET status='COMPLETED',executed_by=$2,provider_reference=$3,completed_at=now() WHERE id=$1",[refundId,financeId,reference]);
    await client.execute("UPDATE damage_claim SET status='REFUNDED',updated_at=now() WHERE id=(SELECT claim_id FROM refund WHERE id=$1) AND status='REFUND_REQUESTED'",[refundId]);
    await appendAudit(client,{actorId:financeId,action:"refund.completed",targetType:"refund",targetId:refundId,domain:"finance",sensitive:true,after:{reference,provider:"AMAZON_PAYMENT_SERVICES"}});
    return{completed:true,status:"CONFIRMED" as const,reference};
  });
}
