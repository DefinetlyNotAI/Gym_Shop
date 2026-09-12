"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useLanguage,
  LocalizedText as T,
} from "@/components/language-provider";
import { PrivateMediaUpload } from "@/components/private-media-upload";
import {
  catalogMutation,
  guideFromForm,
  productFromForm,
  wholeNumber,
} from "@/lib/catalog-actions";

type Grouping = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  active: boolean;
};
type Variant = {
  id: string;
  sku: string;
  options: Record<string, string>;
  enabled: boolean;
  purchasable: boolean;
  inventoryTracking: boolean;
  priceOverrideFils: number | null;
  compareAtFils: number | null;
  barcode: string | null;
  weightGrams: number | null;
};
type Product = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  product_type: string;
  status: string;
  base_price_fils: string;
  featured: boolean;
  size_guide_id: string | null;
  categoryIds: string[];
  collectionIds: string[];
  variants: Variant[];
  media: { id: string; altEn: string; altAr: string; position: number }[];
};
export type CatalogData = {
  products: Product[];
  categories: Grouping[];
  collections: Grouping[];
  sizeGuides: {
    id: string;
    name: string;
    measurements: Record<string, unknown>;
  }[];
  uploads: { id: string; verified_mime: string; scan_status: string }[];
};

function ActionForm({
  label,
  submit,
  children,
  reset = false,
}: {
  label: string;
  submit: (form: FormData) => Promise<unknown>;
  children: ReactNode;
  reset?: boolean;
}) {
  const router = useRouter();
  const { text } = useLanguage();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  return (
    <form
      aria-label={label}
      className="catalog-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const element = event.currentTarget;
        const form = new FormData(element);
        setPending(true);
        setMessage("");
        setFailed(false);
        try {
          await submit(form);
          setMessage("SAVED");
          if (reset) element.reset();
          router.refresh();
        } catch (error) {
          setFailed(true);
          setMessage(
            error instanceof Error
              ? error.message
              : text(
                  "Could not save. Please try again.",
                  "تعذر الحفظ. يرجى المحاولة مجدداً.",
                ),
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <fieldset disabled={pending} className="catalog-fields">
        {children}
      </fieldset>
      <p
        className={failed ? "catalog-feedback is-error" : "catalog-feedback"}
        role={failed ? "alert" : "status"}
      >
        {pending
          ? text("Saving…", "جارٍ الحفظ…")
          : message === "SAVED"
            ? text("Saved successfully.", "تم الحفظ بنجاح.")
            : message}
      </p>
    </form>
  );
}

function GroupingFields({
  data,
  product,
}: {
  data: CatalogData;
  product?: Product;
}) {
  const { text } = useLanguage();
  return (
    <>
      {product?.categoryIds.map((id) => (
        <input type="hidden" name="categoryOrder" value={id} key={id} />
      ))}
      <label>
        {text("Size guide", "دليل المقاسات")}
        <select name="sizeGuideId" defaultValue={product?.size_guide_id ?? ""}>
          <option value="">{text("No size guide", "بدون دليل مقاسات")}</option>
          {data.sizeGuides.map((guide) => (
            <option key={guide.id} value={guide.id}>
              {guide.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {text("Primary category", "الفئة الرئيسية")}
        <select
          name="primaryCategoryId"
          defaultValue={product?.categoryIds[0] ?? ""}
        >
          <option value="">
            {text("First selected category", "أول فئة محددة")}
          </option>
          {data.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {text(category.name_en, category.name_ar)}
              {!category.active ? text(" (inactive)", " (غير نشطة)") : ""}
            </option>
          ))}
        </select>
        <small>
          {text(
            "Must also be selected below. Removed categories cannot remain primary.",
            "يجب تحديدها أدناه أيضاً. لا تبقى الفئة المحذوفة رئيسية.",
          )}
        </small>
      </label>
      {(["categories", "collections"] as const).map((kind) => (
        <fieldset className="catalog-grouping" key={kind}>
          <legend>
            {kind === "categories"
              ? text("Categories", "الفئات")
              : text("Collections", "المجموعات")}
          </legend>
          {data[kind].length ? (
            data[kind].map((item) => (
              <label className="check" key={item.id}>
                <input
                  type="checkbox"
                  name={kind === "categories" ? "categoryIds" : "collectionIds"}
                  value={item.id}
                  defaultChecked={
                    product?.[
                      kind === "categories" ? "categoryIds" : "collectionIds"
                    ].includes(item.id) ?? false
                  }
                />
                {text(item.name_en, item.name_ar)}
                {!item.active ? text(" (inactive)", " (غير نشطة)") : ""}
              </label>
            ))
          ) : (
            <small>
              {text(
                "No groupings yet. Create one in its workspace.",
                "لا توجد مجموعات بعد. أنشئ واحدة في صفحتها.",
              )}
            </small>
          )}
        </fieldset>
      ))}
    </>
  );
}

function ProductFields({ product }: { product?: Product }) {
  const { text } = useLanguage();
  return (
    <>
      <label>
        {text("English name", "الاسم الإنجليزي")}
        <input
          dir="ltr"
          name="nameEn"
          minLength={2}
          maxLength={200}
          defaultValue={product?.name_en}
          required
        />
      </label>
      <label>
        {text("Arabic name", "الاسم العربي")}
        <input
          dir="rtl"
          name="nameAr"
          minLength={2}
          maxLength={200}
          defaultValue={product?.name_ar}
          required
        />
      </label>
      <label>
        {text("Base price (fils)", "السعر الأساسي (فلس)")}
        <input
          name="price"
          type="number"
          min="0"
          step="1"
          defaultValue={product ? Number(product.base_price_fils) : undefined}
          required
        />
        <small>{text("1,000 fils = 1 JOD", "١٬٠٠٠ فلس = ١ دينار")}</small>
      </label>
      <label>
        {text("Visibility", "الظهور")}
        <select name="status" defaultValue={product?.status ?? "DRAFT"}>
          <option value="DRAFT">{text("Draft", "مسودة")}</option>
          <option value="ACTIVE">{text("Published", "منشور")}</option>
          <option value="HIDDEN">{text("Hidden", "مخفي")}</option>
          <option value="ARCHIVED">{text("Archived", "مؤرشف")}</option>
        </select>
      </label>
      <label className="catalog-wide">
        {text("English description", "الوصف الإنجليزي")}
        <textarea
          dir="ltr"
          name="descriptionEn"
          maxLength={10000}
          defaultValue={product?.description_en ?? ""}
        />
      </label>
      <label className="catalog-wide">
        {text("Arabic description", "الوصف العربي")}
        <textarea
          dir="rtl"
          name="descriptionAr"
          maxLength={10000}
          defaultValue={product?.description_ar ?? ""}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={product?.featured}
        />
        {text("Featured on storefront", "مميز في المتجر")}
      </label>
    </>
  );
}

function GalleryPublisher({
  product,
  data,
  storeOrigin,
}: {
  product: Product;
  data: CatalogData;
  storeOrigin: string;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [uploaded, setUploaded] = useState<{
    id: string;
    ready: boolean;
  } | null>(null);
  const [selected, setSelected] = useState("");
  const readyUploads = data.uploads.filter(
    (item) => item.scan_status === "CLEAN",
  );
  const mediaId = uploaded?.ready ? uploaded.id : selected;
  return (
    <div className="catalog-gallery">
      <p>
        {text(
          "Images stay private until their security scan passes and you publish them with bilingual alt text.",
          "تبقى الصور خاصة حتى اجتياز الفحص الأمني ونشرها بنص بديل باللغتين.",
        )}
      </p>
      <PrivateMediaUpload
        label={text("Upload gallery image", "رفع صورة للمعرض")}
        onUploaded={(id, ready) => {
          setUploaded({ id, ready: ready === true });
          setSelected("");
        }}
      />
      {uploaded && !uploaded.ready ? (
        <p role="status">
          {text(
            "Waiting for security scan. Refresh to check availability.",
            "بانتظار الفحص الأمني. حدّث للتحقق من الجاهزية.",
          )}{" "}
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setUploaded(null);
              router.refresh();
            }}
          >
            {text("Refresh uploads", "تحديث الملفات")}
          </button>
        </p>
      ) : null}
      {!uploaded?.ready ? (
        <label>
          {text("Your scanned images", "صورك المفحوصة")}
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">
              {text("Select a ready image", "اختر صورة جاهزة")}
            </option>
            {readyUploads.map((item) => (
              <option key={item.id} value={item.id}>
                {item.verified_mime} · {item.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <small>
          {text("New image ready to publish.", "الصورة الجديدة جاهزة للنشر.")}
        </small>
      )}
      <ActionForm
        label={text(
          `Publish gallery image for ${product.name_en}`,
          `نشر صورة ${product.name_ar}`,
        )}
        submit={async (form) => {
          await catalogMutation({
            kind: "media",
            body: {
              productId: product.id,
              mediaId,
              altEn: form.get("altEn"),
              altAr: form.get("altAr"),
              position: wholeNumber(form.get("position")),
            },
          });
          setUploaded(null);
          setSelected("");
        }}
        reset
      >
        <label>
          {text("English alt text", "النص البديل الإنجليزي")}
          <input name="altEn" dir="ltr" required maxLength={300} />
        </label>
        <label>
          {text("Arabic alt text", "النص البديل العربي")}
          <input name="altAr" dir="rtl" required maxLength={300} />
        </label>
        <label>
          {text("Gallery position (0 first)", "ترتيب الصورة (٠ أولاً)")}
          <input
            name="position"
            type="number"
            min="0"
            max="100"
            step="1"
            defaultValue={product.media.length}
            required
          />
        </label>
        <button className="primary" disabled={!mediaId}>
          {text("Publish image", "نشر الصورة")}
        </button>
      </ActionForm>
      <div className="catalog-gallery-grid">
        {product.media.map((image) => (
          <a
            href={`${storeOrigin}/media/${encodeURIComponent(image.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            key={image.id}
          >
            <span>{image.position + 1}</span>
            <strong>{text(image.altEn, image.altAr)}</strong>
            <small>
              {text("Open published image ↗", "فتح الصورة المنشورة ↗")}
            </small>
          </a>
        ))}
      </div>
    </div>
  );
}

function VariantEditor({
  product,
  variant,
}: {
  product: Product;
  variant: Variant;
}) {
  const { text } = useLanguage();
  return (
    <details className="catalog-disclosure">
      <summary>
        {variant.sku}{" "}
        <span>
          {Object.entries(variant.options)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ") || text("Default variant", "الخيار الأساسي")}
        </span>
      </summary>
      <ActionForm
        label={text(
          `Edit variant ${variant.sku}`,
          `تعديل الخيار ${variant.sku}`,
        )}
        submit={(form) =>
          catalogMutation({
            kind: "update",
            id: product.id,
            body: {
              variants: [
                {
                  id: variant.id,
                  sku: form.get("sku"),
                  priceOverrideFils: form.get("override")
                    ? wholeNumber(form.get("override"))
                    : null,
                  compareAtFils: form.get("compareAt")
                    ? wholeNumber(form.get("compareAt"))
                    : null,
                  barcode: form.get("barcode") || null,
                  weightGrams: form.get("weight")
                    ? wholeNumber(form.get("weight"), 1)
                    : null,
                  enabled: form.get("enabled") === "on",
                  purchasable: form.get("purchasable") === "on",
                  inventoryTracking: form.get("tracking") === "on",
                },
              ],
            },
          })
        }
      >
        <label>
          {text("SKU", "رمز المخزون")}
          <input
            name="sku"
            minLength={2}
            maxLength={80}
            defaultValue={variant.sku}
            required
          />
        </label>
        <label>
          {text(
            "Price override (fils, optional)",
            "السعر المخصص (فلس، اختياري)",
          )}
          <input
            name="override"
            type="number"
            min="0"
            step="1"
            defaultValue={variant.priceOverrideFils ?? ""}
          />
        </label>
        <label>
          {text("Compare-at price (fils)", "السعر قبل الخصم (فلس)")}
          <input
            name="compareAt"
            type="number"
            min="0"
            step="1"
            defaultValue={variant.compareAtFils ?? ""}
          />
        </label>
        <label>
          {text("Barcode", "الباركود")}
          <input
            name="barcode"
            maxLength={100}
            defaultValue={variant.barcode ?? ""}
          />
        </label>
        <label>
          {text("Weight (grams)", "الوزن (غرام)")}
          <input
            name="weight"
            type="number"
            min="1"
            step="1"
            defaultValue={variant.weightGrams ?? ""}
          />
        </label>
        <div className="catalog-wide catalog-toggles">
          {(
            [
              ["enabled", "Enabled", "مفعّل", variant.enabled],
              [
                "purchasable",
                "Purchasable",
                "قابل للشراء",
                variant.purchasable,
              ],
              [
                "tracking",
                "Track inventory",
                "تتبع المخزون",
                variant.inventoryTracking,
              ],
            ] as const
          ).map(([name, en, ar, checked]) => (
            <label className="check" key={name}>
              <input type="checkbox" name={name} defaultChecked={checked} />
              {text(en, ar)}
            </label>
          ))}
        </div>
        <button className="secondary">
          {text("Save variant", "حفظ الخيار")}
        </button>
      </ActionForm>
    </details>
  );
}

function GuideFields() {
  const { text } = useLanguage();
  const [rows, setRows] = useState([0]);
  return (
    <>
      <label>
        {text("Guide name", "اسم الدليل")}
        <input name="name" minLength={2} maxLength={100} required />
      </label>
      <label>
        {text("Measurement unit", "وحدة القياس")}
        <select name="unit" defaultValue="cm">
          <option value="cm">{text("Centimetres (cm)", "سنتيمتر (سم)")}</option>
          <option value="in">{text("Inches (in)", "بوصة")}</option>
          <option value="mm">{text("Millimetres (mm)", "مليمتر (مم)")}</option>
        </select>
      </label>
      <div className="catalog-wide guide-rows">
        {rows.map((id, index) => (
          <fieldset className="guide-row" key={id}>
            <legend>
              {text(`Measurement ${index + 1}`, `قياس ${index + 1}`)}
            </legend>
            <label>
              {text(`Size ${index + 1}`, `المقاس ${index + 1}`)}
              <input name="size" required maxLength={80} placeholder="M" />
            </label>
            <label>
              {text(
                `Measurement label ${index + 1}`,
                `اسم القياس ${index + 1}`,
              )}
              <input
                name="measurement"
                required
                maxLength={100}
                placeholder={text("Chest", "الصدر")}
              />
            </label>
            <label>
              {text(`Value ${index + 1}`, `القيمة ${index + 1}`)}
              <input
                name="value"
                required
                type="number"
                min="0"
                step="any"
                placeholder="98"
              />
            </label>
            <button
              className="ghost"
              type="button"
              disabled={rows.length === 1}
              onClick={() =>
                setRows((current) => current.filter((row) => row !== id))
              }
            >
              {text("Remove row", "حذف الصف")}
            </button>
          </fieldset>
        ))}
      </div>
      <button
        className="secondary"
        type="button"
        disabled={rows.length >= 200}
        onClick={() =>
          setRows((current) => [...current, Math.max(...current) + 1])
        }
      >
        {text("Add measurement", "إضافة قياس")}
      </button>
      <button className="primary">
        {text("Create size guide", "إنشاء دليل مقاسات")}
      </button>
    </>
  );
}

export function CatalogWorkspace({
  data,
  view,
  canEdit,
  storeOrigin,
}: {
  data: CatalogData;
  view: string;
  canEdit: boolean;
  storeOrigin: string;
}) {
  const { text } = useLanguage();
  const [search, setSearch] = useState("");
  const products = data.products.filter((product) =>
    `${product.name_en} ${product.name_ar} ${product.slug} ${product.variants.map((variant) => variant.sku).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase().trim()),
  );
  return (
    <div className="catalog-workspace">
      <nav
        className="catalog-navigation"
        aria-label={text("Catalog workspaces", "صفحات الكتالوج")}
      >
        {[
          ["catalog", "Products", "المنتجات"],
          ["categories", "Categories", "الفئات"],
          ["collections", "Collections", "المجموعات"],
          ["size-guides", "Size guides", "أدلة المقاسات"],
        ].map(([id, en, ar]) => (
          <Link
            href={`/${id}`}
            aria-current={view === id ? "page" : undefined}
            key={id}
          >
            {text(en, ar)}
          </Link>
        ))}
      </nav>
      {view === "categories" || view === "collections" ? (
        <>
          {canEdit ? (
            <section className="panel">
              <h2>
                {view === "categories"
                  ? text("Create category", "إنشاء فئة")
                  : text("Create collection", "إنشاء مجموعة")}
              </h2>
              <ActionForm
                label={
                  view === "categories"
                    ? text("Create category", "إنشاء فئة")
                    : text("Create collection", "إنشاء مجموعة")
                }
                reset
                submit={(form) =>
                  catalogMutation({
                    kind: "taxonomy",
                    body: {
                      kind: view === "categories" ? "category" : "collection",
                      slug: form.get("slug"),
                      nameEn: form.get("nameEn"),
                      nameAr: form.get("nameAr"),
                      ...(view === "collections"
                        ? {
                            descriptionEn: form.get("descriptionEn"),
                            descriptionAr: form.get("descriptionAr"),
                          }
                        : {}),
                    },
                  })
                }
              >
                <label>
                  {text("URL slug", "اسم الرابط")}
                  <input
                    name="slug"
                    dir="ltr"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="training-essentials"
                  />
                </label>
                <label>
                  {text("English name", "الاسم الإنجليزي")}
                  <input name="nameEn" dir="ltr" minLength={2} required />
                </label>
                <label>
                  {text("Arabic name", "الاسم العربي")}
                  <input name="nameAr" dir="rtl" minLength={2} required />
                </label>
                {view === "collections" ? (
                  <>
                    <label>
                      {text("English description", "الوصف الإنجليزي")}
                      <textarea name="descriptionEn" dir="ltr" />
                    </label>
                    <label>
                      {text("Arabic description", "الوصف العربي")}
                      <textarea name="descriptionAr" dir="rtl" />
                    </label>
                  </>
                ) : null}
                <button className="primary">
                  {view === "categories"
                    ? text("Create category", "إنشاء فئة")
                    : text("Create collection", "إنشاء مجموعة")}
                </button>
              </ActionForm>
            </section>
          ) : null}
          <div className="list">
            {data[view].length ? (
              data[view].map((item) => (
                <article key={item.id}>
                  <div>
                    <strong>{text(item.name_en, item.name_ar)}</strong>
                    <small>{item.slug}</small>
                  </div>
                  <a
                    className="secondary"
                    href={`${storeOrigin}/${view}/${encodeURIComponent(item.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {text("View customer page ↗", "عرض صفحة العملاء ↗")}
                  </a>
                </article>
              ))
            ) : (
              <p className="empty">
                {text("No groupings yet.", "لا توجد مجموعات بعد.")}
              </p>
            )}
          </div>
        </>
      ) : view === "size-guides" ? (
        <>
          {canEdit ? (
            <section className="panel">
              <h2>
                <T en="Create size guide" ar="إنشاء دليل مقاسات" />
              </h2>
              <p>
                <T
                  en="Use named sizes, measurement labels and a unit. Guides can be assigned from each product editor."
                  ar="استخدم مقاسات مسماة وقياسات ووحدة. يمكن ربط الدليل من محرر المنتج."
                />
              </p>
              <ActionForm
                label={text("Create size guide", "إنشاء دليل مقاسات")}
                submit={(form) =>
                  catalogMutation({ kind: "guide", body: guideFromForm(form) })
                }
                reset
              >
                <GuideFields />
              </ActionForm>
            </section>
          ) : null}
          <div className="list">
            {data.sizeGuides.length ? (
              data.sizeGuides.map((guide) => (
                <article key={guide.id}>
                  <strong>{guide.name}</strong>
                  <dl className="guide-preview">
                    {Object.entries(guide.measurements).map(([name, value]) => (
                      <div key={name}>
                        <dt>{name}</dt>
                        <dd>
                          {value !== null &&
                          typeof value === "object" &&
                          !Array.isArray(value)
                            ? Object.entries(value)
                                .map(
                                  ([label, amount]) =>
                                    `${label}: ${String(amount)}`,
                                )
                                .join(" · ")
                            : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))
            ) : (
              <p className="empty">
                {text("No size guides yet.", "لا توجد أدلة مقاسات بعد.")}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          {canEdit ? (
            <details className="catalog-disclosure">
              <summary>
                {text(
                  "Create product & initial SKU",
                  "إنشاء منتج ورمز مخزون أولي",
                )}
              </summary>
              <ActionForm
                label={text("Create product", "إنشاء منتج")}
                reset
                submit={(form) =>
                  catalogMutation({
                    kind: "create",
                    body: {
                      ...productFromForm(form),
                      sizeGuideId: form.get("sizeGuideId") || undefined,
                      slug: form.get("slug"),
                      productType: form.get("productType"),
                      options: [],
                      variants: [
                        {
                          sku: form.get("sku"),
                          optionValues: {},
                          inventoryTracking: true,
                          initialStock: wholeNumber(form.get("stock")),
                        },
                      ],
                    },
                  })
                }
              >
                <label>
                  {text("URL slug", "اسم الرابط")}
                  <input
                    name="slug"
                    dir="ltr"
                    required
                    maxLength={100}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="training-top"
                  />
                </label>
                <label>
                  {text("Product type", "نوع المنتج")}
                  <input
                    name="productType"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
                <ProductFields />
                <GroupingFields data={data} />
                <label>
                  {text("Initial SKU", "رمز المخزون الأولي")}
                  <input name="sku" minLength={2} maxLength={80} required />
                </label>
                <label>
                  {text("Initial stock", "المخزون الأولي")}
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={0}
                    required
                  />
                </label>
                <p className="catalog-wide">
                  <T
                    en="New products start as drafts. Publish only after checking their content, price and inventory."
                    ar="تبدأ المنتجات كمسودات. انشر بعد مراجعة المحتوى والسعر والمخزون."
                  />
                </p>
                <button className="primary">
                  {text("Create product", "إنشاء منتج")}
                </button>
              </ActionForm>
            </details>
          ) : null}
          <div className="catalog-toolbar">
            <label>
              {text("Find product or SKU", "ابحث عن منتج أو رمز مخزون")}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={text(
                  "Name, slug or SKU",
                  "الاسم أو الرابط أو رمز المخزون",
                )}
              />
            </label>
            <span>
              {products.length} / {data.products.length}{" "}
              {text("products", "منتجات")}
            </span>
          </div>
          <div className="catalog-products">
            {products.length ? (
              products.map((product) => (
                <article
                  className="catalog-product"
                  key={`${product.id}:${JSON.stringify(product)}`}
                >
                  <header>
                    <div>
                      <h2>{text(product.name_en, product.name_ar)}</h2>
                      <small>
                        {product.slug} · {product.variants.length} SKU
                      </small>
                    </div>
                    <div className="catalog-product-meta">
                      <span className="catalog-status">
                        {product.status === "ACTIVE"
                          ? text("Published", "منشور")
                          : product.status === "DRAFT"
                            ? text("Draft", "مسودة")
                            : product.status === "HIDDEN"
                              ? text("Hidden", "مخفي")
                              : text("Archived", "مؤرشف")}
                      </span>
                      <strong>
                        {(Number(product.base_price_fils) / 1000).toFixed(3)}{" "}
                        JOD
                      </strong>
                      {product.status === "ACTIVE" ? (
                        <a
                          href={`${storeOrigin}/products/${encodeURIComponent(product.slug)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {text("View product ↗", "عرض المنتج ↗")}
                        </a>
                      ) : null}
                    </div>
                  </header>
                  {canEdit ? (
                    <>
                      <details className="catalog-disclosure">
                        <summary>
                          {text(
                            "Edit content, pricing & groupings",
                            "تعديل المحتوى والسعر والمجموعات",
                          )}
                        </summary>
                        <ActionForm
                          label={text(
                            `Edit product ${product.name_en}`,
                            `تعديل المنتج ${product.name_ar}`,
                          )}
                          submit={(form) =>
                            catalogMutation({
                              kind: "update",
                              id: product.id,
                              body: productFromForm(form),
                            })
                          }
                        >
                          <ProductFields product={product} />
                          <GroupingFields data={data} product={product} />
                          <button className="primary">
                            {text("Save product", "حفظ المنتج")}
                          </button>
                        </ActionForm>
                      </details>
                      <details className="catalog-disclosure">
                        <summary>
                          {text("Variants", "الخيارات")} (
                          {product.variants.length})
                        </summary>
                        <div className="catalog-nested">
                          {product.variants.map((variant) => (
                            <VariantEditor
                              product={product}
                              variant={variant}
                              key={variant.id}
                            />
                          ))}
                        </div>
                      </details>
                      <details className="catalog-disclosure">
                        <summary>
                          {text("Gallery", "معرض الصور")} (
                          {product.media.length})
                        </summary>
                        <GalleryPublisher
                          product={product}
                          data={data}
                          storeOrigin={storeOrigin}
                        />
                      </details>
                    </>
                  ) : (
                    <p>
                      <T
                        en="Read-only catalog access."
                        ar="صلاحية قراءة الكتالوج فقط."
                      />
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p className="empty">
                {text(
                  "No products match your search.",
                  "لا توجد منتجات تطابق بحثك.",
                )}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
