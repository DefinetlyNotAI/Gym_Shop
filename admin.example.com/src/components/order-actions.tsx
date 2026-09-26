"use client";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import {
  fulfillOrder,
  type FulfillmentAction,
} from "@/lib/fulfillment-actions";
export function OrderActions({
  publicId,
  fulfillmentStatus,
  simulation = false,
}: {
  publicId: string;
  fulfillmentStatus: string;
  simulation?: boolean;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  const simulationDriver = simulation
    ? "00000000-0000-4000-8000-000000000004"
    : undefined;
  function run(action: FulfillmentAction, body: unknown = {}) {
    void perform(
      async () => {
        await fulfillOrder(publicId, action, body);
        router.refresh();
      },
      {
        en: "Fulfillment action confirmed. Check the updated order state.",
        ar: "تم تأكيد إجراء الطلب. راجع حالة الطلب المحدّثة.",
      },
    );
  }
  return (
    <details aria-busy={pending}>
      <summary>{text("Order actions", "إجراءات الطلب")}</summary>
      <fieldset disabled={pending}>
        {fulfillmentStatus === "UNFULFILLED" ? (
          <button
            type="button"
            className="secondary"
            onClick={() => run("pack")}
          >
            {text(
              pending ? "Saving…" : "Mark packed",
              pending ? "جارٍ الحفظ…" : "تأكيد التجهيز",
            )}
          </button>
        ) : null}
        {fulfillmentStatus === "PACKED" ? (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run("dispatch", { driverId: f.get("driverId") });
              }}
            >
              <label>
                {text(
                  "Assigned driver account UUID",
                  "معرّف حساب السائق المكلّف",
                )}
                <input
                  name="driverId"
                  required
                  defaultValue={simulationDriver}
                />
              </label>
              <button type="submit" className="secondary">
                {text("Dispatch delivery", "إرسال التوصيل")}
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run("pickup", {
                  pin: f.get("pin"),
                  ...(f.get("collectedFils")
                    ? { collectedFils: Number(f.get("collectedFils")) }
                    : {}),
                });
              }}
            >
              <label>
                {text("Customer pickup PIN", "رمز استلام العميل")}
                <input
                  name="pin"
                  required
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </label>
              <label>
                {text(
                  "Cash collected in fils (COD only)",
                  "النقد المحصّل بالفلس (للدفع النقدي فقط)",
                )}
                <input name="collectedFils" type="number" min="0" step="1" />
              </label>
              <button type="submit" className="secondary">
                {text("Complete pickup", "تأكيد الاستلام")}
              </button>
            </form>
          </>
        ) : null}
        {fulfillmentStatus === "SHIPPED" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run("reassign", { driverId: f.get("driverId") });
            }}
          >
            <label>
              {text("New driver account UUID", "معرّف حساب السائق الجديد")}
              <input name="driverId" required defaultValue={simulationDriver} />
            </label>
            <button type="submit" className="secondary">
              {text("Reassign delivery", "إعادة تعيين التوصيل")}
            </button>
          </form>
        ) : null}
      </fieldset>
      <p aria-live={live}>{message}</p>
    </details>
  );
}
