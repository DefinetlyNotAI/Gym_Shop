"use client";

import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { ApiFailure } from "@/lib/api-errors";
import { updateReferralCode } from "@/lib/account-notices";

type ReferralSummary = {
  code: string;
  sharePath: string;
  pending: number;
  completed: number;
  rejected: number;
  earningsFils: number;
  history: {
    id: string;
    status: string;
    reward_fils: string;
    created_at: string;
    completed_at: string | null;
    status_reason: string | null;
  }[];
};
const statuses: Record<string, { en: string; ar: string }> = {
  ATTRIBUTED: { en: "Attributed", ar: "منسوبة" },
  PENDING: { en: "Pending qualification", ar: "بانتظار التأهل" },
  QUALIFIED: { en: "Qualified", ar: "مؤهلة" },
  COMPLETED: { en: "Completed", ar: "مكتملة" },
  REJECTED: { en: "Rejected", ar: "مرفوضة" },
  REVOKED: { en: "Revoked", ar: "ملغاة" },
};
export function ReferralAccount({
  summary,
  origin,
}: {
  summary: ReferralSummary;
  origin: string;
}) {
  const [customCode, setCustomCode] = useState(summary.code);
  const { language, text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const shareUrl = `${origin}${summary.sharePath}`;
  function customize() {
    void perform(async () => {
      await updateReferralCode(customCode);
      location.reload();
    });
  }
  function copyLink() {
    void perform(
      async () => {
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch {
          throw new ApiFailure("CLIPBOARD_UNAVAILABLE");
        }
      },
      { en: "Referral link copied.", ar: "تم نسخ رابط الإحالة." },
    );
  }
  return (
    <>
      <section className="panel" aria-busy={pending}>
        <p className="eyebrow">
          {text("YOUR REFERRAL CODE", "رمز الإحالة الخاص بك")}
        </p>
        <h2>
          <bdi>{summary.code}</bdi>
        </h2>
        <label>
          {text("Shareable referral link", "رابط الإحالة للمشاركة")}
          <input
            readOnly
            dir="ltr"
            value={shareUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={pending}
          onClick={copyLink}
        >
          {text("Copy referral link", "نسخ رابط الإحالة")}
        </button>
        <details>
          <summary>{text("Customize your code", "تخصيص رمزك")}</summary>
          <p>
            {text(
              "Only approved verified partners can choose a custom code. Your existing code and link remain available without customization.",
              "يمكن للشركاء الذين تمت الموافقة على تحققهم فقط اختيار رمز مخصص. يظل رمزك ورابطك الحاليان متاحين دون تخصيص.",
            )}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              customize();
            }}
          >
            <label>
              {text("Custom referral code", "رمز الإحالة المخصص")}
              <input
                required
                value={customCode}
                disabled={pending}
                dir="ltr"
                onChange={(event) =>
                  setCustomCode(event.target.value.toUpperCase())
                }
                minLength={6}
                maxLength={24}
                pattern="[A-Z0-9_-]{6,24}"
                aria-describedby="referral-code-help"
              />
            </label>
            <small id="referral-code-help">
              {text(
                "6–24 letters, numbers, underscores or hyphens. Codes must be unique.",
                "6–24 حرفًا لاتينيًا أو رقمًا أو شرطة سفلية أو شرطة. يجب أن يكون الرمز فريدًا.",
              )}
            </small>
            <button className="secondary" type="submit" disabled={pending}>
              {text(
                pending ? "Updating…" : "Update code",
                pending ? "جارٍ التحديث…" : "تحديث الرمز",
              )}
            </button>
          </form>
        </details>
        {message ? <p aria-live={live}>{message}</p> : null}
      </section>
      <section className="panel">
        <p className="eyebrow">{text("REFERRAL ACTIVITY", "نشاط الإحالات")}</p>
        <h2>{text("Referral progress", "تقدم الإحالات")}</h2>
        <dl className="referral-metrics">
          <div>
            <dt>{text("Pending", "معلقة")}</dt>
            <dd>{summary.pending}</dd>
          </div>
          <div>
            <dt>{text("Completed", "مكتملة")}</dt>
            <dd>{summary.completed}</dd>
          </div>
          <div>
            <dt>{text("Rejected", "مرفوضة")}</dt>
            <dd>{summary.rejected}</dd>
          </div>
          <div>
            <dt>{text("Earned", "مكتسب")}</dt>
            <dd>
              {(summary.earningsFils / 1000).toFixed(3)} {text("JOD", "د.أ")}
            </dd>
          </div>
        </dl>
        <p>
          {text(
            "Pending rewards are not spendable yet. Rewards qualify after completed delivery or verified pickup and confirmed payment, excluding fees.",
            "المكافآت المعلقة غير قابلة للإنفاق بعد. تتأهل المكافآت بعد اكتمال التوصيل أو الاستلام المتحقق والدفع المؤكد، دون الرسوم.",
          )}
        </p>
        <div className="list">
          {summary.history.length ? (
            summary.history.map((reward) => (
              <article key={reward.id}>
                <strong>
                  {statuses[reward.status]?.[language] ??
                    text("Referral update", "تحديث الإحالة")}
                </strong>
                <p>
                  {(Number(reward.reward_fils) / 1000).toFixed(3)}{" "}
                  {text("JOD", "د.أ")}
                </p>
                <time dateTime={reward.created_at}>
                  {new Intl.DateTimeFormat(
                    language === "ar" ? "ar-JO" : "en-JO",
                    { dateStyle: "medium", timeZone: "Asia/Amman" },
                  ).format(new Date(reward.created_at))}
                </time>
                {reward.status_reason ? (
                  <details className="notification-diagnostics">
                    <summary>
                      {text("Decision details", "تفاصيل القرار")}
                    </summary>
                    <code>{reward.status_reason}</code>
                  </details>
                ) : null}
              </article>
            ))
          ) : (
            <p className="empty">
              {text(
                "No referral rewards yet. Share your link to get started.",
                "لا توجد مكافآت إحالة بعد. شارك رابطك للبدء.",
              )}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
