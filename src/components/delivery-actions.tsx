"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrivateMediaUpload } from "@/components/private-media-upload";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { runDriverDeliveryAction } from "@/lib/driver-recovery-actions";

export function DeliveryActions({
  publicId,
  paymentMethod,
  doorstepAuthorized,
}: {
  publicId: string;
  paymentMethod: string;
  doorstepAuthorized: boolean;
}) {
  const router = useRouter();
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [proofMediaId, setProofMediaId] = useState("");

  async function run(
    action: () => Promise<void>,
    success: { en: string; ar: string },
  ) {
    const completed = await perform(action, success);
    if (completed) router.refresh();
  }

  return (
    <details className="driver-attempt-panel">
      <summary>{text("Record a delivery attempt", "تسجيل محاولة توصيل")}</summary>
      <div className="driver-attempt-content">
        <section className="driver-action-block driver-custody-action">
          <div>
            <strong>{text("1. Accept custody", "١. استلام العهدة")}</strong>
            <small>
              {text(
                "Confirm that the package and any expected cash responsibility are now with you.",
                "أكد أن الطرد ومسؤولية أي نقد متوقع أصبحت الآن بعهدتك.",
              )}
            </small>
          </div>
          <button
            className="secondary"
            type="button"
            disabled={pending}
            onClick={() =>
              void run(
                () => runDriverDeliveryAction(publicId, "accept", {}),
                {
                  en: "Package and cash custody accepted.",
                  ar: "تم استلام عهدة الطرد والنقد.",
                },
              )
            }
          >
            {text("Accept custody", "استلام العهدة")}
          </button>
        </section>

        <section className="driver-action-block">
          <div>
            <strong>{text("2. Complete attended delivery", "٢. إكمال التسليم المباشر")}</strong>
            <small>
              {text(
                "Use the customer’s current six-digit PIN. For cash orders, enter the exact collected amount.",
                "استخدم رمز العميل الحالي المكوّن من ستة أرقام. لطلبات النقد، أدخل المبلغ المحصّل بدقة.",
              )}
            </small>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(
                () =>
                  runDriverDeliveryAction(publicId, "complete", {
                    pin: form.get("pin") || undefined,
                    collectedFils: form.get("collectedFils")
                      ? Number(form.get("collectedFils"))
                      : undefined,
                  }),
                {
                  en: "Attended delivery completed and recorded.",
                  ar: "تم إكمال التسليم المباشر وتسجيله.",
                },
              );
            }}
          >
            <label>
              {text("Customer PIN", "رمز العميل")}
              <input
                name="pin"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                required
              />
            </label>
            {paymentMethod === "COD" ? (
              <label>
                {text("Exact collected amount (fils)", "المبلغ المحصّل بدقة (فلس)")}
                <input
                  name="collectedFils"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  required
                />
              </label>
            ) : null}
            <button className="primary" disabled={pending}>
              {text("Complete delivery", "إكمال التسليم")}
            </button>
          </form>
        </section>

        {paymentMethod === "CARD" && doorstepAuthorized ? (
          <section className="driver-action-block">
            <div>
              <strong>{text("Authorized doorstep delivery", "تسليم مصرح عند الباب")}</strong>
              <small>
                {text(
                  "Upload clean proof and record the precise delivery coordinates.",
                  "ارفع إثباتاً واضحاً وسجّل إحداثيات التسليم الدقيقة.",
                )}
              </small>
            </div>
            <PrivateMediaUpload onUploaded={setProofMediaId} />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void run(
                  () =>
                    runDriverDeliveryAction(publicId, "complete", {
                      doorstep: true,
                      proofMediaId,
                      location: {
                        latitude: Number(form.get("latitude")),
                        longitude: Number(form.get("longitude")),
                      },
                    }),
                  {
                    en: "Authorized doorstep delivery completed.",
                    ar: "تم إكمال التسليم المصرح عند الباب.",
                  },
                );
              }}
            >
              <input type="hidden" value={proofMediaId} readOnly />
              <label>
                {text("Latitude", "خط العرض")}
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  required
                />
              </label>
              <label>
                {text("Longitude", "خط الطول")}
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  required
                />
              </label>
              <button className="secondary" disabled={!proofMediaId || pending}>
                {text("Complete doorstep delivery", "إكمال التسليم عند الباب")}
              </button>
            </form>
          </section>
        ) : null}

        <section className="driver-action-block driver-failure-action">
          <div>
            <strong>{text("Record an unsuccessful attempt", "تسجيل محاولة غير ناجحة")}</strong>
            <small>
              {text(
                "Choose the operational reason and document how you tried to contact the customer.",
                "اختر السبب التشغيلي ووثّق كيفية محاولة التواصل مع العميل.",
              )}
            </small>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void run(
                () =>
                  runDriverDeliveryAction(publicId, "fail", {
                    reason: form.get("reason"),
                    contactEffort: form.get("contactEffort"),
                  }),
                {
                  en: "The unsuccessful attempt was recorded.",
                  ar: "تم تسجيل محاولة التوصيل غير الناجحة.",
                },
              );
            }}
          >
            <label>
              {text("Failure reason", "سبب عدم النجاح")}
              <select name="reason" required defaultValue="">
                <option value="" disabled>{text("Choose a reason", "اختر السبب")}</option>
                <option value="CUSTOMER_UNAVAILABLE">{text("Customer unavailable", "العميل غير متاح")}</option>
                <option value="WRONG_ADDRESS">{text("Wrong address", "عنوان غير صحيح")}</option>
                <option value="CUSTOMER_RESCHEDULE">{text("Customer requested reschedule", "طلب العميل إعادة الجدولة")}</option>
                <option value="CUSTOMER_REFUSED">{text("Customer refused", "رفض العميل")}</option>
                <option value="INACCESSIBLE">{text("Location inaccessible", "تعذر الوصول للموقع")}</option>
                <option value="OTHER">{text("Other", "سبب آخر")}</option>
              </select>
            </label>
            <label>
              {text("Contact effort and details", "محاولة التواصل والتفاصيل")}
              <textarea name="contactEffort" minLength={3} maxLength={500} required rows={3} />
            </label>
            <button className="secondary" disabled={pending}>
              {text("Record failed attempt", "تسجيل المحاولة غير الناجحة")}
            </button>
          </form>
        </section>
        <p className="operation-result" aria-live={live}>{message}</p>
      </div>
    </details>
  );
}
