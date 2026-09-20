"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import {
  API_ERROR_EVENT,
  appendNotice,
  type ErrorNotice,
} from "@/lib/api-errors";

export function ApiToasts({ staff = false }: { staff?: boolean }) {
  const { language, text } = useLanguage();
  const [notices, setNotices] = useState<ErrorNotice[]>([]);
  useEffect(() => {
    function receive(event: Event) {
      if (event instanceof CustomEvent)
        setNotices((current) =>
          appendNotice(current, event.detail as ErrorNotice),
        );
    }
    window.addEventListener(API_ERROR_EVENT, receive);
    return () => window.removeEventListener(API_ERROR_EVENT, receive);
  }, []);
  if (!notices.length) return null;
  return (
    <aside
      className="api-toast-stack"
      aria-label={text("Action notifications", "إشعارات الإجراءات")}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <ol>
        {notices.map((notice) => (
          <li className="api-toast" key={notice.key}>
            <svg
              className="api-toast-icon"
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6m0 3v1" />
            </svg>
            <div className="api-toast-copy" role="alert">
              <strong>{notice.title[language]}</strong>
              <p>{notice.description[language]}</p>
            </div>
            <button
              className="api-toast-dismiss"
              type="button"
              aria-label={text("Dismiss notification", "إغلاق الإشعار")}
              onClick={() =>
                setNotices((current) =>
                  current.filter((item) => item.key !== notice.key),
                )
              }
            >
              <span aria-hidden="true">×</span>
            </button>
            <div className="api-toast-extra">
              {notice.recovery === "signin" ? (
                <Link href={staff ? "/" : "/account"}>
                  {text("Sign in", "تسجيل الدخول")}
                </Link>
              ) : null}
              <details>
                <summary>{text("Technical details", "تفاصيل تقنية")}</summary>
                <code dir="ltr">
                  {notice.code}
                  {notice.status ? " · HTTP " + notice.status : ""}
                  {notice.reference ? " · " + notice.reference : ""}
                </code>
              </details>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
