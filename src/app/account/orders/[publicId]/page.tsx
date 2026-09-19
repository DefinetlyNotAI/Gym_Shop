import Link from "next/link";
import { notFound } from "next/navigation";
import { ReorderButton } from "@/components/reorder-button";
import { CancelOrder } from "@/components/cancel-order";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
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
  return (
    <main className="page">
      <Link href="/account/orders">← Orders / الطلبات</Link>
      <h1>{publicId}</h1>
      <section className="panel">
        <p>
          {String(detail.order.status)} · {String(detail.order.payment_status)}{" "}
          · {String(detail.order.fulfillment_status)}
        </p>
        <p>
          {(Number(detail.order.external_due_fils) / 1000).toFixed(3)} JOD ·
          collected {(Number(detail.order.collected_fils) / 1000).toFixed(3)} ·
          refunded {(Number(detail.order.refunded_fils) / 1000).toFixed(3)}
        </p>
        {detail.shipment ? (
          <p>
            {String(detail.shipment.internal_reference)} ·{" "}
            {String(detail.shipment.state)}
          </p>
        ) : null}
        <ReorderButton publicId={publicId} />
        <CancelOrder
          publicId={publicId}
          fulfillmentStatus={String(detail.order.fulfillment_status)}
        />
      </section>
      <section className="panel">
        <h2>Items / المنتجات</h2>
        {detail.lines.map((line) => (
          <article key={String(line.sku)}>
            <strong>
              {typeof line.name_snapshot === "object" &&
              line.name_snapshot !== null &&
              "en" in line.name_snapshot
                ? String((line.name_snapshot as { en: unknown }).en)
                : String(line.sku)}
            </strong>
            <span>
              {String(line.sku)} · ×{String(line.quantity)} ·{" "}
              {(Number(line.unit_net_fils) / 1000).toFixed(3)} JOD
            </span>
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Timeline / التسلسل</h2>
        {detail.timeline.map((event) => (
          <p key={`${String(event.event_type)}-${String(event.occurred_at)}`}>
            {new Date(String(event.occurred_at)).toLocaleString("en-JO")} ·{" "}
            {String(event.event_type)}
          </p>
        ))}
      </section>
    </main>
  );
}
