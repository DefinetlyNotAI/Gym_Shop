"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { simulateHostedPayment } from "@/lib/simulated-payment";

type DeliveryWindow = {
  id: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
};

type Zone = {
  id: string;
  name_en: string;
  name_ar: string;
  fee_fils: string;
  eta_min_days: number;
  eta_max_days: number;
  windows?: DeliveryWindow[];
};

type Pickup = {
  id: string;
  name_en: string;
  name_ar: string;
  address: unknown;
  hours: unknown;
};

type CheckoutResult = {
  orderId: string;
  status: string;
  paymentReference?: string;
  paymentUrl?: string;
  paymentFields?: Record<string, string>;
};

type PricingPreview = {
  merchandiseFils: number;
  discountFils: number;
  deliveryFils: number;
  taxFils: number;
  totalFils: number;
  walletAvailableFils: number;
  walletTenderFils: number;
  externalDueFils: number;
  rejections: { ruleId: string; code: string }[];
};

export function CheckoutForm({
  zones,
  pickups,
  termsId,
  simulation = false,
}: {
  zones: Zone[];
  pickups: Pickup[];
  termsId: string;
  simulation?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CheckoutResult | null>(null);
  const [mode, setMode] = useState<"DELIVERY" | "PICKUP">(
    zones.length ? "DELIVERY" : "PICKUP",
  );
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");
  const [simulationOutcome, setSimulationOutcome] = useState<
    "success" | "failure" | "pending"
  >("success");
  const [couponCode, setCouponCode] = useState("");
  const [walletFils, setWalletFils] = useState(0);
  const [referralCode, setReferralCode] = useState("");
  const [referralApplied, setReferralApplied] = useState(false);
  const [pricingPreview, setPricingPreview] = useState<PricingPreview | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === zoneId),
    [zoneId, zones],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(
          localStorage.getItem("gym-shop-referral") ?? "null",
        ) as { code?: string; expiresAt?: number } | null;
        if (stored?.code && (stored.expiresAt ?? 0) > Date.now())
          setReferralCode(stored.code);
        else localStorage.removeItem("gym-shop-referral");
      } catch {
        localStorage.removeItem("gym-shop-referral");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function applyReferral() {
    if (!referralCode.trim()) return true;
    const response = await fetch("/api/v1/checkout/referral", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: referralCode.trim(),
        source: localStorage.getItem("gym-shop-referral") ? "LINK" : "MANUAL",
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(
        payload.error?.message ??
          "Referral code could not be applied. / تعذر تطبيق رمز الإحالة.",
      );
      return false;
    }
    setReferralCode(payload.data.code);
    setReferralApplied(true);
    return true;
  }

  async function removeReferral() {
    const response = await fetch("/api/v1/checkout/referral", {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      const payload = await response.json();
      setMessage(
        payload.error?.message ?? "Referral code could not be removed.",
      );
      return;
    }
    localStorage.removeItem("gym-shop-referral");
    setReferralCode("");
    setReferralApplied(false);
    setPricingPreview(null);
    setMessage("Referral removed. / تمت إزالة الإحالة.");
  }

  async function submit(form: FormData) {
    if (pending || createdOrder) return;
    setPending(true);
    try {
      setMessage("Placing order… / جارٍ إنشاء الطلب…");
      if (!referralApplied && !(await applyReferral())) return;
      const body = {
        paymentMethod,
        fulfillmentMode: mode,
        deliveryZoneId: mode === "DELIVERY" ? form.get("zone") : undefined,
        deliveryWindowId: mode === "DELIVERY" ? form.get("window") : undefined,
        pickupLocationId: mode === "PICKUP" ? form.get("pickup") : undefined,
        recipient: {
          name: form.get("name"),
          phone: form.get("phone"),
          city: form.get("city"),
          area: form.get("area"),
          street: form.get("street"),
          building: form.get("building"),
          notes: form.get("notes"),
        },
        termsDocumentId: termsId,
        idempotencyKey: crypto.randomUUID(),
        doorstepAuthorized:
          mode === "DELIVERY" && form.get("doorstep") === "on",
        couponCode: couponCode.trim() || undefined,
        walletFils,
      };
      const response = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(
          payload.error?.message ?? "Checkout failed / تعذر إتمام الطلب",
        );
        return;
      }
      const result = payload.data as CheckoutResult;
      setCreatedOrder(result);
      if (
        paymentMethod === "CARD" &&
        result.paymentUrl &&
        result.paymentFields
      ) {
        if (simulation) {
          const destination = await simulateHostedPayment(
            {
              orderId: result.orderId,
              paymentUrl: result.paymentUrl,
              paymentFields: result.paymentFields,
            },
            simulationOutcome,
            window.location.origin,
          );
          router.replace(destination);
          return;
        }
        const paymentForm = document.createElement("form");
        paymentForm.method = "POST";
        paymentForm.action = result.paymentUrl;
        for (const [name, value] of Object.entries(result.paymentFields)) {
          const field = document.createElement("input");
          field.type = "hidden";
          field.name = name;
          field.value =
            simulation && name === "outcome" ? simulationOutcome : value;
          paymentForm.appendChild(field);
        }
        document.body.appendChild(paymentForm);
        paymentForm.submit();
        return;
      }
      setMessage(
        `Order ${result.orderId} confirmed. The pickup PIN is sent through WhatsApp when required. / تم تأكيد الطلب وسيصل رمز الاستلام عبر واتساب عند الحاجة.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Checkout failed. Check your orders before trying again. / تعذر إتمام الطلب. راجع طلباتك قبل المحاولة مجددًا.",
      );
    } finally {
      setPending(false);
    }
  }

  async function previewCoupon() {
    if (mode !== "DELIVERY" || !zoneId) {
      setMessage(
        "Select a delivery zone to preview pricing. / اختر منطقة توصيل لمعاينة السعر.",
      );
      return;
    }
    const parameters = new URLSearchParams({ zoneId });
    if (couponCode.trim()) parameters.set("couponCode", couponCode.trim());
    if (walletFils) parameters.set("walletFils", String(walletFils));
    const response = await fetch(`/api/v1/checkout/quote?${parameters}`, {
      headers: { accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok) {
      setPricingPreview(null);
      setMessage(
        payload.error?.message ??
          "Pricing preview failed. / تعذرت معاينة السعر.",
      );
      return;
    }
    setPricingPreview(payload.data as PricingPreview);
    setMessage(
      "Pricing refreshed from the checkout engine. / تم تحديث السعر من محرك الدفع.",
    );
  }

  return (
    <section className="panel">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        <fieldset
          className="checkout-fields"
          disabled={pending || createdOrder !== null}
        >
          <label>
            Fulfillment / الاستلام
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as "DELIVERY" | "PICKUP")
              }
            >
              {zones.length ? (
                <option value="DELIVERY">Delivery / توصيل</option>
              ) : null}
              {pickups.length ? (
                <option value="PICKUP">Store pickup / استلام من المتجر</option>
              ) : null}
            </select>
          </label>
          {mode === "DELIVERY" && paymentMethod === "COD" && selectedZone ? (
            <article className="notice">
              <strong>COD redelivery / إعادة التوصيل</strong>
              <p>
                The original delivery fee is{" "}
                {(Number(selectedZone.fee_fils) / 1000).toFixed(3)} JOD. Attempt
                two is a courtesy retry. Only when attempt three is actually
                made, an additional{" "}
                {((Number(selectedZone.fee_fils) * 2) / 1000).toFixed(3)} JOD is
                added, making total delivery fees{" "}
                {((Number(selectedZone.fee_fils) * 3) / 1000).toFixed(3)} JOD.
              </p>
              <p>
                المحاولة الثانية مجانية. عند تنفيذ المحاولة الثالثة فعلياً فقط
                تضاف رسوم قدرها ضعفا رسم التوصيل الأصلي.
              </p>
            </article>
          ) : null}
          {mode === "DELIVERY" ? (
            <>
              <label>
                Delivery zone / منطقة التوصيل
                <select
                  name="zone"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  required
                >
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name_en} / {zone.name_ar} —{" "}
                      {(Number(zone.fee_fils) / 1000).toFixed(3)} JOD
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Delivery window / موعد التوصيل
                <select name="window" required>
                  {(selectedZone?.windows ?? []).map((window) => (
                    <option key={window.id} value={window.id}>
                      Day {window.weekday}: {window.startsAt}–{window.endsAt}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label>
              Pickup location / موقع الاستلام
              <select name="pickup" required>
                {pickups.map((pickup) => (
                  <option key={pickup.id} value={pickup.id}>
                    {pickup.name_en} / {pickup.name_ar}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-grid">
            <label>
              Name / الاسم
              <input name="name" required minLength={2} />
            </label>
            <label>
              Phone / الهاتف
              <input name="phone" required minLength={8} />
            </label>
            <label>
              City / المدينة
              <input name="city" required minLength={2} />
            </label>
            <label>
              Area / المنطقة
              <input name="area" required minLength={2} />
            </label>
            <label>
              Street / الشارع
              <input name="street" required minLength={2} />
            </label>
            <label>
              Building / المبنى
              <input name="building" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Referral code / رمز الإحالة
              <input
                value={referralCode}
                onChange={(event) => {
                  setReferralCode(event.target.value);
                  setReferralApplied(false);
                  setPricingPreview(null);
                }}
                minLength={6}
                maxLength={24}
              />
            </label>
            <button
              className="secondary"
              type="button"
              onClick={applyReferral}
              disabled={!referralCode.trim()}
            >
              Apply referral / تطبيق الإحالة
            </button>
            <button
              type="button"
              onClick={removeReferral}
              disabled={!referralCode.trim()}
            >
              Remove before replacing / أزل الرمز قبل استبداله
            </button>
          </div>
          <label>
            Notes / ملاحظات
            <textarea name="notes" maxLength={500} />
          </label>
          <div className="form-grid">
            <label>
              Coupon code / رمز القسيمة
              <input
                name="couponCode"
                value={couponCode}
                onChange={(event) => {
                  setCouponCode(event.target.value);
                  setPricingPreview(null);
                }}
                minLength={3}
                maxLength={64}
              />
            </label>
            <button
              className="secondary"
              type="button"
              onClick={previewCoupon}
              disabled={mode !== "DELIVERY"}
            >
              Preview price / معاينة السعر
            </button>
          </div>
          <label>
            Wallet tender in fils / الدفع من المحفظة بالفلس
            <input
              type="number"
              min="0"
              step="1"
              value={walletFils}
              onChange={(event) => {
                setWalletFils(Number(event.target.value));
                setPricingPreview(null);
              }}
            />
          </label>
          {pricingPreview ? (
            <article className="notice">
              <strong>Authoritative quote / السعر المعتمد</strong>
              <p>
                Merchandise {(pricingPreview.merchandiseFils / 1000).toFixed(3)}{" "}
                JOD · discounts{" "}
                {(pricingPreview.discountFils / 1000).toFixed(3)} JOD · delivery{" "}
                {(pricingPreview.deliveryFils / 1000).toFixed(3)} JOD · tax{" "}
                {(pricingPreview.taxFils / 1000).toFixed(3)} JOD
              </p>
              <p>
                Wallet {(pricingPreview.walletTenderFils / 1000).toFixed(3)} JOD
                of {(pricingPreview.walletAvailableFils / 1000).toFixed(3)} JOD
                available · external due{" "}
                {(pricingPreview.externalDueFils / 1000).toFixed(3)} JOD
              </p>
              <p>
                <strong>
                  Total {(pricingPreview.totalFils / 1000).toFixed(3)} JOD
                </strong>
              </p>
              {pricingPreview.rejections.length ? (
                <small>
                  {pricingPreview.rejections
                    .map((rejection) => rejection.code)
                    .join(" · ")}
                </small>
              ) : null}
            </article>
          ) : null}
          <label>
            Payment / الدفع
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as "CARD" | "COD")
              }
            >
              <option value="CARD">Card / بطاقة</option>
              <option value="COD">Cash on delivery or pickup / نقداً</option>
            </select>
          </label>
          {simulation && paymentMethod === "CARD" ? (
            <label>
              Simulated APS outcome / نتيجة الدفع التجريبية
              <select
                value={simulationOutcome}
                onChange={(event) =>
                  setSimulationOutcome(
                    event.target.value as typeof simulationOutcome,
                  )
                }
              >
                <option value="success">Success / ناجح</option>
                <option value="failure">Failure / فشل</option>
                <option value="pending">Pending / قيد المعالجة</option>
              </select>
            </label>
          ) : null}
          {mode === "DELIVERY" && paymentMethod === "CARD" ? (
            <label className="check">
              <input name="doorstep" type="checkbox" required />
              If I am unavailable, I authorize a safe accessible doorstep
              handoff with private proof and notification. / عند غيابي أوافق على
              التسليم الآمن عند الباب مع إثبات خاص وإشعار.
            </label>
          ) : null}
          <label className="check">
            <input name="terms" type="checkbox" required />I accept the
            displayed versioned terms. / أوافق على نسخة الشروط المعروضة.
          </label>
          <button
            className="primary"
            type="submit"
            disabled={pending || createdOrder !== null}
          >
            {pending
              ? "Placing order… / جارٍ إنشاء الطلب…"
              : "Place order / تأكيد الطلب"}
          </button>
        </fieldset>
      </form>
      {createdOrder ? (
        <Link
          className="secondary"
          href={`/account/orders/${encodeURIComponent(createdOrder.orderId)}`}
        >
          View order and payment status / عرض الطلب وحالة الدفع
        </Link>
      ) : null}
      <p aria-live="polite">{message}</p>
    </section>
  );
}
