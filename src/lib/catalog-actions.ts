type CatalogAction =
  | { kind: "create" | "taxonomy" | "guide" | "media"; body: unknown }
  | { kind: "update"; id: string; body: unknown };

export async function catalogMutation(
  action: CatalogAction,
  transport: typeof fetch = fetch,
): Promise<unknown> {
  const paths = {
    create: "/api/v1/catalog/products",
    taxonomy: "/api/v1/admin/catalog/taxonomy",
    guide: "/api/v1/admin/catalog/size-guides",
    media: "/api/v1/admin/catalog/media",
  };
  const path =
    action.kind === "update"
      ? `/api/v1/admin/catalog/products/${encodeURIComponent(action.id)}`
      : paths[action.kind];
  const response = await transport(path, {
    method: action.kind === "update" ? "PATCH" : "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(action.body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      payload?.error?.code
        ? `${payload.error.message ?? "Could not save"} (${payload.error.code})`
        : `Could not save (HTTP ${response.status}). Please try again.`,
    );
  if (!payload || !Object.hasOwn(payload, "data"))
    throw new Error("Unexpected API response. Please refresh and try again.");
  return payload.data;
}

export function wholeNumber(
  value: FormDataEntryValue | null,
  minimum = 0,
): number {
  const raw = String(value ?? "").trim();
  const number = Number(raw);
  if (!raw || !Number.isSafeInteger(number) || number < minimum)
    throw new Error(
      "Enter a whole number in the allowed range. Prices are in fils (1,000 fils = 1 JOD).",
    );
  return number;
}

export function guideFromForm(form: FormData) {
  if (form.has("size")) {
    const sizes = form.getAll("size").map((value) => String(value).trim());
    const labels = form
      .getAll("measurement")
      .map((value) => String(value).trim());
    const values = form.getAll("value").map((value) => String(value).trim());
    if (
      !sizes.length ||
      sizes.length > 200 ||
      labels.length !== sizes.length ||
      values.length !== sizes.length
    )
      throw new Error("Add between 1 and 200 complete measurement rows.");
    const groups = new Map<string, Map<string, number>>();
    for (const [index, size] of sizes.entries()) {
      const label = labels[index];
      const value = Number(values[index]);
      if (
        !size ||
        size === "unit" ||
        size.length > 80 ||
        !label ||
        label.length > 100 ||
        !values[index] ||
        !Number.isFinite(value) ||
        value < 0
      )
        throw new Error(
          "Each measurement needs a named size, label and non-negative value.",
        );
      const group = groups.get(size) ?? new Map<string, number>();
      if (group.has(label))
        throw new Error(`Duplicate measurement: ${size} / ${label}.`);
      group.set(label, value);
      groups.set(size, group);
    }
    return {
      name: String(form.get("name")),
      measurements: Object.fromEntries([
        ["unit", String(form.get("unit") ?? "cm")],
        ...Array.from(groups, ([size, fields]) => [
          size,
          Object.fromEntries(fields),
        ]),
      ]),
    };
  }
  let measurements: unknown;
  try {
    measurements = JSON.parse(String(form.get("measurements")));
  } catch {
    throw new Error(
      'Measurements must be a valid JSON object, for example {"unit":"cm","M":{"chest":98}}.',
    );
  }
  if (
    !measurements ||
    typeof measurements !== "object" ||
    Array.isArray(measurements)
  )
    throw new Error(
      "Measurements must be a JSON object with named sizes and units.",
    );
  return { name: String(form.get("name")), measurements };
}

export function productFromForm(form: FormData) {
  const selected = form.getAll("categoryIds").map(String);
  const ordered = Array.from(
    new Set([
      ...form
        .getAll("categoryOrder")
        .map(String)
        .filter((id) => selected.includes(id)),
      ...selected,
    ]),
  );
  const primary = String(form.get("primaryCategoryId") ?? "");
  const categoryIds = ordered.includes(primary)
    ? [primary, ...ordered.filter((id) => id !== primary)]
    : ordered;
  return {
    nameEn: String(form.get("nameEn")),
    nameAr: String(form.get("nameAr")),
    basePriceFils: wholeNumber(form.get("price")),
    status: String(form.get("status")),
    descriptionEn: String(form.get("descriptionEn") ?? ""),
    descriptionAr: String(form.get("descriptionAr") ?? ""),
    featured: form.get("featured") === "on",
    categoryIds,
    collectionIds: form.getAll("collectionIds").map(String),
    sizeGuideId: form.get("sizeGuideId") || null,
  };
}
