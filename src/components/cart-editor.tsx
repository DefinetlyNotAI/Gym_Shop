"use client";
import Link from "next/link";
import { useState } from "react";
import type { CartLine } from "@/lib/contracts";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { removeSavedLine, updateCartLine } from "@/lib/commerce-actions";
export function CartEditor({
  initialLines,
  signedIn,
}: {
  initialLines: CartLine[];
  signedIn: boolean;
}) {
  const [lines, setLines] = useState(initialLines);
  const { language, text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  async function update(
    line: CartLine,
    change: Partial<Pick<CartLine, "quantity" | "selected">>,
  ) {
    const next = { ...line, ...change };
    setLines(
      await updateCartLine({
        variantId: line.variant_id,
        quantity: next.quantity,
        selected: next.selected,
      }),
    );
  }
  function selectAll(selected: boolean) {
    void perform(
      async () => {
        for (const line of lines)
          await update(line, {
            selected:
              selected &&
              (line.available === null || line.available >= line.quantity),
          });
      },
      { en: "Cart selections updated.", ar: "تم تحديث اختيارات السلة." },
    );
  }
  return (
    <section aria-busy={pending}>
      <div className="quick-grid">
        <button
          type="button"
          disabled={pending || !lines.length}
          className="secondary"
          onClick={() => selectAll(true)}
        >
          {text("Select available", "تحديد المتاح")}
        </button>
        <button
          type="button"
          disabled={pending || !lines.length}
          className="secondary"
          onClick={() => selectAll(false)}
        >
          {text("Save all for later", "حفظ الكل لوقت لاحق")}
        </button>
      </div>
      <div className="list">
        {lines.map((line) => (
          <article key={line.id}>
            <strong>{language === "ar" ? line.name_ar : line.name_en}</strong>
            <span>
              {line.sku} · {(Number(line.unit_price_fils) / 1000).toFixed(3)}{" "}
              {text("JOD", "د.أ")}
            </span>
            <label className="check">
              <input
                type="checkbox"
                checked={line.selected}
                disabled={
                  pending ||
                  (line.available !== null && line.available < line.quantity)
                }
                onChange={(e) =>
                  void perform(
                    () => update(line, { selected: e.target.checked }),
                    { en: "Selection updated.", ar: "تم تحديث الاختيار." },
                  )
                }
              />
              {text("Selected for checkout", "محدد للدفع")}
            </label>
            <form
              key={line.id + "-" + line.quantity}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(
                  () => update(line, { quantity: Number(f.get("quantity")) }),
                  { en: "Quantity saved.", ar: "تم حفظ الكمية." },
                );
              }}
            >
              <label>
                {text("Quantity", "الكمية")}
                <input
                  name="quantity"
                  type="number"
                  required
                  min={1}
                  max={99}
                  defaultValue={line.quantity}
                  disabled={pending}
                />
              </label>
              <button type="submit" className="secondary" disabled={pending}>
                {text("Save quantity", "حفظ الكمية")}
              </button>
            </form>
            {line.available !== null && line.available < line.quantity ? (
              <small className="alert">
                {text(
                  `Only ${line.available} currently available; this line cannot be selected.`,
                  `المتوفر حاليًا ${line.available} فقط؛ لا يمكن تحديد هذا المنتج.`,
                )}
              </small>
            ) : null}
            <button
              type="button"
              disabled={pending}
              className="ghost"
              onClick={() =>
                void perform(
                  async () => {
                    await removeSavedLine(line.id);
                    setLines((current) =>
                      current.filter((item) => item.id !== line.id),
                    );
                  },
                  {
                    en: "Item removed from the cart.",
                    ar: "تم حذف المنتج من السلة.",
                  },
                )
              }
            >
              {text("Remove", "حذف")}
            </button>
          </article>
        ))}
      </div>
      {!lines.length ? (
        <p className="empty">{text("Your cart is empty.", "سلتك فارغة.")}</p>
      ) : null}
      {lines.some((line) => line.selected) && !pending ? (
        <Link className="primary" href={signedIn ? "/checkout" : "/account"}>
          {text(
            signedIn ? "Checkout" : "Sign in to review and confirm selections",
            signedIn ? "الدفع" : "سجّل الدخول لمراجعة الاختيارات وتأكيدها",
          )}
        </Link>
      ) : null}
      <p aria-live={live}>{message}</p>
    </section>
  );
}
