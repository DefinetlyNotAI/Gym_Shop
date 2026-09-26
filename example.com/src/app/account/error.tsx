"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

export default function AccountError({ retry }: { retry: () => void }) {
  const { text } = useLanguage();
  return (
    <main className="page account-error-page">
      <section className="panel account-error-card" role="alert">
        <span className="eyebrow">
          {text("Account service", "خدمة الحساب")}
        </span>
        <h1>
          {text("This account page could not load", "تعذّر تحميل صفحة الحساب")}
        </h1>
        <p>
          {text(
            "We could not confirm the latest account information. Nothing on this page was submitted. Check your connection, then try loading it again.",
            "تعذّر تأكيد أحدث معلومات الحساب. لم يُرسل أي شيء من هذه الصفحة. تحقق من اتصالك ثم حاول تحميلها مجددًا.",
          )}
        </p>
        <div className="action-row">
          <button className="primary" type="button" onClick={() => retry()}>
            {text("Try loading again", "حاول التحميل مجددًا")}
          </button>
          <Link className="secondary" href="/account">
            {text("Back to account", "العودة إلى الحساب")}
          </Link>
        </div>
        <small className="muted">
          {text(
            "If the problem continues, use Support from the site navigation.",
            "إذا استمرت المشكلة، استخدم الدعم من تنقل الموقع.",
          )}
        </small>
      </section>
    </main>
  );
}
