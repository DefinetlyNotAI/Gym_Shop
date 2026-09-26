"use client";
import { useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { updateCartLine } from "@/lib/commerce-actions";
export function AddToCart({
  variants,
}: {
  variants: Array<{
    id: string;
    sku: string;
    options: Record<string, string>;
    priceFils: string;
    available: number | null;
  }>;
}) {
  const { text } = useLanguage();
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const { pending, perform, message, live } = useApiAction();
  const selected = variants.find((v) => v.id === variantId);
  return (
    <div className="purchase" aria-busy={pending}>
      <label>
        {text("Choose a variant", "اختر خيار المنتج")}
        <select
          value={variantId}
          disabled={pending}
          onChange={(e) => setVariantId(e.target.value)}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.sku} · {Object.values(v.options).join(" · ")} ·{" "}
              {(Number(v.priceFils) / 1000).toFixed(3)} {text("JOD", "د.أ")}{" "}
              {v.available === 0 ? text("· Out of stock", "· غير متوفر") : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="primary"
        disabled={
          pending ||
          !selected ||
          (selected.available !== null && selected.available < 1)
        }
        onClick={() =>
          void perform(
            async () => {
              await updateCartLine({ variantId, quantity: 1, selected: true });
            },
            {
              en: "Added to cart. Review your selections before checkout.",
              ar: "تمت الإضافة إلى السلة. راجع اختياراتك قبل الدفع.",
            },
          )
        }
      >
        {text(
          pending ? "Adding…" : "Add to cart",
          pending ? "جارٍ الإضافة…" : "أضف للسلة",
        )}
      </button>
      <p aria-live={live}>{message}</p>
    </div>
  );
}
