import { z } from "zod";
import type { CurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient } from "@/lib/db/client";

const filtersInput = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.string().trim().max(40).optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  referralCode: z.string().trim().max(24).optional(),
  zoneId: z.string().uuid().optional(),
});

export function analyticsGroups(role: string): string[] {
  if (role === "DELIVERY_AGENT") return ["delivery"];
  if (role === "FINANCE_STAFF") return ["commerce", "finance", "wallet", "payouts"];
  if (role === "LOGISTICS_STAFF") return ["orders", "inventory", "delivery"];
  if (role === "SUPPORT_AGENT") return ["support", "reviews", "notifications"];
  return ["commerce", "orders", "inventory", "delivery", "finance", "wallet", "payouts", "referrals", "support", "reviews", "notifications"];
}

export async function getOperationalDashboard(actor: CurrentAccount, raw: unknown) {
  const filters = filtersInput.parse(raw);
  const groups = analyticsGroups(actor.role);
  const from = filters.from ?? new Date("1970-01-01T00:00:00Z");
  const to = filters.to ?? new Date("9999-12-31T23:59:59Z");
  const parameters = [from, to, filters.status ?? null, filters.productId ?? null, filters.categoryId ?? null,
    filters.collectionId ?? null, filters.referralCode ?? null, filters.zoneId ?? null];
  const orderScope = `orders.created_at BETWEEN $1 AND $2
    AND ($3::text IS NULL OR orders.status=$3)
    AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM order_line WHERE order_id=orders.id AND product_id=$4))
    AND ($5::uuid IS NULL OR EXISTS(SELECT 1 FROM order_line JOIN product_category USING(product_id) WHERE order_id=orders.id AND category_id=$5))
    AND ($6::uuid IS NULL OR EXISTS(SELECT 1 FROM order_line JOIN product_collection USING(product_id) WHERE order_id=orders.id AND collection_id=$6))
    AND ($7::text IS NULL OR EXISTS(SELECT 1 FROM referral_reward JOIN referral_attribution ON referral_attribution.id=referral_reward.attribution_id WHERE referral_reward.order_id=orders.id AND referral_attribution.used_code=$7))
    AND ($8::uuid IS NULL OR orders.delivery_snapshot->>'zoneId'=$8::text)`;
  return withDatabaseClient(async (client) => {
    const data: Record<string, unknown> = {};
    if (groups.includes("commerce") || groups.includes("orders")) {
      const row = (await client.execute<{ revenue: string; orders: number; units: string; pending: number }>(
        `SELECT COALESCE(sum(orders.external_due_fils+orders.wallet_tender_fils) FILTER(WHERE orders.status='COMPLETED'),0)::text AS revenue,
                count(*) FILTER(WHERE orders.status='COMPLETED')::int AS orders,
                COALESCE(sum((SELECT sum(quantity) FROM order_line WHERE order_id=orders.id)) FILTER(WHERE orders.status='COMPLETED'),0)::text AS units,
                count(*) FILTER(WHERE orders.status NOT IN('COMPLETED','CANCELLED'))::int AS pending
         FROM shop_order AS orders WHERE ${orderScope}`,
        parameters,
      )).rows[0];
      data.commerce = { revenueFils: Number(row.revenue), orders: row.orders,
        aovFils: row.orders ? Math.floor(Number(row.revenue) / row.orders) : 0, units: Number(row.units), pendingOrders: row.pending };
    }
    if (groups.includes("inventory")) data.inventory = (await client.execute(
      `SELECT count(*) FILTER(WHERE balance.on_hand-balance.reserved<=balance.low_stock_threshold)::int AS low_stock,
              count(*) FILTER(WHERE balance.on_hand-balance.reserved<=0)::int AS out_of_stock
       FROM inventory_balance AS balance JOIN product_variant AS variant ON variant.id=balance.variant_id
       WHERE ($1::uuid IS NULL OR variant.product_id=$1)
         AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM product_category WHERE product_id=variant.product_id AND category_id=$2))
         AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM product_collection WHERE product_id=variant.product_id AND collection_id=$3))`,
      [filters.productId ?? null, filters.categoryId ?? null, filters.collectionId ?? null],
    )).rows[0];
    if (groups.includes("delivery")) data.delivery = (await client.execute(
      `SELECT shipment.state AS status,count(*)::int AS count FROM shipment
       JOIN shop_order AS orders ON orders.id=shipment.order_id
       WHERE ($1::uuid IS NULL OR shipment.driver_id=$1) AND ($2::uuid IS NULL OR orders.delivery_snapshot->>'zoneId'=$2::text)
         AND ($3::text IS NULL OR shipment.state=$3) AND orders.created_at BETWEEN $4 AND $5
       GROUP BY shipment.state ORDER BY shipment.state`,
      [actor.role === "DELIVERY_AGENT" ? actor.id : null, filters.zoneId ?? null, filters.status ?? null, from, to],
    )).rows;
    if (groups.includes("finance")) data.finance = (await client.execute(
      "SELECT kind,state,COALESCE(sum(amount_fils),0)::text AS amount_fils FROM cash_ledger WHERE occurred_at BETWEEN $1 AND $2 GROUP BY kind,state ORDER BY kind,state",
      [from, to],
    )).rows;
    if (groups.includes("wallet")) data.wallet = (await client.execute(
      "SELECT direction,kind,COALESCE(sum(amount_fils),0)::text AS amount_fils FROM wallet_ledger WHERE created_at BETWEEN $1 AND $2 GROUP BY direction,kind ORDER BY direction,kind",
      [from, to],
    )).rows;
    if (groups.includes("payouts")) data.payouts = (await client.execute(
      "SELECT status,count(*)::int AS count,COALESCE(sum(amount_fils),0)::text AS amount_fils FROM wallet_payout WHERE requested_at BETWEEN $1 AND $2 GROUP BY status ORDER BY status",
      [from, to],
    )).rows;
    if (groups.includes("referrals")) data.referrals = (await client.execute(
      "SELECT status,count(*)::int AS count,COALESCE(sum(reward_fils),0)::text AS reward_fils FROM referral_reward WHERE created_at BETWEEN $1 AND $2 GROUP BY status ORDER BY status",
      [from, to],
    )).rows;
    if (groups.includes("support")) data.support = (await client.execute(
      "SELECT status,count(*)::int AS count FROM support_ticket WHERE created_at BETWEEN $1 AND $2 GROUP BY status ORDER BY status", [from, to])).rows;
    if (groups.includes("reviews")) data.reviews = (await client.execute(
      "SELECT status,count(*)::int AS count FROM product_review WHERE created_at BETWEEN $1 AND $2 GROUP BY status ORDER BY status", [from, to])).rows;
    if (groups.includes("notifications")) data.notifications = (await client.execute(
      "SELECT status,count(*)::int AS count FROM notification WHERE created_at BETWEEN $1 AND $2 GROUP BY status ORDER BY status", [from, to])).rows;
    return { filters: { ...filters, from: from.toISOString(), to: to.toISOString() }, groups, data, metadata: {
      revenue: "Completed order snapshot total: external due plus wallet tender; wallet ledger transfers are excluded.",
      aov: "Completed-order revenue divided by completed-order count.",
      units: "Order-line quantity on completed orders.",
      codCustody: "Cash ledger states are reported separately; driver-held cash is not merchant deposited cash.",
    } };
  });
}

function flatten(value: unknown, prefix = ""): string[][] {
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${prefix}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key));
  return [[prefix, String(value ?? "")]];
}

export async function exportOperationalDashboard(actor: CurrentAccount, raw: unknown, format: "csv" | "xml") {
  const rows = flatten(await getOperationalDashboard(actor, raw));
  if (format === "csv") return { contentType: "text/csv; charset=utf-8", filename: "gym-shop-analytics.csv",
    body: ["measure,value", ...rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))].join("\r\n") };
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return { contentType: "application/vnd.ms-excel; charset=utf-8", filename: "gym-shop-analytics.xml",
    body: `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Analytics" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Table>${rows.map(([key, value]) => `<Row><Cell><Data ss:Type="String">${escape(key)}</Data></Cell><Cell><Data ss:Type="String">${escape(value)}</Data></Cell></Row>`).join("")}</Table></Worksheet></Workbook>` };
}
