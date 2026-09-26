"use client";

import { useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/language-provider";
import type { CatalogProduct } from "@/lib/contracts";
import { sizeGuideTable } from "@/lib/product-presentation";

export function ProductGallery({ product }: { product: CatalogProduct }) {
  const { language, text } = useLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  const images = product.media ?? [];
  const hero = images.find((image) => image.id === selected) ?? images[0];
  return (
    <section
      className="product-gallery"
      aria-label={text("Product images", "صور المنتج")}
    >
      {hero ? (
        <Image
          unoptimized
          className="product-art large"
          src={`/media/${hero.id}`}
          alt={language === "ar" ? hero.altAr : hero.altEn}
          width={720}
          height={720}
          sizes="(max-width: 700px) calc(100vw - 32px), 45vw"
        />
      ) : (
        <div className="product-art large">
          {product.product_type.slice(0, 2).toUpperCase()}
        </div>
      )}
      {images.length > 1 ? (
        <div
          className="product-thumbnails"
          aria-label={text("Choose product image", "اختر صورة المنتج")}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-pressed={hero?.id === image.id}
              aria-label={text(
                `Image ${index + 1}: ${image.altEn}`,
                `صورة ${index + 1}: ${image.altAr}`,
              )}
              onClick={() => setSelected(image.id)}
            >
              <Image
                unoptimized
                src={`/media/${image.id}`}
                alt=""
                width={96}
                height={96}
                sizes="80px"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ProductSizeGuide({
  guide,
}: {
  guide: NonNullable<CatalogProduct["size_guide"]>;
}) {
  const { text } = useLanguage();
  const table = sizeGuideTable(guide.measurements);
  return (
    <details className="product-size-guide">
      <summary>
        {text("Size guide", "دليل المقاسات")} · {guide.name}
      </summary>
      {table.unit ? (
        <p>
          {text("Measurements in", "القياسات بوحدة")}{" "}
          <strong>{table.unit}</strong>
        </p>
      ) : null}
      {table.rows.length ? (
        <div
          className="measurement-scroll"
          tabIndex={0}
          role="region"
          aria-label={text("Size measurements", "قياسات المقاسات")}
        >
          <table>
            <caption>{guide.name}</caption>
            <thead>
              <tr>
                <th scope="col">{text("Size", "المقاس")}</th>
                {table.columns.map((column) => (
                  <th scope="col" key={column}>
                    {column === "Measurement"
                      ? text("Measurement", "القياس")
                      : column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.size}>
                  <th scope="row">{row.size}</th>
                  {row.values.map((value, index) => (
                    <td key={table.columns[index]}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          {text(
            "No measurements have been provided yet.",
            "لم تُضف القياسات بعد.",
          )}
        </p>
      )}
    </details>
  );
}
