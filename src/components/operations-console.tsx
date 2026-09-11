"use client";

import{useState}from"react";
import{PromotionOperations,type Campaign}from"@/components/promotion-operations";
import{ReferralOperations,type ReferralOperationsData}from"@/components/referral-operations";
import{ReviewOperations,type ReviewQueueItem}from"@/components/review-operations";

type RecordRow=Record<string,unknown>;
type Props={
  products:RecordRow[];inventory:RecordRow[];customers:RecordRow[];staff:RecordRow[];
  refunds:RecordRow[];cash:RecordRow[];templates:RecordRow[];audits:RecordRow[];
  campaigns:Campaign[];
  referrals:ReferralOperationsData;
  reviews:ReviewQueueItem[];
  canEditCatalog:boolean;canAdjustInventory:boolean;canInviteStaff:boolean;
  canManagePromotions:boolean;
  canModerateReviews:boolean;
};

async function mutate(path:string,method:string,body:unknown){const response=await fetch(path,{method,headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.code??"REQUEST_FAILED");return payload.data;}
function money(value:unknown){return `${(Number(value)/1000).toFixed(3)} JOD`;}

export function OperationsConsole(props:Props){
  const[message,setMessage]=useState("");
  async function run(action:()=>Promise<unknown>){try{const result=await action();setMessage(`Saved: ${JSON.stringify(result)}`);location.reload();}catch(error){setMessage(error instanceof Error?error.message:"Request failed");}}
  return <>
    <nav className="section-nav" aria-label="Operations sections">
      {[["catalog","Products"],["inventory","Inventory"],["customers","Customers"],["promotions","Promotions"],["referrals","Referrals"],["reviews","Reviews"],["finance","Finance"],["notifications","Notifications"],["audits","Audits"],["staff","Staff"]].map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}
    </nav>
    <p className="operation-message" aria-live="polite">{message}</p>

    <section id="catalog"><h2>Products & variants / المنتجات والخيارات</h2><div className="list">{props.products.map(product=><article key={String(product.id)}><div><strong>{String(product.name_en)} / {String(product.name_ar)}</strong><small>{String(product.slug)} · {String(product.status)} · {Array.isArray(product.variants)?product.variants.length:0} SKU</small></div><span>{money(product.base_price_fils)}</span>{props.canEditCatalog?<form action={form=>run(()=>mutate(`/api/v1/admin/catalog/products/${product.id}`,"PATCH",{nameEn:form.get("nameEn"),nameAr:form.get("nameAr"),basePriceFils:Number(form.get("price")),status:form.get("status"),featured:form.get("featured")==="on"}))}><input name="nameEn" defaultValue={String(product.name_en)} required/><input name="nameAr" defaultValue={String(product.name_ar)} required/><input name="price" type="number" min="0" defaultValue={Number(product.base_price_fils)} required/><select name="status" defaultValue={String(product.status)}><option>DRAFT</option><option>ACTIVE</option><option>HIDDEN</option><option>ARCHIVED</option></select><label className="check"><input name="featured" type="checkbox" defaultChecked={Boolean(product.featured)}/> Featured</label><button className="secondary">Save product</button></form>:null}</article>)}</div></section>

    <section id="inventory"><h2>Inventory ledger / سجل المخزون</h2><div className="list">{props.inventory.map(item=><article key={String(item.variant_id)}><div><strong>{String(item.sku)} · {String(item.name_en)}</strong><small>{String(item.state)} · on hand {String(item.on_hand)} · reserved {String(item.reserved)} · available {String(item.available)}</small></div>{props.canAdjustInventory?<form action={form=>run(()=>mutate("/api/v1/admin/inventory","POST",{variantId:item.variant_id,onHandDelta:Number(form.get("delta")),reason:form.get("reason"),sourceReference:form.get("reference"),comment:form.get("comment")||undefined}))}><input name="delta" type="number" required placeholder="Stock delta"/><select name="reason"><option>RESTOCK</option><option>DAMAGE</option><option>LOSS</option><option>FOUND</option><option>COUNT</option><option>SUPPLIER_CORRECTION</option><option>OTHER</option></select><input name="reference" required placeholder="Source reference"/><input name="comment" placeholder="Explanation"/><button className="secondary">Record movement</button></form>:null}</article>)}</div></section>

    <section id="customers"><h2>Customers / العملاء</h2><div className="list">{props.customers.map(customer=><article key={String(customer.public_id)}><div><strong>{String(customer.display_name)}</strong><small>{String(customer.public_id)} · {String(customer.email_normalized)}</small></div><span>{String(customer.status)}</span><span>{String(customer.order_count)} orders · {String(customer.open_ticket_count)} open tickets</span></article>)}</div></section>

    <section id="finance"><h2>Finance & reconciliation / المالية والمطابقة</h2><h3>Refund obligations</h3><div className="list">{props.refunds.length?props.refunds.map(refund=><article key={String(refund.id)}><div><strong>{String(refund.order_public_id??"Unlinked refund")}</strong><small>{String(refund.reason)} · {String(refund.status)} · {String(refund.provider??refund.method??"")}</small></div><span>{money(refund.amount_fils)}</span>{["REQUIRED","PENDING","UNKNOWN"].includes(String(refund.status))?<form action={form=>run(()=>mutate(`/api/v1/admin/finance/refunds/${refund.id}/execute`,"POST",{reference:form.get("reference")||undefined}))}><input name="reference" placeholder="Manual receipt for non-provider refund"/><button className="secondary">Execute refund</button></form>:null}</article>):<p>No refund obligations.</p>}</div><h3>Cash custody ledger</h3><div className="list">{props.cash.length?props.cash.map(entry=><article key={String(entry.id)}><div><strong>{String(entry.kind)} · {String(entry.state)}</strong><small>{String(entry.driver_name??entry.driver_id)} · {String(entry.source_id)}</small></div><span>{money(entry.amount_fils)}</span>{entry.kind==="HANDOVER"&&entry.state==="HANDED_OVER"?<button className="secondary" onClick={()=>run(()=>mutate(`/api/v1/admin/finance/handovers/${entry.id}/verify`,"POST",{}))}>Verify handover</button>:null}{entry.kind==="FINANCE_VERIFICATION"?<form action={form=>run(()=>mutate("/api/v1/admin/finance/deposits","POST",{verificationId:entry.id,bankReference:form.get("bankReference")}))}><input name="bankReference" required placeholder="Bank statement reference"/><button className="secondary">Record independent deposit</button></form>:null}</article>):<p>No cash custody entries.</p>}</div></section>

    <section id="notifications"><h2>Notification templates / قوالب الإشعارات</h2><div className="list">{props.templates.map(template=><article key={String(template.id)}><strong>{String(template.event_type)}</strong><span>{String(template.channel)} · {String(template.language)} · v{String(template.version)}</span><small>{String(template.enabled?"Enabled":"Disabled")}</small></article>)}</div></section>

    <section id="audits"><h2>Permission-filtered audit / سجل التدقيق</h2><div className="list">{props.audits.map((event,index)=><article key={String(event.id??index)}>{event.locked?<><strong>Protected audit record</strong><span>{String(event.reason)}</span></>:<><strong>{String(event.action)}</strong><span>{String(event.domain)} · {String(event.result)}</span><small>{String(event.actorRole??"SYSTEM")} · {new Date(String(event.occurredAt)).toLocaleString("en-JO")}</small></>}</article>)}</div></section>

    <section id="staff"><h2>Staff / الموظفون</h2>{props.canInviteStaff?<form className="panel form-grid" action={form=>run(()=>mutate("/api/v1/admin/staff","POST",{email:form.get("email"),name:form.get("name"),role:form.get("role")}))}><input name="email" type="email" required placeholder="Staff email"/><input name="name" required placeholder="Staff name"/><select name="role"><option>DELIVERY_AGENT</option><option>SUPPORT_AGENT</option><option>LOGISTICS_STAFF</option><option>FINANCE_STAFF</option><option>ADMIN</option><option>SUPER_ADMIN</option></select><button className="secondary">Create one-use enrollment</button></form>:null}<div className="list">{props.staff.map(member=><article key={String(member.public_id)}><div><strong>{String(member.display_name)}</strong><small>{String(member.email_normalized)} · {String(member.public_id)}</small></div><span>{String(member.role_id)} · {String(member.status)}</span>{String(member.role_id)!=="CTO"?<div className="inline-actions"><button onClick={()=>run(()=>mutate(`/api/v1/admin/staff/${member.public_id}/status`,"POST",{status:"SUSPENDED"}))}>Suspend</button><button onClick={()=>run(()=>mutate(`/api/v1/admin/staff/${member.public_id}/status`,"POST",{status:"ACTIVE"}))}>Activate</button><button onClick={()=>run(()=>mutate(`/api/v1/admin/staff/${member.public_id}/status`,"POST",{status:"DISABLED"}))}>Disable</button></div>:null}</article>)}</div></section>
    {props.canManagePromotions?<PromotionOperations campaigns={props.campaigns}/>:null}
    {props.canManagePromotions?<ReferralOperations referrals={props.referrals}/>:null}
    {props.canModerateReviews?<ReviewOperations reviews={props.reviews}/>:null}
  </>;
}
