import { analyticsQuery } from "@/lib/analytics-query";

export type OperationalDashboard = {
  groups: readonly string[];
  data: Record<string, unknown>;
  metadata: Record<string, string>;
  filters: { from: string; to: string };
};
function label(key: string) {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}
function Measures({ value }: { value: unknown }) {
  if (Array.isArray(value))
    return (
      <div className="list">
        {value.length ? (
          value.map((row, index) => (
            <div key={index}>
              <Measures value={row} />
            </div>
          ))
        ) : (
          <p>No activity in this period.</p>
        )}
      </div>
    );
  if (value !== null && typeof value === "object")
    return (
      <dl className="metric-values">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <dt>{label(key)}</dt>
            <dd>
              {item !== null && typeof item === "object" ? (
                <Measures value={item} />
              ) : key.toLowerCase().includes("fils") ? (
                `${(Number(item) / 1000).toFixed(3)} JOD`
              ) : (
                String(item ?? "—")
              )}
            </dd>
          </div>
        ))}
      </dl>
    );
  return <p>{String(value ?? "—")}</p>;
}
export function AnalyticsDashboard({
  dashboard,
  query = "",
}: {
  dashboard: OperationalDashboard | null;
  query?: string;
}) {
  if (!dashboard)
    return <div className="empty">Analytics are currently unavailable.</div>;
  const filters = analyticsQuery(new URLSearchParams(query));
  const exportUrl = (format: string) => {
    const params = new URLSearchParams(filters);
    params.set("format", format);
    return `/api/v1/admin/analytics/export?${params}`;
  };
  return (
    <section id="analytics">
      <h2>Operational analytics / التحليلات التشغيلية</h2>
      <p>
        Only measures authorized for this staff role are included. Wallet
        transfers are not revenue; cash custody states remain separate.
      </p>
      <details>
        <summary>Filter reporting period and activity</summary>
        <form method="get" className="form-grid">
          {[
            "from",
            "to",
            "status",
            "productId",
            "categoryId",
            "collectionId",
            "referralCode",
            "zoneId",
          ].map((key) => (
            <label key={key}>
              {label(key)}
              <input
                name={key}
                type={key === "from" || key === "to" ? "date" : "text"}
                defaultValue={
                  key === "from" || key === "to"
                    ? (filters.get(key) ?? "").slice(0, 10)
                    : (filters.get(key) ?? "")
                }
              />
            </label>
          ))}
          <button className="primary">Apply filters</button>
        </form>
      </details>
      <div className="analytics-grid">
        {Object.entries(dashboard.data).map(([group, value]) => (
          <article className="panel" key={group}>
            <h3>{label(group)}</h3>
            <Measures value={value} />
          </article>
        ))}
      </div>
      <div className="inline-actions">
        <a className="secondary" href={exportUrl("csv")}>
          CSV export
        </a>
        <a className="secondary" href={exportUrl("xml")}>
          Excel XML export
        </a>
      </div>
      <details>
        <summary>Metric definitions</summary>
        {Object.entries(dashboard.metadata).map(([key, value]) => (
          <p key={key}>
            <strong>{label(key)}:</strong> {value}
          </p>
        ))}
      </details>
    </section>
  );
}
