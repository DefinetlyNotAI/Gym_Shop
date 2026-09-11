import{apiError,apiSuccess}from"@/lib/api/response";
import{requirePermission}from"@/lib/auth/authorization";
import{getCurrentAccount}from"@/lib/auth/session";
import{withDatabaseClient}from"@/lib/db/client";

export async function GET(){
  try{
    const actor=await getCurrentAccount();
    try{await requirePermission(actor,"cash.reconcile");}catch{await requirePermission(actor,"refund.execute");}
    return apiSuccess(await withDatabaseClient(async client=>{
      const[refunds,cash]=await Promise.all([
        client.execute(`SELECT refund.id,refund.amount_fils,refund.reason,refund.status,refund.provider_reference,orders.public_id AS order_public_id,payment.method,payment.provider FROM refund LEFT JOIN shop_order AS orders ON orders.id=refund.order_id LEFT JOIN payment ON payment.id=refund.payment_id ORDER BY refund.created_at DESC LIMIT 100`),
        client.execute(`SELECT ledger.id,ledger.driver_id,account.display_name AS driver_name,ledger.kind,ledger.amount_fils,ledger.state,ledger.source_id,ledger.reason,ledger.created_at FROM cash_ledger AS ledger LEFT JOIN account ON account.id=ledger.driver_id ORDER BY ledger.created_at DESC LIMIT 200`),
      ]);
      return{refunds:refunds.rows,cash:cash.rows,reconciliationDefinitions:{driverHeld:"Cash collected by a driver remains custody, not merchant deposited cash.",deposited:"Only independently verified deposits are merchant bank cash.",wallet:"Wallet ledger movement is not new revenue."}};
    }));
  }catch{return apiError(403,{code:"PERMISSION_DENIED",message:"Finance access is denied."});}
}

