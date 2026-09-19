"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function RouteError({ retry }: { retry: () => void }) {
  const { text } = useLanguage();
  return (
    <main className="page account-error-page">
      <section className="panel account-error-card" role="alert">
        <span className="eyebrow">
          {text("Temporary interruption", "انقطاع مؤقت")}
        </span>
        <h1>{text("This page could not load", "تعذّر تحميل الصفحة")}</h1>
        <p>
          {text(
            "We could not confirm the latest information. Nothing on this page was submitted. Check your connection, then try again.",
            "تعذّر تأكيد أحدث المعلومات. لم يُرسل أي شيء من هذه الصفحة. تحقق من اتصالك ثم حاول مجددًا.",
          )}
        </p>
        <div className="action-row">
          <button className="primary" type="button" onClick={() => retry()}>
            {text("Try loading again", "حاول التحميل مجددًا")}
          </button>
          <Link className="secondary" href="/">
            {text("Return home", "العودة للرئيسية")}
          </Link>
        </div>
        <p className="form-help">
          {text(
            "If this keeps happening, use the support page and include what you were trying to open.",
            "إذا استمرت المشكلة، استخدم صفحة الدعم واذكر الصفحة التي كنت تحاول فتحها.",
          )}
        </p>
      </section>
    </main>
  );
}
