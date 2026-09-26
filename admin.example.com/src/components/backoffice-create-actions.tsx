"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import {
  createNotificationTemplate,
  inspectInventoryReturn,
  recordCashDiscrepancy,
} from "@/lib/backoffice-actions";

function ActionResult({
  message,
  live,
}: {
  message: string;
  live: "off" | "polite";
}) {
  return (
    <p className="operation-result" aria-live={live}>
      {message}
    </p>
  );
}

export function InventoryReturnInspection() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      async () => {
        await inspectInventoryReturn(String(values.get("orderId") ?? ""), {
          sellable: values.get("condition") === "SELLABLE",
          reason: String(values.get("reason") ?? ""),
        });
      },
      {
        en: "Return inspection recorded and inventory refreshed.",
        ar: "تم تسجيل فحص المرتجع وتحديث المخزون.",
      },
    );
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <article className="operation-create-card">
      <div className="operation-create-heading">
        <div>
          <span className="eyebrow">
            {text("RETURN CONTROL", "ضبط المرتجعات")}
          </span>
          <h3>{text("Inspect a returned order", "فحص طلب مرتجع")}</h3>
        </div>
        <p>
          {text(
            "Record whether every pending return allocation is sellable or damaged. This action writes an audited stock movement.",
            "سجّل ما إذا كانت مخصصات المرتجع المعلّقة قابلة للبيع أو تالفة. ينشئ هذا الإجراء حركة مخزون مدققة.",
          )}
        </p>
      </div>
      <form
        className="operation-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          {text("Order reference", "مرجع الطلب")}
          <input name="orderId" required maxLength={100} placeholder="ord_…" />
        </label>
        <label>
          {text("Inspected condition", "حالة المنتج بعد الفحص")}
          <select name="condition" defaultValue="SELLABLE">
            <option value="SELLABLE">
              {text("Sellable return", "مرتجع قابل للبيع")}
            </option>
            <option value="DAMAGED">
              {text("Damaged — do not restock", "تالف — لا يُعاد للمخزون")}
            </option>
          </select>
        </label>
        <label className="operation-wide-field">
          {text("Inspection reason", "سبب نتيجة الفحص")}
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={3}
          />
        </label>
        <div className="operation-submit-row">
          <small>
            {text(
              "Confirm the physical inspection before saving.",
              "أكد الفحص الفعلي قبل الحفظ.",
            )}
          </small>
          <button disabled={pending}>
            {text(
              pending ? "Recording…" : "Record inspection",
              pending ? "جارٍ التسجيل…" : "تسجيل الفحص",
            )}
          </button>
        </div>
      </form>
      <ActionResult message={message} live={live} />
    </article>
  );
}

export function CashDiscrepancyForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      async () => {
        await recordCashDiscrepancy({
          driverId: String(values.get("driverId") ?? ""),
          expectedFils: Number(values.get("expectedFils")),
          actualFils: Number(values.get("actualFils")),
          sourceId: String(values.get("sourceId") ?? ""),
          reason: String(values.get("reason") ?? ""),
        });
      },
      {
        en: "Cash discrepancy recorded for independent review.",
        ar: "تم تسجيل فرق النقد للمراجعة المستقلة.",
      },
    );
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <article className="operation-create-card operation-finance-card">
      <div className="operation-create-heading">
        <div>
          <span className="eyebrow">{text("RECONCILIATION", "المطابقة")}</span>
          <h3>{text("Record a cash discrepancy", "تسجيل فرق نقد")}</h3>
        </div>
        <p>
          {text(
            "Amounts are entered in integer fils. The record is disputed until the finance workflow resolves it.",
            "تُدخل المبالغ بالفلس كأعداد صحيحة. يبقى السجل محل نزاع حتى تعالجه دورة العمل المالية.",
          )}
        </p>
      </div>
      <form
        className="operation-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          {text("Driver account UUID", "معرّف حساب المندوب")}
          <input name="driverId" required pattern="[0-9a-fA-F-]{36}" />
        </label>
        <label>
          {text("Source reference", "مرجع المصدر")}
          <input name="sourceId" required maxLength={200} />
        </label>
        <label>
          {text("Expected fils", "المبلغ المتوقع بالفلس")}
          <input name="expectedFils" type="number" min={0} step={1} required />
        </label>
        <label>
          {text("Actual fils", "المبلغ الفعلي بالفلس")}
          <input name="actualFils" type="number" min={0} step={1} required />
        </label>
        <label className="operation-wide-field">
          {text("Reconciliation reason", "سبب فرق المطابقة")}
          <textarea
            name="reason"
            required
            minLength={3}
            maxLength={500}
            rows={3}
          />
        </label>
        <div className="operation-submit-row">
          <small>
            {text(
              "Recent authentication and cash.reconcile permission are required.",
              "يلزم تسجيل دخول حديث وصلاحية مطابقة النقد.",
            )}
          </small>
          <button disabled={pending}>
            {text(
              pending ? "Recording…" : "Record discrepancy",
              pending ? "جارٍ التسجيل…" : "تسجيل الفرق",
            )}
          </button>
        </div>
      </form>
      <ActionResult message={message} live={live} />
    </article>
  );
}

export function NotificationTemplateForm() {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    const completed = await perform(
      async () => {
        await createNotificationTemplate({
          eventType: String(values.get("eventType") ?? ""),
          channel: String(values.get("channel")) as
            "IN_SITE" | "EMAIL" | "WHATSAPP",
          language: String(values.get("language")) as "ar" | "en",
          subject: String(values.get("subject") ?? ""),
          body: String(values.get("body") ?? ""),
          allowedVariables: String(values.get("allowedVariables") ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        });
      },
      {
        en: "A new template version was created.",
        ar: "تم إنشاء إصدار جديد من القالب.",
      },
    );
    if (completed) {
      form.reset();
      router.refresh();
    }
  }

  return (
    <article className="operation-create-card operation-template-card">
      <div className="operation-create-heading">
        <div>
          <span className="eyebrow">
            {text("VERSIONED CONTENT", "محتوى بإصدارات")}
          </span>
          <h3>{text("Create a notification template", "إنشاء قالب إشعار")}</h3>
        </div>
        <p>
          {text(
            "Saving creates the next version for this event, channel, and language. Existing delivery history is preserved.",
            "ينشئ الحفظ الإصدار التالي لهذا الحدث والقناة واللغة، مع الحفاظ على سجل الإرسال السابق.",
          )}
        </p>
      </div>
      <form
        className="operation-form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
      >
        <label>
          {text("Versioned event", "الحدث مع الإصدار")}
          <input
            name="eventType"
            required
            pattern="[a-z][a-z0-9_.-]+\.v[1-9][0-9]*"
            placeholder="order.delivered.v1"
          />
        </label>
        <label>
          {text("Channel", "القناة")}
          <select name="channel" defaultValue="IN_SITE">
            <option value="IN_SITE">{text("In-site", "داخل الموقع")}</option>
            <option value="EMAIL">{text("Email", "البريد الإلكتروني")}</option>
            <option value="WHATSAPP">{text("WhatsApp", "واتساب")}</option>
          </select>
        </label>
        <label>
          {text("Language", "اللغة")}
          <select name="language" defaultValue="ar">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {text("Subject (email only)", "العنوان (للبريد فقط)")}
          <input name="subject" maxLength={200} />
        </label>
        <label className="operation-wide-field">
          {text(
            "Allowed variables, comma separated",
            "المتغيرات المسموحة، مفصولة بفواصل",
          )}
          <input name="allowedVariables" placeholder="name, orderId" />
        </label>
        <label className="operation-wide-field">
          {text("Template body", "نص القالب")}
          <textarea
            name="body"
            required
            maxLength={10000}
            rows={5}
            placeholder="Hello {{name}}…"
          />
        </label>
        <div className="operation-submit-row">
          <small>
            {text(
              "Every {{placeholder}} must appear in the allowed-variable list.",
              "يجب إدراج كل {{عنصر نائب}} في قائمة المتغيرات المسموحة.",
            )}
          </small>
          <button disabled={pending}>
            {text(
              pending ? "Creating…" : "Create version",
              pending ? "جارٍ الإنشاء…" : "إنشاء الإصدار",
            )}
          </button>
        </div>
      </form>
      <ActionResult message={message} live={live} />
    </article>
  );
}
