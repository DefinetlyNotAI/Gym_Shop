"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";

export function MarketingConsent({ signedIn }: { signedIn: boolean }) {
  const { text } = useLanguage();
  const [message, setMessage] = useState("");
  async function optIn() { const response = await fetch("/api/v1/account/marketing-consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ granted: true }) }); setMessage(response.ok ? text("Optional email updates enabled. You can withdraw at any time.","تم تفعيل تحديثات البريد الاختيارية. يمكنك الانسحاب في أي وقت.") : text("Sign in to choose optional email updates.","سجّل الدخول لاختيار تحديثات البريد الاختيارية.")); }
  return <section className="panel"><h2>{text("Training gear updates","تحديثات معدات التدريب")}</h2><p>{text("Optional email announcements are separate from required order and security messages.","إعلانات البريد الاختيارية منفصلة عن رسائل الطلب والأمان الضرورية.")}</p>{signedIn ? <button className="secondary" onClick={optIn}>{text("Yes, email me optional updates","نعم، أرسل لي التحديثات الاختيارية")}</button> : <a className="secondary" href="/account">{text("Sign in to opt in","سجّل الدخول للاشتراك")}</a>}<small aria-live="polite">{message}</small></section>;
}
