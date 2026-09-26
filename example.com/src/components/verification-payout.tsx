"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PrivateMediaUpload } from "@/components/private-media-upload";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { requestApi } from "@/lib/client-api";
import { requestSimulatedPayout } from "@/lib/payout-actions";

export type VerificationSummary = {
  status: string;
  verified: boolean;
  application: null | { public_name: string; decision_reason: string | null; submitted_at: string; rejected_until: string | null };
  history: { from_status: string | null; to_status: string; action: string; reason: string | null; created_at: string }[];
};

export type PayoutAvailability = {
  verified: boolean;
  withdrawableFils: number;
  minimumFils: number | null;
  providerAvailable: boolean;
  provider: { name: string; available: boolean; mode: "SIMULATION" | "UNAVAILABLE"; code: string; reason: string };
  history: { public_id: string; amount_fils: string; status: string; requested_at: string; alias_masked: string; provider_reference: string | null }[];
};

export function VerificationPanel({ summary }: { summary: VerificationSummary }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [evidenceMediaIds, setEvidenceMediaIds] = useState<string[]>([]);
  const { pending, perform, message, live } = useApiAction();
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(() => requestApi("/api/v1/account/verification", { method: "POST", body: {
      publicName: values.get("publicName"), reason: values.get("reason"), evidenceMediaIds,
      platforms: String(values.get("platformUrl") ?? "").trim() ? [{ name: "Primary profile", url: values.get("platformUrl") }] : [],
    }}).then(() => undefined), { en: "Verification application submitted for independent review.", ar: "تم إرسال طلب التحقق للمراجعة المستقلة." });
    if (completed) router.refresh();
  }
  return <>
    <section className="panel"><p className="eyebrow">{text("Partner status", "حالة الشريك")}</p><h2>{summary.status.replaceAll("_", " ")}</h2><p>{text("Approval requires verified email and phone, an independent security key, a saved recovery secret, and manual staff review. Audience size never triggers automatic approval.", "تتطلب الموافقة بريداً إلكترونياً وهاتفاً موثقين، ومفتاح أمان مستقلاً، وعبارة استرداد محفوظة، ومراجعة يدوية من الموظفين. لا يؤدي حجم الجمهور إلى موافقة تلقائية.")}</p>{summary.application?<small>{text("Submitted", "قُدّم")} {new Date(summary.application.submitted_at).toLocaleString()}{summary.application.rejected_until?` · ${text("Reapply after", "إعادة التقديم بعد")} ${new Date(summary.application.rejected_until).toLocaleString()}`:""}{summary.application.decision_reason?` · ${summary.application.decision_reason}`:""}</small>:null}<div className="list">{summary.history.map((entry,index)=><article key={`${entry.action}-${entry.created_at}-${index}`}><strong>{entry.action.replaceAll("_", " ")}</strong><small>{(entry.from_status??"NEW").replaceAll("_", " ")} → {entry.to_status.replaceAll("_", " ")} · {new Date(entry.created_at).toLocaleString()}{entry.reason?` · ${entry.reason}`:""}</small></article>)}</div></section>
    {summary.status==="NOT_SUBMITTED"||summary.status==="REJECTED"||summary.status==="CANCELLED"?<form className="panel form-grid" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><h2>{text("Apply for verification", "التقدم بطلب التحقق")}</h2><label>{text("Public name", "الاسم العام")}<input name="publicName" minLength={2} maxLength={120} required /></label><label>{text("Primary profile or website", "الملف الأساسي أو الموقع")}<input name="platformUrl" type="url" /></label><label>{text("Why should this partner identity be verified?", "لماذا يجب التحقق من هوية هذا الشريك؟")}<textarea name="reason" minLength={20} maxLength={2000} required /></label><PrivateMediaUpload accept="image/jpeg,image/png,image/webp,application/pdf" onUploaded={(id)=>setEvidenceMediaIds((current)=>current.includes(id)?current:[...current,id])}/><small>{text(`${evidenceMediaIds.length} private evidence file(s) ready`, `${evidenceMediaIds.length} ملف إثبات خاص جاهز`)}</small><button disabled={pending || !evidenceMediaIds.length}>{text("Submit for independent review", "إرسال للمراجعة المستقلة")}</button></form>:null}
    {summary.verified?<button className="secondary" disabled={pending} type="button" onClick={() => void perform(() => requestApi("/api/v1/account/verification/revoke", { method: "POST", body: { reason: "Revoked by account owner" } }).then(() => undefined), { en: "Verification revoked.", ar: "تم إلغاء التحقق." }).then((completed) => { if (completed) router.refresh(); })}>{text("Revoke verification", "إلغاء التحقق")}</button>:null}<p aria-live={live}>{message}</p>
  </>;
}

export function PayoutPanel({ availability }: { availability: PayoutAvailability }) {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  const idempotencyKey = useRef<string | null>(null);
  const simulation = availability.providerAvailable && availability.provider.mode === "SIMULATION";
  async function request(form: HTMLFormElement) {
    const values = new FormData(form);
    idempotencyKey.current ??= crypto.randomUUID();
    const completed = await perform(
      () => requestSimulatedPayout({
        destinationAlias: String(values.get("destinationAlias") ?? ""),
        amountJod: String(values.get("amountJod") ?? ""),
      }, undefined, () => idempotencyKey.current!).then(() => undefined),
      {
        en: "Simulated payout requested. Wallet funds are held for Finance review.",
        ar: "تم طلب السحب التجريبي. حُجز الرصيد لمراجعة فريق المالية.",
      },
    );
    if (completed) { idempotencyKey.current = null; form.reset(); router.refresh(); }
  }
  return <>
    <section className="panel"><p className="eyebrow">{text("Withdrawable wallet", "الرصيد القابل للسحب")}</p><h2>{(availability.withdrawableFils/1000).toFixed(3)} JOD</h2><p>{availability.verified?text("All settled, undisputed wallet sources are eligible.", "جميع مصادر المحفظة المسوّاة وغير المتنازع عليها مؤهلة."):text("Partner verification is required before wallet funds become withdrawable.", "يلزم التحقق من الشريك قبل أن تصبح أموال المحفظة قابلة للسحب.")}</p></section>
    <section className={`panel payout-provider-card ${simulation ? "is-simulation" : "is-unavailable"}`}>
      <header className="payout-provider-heading"><div><p className="eyebrow">{availability.provider.name}</p><h2>{text("Wallet withdrawals", "سحب المحفظة")}</h2></div><span className="status-badge">{simulation ? text("Simulation only", "محاكاة فقط") : text("Unavailable", "غير متاح")}</span></header>
      <p>{simulation
        ? text("This proof of concept exercises the real application lifecycle without contacting APS or moving money. Production remains disabled until beneficiary-disbursement capability is contracted and verified.", "يختبر هذا النموذج دورة التطبيق الفعلية دون الاتصال بـ APS أو تحويل أموال. يظل الإنتاج معطلاً حتى يتم التعاقد على قدرة صرف الأموال للمستفيدين والتحقق منها.")
        : text(availability.provider.reason, "تم اختيار Amazon Payment Services لمعالجة المدفوعات. يظل سحب المحفظة غير متاح إلى أن يتم التحقق تعاقدياً وفنياً من قدرة APS على صرف الأموال للمستفيدين. عمليات استرداد البطاقات وتسوية التاجر ليست عمليات سحب للمحفظة.")}</p>
      {simulation ? <form className="payout-request-form" onSubmit={(event) => { event.preventDefault(); void request(event.currentTarget); }}>
        <label>{text("Test destination label", "تسمية وجهة الاختبار")}<input name="destinationAlias" required minLength={4} maxLength={80} placeholder={text("Simulation bank ••0042", "بنك المحاكاة ••0042")} autoComplete="off" /></label>
        <label>{text("Amount (JOD)", "المبلغ (دينار)")}<input name="amountJod" required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,3})?" placeholder="12.500" /></label>
        <div className="payout-form-submit"><button disabled={pending || !availability.verified || availability.withdrawableFils <= 0}>{text(pending ? "Requesting…" : "Request simulated payout", pending ? "جارٍ الطلب…" : "طلب سحب تجريبي")}</button><small>{text("Use a masked test label only—never enter real bank or card details.", "استخدم تسمية اختبار مخفية فقط—لا تدخل بيانات مصرفية أو بيانات بطاقة حقيقية.")}</small></div>
      </form> : <><button type="button" disabled>{text("Request payout", "طلب سحب")}</button><small>{text("No wallet funds will be held while the provider is unavailable.", "لن يتم حجز أي رصيد من المحفظة ما دام المزود غير متاح.")}</small></>}
      <p className="operation-result" aria-live={live}>{message}</p>
      <div className="list payout-history">{availability.history.length ? availability.history.map((item)=><article key={item.public_id}><div><strong>{item.public_id}</strong><span className="status-badge">{item.status.replaceAll("_", " ")}</span></div><small>{(Number(item.amount_fils)/1000).toFixed(3)} JOD · {item.alias_masked} · {new Date(item.requested_at).toLocaleString()}</small>{item.provider_reference?<small>{text("Provider reference", "مرجع المزود")}: {item.provider_reference}</small>:null}</article>) : <p>{text("No payout requests yet.", "لا توجد طلبات سحب بعد.")}</p>}</div>
    </section>
  </>;
}
