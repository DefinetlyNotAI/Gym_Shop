"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import {
  createDeliveryZone,
  createPickupLocation,
} from "@/lib/delivery-settings-actions";

type Zone = Record<string, unknown>;
type Pickup = Record<string, unknown>;

function textValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const text = (value as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return "—";
}

function ActionResult({ message, live }: { message: string; live: "off" | "polite" }) {
  return <p className="operation-result" aria-live={live}>{message}</p>;
}

function ZoneForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(async () => {
      await createDeliveryZone({
        nameEn: String(values.get("nameEn") ?? ""),
        nameAr: String(values.get("nameAr") ?? ""),
        feeFils: Number(values.get("feeFils")),
        etaMinDays: Number(values.get("etaMinDays")),
        etaMaxDays: Number(values.get("etaMaxDays")),
        policyReviewed: values.get("policyReviewed") === "on",
        weekday: Number(values.get("weekday")),
        startsAt: String(values.get("startsAt") ?? ""),
        endsAt: String(values.get("endsAt") ?? ""),
        capacity: Number(values.get("capacity")),
      });
    }, {
      en: "Delivery zone created and the service list refreshed.",
      ar: "تم إنشاء منطقة التوصيل وتحديث قائمة الخدمة.",
    });
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return <article className="configuration-card configuration-zone-card">
    <header>
      <span className="eyebrow">{text("DELIVERY COVERAGE", "نطاق التوصيل")}</span>
      <h2>{text("Create a service zone", "إنشاء منطقة خدمة")}</h2>
      <p>{text("Define the reviewed fee, delivery promise, and first operating window. All money is entered in integer fils.", "حدد الرسوم المعتمدة ومدة التوصيل وأول نافذة تشغيل. تُدخل جميع المبالغ بالفلس كأعداد صحيحة.")}</p>
    </header>
    <form className="configuration-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <label>{text("English name", "الاسم بالإنجليزية")}<input name="nameEn" required minLength={2} maxLength={100} /></label>
      <label>{text("Arabic name", "الاسم بالعربية")}<input name="nameAr" required minLength={2} maxLength={100} dir="rtl" /></label>
      <label>{text("Fee in fils", "الرسوم بالفلس")}<input name="feeFils" type="number" min={0} step={1} required /></label>
      <label>{text("Minimum days", "الحد الأدنى للأيام")}<input name="etaMinDays" type="number" min={0} step={1} required /></label>
      <label>{text("Maximum days", "الحد الأقصى للأيام")}<input name="etaMaxDays" type="number" min={0} step={1} required /></label>
      <label>{text("Operating day", "يوم التشغيل")}<select name="weekday" defaultValue="0"><option value="0">{text("Sunday", "الأحد")}</option><option value="1">{text("Monday", "الاثنين")}</option><option value="2">{text("Tuesday", "الثلاثاء")}</option><option value="3">{text("Wednesday", "الأربعاء")}</option><option value="4">{text("Thursday", "الخميس")}</option><option value="5">{text("Friday", "الجمعة")}</option><option value="6">{text("Saturday", "السبت")}</option></select></label>
      <label>{text("Window starts", "بداية النافذة")}<input name="startsAt" type="time" required /></label>
      <label>{text("Window ends", "نهاية النافذة")}<input name="endsAt" type="time" required /></label>
      <label>{text("Daily capacity", "السعة اليومية")}<input name="capacity" type="number" min={1} step={1} required /></label>
      <label className="check configuration-wide"><input name="policyReviewed" type="checkbox" />{text("Fee and delivery policy reviewed", "تمت مراجعة الرسوم وسياسة التوصيل")}</label>
      <div className="configuration-submit configuration-wide">
        <small>{text("The zone stays auditable and appears at checkout once active.", "تبقى المنطقة قابلة للتدقيق وتظهر عند الدفع بعد تفعيلها.")}</small>
        <button disabled={pending}>{text(pending ? "Creating…" : "Create zone", pending ? "جارٍ الإنشاء…" : "إنشاء المنطقة")}</button>
      </div>
    </form>
    <ActionResult message={message} live={live} />
  </article>;
}

function PickupForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(async () => {
      await createPickupLocation({
        nameEn: String(values.get("nameEn") ?? ""),
        nameAr: String(values.get("nameAr") ?? ""),
        address: String(values.get("address") ?? ""),
        hours: String(values.get("hours") ?? ""),
      });
    }, {
      en: "Pickup location created and the location list refreshed.",
      ar: "تم إنشاء موقع الاستلام وتحديث قائمة المواقع.",
    });
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return <article className="configuration-card configuration-pickup-card">
    <header>
      <span className="eyebrow">{text("CUSTOMER PICKUP", "استلام العملاء")}</span>
      <h2>{text("Create a pickup location", "إنشاء موقع استلام")}</h2>
      <p>{text("Publish a clearly named location with customer-ready address and opening-hour guidance.", "انشر موقعاً واضح الاسم مع عنوان وإرشادات ساعات عمل جاهزة للعملاء.")}</p>
    </header>
    <form className="configuration-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <label>{text("English name", "الاسم بالإنجليزية")}<input name="nameEn" required minLength={2} maxLength={100} /></label>
      <label>{text("Arabic name", "الاسم بالعربية")}<input name="nameAr" required minLength={2} maxLength={100} dir="rtl" /></label>
      <label className="configuration-wide">{text("Customer-facing address", "العنوان الظاهر للعملاء")}<textarea name="address" required minLength={3} maxLength={1000} rows={3} /></label>
      <label className="configuration-wide">{text("Opening hours and guidance", "ساعات العمل والإرشادات")}<textarea name="hours" required minLength={3} maxLength={1000} rows={3} /></label>
      <div className="configuration-submit configuration-wide">
        <small>{text("Use wording customers can follow without staff assistance.", "استخدم صياغة يستطيع العملاء اتباعها دون مساعدة الموظفين.")}</small>
        <button disabled={pending}>{text(pending ? "Creating…" : "Create pickup", pending ? "جارٍ الإنشاء…" : "إنشاء موقع الاستلام")}</button>
      </div>
    </form>
    <ActionResult message={message} live={live} />
  </article>;
}

export function DeliverySettingsWorkspace({ zones, pickups }: { zones: Zone[]; pickups: Pickup[] }) {
  const { text } = useLanguage();
  return <div className="configuration-workspace">
    <section className="configuration-summary" aria-label={text("Delivery configuration summary", "ملخص إعدادات التوصيل")}>
      <article><span>{text("Service zones", "مناطق الخدمة")}</span><strong>{zones.length}</strong></article>
      <article><span>{text("Pickup locations", "مواقع الاستلام")}</span><strong>{pickups.length}</strong></article>
      <p>{text("Checkout uses these live, audited fulfillment choices. Review customer-facing names, fees, and hours before launch.", "تستخدم صفحة الدفع خيارات التنفيذ المباشرة والمدققة هذه. راجع الأسماء والرسوم والساعات الظاهرة للعملاء قبل الإطلاق.")}</p>
    </section>
    <div className="configuration-columns"><ZoneForm /><PickupForm /></div>
    <section className="configuration-lists">
      <div><header><h2>{text("Current service zones", "مناطق الخدمة الحالية")}</h2><span>{zones.length}</span></header><div className="configuration-list">{zones.length ? zones.map((zone) => <article key={String(zone.id)}><div><strong>{text(String(zone.name_en), String(zone.name_ar))}</strong><small>{text(`${zone.eta_min_days}–${zone.eta_max_days} days`, `${zone.eta_min_days}–${zone.eta_max_days} أيام`)}</small></div><div className="configuration-value"><strong>{(Number(zone.fee_fils) / 1000).toFixed(3)} JOD</strong><span className={zone.policy_reviewed ? "status-chip is-ready" : "status-chip is-warning"}>{zone.policy_reviewed ? text("Reviewed", "معتمد") : text("Review required", "تحتاج مراجعة")}</span></div></article>) : <p className="empty">{text("No delivery zones configured.", "لم يتم إعداد مناطق توصيل.")}</p>}</div></div>
      <div><header><h2>{text("Current pickup locations", "مواقع الاستلام الحالية")}</h2><span>{pickups.length}</span></header><div className="configuration-list">{pickups.length ? pickups.map((pickup) => <article key={String(pickup.id)}><div><strong>{text(String(pickup.name_en), String(pickup.name_ar))}</strong><small>{textValue(pickup.address)}</small></div><div className="configuration-value"><span>{textValue(pickup.hours)}</span></div></article>) : <p className="empty">{text("No pickup locations configured.", "لم يتم إعداد مواقع استلام.")}</p>}</div></div>
    </section>
  </div>;
}
