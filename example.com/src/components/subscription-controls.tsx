"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { subscribeVariant, updateNewsletter } from "@/lib/commerce-actions";
export function NewsletterControl({ signedIn }: { signedIn: boolean }) {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  function update(subscribed: boolean) {
    void perform(() => updateNewsletter(subscribed), {
      en: subscribed
        ? "Subscribed to optional email updates."
        : "Unsubscribed from optional email updates.",
      ar: subscribed
        ? "تم الاشتراك في تحديثات البريد الاختيارية."
        : "تم إلغاء الاشتراك في تحديثات البريد الاختيارية.",
    });
  }
  return (
    <section className="panel" aria-busy={pending}>
      <h2>{text("Newsletter", "النشرة البريدية")}</h2>
      <p>
        {text(
          "Optional product news and offers. You can unsubscribe at any time; consent is checked before every send.",
          "أخبار المنتجات والعروض اختيارية. يمكنك إلغاء الاشتراك في أي وقت؛ تُراجع الموافقة قبل كل إرسال.",
        )}
      </p>
      {signedIn ? (
        <div className="inline-actions">
          <button type="button" disabled={pending} onClick={() => update(true)}>
            {text(
              pending ? "Updating…" : "Subscribe",
              pending ? "جارٍ التحديث…" : "اشتراك",
            )}
          </button>
          <button
            type="button"
            disabled={pending}
            className="secondary"
            onClick={() => update(false)}
          >
            {text("Unsubscribe", "إلغاء الاشتراك")}
          </button>
        </div>
      ) : (
        <Link className="secondary" href="/account">
          {text("Sign in to choose", "سجّل الدخول للاختيار")}
        </Link>
      )}
      <p aria-live={live}>{message}</p>
    </section>
  );
}
export function RestockControls({
  variants,
}: {
  variants: {
    id: string;
    available: number | null;
    options: Record<string, string>;
  }[];
}) {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const unavailable = variants.filter(
    (v) => v.available !== null && v.available <= 0,
  );
  if (!unavailable.length) return null;
  return (
    <section className="panel" aria-busy={pending}>
      <h2>{text("Back-in-stock alerts", "تنبيهات توفر المخزون")}</h2>
      <p>
        {text(
          "Choose the exact unavailable variant. Each variant is tracked separately and sends once.",
          "اختر الخيار غير المتوفر بالضبط. يُتابَع كل خيار بشكل مستقل ويُرسل تنبيه واحد.",
        )}
      </p>
      <div className="inline-actions">
        {unavailable.map((v) => (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            key={v.id}
            onClick={() =>
              void perform(() => subscribeVariant(v.id), {
                en: "An alert for this exact variant is saved.",
                ar: "تم حفظ تنبيه لهذا الخيار بالضبط.",
              })
            }
          >
            {text(
              pending ? "Saving…" : "Notify me:",
              pending ? "جارٍ الحفظ…" : "أبلغني:",
            )}{" "}
            {Object.values(v.options).join(" / ") || v.id}
          </button>
        ))}
      </div>
      <p aria-live={live}>{message}</p>
    </section>
  );
}
