"use client";
import { presentApiError } from "@/lib/api-errors";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { customerAction } from "@/lib/customer-actions";

export function CancelOrder({
  publicId,
  fulfillmentStatus,
}: {
  publicId: string;
  fulfillmentStatus: string;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);
  if (fulfillmentStatus === "CANCELLED" || cancelled)
    return (
      <p role="status">
        {text(
          "This order is cancelled. Any required payment refund is handled separately.",
          "تم إلغاء هذا الطلب. تتم معالجة أي استرداد مطلوب للدفع بشكل منفصل.",
        )}
      </p>
    );
  if (!["UNFULFILLED", "PROCESSING"].includes(fulfillmentStatus))
    return (
      <p className="muted">
        {text(
          "Cancellation closes when packing is complete. Contact support if you need help.",
          "يتوقف الإلغاء عند اكتمال التعبئة. تواصل مع الدعم إذا كنت تحتاج إلى المساعدة.",
        )}
      </p>
    );
  async function cancel(form: FormData) {
    if (pending || form.get("confirmation") !== "on") return;
    setPending(true);
    setError("");
    try {
      const result = await customerAction({ kind: "cancel", id: publicId });
      if (result.cancelled !== true)
        throw new Error(
          text("Cancellation was not confirmed.", "لم يتم تأكيد الإلغاء."),
        );
      setCancelled(true);
      router.refresh();
    } catch (error) {
      setError(presentApiError(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="order-cancellation">
      <summary>{text("Cancel this order", "إلغاء هذا الطلب")}</summary>
      <form action={cancel}>
        <fieldset disabled={pending}>
          <legend>{text("Confirm cancellation", "تأكيد الإلغاء")}</legend>
          <p>
            {text(
              "Cancellation releases reserved items and eligible wallet funds. Card refunds are processed separately; this does not confirm an immediate refund.",
              "يؤدي الإلغاء إلى تحرير المنتجات المحجوزة وأموال المحفظة المؤهلة. تتم معالجة استرداد البطاقة بشكل منفصل؛ ولا يعني ذلك استردادًا فوريًا.",
            )}
          </p>
          <label className="confirmation-check">
            <input name="confirmation" type="checkbox" required />
            {text("I want to cancel this order.", "أريد إلغاء هذا الطلب.")}
          </label>
          <button type="submit" className="secondary" disabled={pending}>
            {pending
              ? text("Cancelling…", "جارٍ الإلغاء…")
              : text("Confirm cancellation", "تأكيد الإلغاء")}
          </button>
        </fieldset>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
    </details>
  );
}
