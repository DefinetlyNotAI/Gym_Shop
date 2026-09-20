"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { presentApiError } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

export function SimulationSwitcher() {
  const router = useRouter();
  const { language, text } = useLanguage();
  const [enabled, setEnabled] = useState(false);
  const { pending, perform } = useApiAction();

  useEffect(() => {
    let active = true;
    void requestApi<{ simulation: boolean }>("/api/v1/platform")
      .then((platform) => { if (active) setEnabled(platform.simulation); })
      .catch((error) => { if (active) presentApiError(error); });
    return () => { active = false; };
  }, []);

  if (!enabled) return null;

  async function assume(role: string) {
    const completed = await perform(() => requestApi("/api/v1/simulation/session", { method: "POST", body: { role } }).then(() => undefined));
    if (completed) {
      router.push("/");
      router.refresh();
    }
  }

  return <aside className="simulation-banner">
    <strong>{text("SIMULATION MODE", "وضع المحاكاة")}</strong>
    <span>{text("Memory-only · no real messages or payments", "ذاكرة محلية فقط · لا رسائل أو مدفوعات حقيقية")}</span>
    <button disabled={pending} onClick={() => void assume("CUSTOMER")}>{text("Use customer", "استخدام حساب عميل")}</button>
    <button disabled={pending} onClick={() => void assume("CTO")}>{language === "ar" ? "استخدام حساب مدير التقنية" : "Use CTO"}</button>
    <a href="http://localhost:4000">{text("Open staff site", "فتح موقع الموظفين")}</a>
  </aside>;
}
