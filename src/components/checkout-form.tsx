"use client";

import { useMemo, useState } from "react";

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

export function CheckoutForm({ zones, pickups, termsId, simulation=false }: { zones: Zone[]; pickups: Pickup[]; termsId: string; simulation?:boolean }) {
  const [mode, setMode] = useState<"DELIVERY" | "PICKUP">(zones.length ? "DELIVERY" : "PICKUP");
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "COD">("CARD");
  const [simulationOutcome,setSimulationOutcome]=useState<"success"|"failure"|"pending">("success");
  const [message, setMessage] = useState("");
  const selectedZone = useMemo(() => zones.find((zone) => zone.id === zoneId), [zoneId, zones]);

  async function submit(form: FormData) {
    setMessage("Placing order… / جارٍ إنشاء الطلب…");
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
      doorstepAuthorized: mode === "DELIVERY" && form.get("doorstep") === "on",
    };
    const response = await fetch("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error?.message ?? "Checkout failed / تعذر إتمام الطلب");
      return;
    }
    const result = payload.data as CheckoutResult;
    if (paymentMethod === "CARD" && result.paymentUrl && result.paymentFields) {
      const paymentForm=document.createElement("form");paymentForm.method="POST";paymentForm.action=result.paymentUrl;
      for(const[name,value]of Object.entries(result.paymentFields)){const field=document.createElement("input");field.type="hidden";field.name=name;field.value=simulation&&name==="outcome"?simulationOutcome:value;paymentForm.appendChild(field);}
      document.body.appendChild(paymentForm);paymentForm.submit();
      return;
    }
    setMessage(`Order ${result.orderId} confirmed. The pickup PIN is sent through WhatsApp when required. / تم تأكيد الطلب وسيصل رمز الاستلام عبر واتساب عند الحاجة.`);
  }

  return (
    <section className="panel">
      <form action={submit}>
        <label>
          Fulfillment / الاستلام
          <select value={mode} onChange={(event) => setMode(event.target.value as "DELIVERY" | "PICKUP")}>
            {zones.length ? <option value="DELIVERY">Delivery / توصيل</option> : null}
            {pickups.length ? <option value="PICKUP">Store pickup / استلام من المتجر</option> : null}
          </select>
        </label>
        {mode === "DELIVERY" && paymentMethod === "COD" && selectedZone ? <article className="notice"><strong>COD redelivery / إعادة التوصيل</strong><p>The original delivery fee is {(Number(selectedZone.fee_fils)/1000).toFixed(3)} JOD. Attempt two is a courtesy retry. Only when attempt three is actually made, an additional {(Number(selectedZone.fee_fils)*2/1000).toFixed(3)} JOD is added, making total delivery fees {(Number(selectedZone.fee_fils)*3/1000).toFixed(3)} JOD.</p><p>المحاولة الثانية مجانية. عند تنفيذ المحاولة الثالثة فعلياً فقط تضاف رسوم قدرها ضعفا رسم التوصيل الأصلي.</p></article> : null}
        {mode === "DELIVERY" ? (
          <>
            <label>
              Delivery zone / منطقة التوصيل
              <select name="zone" value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
                {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name_en} / {zone.name_ar} — {(Number(zone.fee_fils) / 1000).toFixed(3)} JOD</option>)}
              </select>
            </label>
            <label>
              Delivery window / موعد التوصيل
              <select name="window" required>
                {(selectedZone?.windows ?? []).map((window) => <option key={window.id} value={window.id}>Day {window.weekday}: {window.startsAt}–{window.endsAt}</option>)}
              </select>
            </label>
          </>
        ) : (
          <label>
            Pickup location / موقع الاستلام
            <select name="pickup" required>
              {pickups.map((pickup) => <option key={pickup.id} value={pickup.id}>{pickup.name_en} / {pickup.name_ar}</option>)}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label>Name / الاسم<input name="name" required minLength={2} /></label>
          <label>Phone / الهاتف<input name="phone" required minLength={8} /></label>
          <label>City / المدينة<input name="city" required minLength={2} /></label>
          <label>Area / المنطقة<input name="area" required minLength={2} /></label>
          <label>Street / الشارع<input name="street" required minLength={2} /></label>
          <label>Building / المبنى<input name="building" /></label>
        </div>
        <label>Notes / ملاحظات<textarea name="notes" maxLength={500} /></label>
        <label>
          Payment / الدفع
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "CARD" | "COD")}>
            <option value="CARD">Card / بطاقة</option>
            <option value="COD">Cash on delivery or pickup / نقداً</option>
          </select>
        </label>
        {simulation&&paymentMethod==="CARD"?<label>Simulated APS outcome / نتيجة الدفع التجريبية<select value={simulationOutcome} onChange={event=>setSimulationOutcome(event.target.value as typeof simulationOutcome)}><option value="success">Success / ناجح</option><option value="failure">Failure / فشل</option><option value="pending">Pending / قيد المعالجة</option></select></label>:null}
        {mode === "DELIVERY" && paymentMethod === "CARD" ? <label className="check"><input name="doorstep" type="checkbox" required />If I am unavailable, I authorize a safe accessible doorstep handoff with private proof and notification. / عند غيابي أوافق على التسليم الآمن عند الباب مع إثبات خاص وإشعار.</label> : null}
        <label className="check"><input name="terms" type="checkbox" required />I accept the displayed versioned terms. / أوافق على نسخة الشروط المعروضة.</label>
        <button className="primary" type="submit">Place order / تأكيد الطلب</button>
      </form>
      <p aria-live="polite">{message}</p>
    </section>
  );
}
