"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { handoverDriverCash } from "@/lib/driver-recovery-actions";

function formatJod(fils: number, language: "ar" | "en") {
  return new Intl.NumberFormat(language === "ar" ? "ar-JO" : "en-JO", {
    style: "currency",
    currency: "JOD",
    minimumFractionDigits: 3,
  }).format(fils / 1000);
}

export function DriverCashHandover({
  heldFils,
  pendingHandoverFils,
}: {
  heldFils: number;
  pendingHandoverFils: number;
}) {
  const router = useRouter();
  const { language, text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const availableFils = Math.max(0, heldFils - pendingHandoverFils);

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      async () => {
        await handoverDriverCash(Number(values.get("amountFils")));
      },
      {
        en: "Cash handover recorded. Finance must verify the physical deposit independently.",
        ar: "تم تسجيل تسليم النقد. يجب على المالية التحقق من الإيداع الفعلي بشكل مستقل.",
      },
    );
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <section className="driver-cash-panel" aria-labelledby="cash-custody-title">
      <div className="driver-cash-heading">
        <div>
          <p className="eyebrow">{text("CASH CUSTODY", "عهدة النقد")}</p>
          <h2 id="cash-custody-title">
            {text("Reconcile cash safely", "مطابقة النقد بأمان")}
          </h2>
        </div>
        <p>
          {text(
            "Record only cash physically handed to finance. The amount remains pending until a different finance user verifies it.",
            "سجّل فقط النقد الذي سُلّم فعلياً للمالية. يبقى المبلغ معلّقاً حتى يتحقق منه مستخدم مالي آخر.",
          )}
        </p>
      </div>
      <div className="driver-cash-metrics">
        <article>
          <span>{text("Available to hand over", "المتاح للتسليم")}</span>
          <strong>{formatJod(availableFils, language)}</strong>
          <small>{availableFils.toLocaleString(language === "ar" ? "ar-JO" : "en-JO")} {text("fils", "فلس")}</small>
        </article>
        <article>
          <span>{text("Awaiting finance verification", "بانتظار تحقق المالية")}</span>
          <strong>{formatJod(pendingHandoverFils, language)}</strong>
          <small>{pendingHandoverFils.toLocaleString(language === "ar" ? "ar-JO" : "en-JO")} {text("fils", "فلس")}</small>
        </article>
      </div>
      <form
        className="driver-cash-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          {text("Amount handed over (fils)", "المبلغ المسلّم (بالفلس)")}
          <input
            name="amountFils"
            type="number"
            min={1}
            max={Math.max(availableFils, 1)}
            step={1}
            inputMode="numeric"
            required
            disabled={availableFils <= 0 || pending}
            placeholder="12500"
          />
        </label>
        <button className="primary" disabled={availableFils <= 0 || pending}>
          {text(
            pending ? "Recording…" : "Record physical handover",
            pending ? "جارٍ التسجيل…" : "تسجيل التسليم الفعلي",
          )}
        </button>
      </form>
      {availableFils <= 0 ? (
        <p className="driver-cash-empty">
          {text(
            "No collected cash is currently available to hand over.",
            "لا يوجد نقد محصّل متاح للتسليم حالياً.",
          )}
        </p>
      ) : null}
      <p className="operation-result" aria-live={live}>
        {message}
      </p>
    </section>
  );
}
