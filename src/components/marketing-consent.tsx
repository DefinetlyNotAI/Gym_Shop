"use client";

import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";

export function MarketingConsent({ signedIn }: { signedIn: boolean }) {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  async function optIn() { await perform(() => requestApi("/api/v1/account/marketing-consent", { method: "POST", body: { granted: true } }).then(() => undefined), { en: "Optional email updates enabled. You can withdraw at any time.", ar: "تم تفعيل تحديثات البريد الاختيارية. يمكنك الانسحاب في أي وقت." }); }
  return <section className="panel"><h2>{text("Training gear updates","تحديثات معدات التدريب")}</h2><p>{text("Optional email announcements are separate from required order and security messages.","إعلانات البريد الاختيارية منفصلة عن رسائل الطلب والأمان الضرورية.")}</p>{signedIn ? <button className="secondary" disabled={pending} onClick={() => void optIn()}>{text("Yes, email me optional updates","نعم، أرسل لي التحديثات الاختيارية")}</button> : <a className="secondary" href="/account">{text("Sign in to opt in","سجّل الدخول للاشتراك")}</a>}<small aria-live={live}>{message}</small></section>;
}
