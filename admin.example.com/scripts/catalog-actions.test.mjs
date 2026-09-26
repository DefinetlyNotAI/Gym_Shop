import assert from "node:assert/strict";
import test from "node:test";
import { loadProduction } from "./load-production.mjs";

const { catalogMutation, guideFromForm, productFromForm } =
  await loadProduction(
    new URL("../src/lib/catalog-actions.ts", import.meta.url),
  );

test("catalog actions use their real method and encoded resource URL", async () => {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ data: { saved: true } });
  };
  for (const action of [
    { kind: "create", body: { slug: "training-top" } },
    { kind: "update", id: "product/1", body: { featured: false } },
    { kind: "taxonomy", body: { kind: "collection" } },
    { kind: "guide", body: { name: "Training sizes" } },
    { kind: "media", body: { position: 0 } },
  ])
    assert.deepEqual(await catalogMutation(action, transport), { saved: true });
  assert.deepEqual(
    calls.map(({ url, method }) => [method, url]),
    [
      ["POST", "/api/v1/catalog/products"],
      ["PATCH", "/api/v1/admin/catalog/products/product%2F1"],
      ["POST", "/api/v1/admin/catalog/taxonomy"],
      ["POST", "/api/v1/admin/catalog/size-guides"],
      ["POST", "/api/v1/admin/catalog/media"],
    ],
  );
  assert.equal(JSON.parse(calls[1].body).featured, false);
});

test("size guide input accepts structured measurements but rejects arrays and invalid JSON", () => {
  const form = new FormData();
  form.set("name", "Training sizes");
  form.set("measurements", '{"unit":"cm","M":{"chest":98}}');
  assert.deepEqual(guideFromForm(form), {
    name: "Training sizes",
    measurements: { unit: "cm", M: { chest: 98 } },
  });
  for (const invalid of ["[]", "null", "98", "{broken}"]) {
    form.set("measurements", invalid);
    assert.throws(() => guideFromForm(form), /measurement/i);
  }
});

test("named size rows build measurements without requiring a JSON editor", () => {
  const form = new FormData();
  form.set("name", "Training sizes");
  form.set("unit", "cm");
  for (const [size, measurement, value] of [
    ["M", "chest", "98"],
    ["M", "length", "70.5"],
    ["L", "chest", "104"],
  ]) {
    form.append("size", size);
    form.append("measurement", measurement);
    form.append("value", value);
  }
  assert.deepEqual(guideFromForm(form), {
    name: "Training sizes",
    measurements: {
      unit: "cm",
      M: { chest: 98, length: 70.5 },
      L: { chest: 104 },
    },
  });
  form.append("size", "M");
  form.append("measurement", "chest");
  form.append("value", "99");
  assert.throws(() => guideFromForm(form), /duplicate/i);
});

test("product editor preserves grouping removals and null size guide without allowing fractional money", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    nameEn: "Training top",
    nameAr: "قميص تدريب",
    price: "18000",
    status: "DRAFT",
    descriptionEn: "Lightweight",
    descriptionAr: "خفيف",
    sizeGuideId: "",
  }))
    form.set(key, value);
  assert.deepEqual(productFromForm(form), {
    nameEn: "Training top",
    nameAr: "قميص تدريب",
    basePriceFils: 18000,
    status: "DRAFT",
    descriptionEn: "Lightweight",
    descriptionAr: "خفيف",
    featured: false,
    categoryIds: [],
    collectionIds: [],
    sizeGuideId: null,
  });
  for (const invalid of ["18.5", "-1", "", "NaN"]) {
    form.set("price", invalid);
    assert.throws(() => productFromForm(form), /whole/i);
  }
});

test("unrelated saves retain a non-alphabetical primary and explicit primary changes reorder only selected categories", () => {
  const form = new FormData();
  form.set("price", "18000");
  form.append("categoryIds", "alphabetical-first");
  form.append("categoryIds", "original-primary");
  form.append("categoryOrder", "original-primary");
  form.append("categoryOrder", "alphabetical-first");
  assert.deepEqual(productFromForm(form).categoryIds, [
    "original-primary",
    "alphabetical-first",
  ]);
  form.set("primaryCategoryId", "alphabetical-first");
  assert.deepEqual(productFromForm(form).categoryIds, [
    "alphabetical-first",
    "original-primary",
  ]);
  form.delete("categoryIds");
  form.append("categoryIds", "original-primary");
  assert.deepEqual(productFromForm(form).categoryIds, ["original-primary"]);
});

test("failed and non-JSON responses remain actionable instead of reporting a save", async () => {
  await assert.rejects(
    catalogMutation({ kind: "media", body: {} }, async () =>
      Response.json(
        {
          error: {
            code: "MEDIA_NOT_READY",
            message: "Image scan is not complete.",
          },
        },
        { status: 422 },
      ),
    ),
    (error) => error.code === "MEDIA_NOT_READY" && /scan/i.test(error.message),
  );
  await assert.rejects(
    catalogMutation(
      { kind: "guide", body: {} },
      async () => new Response("upstream offline", { status: 503 }),
    ),
    (error) => error.status === 503,
  );
});
