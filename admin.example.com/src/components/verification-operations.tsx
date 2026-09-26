"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";
import {
  executeSimulatedPayout,
  reviewPayout,
} from "@/lib/payout-actions";

export type VerificationQueue = { applications: {
  public_id: string; public_name: string; reason: string; platforms: { name: string; url: string }[];
  evidence_media_ids: string[]; status: string; submitted_at: string; rejected_until: string | null;
  decision_reason: string | null; account_public_id: string; reviewer_public_id: string | null;
}[] };

export type PayoutQueue = { payouts: {
  public_id: string; amount_fils: string; status: string; requested_at: string; completed_at: string | null; provider_reference: string | null; account_public_id: string; alias_masked: string;
}[]; provider: { name: string; available: boolean; mode: "SIMULATION" | "UNAVAILABLE"; code: string; reason: string } };

export function VerificationOperations({ queue }: { queue: VerificationQueue }) {
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function decide(publicId: string, decision: string, reason: string) { const completed = await perform(() => requestApi(`/api/v1/admin/verification/${encodeURIComponent(publicId)}/decision`, { method: "POST", body: { decision, reason } }).then(() => undefined), { en: "Verification decision recorded.", ar: "تم تسجيل قرار التحقق." }); if (completed) router.refresh(); }
  return <section id="verification"><h2>Partner verification</h2><p>Review identity evidence independently. Follower counts and platform metrics never auto-approve an application.</p><p aria-live={live}>{message}</p><div className="list">{queue.applications.length?queue.applications.map((item)=><article key={item.public_id}><div><strong>{item.public_name} · {item.status}</strong><small>{item.account_public_id} · submitted {new Date(item.submitted_at).toISOString()}</small></div><p>{item.reason}</p><small>Private evidence: {item.evidence_media_ids.length} file(s) · profiles: {item.platforms.map((platform)=>platform.name).join(", ")||"none"}</small>{["PENDING","UNDER_REVIEW"].includes(item.status)?<form onSubmit={(event)=>{event.preventDefault();const values=new FormData(event.currentTarget);void decide(item.public_id,String(values.get("decision")),String(values.get("reason")));}}><select name="decision"><option>APPROVE</option><option>REJECT</option></select><input name="reason" required minLength={3} placeholder="Independent review reason"/><button className="secondary" disabled={pending}>Record decision</button></form>:null}{item.status==="CANCELLED"?<button className="secondary" disabled={pending} onClick={()=>void decide(item.public_id,"REINSTATE","Reinstated after independent review")}>Reinstate</button>:null}</article>):<p>No verification applications.</p>}</div></section>;
}

export function PayoutOperations({ queue }: { queue: PayoutQueue }) {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  const simulation = queue.provider.available && queue.provider.mode === "SIMULATION";
  async function review(publicId: string, form: HTMLFormElement) {
    const values = new FormData(form);
    const decision = String(values.get("decision")) as "APPROVE" | "REJECT" | "CANCEL";
    const completed = await perform(
      () => reviewPayout(publicId, decision, String(values.get("reason") ?? "")).then(() => undefined),
      { en: "Finance payout decision recorded.", ar: "تم تسجيل قرار فريق المالية بشأن السحب." },
    );
    if (completed) router.refresh();
  }
  async function execute(publicId: string, outcome: "COMPLETED" | "FAILED" | "UNKNOWN") {
    const completed = await perform(
      () => executeSimulatedPayout(publicId, outcome).then(() => undefined),
      { en: `Simulated payout recorded as ${outcome.toLowerCase()}.`, ar: "تم تسجيل نتيجة السحب التجريبي." },
    );
    if (completed) router.refresh();
  }
  return <section id="payouts" className="payout-operations">
    <header className="payout-operations-heading"><div><span className="eyebrow">{queue.provider.name}</span><h2>{text("Wallet payout operations", "عمليات سحب المحفظة")}</h2></div><span className="status-badge">{simulation ? text("Simulation only", "محاكاة فقط") : text("Unavailable", "غير متاح")}</span></header>
    <p className={`payout-provider-notice ${simulation ? "is-simulation" : "is-unavailable"}`}><strong>{simulation ? text("Proof-of-concept environment.", "بيئة إثبات مفهوم.") : text("Withdrawals unavailable.", "عمليات السحب غير متاحة.")}</strong> {simulation ? text("Review, execute, and reconcile test payouts here. No APS request or real-money movement occurs, and production remains fail-closed.", "راجع طلبات السحب التجريبية ونفذها وسوّها هنا. لا يتم إرسال طلب إلى APS أو تحويل أموال حقيقية، ويظل الإنتاج مغلقاً بأمان.") : queue.provider.reason}</p>
    <p className="operation-result" aria-live={live}>{message}</p>
    <div className="list payout-operations-list">{queue.payouts.length ? queue.payouts.map((item) => <article className="payout-operation-card" key={item.public_id}>
      <header><div><strong>{item.public_id}</strong><small>{item.account_public_id} · {item.alias_masked}</small></div><span className="status-badge">{item.status.replaceAll("_", " ")}</span></header>
      <div className="payout-operation-meta"><span>{(Number(item.amount_fils)/1000).toFixed(3)} JOD</span><span>{new Date(item.requested_at).toLocaleString()}</span>{item.provider_reference?<code>{item.provider_reference}</code>:null}</div>
      {simulation && ["REQUESTED", "UNDER_REVIEW"].includes(item.status) ? <form className="operation-form-grid payout-review-form" onSubmit={(event) => { event.preventDefault(); void review(item.public_id, event.currentTarget); }}><label>{text("Decision", "القرار")}<select name="decision" defaultValue="APPROVE"><option value="APPROVE">{text("Approve", "موافقة")}</option><option value="REJECT">{text("Reject", "رفض")}</option><option value="CANCEL">{text("Cancel", "إلغاء")}</option></select></label><label>{text("Independent review reason", "سبب المراجعة المستقلة")}<input name="reason" required minLength={3} maxLength={2000} /></label><button className="secondary" disabled={pending}>{text("Record decision", "تسجيل القرار")}</button></form> : null}
      {simulation && ["APPROVED", "UNKNOWN"].includes(item.status) ? <div className="payout-simulation-actions"><p><strong>{item.status === "UNKNOWN" ? text("Reconcile the unknown result", "تسوية النتيجة المجهولة") : text("Choose the simulated provider result", "اختر نتيجة المزود التجريبية")}</strong></p><div className="inline-actions"><button disabled={pending} type="button" onClick={() => void execute(item.public_id, "COMPLETED")}>{text("Complete", "مكتمل")}</button><button className="secondary" disabled={pending} type="button" onClick={() => void execute(item.public_id, "FAILED")}>{text("Fail and release", "فشل وإعادة الرصيد")}</button>{item.status === "APPROVED"?<button className="secondary" disabled={pending} type="button" onClick={() => void execute(item.public_id, "UNKNOWN")}>{text("Mark unknown", "وضع مجهول")}</button>:null}</div></div> : null}
    </article>) : <p>{text("No payout records. Unknown payouts will appear first for reconciliation.", "لا توجد طلبات سحب. ستظهر الطلبات مجهولة النتيجة أولاً للتسوية.")}</p>}</div>
  </section>;
}
