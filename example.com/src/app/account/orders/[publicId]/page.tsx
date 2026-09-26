import Link from "next/link";
import { notFound } from "next/navigation";
import { ReorderButton } from "@/components/reorder-button";
import { CancelOrder } from "@/components/cancel-order";
import { DamageClaimForm } from "@/components/damage-claim-form";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";

export const dynamic = "force-dynamic";

function lineName(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "en" in value) {
    return String((value as { en: unknown }).en);
  }
  return fallback;
}

function jod(value: unknown) {
  return `${(Number(value) / 1000).toFixed(3)} JOD`;
}

export default async function OrderDetail({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  await requireCustomerSession();
  const publicId = (await params).publicId;
  const detail = await apiGet<{
    order: Record<string, unknown>;
    lines: Record<string, unknown>[];
    shipment: Record<string, unknown> | null;
    timeline: Record<string, unknown>[];
  }>(`/api/v1/orders/${encodeURIComponent(publicId)}`, true);
  if (!detail) notFound();

  const fulfillment = String(detail.order.fulfillment_status);
  const claimWindowOpen =
    fulfillment === "DELIVERED" && detail.order.damage_claim_eligible === true;
  const claimLines = detail.lines
    .filter((line) => typeof line.id === "string")
    .map((line) => ({
      id: String(line.id),
      sku: String(line.sku),
      name: lineName(line.name_snapshot, String(line.sku)),
      quantity: Number(line.quantity),
      refundedQuantity: Number(line.refunded_quantity ?? 0),
    }));

  return (
    <main className="page order-detail-page">
      <Link href="/account/orders">← Orders / الطلبات</Link>
      <header className="order-detail-heading">
        <div>
          <p className="eyebrow">Order / الطلب</p>
          <h1 className="reference">{publicId}</h1>
        </div>
        <span className="status-badge">{fulfillment}</span>
      </header>
      <section className="panel order-summary" aria-label="Order summary">
        <dl className="order-metrics">
          <div>
            <dt>Status / الحالة</dt>
            <dd>{String(detail.order.status)}</dd>
          </div>
          <div>
            <dt>Payment / الدفع</dt>
            <dd>{String(detail.order.payment_status)}</dd>
          </div>
          <div>
            <dt>Amount due / المستحق</dt>
            <dd>{jod(detail.order.external_due_fils)}</dd>
          </div>
          <div>
            <dt>Collected / المحصل</dt>
            <dd>{jod(detail.order.collected_fils)}</dd>
          </div>
          <div>
            <dt>Refunded / المسترد</dt>
            <dd>{jod(detail.order.refunded_fils)}</dd>
          </div>
        </dl>
        {detail.shipment ? (
          <div className="order-shipment">
            <span>Shipment / الشحنة</span>
            <strong>{String(detail.shipment.state)}</strong>
            <code>{String(detail.shipment.internal_reference)}</code>
          </div>
        ) : null}
        <div className="action-row">
          <ReorderButton publicId={publicId} />
          <CancelOrder publicId={publicId} fulfillmentStatus={fulfillment} />
        </div>
      </section>
      <section className="panel order-items">
        <div className="section-heading">
          <h2>Items / المنتجات</h2>
          <span>{detail.lines.length}</span>
        </div>
        <div className="order-item-list">
          {detail.lines.map((line) => (
            <article key={String(line.id ?? line.sku)}>
              <div>
                <strong>
                  {lineName(line.name_snapshot, String(line.sku))}
                </strong>
                <small className="reference">{String(line.sku)}</small>
              </div>
              <span>×{String(line.quantity)}</span>
              <strong>{jod(line.unit_net_fils)}</strong>
            </article>
          ))}
        </div>
      </section>
      {claimWindowOpen ? (
        <DamageClaimForm lines={claimLines} />
      ) : fulfillment === "DELIVERED" ? (
        <section className="panel claim-closed">
          <h2>Need help with this order? / هل تحتاج مساعدة؟</h2>
          <p>
            The seven-day damage-report window has ended. Contact support for
            any other order question. / انتهت مهلة الإبلاغ عن التلف البالغة سبعة
            أيام. تواصل مع الدعم لأي استفسار آخر.
          </p>
          <Link className="secondary" href="/contact">
            Open support center / فتح مركز الدعم
          </Link>
        </section>
      ) : null}
      <section className="panel order-timeline">
        <h2>Timeline / التسلسل</h2>
        <ol>
          {detail.timeline.map((event) => (
            <li
              key={`${String(event.event_type)}-${String(event.occurred_at)}`}
            >
              <span aria-hidden="true" />
              <div>
                <strong>{String(event.event_type)}</strong>
                <time dateTime={String(event.occurred_at)}>
                  {new Date(String(event.occurred_at)).toLocaleString("en-JO")}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
