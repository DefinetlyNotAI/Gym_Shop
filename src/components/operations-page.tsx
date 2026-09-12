import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminTools } from "@/components/admin-tools";
import {
  CatalogWorkspace,
  type CatalogData,
} from "@/components/catalog-workspace";
import { OperationsConsole } from "@/components/operations-console";
import { OrderActions } from "@/components/order-actions";
import { StaffLogin } from "@/components/staff-login";
import { LocalizedText as T } from "@/components/language-provider";
import { SupportOperations } from "@/components/support-operations";
import type { Campaign } from "@/components/promotion-operations";
import type { ReferralOperationsData } from "@/components/referral-operations";
import type { ReviewQueueItem } from "@/components/review-operations";
import type {
  PayoutQueue,
  VerificationQueue,
} from "@/components/verification-operations";
import type { NotificationCampaign } from "@/components/campaign-operations";
import type { OperationalDashboard } from "@/components/analytics-dashboard";
import { apiGet, getSession } from "@/lib/api";
import { analyticsQuery } from "@/lib/analytics-query";
import {
  getOperationsRoute,
  operationsRequests,
  routesForRole,
} from "@/lib/operations-routes";

type Row = Record<string, unknown>;
type Rows = {
  products?: Row[];
  inventory?: Row[];
  customers?: Row[];
  staff?: Row[];
  templates?: Row[];
  events?: Row[];
  orders?: Row[];
  zones?: Row[];
  tickets?: Parameters<typeof SupportOperations>[0]["initialTickets"];
  refunds?: Row[];
  cash?: Row[];
};
const filterKeys = [
  "from",
  "to",
  "status",
  "productId",
  "categoryId",
  "collectionId",
  "referralCode",
  "zoneId",
];

export async function OperationsPage({
  section,
  searchParams = {},
}: {
  section: string;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await getSession();
  if (!actor) {
    if (section !== "overview") redirect("/");
    return (
      <main className="page auth-page">
        <p className="eyebrow">
          <T en="GYM SHOP STAFF" ar="موظفو جيم شوب" />
        </p>
        <h1>
          <T en="Operations sign in" ar="دخول العمليات" />
        </h1>
        <p>
          <T
            en="A secure workspace for authorized staff."
            ar="مساحة عمل آمنة للموظفين المصرح لهم."
          />
        </p>
        <StaffLogin />
      </main>
    );
  }
  if (actor.sessionKind === "EMERGENCY") redirect("/recovery");
  if (actor.role === "DELIVERY_AGENT") redirect("/delivery");
  const route = getOperationsRoute(section);
  if (!route?.roles.includes(actor.role)) notFound();

  let query = new URLSearchParams();
  for (const key of filterKeys) {
    const value = searchParams[key];
    if (typeof value === "string" && value.trim()) query.set(key, value.trim());
  }
  query = analyticsQuery(query);
  const entries = await Promise.all(
    operationsRequests(section, actor.role).map(async (path) => {
      const target =
        path === "/api/v1/admin/analytics" && query.size
          ? `${path}?${query}`
          : path;
      return [path, await apiGet<unknown>(target)] as const;
    }),
  );
  const data = new Map<string, unknown>(entries);
  function read<Value>(path: string): Value | undefined {
    return data.get(path) as Value | undefined;
  }

  const orders = read<Rows>("/api/v1/admin/orders");
  const inventory = read<Rows>("/api/v1/admin/inventory");
  const tickets = read<Rows>("/api/v1/admin/support/tickets");
  const finance = read<Rows>("/api/v1/admin/finance/overview");
  const products = read<CatalogData>("/api/v1/admin/catalog/products");
  const customers = read<Rows>("/api/v1/admin/customers");
  const staff = read<Rows>("/api/v1/admin/staff");
  const zones = read<Rows>("/api/v1/admin/delivery/zones");
  const templates = read<Rows>("/api/v1/admin/notifications/templates");
  const audits = read<Rows>("/api/v1/admin/audits");
  const platform = read<{ simulation: boolean }>("/api/v1/platform");

  return (
    <main className="page operations-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <T en={route.group} ar="مساحة العمليات" />
          </p>
          <h1>
            <T en={route.title} ar={route.titleAr} />
          </h1>
        </div>
        <p>
          <T en={route.description} ar={route.descriptionAr} />
        </p>
      </header>
      {section === "overview" ? (
        <>
          <div className="metric-grid">
            {orders ? (
              <article>
                <span>
                  <T en="Orders" ar="الطلبات" />
                </span>
                <strong>{orders.orders?.length ?? 0}</strong>
                <Link href="/orders">
                  <T en="View queue" ar="عرض القائمة" />
                </Link>
              </article>
            ) : null}
            {inventory ? (
              <article>
                <span>
                  <T en="Stock alerts" ar="تنبيهات المخزون" />
                </span>
                <strong>
                  {inventory.inventory?.filter((item) =>
                    ["LOW_STOCK", "OUT_OF_STOCK"].includes(String(item.state)),
                  ).length ?? 0}
                </strong>
                <Link href="/inventory">
                  <T en="Review stock" ar="مراجعة المخزون" />
                </Link>
              </article>
            ) : null}
            {tickets ? (
              <article>
                <span>
                  <T en="Support tickets" ar="تذاكر الدعم" />
                </span>
                <strong>{tickets.tickets?.length ?? 0}</strong>
                <Link href="/support">
                  <T en="Open support" ar="فتح الدعم" />
                </Link>
              </article>
            ) : null}
            {finance ? (
              <article>
                <span>
                  <T en="Refund actions" ar="إجراءات الاسترداد" />
                </span>
                <strong>
                  {finance.refunds?.filter(
                    (item) => item.status !== "COMPLETED",
                  ).length ?? 0}
                </strong>
                <Link href="/finance">
                  <T en="Review finance" ar="مراجعة المالية" />
                </Link>
              </article>
            ) : null}
          </div>
          <section className="panel">
            <h2>
              <T en="Choose your workspace" ar="اختر مساحة عملك" />
            </h2>
            <p>
              <T
                en="Each area has its own page, data, and focused actions."
                ar="لكل مجال صفحته وبياناته وإجراءاته المركزة."
              />
            </p>
            <div className="overview-grid">
              {routesForRole(actor.role)
                .filter((item) => item.id !== "overview")
                .map((item) => (
                  <Link
                    className="workspace-card"
                    href={item.href}
                    key={item.id}
                    prefetch={false}
                  >
                    <span className="workspace-label">{item.group}</span>
                    <strong>
                      <T en={item.title} ar={item.titleAr} />
                    </strong>
                    <span>
                      <T en={item.description} ar={item.descriptionAr} />
                    </span>
                    <span className="workspace-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        </>
      ) : null}
      {section === "settings" ? <AdminTools /> : null}
      {["catalog", "categories", "collections", "size-guides"].includes(
        section,
      ) && products ? (
        <CatalogWorkspace
          data={products}
          view={section}
          canEdit={["CTO", "SUPER_ADMIN", "ADMIN", "LOGISTICS_STAFF"].includes(
            actor.role,
          )}
          storeOrigin={process.env.STOREFRONT_ORIGIN ?? "https://example.com"}
        />
      ) : null}
      {section === "orders" ? (
        <section id="orders">
          <h2>
            <T en="Fulfillment queue" ar="قائمة تنفيذ الطلبات" />
          </h2>
          <div className="list">
            {orders?.orders?.length ? (
              orders.orders.map((order) => (
                <article key={String(order.public_id)}>
                  <div>
                    <strong>{String(order.public_id)}</strong>
                    <small>
                      {String(order.fulfillment_status)} ·{" "}
                      {String(order.payment_status)}
                    </small>
                  </div>
                  <span className="amount">
                    {(Number(order.external_due_fils) / 1000).toFixed(3)} JOD
                  </span>
                  <OrderActions
                    publicId={String(order.public_id)}
                    fulfillmentStatus={String(order.fulfillment_status)}
                    simulation={platform?.simulation}
                  />
                </article>
              ))
            ) : (
              <p className="empty">
                <T
                  en="No orders in this queue."
                  ar="لا توجد طلبات في هذه القائمة."
                />
              </p>
            )}
          </div>
        </section>
      ) : null}
      {section === "support" ? (
        <SupportOperations initialTickets={tickets?.tickets ?? []} />
      ) : null}
      {section === "delivery-settings" ? (
        <section id="delivery-settings">
          <h2>
            <T en="Service zones" ar="مناطق الخدمة" />
          </h2>
          <div className="list">
            {zones?.zones?.length ? (
              zones.zones.map((zone) => (
                <article key={String(zone.id)}>
                  <div>
                    <strong>
                      <T en={String(zone.name_en)} ar={String(zone.name_ar)} />
                    </strong>
                    <small>
                      {zone.policy_reviewed
                        ? "Reviewed / معتمد"
                        : "Policy review required / يلزم اعتماد السياسة"}
                    </small>
                  </div>
                  <span className="amount">
                    {(Number(zone.fee_fils) / 1000).toFixed(3)} JOD
                  </span>
                </article>
              ))
            ) : (
              <p className="empty">
                <T
                  en="No delivery zones configured."
                  ar="لم يتم إعداد مناطق توصيل."
                />
              </p>
            )}
          </div>
        </section>
      ) : null}
      {![
        "overview",
        "settings",
        "orders",
        "support",
        "delivery-settings",
        "catalog",
        "categories",
        "collections",
        "size-guides",
      ].includes(section) ? (
        <OperationsConsole
          section={section}
          inventory={inventory?.inventory ?? []}
          customers={customers?.customers ?? []}
          staff={staff?.staff ?? []}
          refunds={finance?.refunds ?? []}
          cash={finance?.cash ?? []}
          templates={templates?.templates ?? []}
          audits={audits?.events ?? []}
          campaigns={read<Campaign[]>("/api/v1/admin/promotions") ?? []}
          referrals={
            read<ReferralOperationsData>("/api/v1/admin/referrals") ?? {
              codes: [],
              rewards: [],
            }
          }
          reviews={read<ReviewQueueItem[]>("/api/v1/admin/reviews") ?? []}
          verification={
            read<VerificationQueue>("/api/v1/admin/verification") ?? {
              applications: [],
            }
          }
          payouts={
            read<PayoutQueue>("/api/v1/admin/finance/payouts") ?? {
              payouts: [],
              provider: {
                name: "Amazon Payment Services",
                available: false,
                code: "PAYOUT_PROVIDER_UNAVAILABLE",
                reason:
                  "APS wallet withdrawal capability and integration evidence are not verified.",
              },
            }
          }
          notificationCampaigns={
            read<NotificationCampaign[]>(
              "/api/v1/admin/notifications/campaigns",
            ) ?? []
          }
          analytics={
            read<OperationalDashboard>("/api/v1/admin/analytics") ?? null
          }
          analyticsQuery={query.toString()}
          canAdjustInventory={[
            "CTO",
            "SUPER_ADMIN",
            "LOGISTICS_STAFF",
          ].includes(actor.role)}
          canInviteStaff={actor.role === "CTO"}
          canManagePromotions={["CTO", "SUPER_ADMIN", "ADMIN"].includes(
            actor.role,
          )}
          canModerateReviews={[
            "CTO",
            "SUPER_ADMIN",
            "ADMIN",
            "SUPPORT_AGENT",
          ].includes(actor.role)}
          canReviewVerification={["CTO", "SUPER_ADMIN", "ADMIN"].includes(
            actor.role,
          )}
          canReviewPayouts={["CTO", "SUPER_ADMIN", "FINANCE_STAFF"].includes(
            actor.role,
          )}
        />
      ) : null}
    </main>
  );
}
