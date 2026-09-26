import Link from "next/link";
import { apiGet } from "@/lib/api";
import { requireCustomerSession } from "@/lib/customer-session";
export const dynamic = "force-dynamic";
export default async function Orders() {
  await requireCustomerSession();
  const result = await apiGet<{ orders: Record<string, unknown>[] }>(
    "/api/v1/orders",
  );
  return (
    <main className="page">
      <h1>Orders / الطلبات</h1>
      <div className="list">
        {result!.orders.map((order) => (
          <article key={String(order.public_id)}>
            <Link href={`/account/orders/${String(order.public_id)}`}>
              <strong>{String(order.public_id)}</strong>
            </Link>
            <span>
              {String(order.status)} · {String(order.payment_method)} ·{" "}
              {String(order.payment_status)}
            </span>
            <span>
              {(Number(order.external_due_fils) / 1000).toFixed(3)} JOD
            </span>
          </article>
        ))}
      </div>
    </main>
  );
}
