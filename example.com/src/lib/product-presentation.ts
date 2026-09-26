function readable(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map(readable).join(", ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([name, item]) => `${name}: ${readable(item)}`)
      .join(" · ");
  return String(value);
}

export function sizeGuideTable(measurements: Record<string, unknown>) {
  const unit = typeof measurements.unit === "string" ? measurements.unit : null;
  const entries = Object.entries(measurements).filter(
    ([key]) => key !== "unit",
  );
  // JSONB does not preserve the author's insertion order. Keep familiar fit
  // progression for standard apparel guides without guessing custom labels.
  const sizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
  const rank = (size: string) =>
    sizes.indexOf(size.toUpperCase().replace(/^2XL$/, "XXL"));
  if (entries.every(([size]) => rank(size) >= 0))
    entries.sort(([left], [right]) => rank(left) - rank(right));
  const columns = Array.from(
    new Set(
      entries.flatMap(([, value]) =>
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? Object.keys(value)
          : ["Measurement"],
      ),
    ),
  );
  const rows = entries.map(([size, value]) => ({
    size,
    values: columns.map((column) =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? readable(
            Object.hasOwn(value, column)
              ? (value as Record<string, unknown>)[column]
              : null,
          )
        : column === "Measurement"
          ? readable(value)
          : "—",
    ),
  }));
  return { unit, columns, rows };
}
