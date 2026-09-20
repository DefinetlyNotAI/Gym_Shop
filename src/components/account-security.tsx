"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { ApiFailure, presentApiError } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

type Session = { id: string; user_agent: string | null; last_seen_at: string };

export function AccountSecurity() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    let active = true;
    void requestApi<{ sessions: Session[] }>("/api/v1/account/sessions")
      .then((data) => { if (active) setSessions(data.sessions); })
      .catch((error) => { if (active) presentApiError(error); })
      .finally(() => { if (active) setLoadingSessions(false); });
    return () => { active = false; };
  }, []);

  async function submit(form: HTMLFormElement, action: () => Promise<unknown>, success: { en: string; ar: string }) {
    const completed = await perform(() => action().then(() => undefined), success);
    if (completed) { form.reset(); router.refresh(); }
  }

  return (
    <section className="panel account-security">
      <h2>{text("Security", "الأمان")}</h2>
      <details><summary>{text("Change password", "تغيير كلمة المرور")}</summary><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void submit(form, () => requestApi("/api/v1/account/password", { method: "POST", body: { currentPassword: values.get("currentPassword"), password: values.get("password") } }), { en: "Password changed and other sessions revoked.", ar: "تم تغيير كلمة المرور وإلغاء الجلسات الأخرى." }); }}><input name="currentPassword" type="password" required placeholder={text("Current password", "كلمة المرور الحالية")} /><input name="password" type="password" required minLength={12} placeholder={text("New password", "كلمة المرور الجديدة")} /><button className="secondary" disabled={pending}>{text("Change and revoke other sessions", "التغيير وإلغاء الجلسات الأخرى")}</button></form></details>
      <details><summary>{text("Change verified email", "تغيير البريد الموثق")}</summary><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void submit(form, () => requestApi("/api/v1/account/email", { method: "POST", body: { currentPassword: values.get("currentPassword"), email: values.get("email") } }), { en: "Verification sent to the new email.", ar: "تم إرسال التحقق إلى البريد الجديد." }); }}><input name="currentPassword" type="password" required placeholder={text("Current password", "كلمة المرور الحالية")} /><input name="email" type="email" required placeholder={text("New email", "البريد الجديد")} /><button className="secondary" disabled={pending}>{text("Send verification", "إرسال التحقق")}</button></form></details>
      <details><summary>{text(`Active sessions (${sessions.length})`, `الجلسات النشطة (${sessions.length})`)}</summary>{loadingSessions ? <p>{text("Loading sessions…", "جارٍ تحميل الجلسات…")}</p> : sessions.length ? <div className="list">{sessions.map((session) => <article key={session.id}><span>{session.user_agent ?? text("Unknown device", "جهاز غير معروف")}</span><small>{new Date(session.last_seen_at).toLocaleString()}</small></article>)}</div> : <p className="empty">{text("No other active sessions.", "لا توجد جلسات نشطة أخرى.")}</p>}<button className="secondary" disabled={pending} onClick={() => void perform(() => requestApi("/api/v1/account/sessions", { method: "DELETE", body: { scope: "OTHER" } }).then(() => undefined), { en: "Other sessions signed out.", ar: "تم تسجيل خروج الجلسات الأخرى." })}>{text("Sign out other sessions", "تسجيل خروج الجلسات الأخرى")}</button></details>
      <details><summary>{text("Delete account", "حذف الحساب")}</summary><p>{text("Deletion starts a fourteen-day support and export period, then de-identifies personal data while preserving required transaction records.", "يبدأ الحذف بفترة دعم وتصدير مدتها أربعة عشر يوماً، ثم تُزال هوية البيانات الشخصية مع حفظ سجلات المعاملات المطلوبة.")}</p><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const confirmation = String(new FormData(form).get("confirmation") ?? ""); void submit(form, () => confirmation === "DELETE" ? requestApi("/api/v1/account/deletion", { method: "POST", body: {} }) : Promise.reject(new ApiFailure("DELETION_CONFIRMATION_INVALID", 400)), { en: "Account deletion period started.", ar: "بدأت فترة حذف الحساب." }); }}><input name="confirmation" required pattern="DELETE" placeholder={text("Type DELETE", "اكتب DELETE")} /><button className="secondary" disabled={pending}>{text("Start 14-day deletion period", "بدء فترة الحذف لمدة 14 يوماً")}</button></form></details>
      <p aria-live={live}>{message}</p>
    </section>
  );
}
