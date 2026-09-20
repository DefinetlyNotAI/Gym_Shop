"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { publishBilingualTerms, recordRecoveryDrill, updateLaunchSetting } from "@/lib/launch-settings-actions";
import { readinessBlockerCopy } from "@/lib/launch-readiness";

type Health = { status?: string; service?: string; version?: string };
type Readiness = { ready?: boolean; blockers?: string[] };

function Result({ message, live }: { message: string; live: "off" | "polite" }) {
  return <p className="operation-result" aria-live={live}>{message}</p>;
}

function SettingAction({ label, pendingLabel, setting, value, reason }: {
  label: { en: string; ar: string };
  pendingLabel: { en: string; ar: string };
  setting: "checkout.tax_policy" | "delivery.cod_redelivery_policy_reviewed" | "platform.store_enabled";
  value: "NONE_REVIEWED" | boolean;
  reason: string;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function run() {
    const completed = await perform(
      () => updateLaunchSetting(setting, value, reason),
      { en: "Launch setting saved and readiness refreshed.", ar: "تم حفظ إعداد التشغيل وتحديث الجاهزية." },
    );
    if (completed) router.refresh();
  }
  return (
    <article className="launch-action">
      <button className="secondary" disabled={pending} onClick={() => void run()}>
        {text(pending ? pendingLabel.en : label.en, pending ? pendingLabel.ar : label.ar)}
      </button>
      <Result message={message} live={live} />
    </article>
  );
}

function TermsForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      () => publishBilingualTerms({
        version: String(values.get("version") ?? ""),
        titleEn: String(values.get("titleEn") ?? ""),
        bodyEn: String(values.get("bodyEn") ?? ""),
        titleAr: String(values.get("titleAr") ?? ""),
        bodyAr: String(values.get("bodyAr") ?? ""),
      }).then(() => undefined),
      { en: "Immutable bilingual terms published.", ar: "تم نشر الشروط الثابتة باللغتين." },
    );
    if (completed) { form.reset(); router.refresh(); }
  }
  return (
    <article className="launch-form-card">
      <header><span className="eyebrow">{text("LEGAL CONTENT", "المحتوى القانوني")}</span><h2>{text("Publish bilingual terms", "نشر الشروط باللغتين")}</h2><p>{text("Publishing creates one immutable English and Arabic version for checkout consent.", "ينشئ النشر إصداراً ثابتاً بالإنجليزية والعربية لموافقة الدفع.")}</p></header>
      <form className="configuration-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <label>{text("Version", "الإصدار")}<input name="version" required maxLength={100} placeholder="2026-09-20" /></label>
        <label>{text("English title", "العنوان بالإنجليزية")}<input name="titleEn" required minLength={2} /></label>
        <label className="configuration-wide">{text("Reviewed English terms", "الشروط الإنجليزية المعتمدة")}<textarea name="bodyEn" required minLength={10} rows={5} /></label>
        <label>{text("Arabic title", "العنوان بالعربية")}<input name="titleAr" required minLength={2} dir="rtl" /></label>
        <label className="configuration-wide">{text("Reviewed Arabic terms", "الشروط العربية المعتمدة")}<textarea name="bodyAr" required minLength={10} rows={5} dir="rtl" /></label>
        <div className="configuration-submit configuration-wide"><small>{text("A published version cannot be edited later.", "لا يمكن تعديل الإصدار بعد نشره.")}</small><button disabled={pending}>{text(pending ? "Publishing…" : "Publish version", pending ? "جارٍ النشر…" : "نشر الإصدار")}</button></div>
      </form>
      <Result message={message} live={live} />
    </article>
  );
}

function RecoveryDrillForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      () => recordRecoveryDrill({ result: String(values.get("result")) as "PASSED" | "FAILED", notes: String(values.get("notes") ?? "") }).then(() => undefined),
      { en: "Recovery-drill evidence recorded.", ar: "تم تسجيل دليل تمرين الاسترداد." },
    );
    if (completed) { form.reset(); router.refresh(); }
  }
  return (
    <article className="launch-form-card launch-evidence-card">
      <header><span className="eyebrow">{text("RECOVERY EVIDENCE", "دليل الاسترداد")}</span><h2>{text("Record the CTO recovery drill", "تسجيل تمرين استرداد المدير التقني")}</h2><p>{text("Document the real two-key recovery outcome, participants, and follow-up actions.", "وثّق نتيجة الاسترداد الفعلية بمفتاحين والمشاركين وإجراءات المتابعة.")}</p></header>
      <form className="configuration-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <label>{text("Result", "النتيجة")}<select name="result" defaultValue="PASSED"><option value="PASSED">{text("Passed", "ناجح")}</option><option value="FAILED">{text("Failed", "فشل")}</option></select></label>
        <label className="configuration-wide">{text("Evidence notes", "ملاحظات الدليل")}<textarea name="notes" required minLength={10} maxLength={2000} rows={6} placeholder={text("Date, participants, keys used, outcome, and follow-up actions", "التاريخ والمشاركون والمفاتيح المستخدمة والنتيجة وإجراءات المتابعة")} /></label>
        <div className="configuration-submit configuration-wide"><small>{text("Record only a drill that actually occurred.", "سجّل فقط تمريناً تم تنفيذه فعلياً.")}</small><button disabled={pending}>{text(pending ? "Recording…" : "Record evidence", pending ? "جارٍ التسجيل…" : "تسجيل الدليل")}</button></div>
      </form>
      <Result message={message} live={live} />
    </article>
  );
}

export function AdminTools({ health, readiness }: { health?: Health; readiness?: Readiness }) {
  const { text, language } = useLanguage();
  const ready = readiness?.ready === true;
  const blockers = readiness?.blockers ?? [];
  return (
    <div className="launch-workspace">
      <section className={`readiness-hero ${ready ? "is-ready" : "is-blocked"}`}>
        <div><span className="eyebrow">{text("LAUNCH CONTROL", "ضبط الإطلاق")}</span><h2>{ready ? text("Storefront launch requirements are ready", "متطلبات إطلاق المتجر جاهزة") : text(`${blockers.length} launch requirement${blockers.length === 1 ? "" : "s"} need attention`, `${blockers.length} من متطلبات الإطلاق تحتاج متابعة`)}</h2><p>{text("This status is calculated by the API from live platform state and immutable release evidence.", "تُحتسب هذه الحالة من واجهة البرمجة اعتماداً على حالة المنصة المباشرة وأدلة الإصدار الثابتة.")}</p></div>
        <div className="readiness-signals"><article><span>{text("API service", "خدمة الواجهة")}</span><strong>{health?.status === "ok" ? text("Operational", "تعمل") : text("Unavailable", "غير متاحة")}</strong><small>{health?.service ?? "gym-shop-api"} · v{health?.version ?? "—"}</small></article><article><span>{text("Launch gate", "بوابة الإطلاق")}</span><strong>{ready ? text("Ready", "جاهزة") : text("Blocked", "متوقفة")}</strong><small>{ready ? text("No active blockers", "لا توجد عوائق نشطة") : text("Complete every item below", "أكمل جميع البنود أدناه")}</small></article></div>
      </section>
      {blockers.length ? <section className="readiness-blockers"><header><h2>{text("Requirements to resolve", "المتطلبات المطلوب معالجتها")}</h2><span>{blockers.length}</span></header><div>{blockers.map((code) => { const copy = readinessBlockerCopy(code); return <article key={code}><span aria-hidden="true">!</span><div><strong>{copy.title[language]}</strong><p>{copy.description[language]}</p></div></article>; })}</div></section> : <p className="readiness-clear">{text("All platform launch requirements currently pass. Recheck after any configuration change.", "جميع متطلبات إطلاق المنصة ناجحة حالياً. أعد التحقق بعد أي تغيير في الإعدادات.")}</p>}
      <section className="launch-settings-card"><header><div><span className="eyebrow">{text("OWNER CONFIRMATIONS", "تأكيدات المالك")}</span><h2>{text("Reviewed launch settings", "إعدادات الإطلاق المعتمدة")}</h2></div><p>{text("Each confirmation creates an audited setting change. Enable the storefront only after every blocker is resolved.", "ينشئ كل تأكيد تغييراً مدققاً في الإعدادات. فعّل المتجر فقط بعد معالجة جميع العوائق.")}</p></header><div className="launch-actions"><SettingAction label={{ en: "Confirm reviewed tax mode", ar: "تأكيد وضع الضريبة المعتمد" }} pendingLabel={{ en: "Saving…", ar: "جارٍ الحفظ…" }} setting="checkout.tax_policy" value="NONE_REVIEWED" reason="Owner reviewed launch tax treatment" /><SettingAction label={{ en: "Confirm COD redelivery policy", ar: "تأكيد سياسة إعادة توصيل الدفع عند الاستلام" }} pendingLabel={{ en: "Saving…", ar: "جارٍ الحفظ…" }} setting="delivery.cod_redelivery_policy_reviewed" value={true} reason="CTO confirmed the reviewed quote-derived COD redelivery policy" /><SettingAction label={{ en: "Enable storefront", ar: "تفعيل المتجر" }} pendingLabel={{ en: "Enabling…", ar: "جارٍ التفعيل…" }} setting="platform.store_enabled" value={true} reason="CTO opened storefront after readiness review" /></div><Link className="delivery-settings-link" href="/delivery-settings">{text("Open delivery & pickup configuration", "فتح إعدادات التوصيل والاستلام")} <span aria-hidden="true">↗</span></Link></section>
      <div className="launch-form-columns"><TermsForm /><RecoveryDrillForm /></div>
    </div>
  );
}
