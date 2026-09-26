"use client";
import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";
export type NotificationCampaign = {
  public_id: string;
  name: string;
  subject: string;
  body: string;
  status: string;
  scheduled_at: string | null;
  recipients: number;
  suppressed: number;
};
export function CampaignOperations({
  campaigns,
}: {
  campaigns: NotificationCampaign[];
}) {
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function run(work: () => Promise<unknown>, success: { en: string; ar: string }) {
    const completed = await perform(() => work().then(() => undefined), success);
    if (completed) router.refresh();
  }
  return (
    <section id="campaigns">
      <h2>Newsletter campaigns</h2>
      <p>
        Core audience: currently opted-in newsletter accounts. Consent and
        account state are checked again when delivery is attempted.
      </p>
      <details className="workflow-disclosure">
        <summary>Create a newsletter draft</summary>
        <form
          className="form-grid"
          onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const values = new FormData(form); void run(() => requestApi("/api/v1/admin/notifications/campaigns", { method: "POST", body: { name: values.get("name"), subject: values.get("subject"), body: values.get("body") } }), { en: "Newsletter draft created.", ar: "تم إنشاء مسودة النشرة." }); }}
        >
          <label>
            Campaign name
            <input name="name" required placeholder="Campaign name" />
          </label>
          <label>
            Email subject
            <input name="subject" required placeholder="Email subject" />
          </label>
          <label>
            Campaign message
            <textarea
              name="body"
              required
              minLength={5}
              placeholder="Campaign message"
            />
          </label>
          <button disabled={pending}>Create draft</button>
        </form>
      </details>
      <p aria-live={live}>{message}</p>
      <div className="list">
        {campaigns.map((item) => (
          <article key={item.public_id}>
            <strong>
              {item.name} · {item.status}
            </strong>
            <small>
              {item.recipients} recipients · {item.suppressed} suppressed
            </small>
            <p>{item.subject}</p>
            <div className="inline-actions">
              <button
                className="secondary"
                disabled={pending}
                onClick={() => void run(() =>
                    requestApi(
                      `/api/v1/admin/notifications/campaigns/${item.public_id}`,
                      { method: "POST", body: { action: "PREVIEW" } },
                    ),
                  { en: "Campaign preview prepared.", ar: "تم إعداد معاينة الحملة." })}
              >
                Preview
              </button>
              <button
                disabled={pending}
                onClick={() => void run(() =>
                    requestApi(
                      `/api/v1/admin/notifications/campaigns/${item.public_id}`,
                      {
                        method: "POST",
                        body: { action: "SCHEDULE", scheduledAt: new Date().toISOString() },
                      },
                    ),
                  { en: "Campaign scheduled.", ar: "تمت جدولة الحملة." })}
              >
                Schedule now
              </button>
              <button
                className="secondary"
                disabled={pending}
                onClick={() => void run(() =>
                    requestApi(
                      `/api/v1/admin/notifications/campaigns/${item.public_id}`,
                      { method: "POST", body: { action: "PAUSE" } },
                    ),
                  { en: "Campaign paused.", ar: "تم إيقاف الحملة مؤقتاً." })}
              >
                Pause
              </button>
              <button
                className="secondary"
                disabled={pending}
                onClick={() => void run(() =>
                    requestApi(
                      `/api/v1/admin/notifications/campaigns/${item.public_id}`,
                      { method: "POST", body: { action: "CANCEL" } },
                    ),
                  { en: "Campaign cancelled.", ar: "تم إلغاء الحملة." })}
              >
                Cancel
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
