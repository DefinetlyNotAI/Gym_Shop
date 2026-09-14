"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/account-phone";

type CodeRequest = {
  requestId: string;
  phone: string;
  developmentCode?: string;
};

export function PhoneVerification() {
  const { text } = useLanguage();
  const router = useRouter();
  const action = useApiAction();
  const id = useId();
  const [request, setRequest] = useState<CodeRequest | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);

  return (
    <section
      className="panel phone-verification"
      aria-labelledby={`${id}-heading`}
    >
      <div className="notice-heading">
        <div>
          <span className="eyebrow">
            {text("Account verification", "التحقق من الحساب")}
          </span>
          <h2 id={`${id}-heading`}>
            {text("Verify your phone", "تحقق من هاتفك")}
          </h2>
        </div>
        <span className="status-badge">{text("WhatsApp", "واتساب")}</span>
      </div>
      <p className="muted" id={`${id}-help`}>
        {text(
          "Verify your email first, then request a six-digit code for your Jordanian phone number. Verification updates the phone saved to your account.",
          "تحقق من بريدك الإلكتروني أولًا، ثم اطلب رمزًا من ستة أرقام لرقم هاتفك الأردني. يُحدّث التحقق رقم الهاتف المحفوظ في حسابك.",
        )}
      </p>
      <form
        className="phone-verification-form"
        aria-busy={action.pending}
        onSubmit={(event) => {
          event.preventDefault();
          const phone = String(
            new FormData(event.currentTarget).get("phone") ?? "",
          ).trim();
          void action.perform(
            async () => {
              const result = await requestPhoneCode(phone);
              setRequest({ ...result, phone });
              setVerifiedPhone(null);
            },
            {
              en: "Verification request created. Use the newest code; it expires after five minutes.",
              ar: "تم إنشاء طلب التحقق. استخدم أحدث رمز؛ تنتهي صلاحيته بعد خمس دقائق.",
            },
          );
        }}
      >
        <label htmlFor={`${id}-phone`}>
          {text("Jordan phone number", "رقم الهاتف الأردني")}
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            required
            pattern="[+]962[0-9]{8,9}"
            minLength={12}
            maxLength={13}
            placeholder="+962790000123"
            aria-describedby={`${id}-help ${id}-format`}
            disabled={action.pending}
          />
          <small id={`${id}-format`}>
            {text(
              "Start with +962, without spaces. Example: +962790000123.",
              "ابدأ بـ ‎+962 دون مسافات. مثال: ‎+962790000123.",
            )}
          </small>
        </label>
        <button className="primary" disabled={action.pending}>
          {action.pending
            ? text("Please wait…", "يرجى الانتظار…")
            : request
              ? text("Request a new code", "طلب رمز جديد")
              : text("Request WhatsApp code", "طلب رمز عبر واتساب")}
        </button>
      </form>
      {request ? (
        <div className="phone-code-step" key={request.requestId}>
          <h3>{text("Enter your verification code", "أدخل رمز التحقق")}</h3>
          <p className="muted">
            {text("Use the latest code for", "استخدم أحدث رمز للرقم")}{" "}
            <bdi dir="ltr">{request.phone}</bdi>.{" "}
            {text(
              "Requesting another code replaces the previous one. Delivery can take a moment; an accepted request is not a delivery confirmation.",
              "يُلغي طلب رمز جديد الرمز السابق. قد يستغرق الوصول بعض الوقت؛ قبول الطلب لا يؤكد وصول الرسالة.",
            )}
          </p>
          {request.developmentCode ? (
            <aside className="notice phone-simulation">
              <strong>
                {text("Development testing code", "رمز اختبار التطوير")}
              </strong>
              <p>
                {text(
                  "The server provided this code for local testing. Keep it private; displaying it does not confirm WhatsApp delivery.",
                  "قدّم الخادم هذا الرمز للاختبار المحلي. احتفظ به سريًا؛ عرضه لا يؤكد وصول رسالة واتساب.",
                )}
              </p>
              <span>
                {text("Testing code", "رمز الاختبار")}:{" "}
                <code dir="ltr">{request.developmentCode}</code>
              </span>
            </aside>
          ) : null}
          <form
            className="phone-verification-form"
            aria-busy={action.pending}
            onSubmit={(event) => {
              event.preventDefault();
              const code = String(
                new FormData(event.currentTarget).get("code") ?? "",
              );
              void action.perform(
                async () => {
                  await verifyPhoneCode(request.requestId, code);
                  setVerifiedPhone(request.phone);
                  setRequest(null);
                  router.refresh();
                },
                {
                  en: "Phone verified and saved to your account.",
                  ar: "تم التحقق من الهاتف وحفظه في حسابك.",
                },
              );
            }}
          >
            <label htmlFor={`${id}-code`}>
              {text("Six-digit code", "الرمز المكوّن من ستة أرقام")}
              <input
                id={`${id}-code`}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                disabled={action.pending}
                aria-describedby={`${id}-code-help`}
              />
              <small id={`${id}-code-help`}>
                {text(
                  "Expires after five minutes. Repeated incorrect attempts invalidate the code.",
                  "تنتهي صلاحيته بعد خمس دقائق. تُبطل المحاولات الخاطئة المتكررة الرمز.",
                )}
              </small>
            </label>
            <button className="secondary" disabled={action.pending}>
              {action.pending
                ? text("Please wait…", "يرجى الانتظار…")
                : text("Verify phone", "تحقق من الهاتف")}
            </button>
          </form>
        </div>
      ) : null}
      {verifiedPhone ? (
        <p className="notice">
          {text("Verified phone", "الهاتف المتحقق منه")}:{" "}
          <bdi dir="ltr">{verifiedPhone}</bdi>
        </p>
      ) : null}
      <p className="muted" aria-live={action.live}>
        {action.message}
      </p>
    </section>
  );
}
