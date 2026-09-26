"use client";

import Link from "next/link";
import { AddToCart } from "@/components/add-to-cart";
import { useLanguage } from "@/components/language-provider";
import type { CatalogProduct } from "@/lib/contracts";
import { ReviewDiscovery } from "@/components/review-discovery";
import { RestockControls } from "@/components/subscription-controls";
import { ProductGallery, ProductSizeGuide } from "@/components/product-gallery";

const PRODUCT_TYPES_AR: Record<string, string> = {
  Apparel: "ملابس",
  Accessories: "إكسسوارات",
  Footwear: "أحذية",
  Equipment: "معدات",
};

export function ProductDetails({ product }: { product: CatalogProduct }) {
  const { language, text } = useLanguage();
  const arabic = language === "ar";
  return (
    <main className="page">
      <Link href="/shop">{text("← Shop", "المتجر ←")}</Link>
      <div className="product-detail">
        <ProductGallery product={product} />
        <section>
          <p className="eyebrow">
            {product.brand ? `${product.brand} · ` : ""}
            {arabic
              ? (PRODUCT_TYPES_AR[product.product_type] ?? "منتج")
              : product.product_type}
          </p>
          <h1>{arabic ? product.name_ar : product.name_en}</h1>
          {(
            arabic ? product.short_description_ar : product.short_description_en
          ) ? (
            <p>
              {arabic
                ? product.short_description_ar
                : product.short_description_en}
            </p>
          ) : null}
          <p>{arabic ? product.description_ar : product.description_en}</p>
          {!arabic &&
          (product.audience || product.activity || product.tags.length) ? (
            <p className="muted">
              {[product.audience, product.activity, ...product.tags]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {!arabic && Object.keys(product.attributes).length ? (
            <dl className="panel">
              {Object.entries(product.attributes).map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>
                    {typeof value === "string" || typeof value === "number"
                      ? String(value)
                      : JSON.stringify(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {product.size_guide ? (
            <ProductSizeGuide guide={product.size_guide} />
          ) : null}
          <AddToCart variants={product.variants} />
        </section>
      </div>
      <RestockControls variants={product.variants} />
      <ReviewDiscovery slug={product.slug} />
    </main>
  );
}
