"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { requestApi } from "@/lib/client-api";
import {
  PromotionOperations,
  type Campaign,
} from "@/components/promotion-operations";
import {
  ReferralOperations,
  type ReferralOperationsData,
} from "@/components/referral-operations";
import {
  ReviewOperations,
  type ReviewQueueItem,
} from "@/components/review-operations";
import {
  PayoutOperations,
  VerificationOperations,
  type PayoutQueue,
  type VerificationQueue,
} from "@/components/verification-operations";
import {
  CampaignOperations,
  type NotificationCampaign,
} from "@/components/campaign-operations";
import {
  AnalyticsDashboard,
  type OperationalDashboard,
} from "@/components/analytics-dashboard";
import {
  CashDiscrepancyForm,
  InventoryReturnInspection,
  NotificationTemplateForm,
} from "@/components/backoffice-create-actions";

type RecordRow = Record<string, unknown>;
type Props = {
  section: string;
  analyticsQuery?: string;
  inventory: RecordRow[];
  customers: RecordRow[];
  staff: RecordRow[];
  refunds: RecordRow[];
  cash: RecordRow[];
  templates: RecordRow[];
  audits: RecordRow[];
  campaigns: Campaign[];
  referrals: ReferralOperationsData;
  reviews: ReviewQueueItem[];
  verification: VerificationQueue;
  payouts: PayoutQueue;
  notificationCampaigns: NotificationCampaign[];
  analytics: OperationalDashboard | null;
  canAdjustInventory: boolean;
  canInviteStaff: boolean;
  canManagePromotions: boolean;
  canModerateReviews: boolean;
  canReviewVerification: boolean;
  canReviewPayouts: boolean;
  canReconcileCash: boolean;
  canManageNotifications: boolean;
};

async function mutate(path: string, method: string, body: unknown) {
  return requestApi(path, { method, body });
}
function money(value: unknown) {
  return `${(Number(value) / 1000).toFixed(3)} JOD`;
}

export function OperationsConsole(props: Props) {
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function run(action: () => Promise<unknown>) {
    const completed = await perform(() => action().then(() => undefined), {
      en: "Operation saved and the current workspace refreshed.",
      ar: "تم حفظ العملية وتحديث مساحة العمل الحالية.",
    });
    if (completed) router.refresh();
  }
  return (
    <div className="operations-console">
      <p className="operation-message" aria-live={live}>
        {message}
      </p>
      {props.section === "analytics" ? (
        <AnalyticsDashboard
          dashboard={props.analytics}
          query={props.analyticsQuery}
        />
      ) : null}
      {props.section === "promotions" && props.canManagePromotions ? (
        <PromotionOperations campaigns={props.campaigns} />
      ) : null}
      {props.section === "campaigns" && props.canManagePromotions ? (
        <CampaignOperations campaigns={props.notificationCampaigns} />
      ) : null}
      {props.section === "referrals" && props.canManagePromotions ? (
        <ReferralOperations referrals={props.referrals} />
      ) : null}
      {props.section === "reviews" && props.canModerateReviews ? (
        <ReviewOperations reviews={props.reviews} />
      ) : null}
      {props.section === "verification" && props.canReviewVerification ? (
        <VerificationOperations queue={props.verification} />
      ) : null}
      {props.section === "payouts" && props.canReviewPayouts ? (
        <PayoutOperations queue={props.payouts} />
      ) : null}

      {props.section === "inventory" ? (
        <section id="inventory">
          <h2>Inventory ledger / سجل المخزون</h2>
          {props.canAdjustInventory ? <InventoryReturnInspection /> : null}
          <div className="list">
            {props.inventory.map((item) => (
              <article key={String(item.variant_id)}>
                <div>
                  <strong>
                    {String(item.sku)} · {String(item.name_en)}
                  </strong>
                  <small>
                    {String(item.state)} · on hand {String(item.on_hand)} ·
                    reserved {String(item.reserved)} · available{" "}
                    {String(item.available)}
                  </small>
                </div>
                {props.canAdjustInventory ? (
                  <form
                    onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() =>
                        mutate("/api/v1/admin/inventory", "POST", {
                          variantId: item.variant_id,
                          onHandDelta: Number(values.get("delta")),
                          reason: values.get("reason"),
                          sourceReference: values.get("reference"),
                          comment: values.get("comment") || undefined,
                        }),
                      ); }}
                  >
                    <label>
                      Stock delta
                      <input
                        name="delta"
                        type="number"
                        required
                        placeholder="Stock delta"
                      />
                    </label>
                    <label>
                      Reason
                      <select name="reason">
                        <option>RESTOCK</option>
                        <option>DAMAGE</option>
                        <option>LOSS</option>
                        <option>FOUND</option>
                        <option>COUNT</option>
                        <option>SUPPLIER_CORRECTION</option>
                        <option>OTHER</option>
                      </select>
                    </label>
                    <label>
                      Source reference
                      <input
                        name="reference"
                        required
                        placeholder="Source reference"
                      />
                    </label>
                    <label>
                      Explanation
                      <input name="comment" placeholder="Explanation" />
                    </label>
                    <button className="secondary" disabled={pending}>Record movement</button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {props.section === "customers" ? (
        <section id="customers">
          <h2>Customers / العملاء</h2>
          <div className="list">
            {props.customers.map((customer) => (
              <article key={String(customer.public_id)}>
                <div>
                  <strong>{String(customer.display_name)}</strong>
                  <small>
                    {String(customer.public_id)} ·{" "}
                    {String(customer.email_normalized)}
                  </small>
                </div>
                <span>{String(customer.status)}</span>
                <span>
                  {String(customer.order_count)} orders ·{" "}
                  {String(customer.open_ticket_count)} open tickets
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {props.section === "finance" ? (
        <section id="finance">
          <h2>Finance & reconciliation / المالية والمطابقة</h2>
          {props.canReconcileCash ? <CashDiscrepancyForm /> : null}
          <h3>Refund obligations</h3>
          <div className="list">
            {props.refunds.length ? (
              props.refunds.map((refund) => (
                <article key={String(refund.id)}>
                  <div>
                    <strong>
                      {String(refund.order_public_id ?? "Unlinked refund")}
                    </strong>
                    <small>
                      {String(refund.reason)} · {String(refund.status)} ·{" "}
                      {String(refund.provider ?? refund.method ?? "")}
                    </small>
                  </div>
                  <span>{money(refund.amount_fils)}</span>
                  {["REQUIRED", "PENDING", "UNKNOWN"].includes(
                    String(refund.status),
                  ) ? (
                    <form
                      onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() =>
                          mutate(
                            `/api/v1/admin/finance/refunds/${refund.id}/execute`,
                            "POST",
                            { reference: values.get("reference") || undefined },
                          ),
                        ); }}
                    >
                      <label>
                        Manual receipt for non-provider refund
                        <input
                          name="reference"
                          placeholder="Manual receipt for non-provider refund"
                        />
                      </label>
                      <button className="secondary" disabled={pending}>Execute refund</button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <p>No refund obligations.</p>
            )}
          </div>
          <h3>Cash custody ledger</h3>
          <div className="list">
            {props.cash.length ? (
              props.cash.map((entry) => (
                <article key={String(entry.id)}>
                  <div>
                    <strong>
                      {String(entry.kind)} · {String(entry.state)}
                    </strong>
                    <small>
                      {String(entry.driver_name ?? entry.driver_id)} ·{" "}
                      {String(entry.source_id)}
                    </small>
                  </div>
                  <span>{money(entry.amount_fils)}</span>
                  {entry.kind === "HANDOVER" &&
                  entry.state === "HANDED_OVER" ? (
                    <button
                      className="secondary"
                      onClick={() =>
                        run(() =>
                          mutate(
                            `/api/v1/admin/finance/handovers/${entry.id}/verify`,
                            "POST",
                            {},
                          ),
                        )
                      }
                    >
                      Verify handover
                    </button>
                  ) : null}
                  {entry.kind === "FINANCE_VERIFICATION" ? (
                    <form
                      onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() =>
                          mutate("/api/v1/admin/finance/deposits", "POST", {
                            verificationId: entry.id,
                            bankReference: values.get("bankReference"),
                          }),
                        ); }}
                    >
                      <label>
                        Bank statement reference
                        <input
                          name="bankReference"
                          required
                          placeholder="Bank statement reference"
                        />
                      </label>
                      <button className="secondary" disabled={pending}>
                        Record independent deposit
                      </button>
                    </form>
                  ) : null}
                </article>
              ))
            ) : (
              <p>No cash custody entries.</p>
            )}
          </div>
        </section>
      ) : null}

      {props.section === "notifications" ? (
        <section id="notifications">
          <h2>Notification templates / قوالب الإشعارات</h2>
          {props.canManageNotifications ? <NotificationTemplateForm /> : null}
          <div className="list">
            {props.templates.map((template) => (
              <article key={String(template.id)}>
                <strong>{String(template.event_type)}</strong>
                <span>
                  {String(template.channel)} · {String(template.language)} · v
                  {String(template.version)}
                </span>
                <small>
                  {String(template.enabled ? "Enabled" : "Disabled")}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {props.section === "audits" ? (
        <section id="audits">
          <h2>Permission-filtered audit / سجل التدقيق</h2>
          <div className="list">
            {props.audits.map((event, index) => (
              <article key={String(event.id ?? index)}>
                {event.locked ? (
                  <>
                    <strong>Protected audit record</strong>
                    <span>{String(event.reason)}</span>
                  </>
                ) : (
                  <>
                    <strong>{String(event.action)}</strong>
                    <span>
                      {String(event.domain)} · {String(event.result)}
                    </span>
                    <small>
                      {String(event.actorRole ?? "SYSTEM")} ·{" "}
                      {new Date(String(event.occurredAt)).toLocaleString(
                        "en-JO",
                      )}
                    </small>
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {props.section === "staff" ? (
        <section id="staff">
          <h2>Staff / الموظفون</h2>
          {props.canInviteStaff ? (
            <form
              className="panel form-grid"
              onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() =>
                  mutate("/api/v1/admin/staff", "POST", {
                    email: values.get("email"),
                    name: values.get("name"),
                    role: values.get("role"),
                  }),
                ); }}
            >
              <label>
                Staff email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Staff email"
                />
              </label>
              <label>
                Staff name
                <input name="name" required placeholder="Staff name" />
              </label>
              <label>
                Role
                <select name="role">
                  <option>DELIVERY_AGENT</option>
                  <option>SUPPORT_AGENT</option>
                  <option>LOGISTICS_STAFF</option>
                  <option>FINANCE_STAFF</option>
                  <option>ADMIN</option>
                  <option>SUPER_ADMIN</option>
                </select>
              </label>
              <button className="secondary">Create one-use enrollment</button>
            </form>
          ) : null}
          <div className="list">
            {props.staff.map((member) => (
              <article key={String(member.public_id)}>
                <div>
                  <strong>{String(member.display_name)}</strong>
                  <small>
                    {String(member.email_normalized)} ·{" "}
                    {String(member.public_id)}
                  </small>
                </div>
                <span>
                  {String(member.role_id)} · {String(member.status)}
                </span>
                {String(member.role_id) !== "CTO" ? (
                  <div className="inline-actions">
                    <button
                      className="danger"
                      onClick={() =>
                        run(() =>
                          mutate(
                            `/api/v1/admin/staff/${member.public_id}/status`,
                            "POST",
                            { status: "SUSPENDED" },
                          ),
                        )
                      }
                    >
                      Suspend
                    </button>
                    <button
                      className="secondary"
                      onClick={() =>
                        run(() =>
                          mutate(
                            `/api/v1/admin/staff/${member.public_id}/status`,
                            "POST",
                            { status: "ACTIVE" },
                          ),
                        )
                      }
                    >
                      Activate
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        run(() =>
                          mutate(
                            `/api/v1/admin/staff/${member.public_id}/status`,
                            "POST",
                            { status: "DISABLED" },
                          ),
                        )
                      }
                    >
                      Disable
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
