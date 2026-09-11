import{redirect}from"next/navigation";
import{AdminTools}from"@/components/admin-tools";
import{OperationsConsole}from"@/components/operations-console";
import{OrderActions}from"@/components/order-actions";
import{StaffLogin}from"@/components/staff-login";
import{LocalizedText as T}from"@/components/language-provider";
import{SupportOperations}from"@/components/support-operations";
import type{Campaign}from"@/components/promotion-operations";
import type{ReferralOperationsData}from"@/components/referral-operations";
import{apiGet,getSession}from"@/lib/api";

export const dynamic="force-dynamic";
type Rows={products?:Record<string,unknown>[];inventory?:Record<string,unknown>[];customers?:Record<string,unknown>[];staff?:Record<string,unknown>[];templates?:Record<string,unknown>[];events?:Record<string,unknown>[];orders?:Record<string,unknown>[];zones?:Record<string,unknown>[];tickets?:never[];refunds?:Record<string,unknown>[];cash?:Record<string,unknown>[]};

export default async function Admin(){
  const actor=await getSession();
  if(!actor)return <main className="page auth-page"><p className="eyebrow"><T en="GYM SHOP STAFF" ar="موظفو جيم شوب"/></p><h1><T en="Operations sign in" ar="دخول العمليات"/></h1><StaffLogin/></main>;
  if(actor.role==="CUSTOMER")return <main className="page"><h1><T en="Staff access required" ar="يلزم تصريح موظف"/></h1><a href={process.env.STOREFRONT_ORIGIN??"https://example.com"}><T en="Return to customer store" ar="العودة إلى متجر العملاء"/></a></main>;
  if(actor.role==="DELIVERY_AGENT")redirect("/delivery");

  const canCatalog=["CTO","SUPER_ADMIN","ADMIN","LOGISTICS_STAFF"].includes(actor.role);
  const canAdjustInventory=["CTO","SUPER_ADMIN","LOGISTICS_STAFF"].includes(actor.role);
  const canFulfill=["CTO","SUPER_ADMIN","ADMIN","LOGISTICS_STAFF"].includes(actor.role);
  const canSupport=["CTO","SUPER_ADMIN","ADMIN","SUPPORT_AGENT"].includes(actor.role);
  const canFinance=["CTO","SUPER_ADMIN","FINANCE_STAFF"].includes(actor.role);
  const canNotifications=["CTO","SUPER_ADMIN","ADMIN"].includes(actor.role);
  const canPromotions=["CTO","SUPER_ADMIN","ADMIN"].includes(actor.role);
  const canStaff=["CTO","SUPER_ADMIN"].includes(actor.role);
  const platform=await apiGet<{simulation:boolean}>("/api/v1/platform",true);

  const[orders,zones,tickets,products,inventory,customers,finance,templates,audits,staff,campaigns,referrals]=await Promise.all([
    canFulfill?apiGet<Rows>("/api/v1/admin/orders",true):null,
    canFulfill?apiGet<Rows>("/api/v1/admin/delivery/zones",true):null,
    canSupport?apiGet<Rows>("/api/v1/admin/support/tickets",true):null,
    canCatalog?apiGet<Rows>("/api/v1/admin/catalog/products",true):null,
    canCatalog?apiGet<Rows>("/api/v1/admin/inventory",true):null,
    canFulfill||canSupport?apiGet<Rows>("/api/v1/admin/customers",true):null,
    canFinance?apiGet<Rows>("/api/v1/admin/finance/overview",true):null,
    canNotifications?apiGet<Rows>("/api/v1/admin/notifications/templates",true):null,
    apiGet<Rows>("/api/v1/admin/audits",true),
    canStaff?apiGet<Rows>("/api/v1/admin/staff",true):null,
    canPromotions?apiGet<Campaign[]>("/api/v1/admin/promotions",true):null,
    canPromotions?apiGet<ReferralOperationsData>("/api/v1/admin/referrals",true):null,
  ]);

  return <main className="page">
    <p className="eyebrow">STAFF · {actor.role}</p><h1>Operations / العمليات</h1>
    <div className="metric-grid"><article><strong>{orders?.orders?.length??0}</strong><span>Orders</span></article><article><strong>{inventory?.inventory?.filter(item=>item.state==="LOW_STOCK"||item.state==="OUT_OF_STOCK").length??0}</strong><span>Stock alerts</span></article><article><strong>{tickets?.tickets?.length??0}</strong><span>Support tickets</span></article><article><strong>{finance?.refunds?.filter(item=>item.status!=="COMPLETED").length??0}</strong><span>Refund actions</span></article></div>
    {actor.role==="CTO"?<AdminTools/>:null}
    {canFulfill?<section id="orders"><h2>Orders & logistics / الطلبات واللوجستيات</h2><div className="list">{(orders?.orders??[]).map(order=><article key={String(order.public_id)}><strong>{String(order.public_id)}</strong><span>{String(order.fulfillment_status)} · {String(order.payment_status)}</span><span>{(Number(order.external_due_fils)/1000).toFixed(3)} JOD</span><OrderActions publicId={String(order.public_id)} fulfillmentStatus={String(order.fulfillment_status)} simulation={platform?.simulation}/></article>)}</div></section>:null}
    {canSupport?<SupportOperations initialTickets={tickets?.tickets??[]}/>:null}
    {canFulfill?<section id="delivery"><h2>Delivery configuration / إعداد التوصيل</h2><div className="list">{(zones?.zones??[]).map(zone=><article key={String(zone.id)}><strong>{String(zone.name_en)} / {String(zone.name_ar)}</strong><span>{Number(zone.fee_fils)/1000} JOD</span><span>{zone.policy_reviewed?"Reviewed":"Blocked"}</span></article>)}</div></section>:null}
    <OperationsConsole products={products?.products??[]} inventory={inventory?.inventory??[]} customers={customers?.customers??[]} staff={staff?.staff??[]} refunds={finance?.refunds??[]} cash={finance?.cash??[]} templates={templates?.templates??[]} audits={audits?.events??[]} campaigns={campaigns??[]} referrals={referrals??{codes:[],rewards:[]}} canEditCatalog={canCatalog} canAdjustInventory={canAdjustInventory} canInviteStaff={actor.role==="CTO"} canManagePromotions={canPromotions}/>
  </main>;
}
