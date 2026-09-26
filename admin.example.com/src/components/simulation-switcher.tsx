"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { presentApiError } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

export function SimulationSwitcher() {
  const router = useRouter();
  const { text } = useLanguage();
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
      router.push(role === "DELIVERY_AGENT" ? "/delivery" : "/");
      router.refresh();
    }
  }

  return <aside className="simulation-banner">
    <strong>{text("SIMULATION MODE", "وضع المحاكاة")}</strong>
    <span>{text("Memory-only · choose a staff perspective", "ذاكرة محلية فقط · اختر منظور الموظف")}</span>
    <button disabled={pending} onClick={() => void assume("CTO")}>{text("CTO", "مدير التقنية")}</button>
    <button disabled={pending} onClick={() => void assume("ADMIN")}>{text("Admin", "مسؤول")}</button>
    <button disabled={pending} onClick={() => void assume("DELIVERY_AGENT")}>{text("Driver", "مندوب التوصيل")}</button>
    <a href="http://localhost:3030">{text("Customer site", "موقع العملاء")}</a>
  </aside>;
}
