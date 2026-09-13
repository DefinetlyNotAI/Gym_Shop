"use client";
import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import { copyOrderToCart } from "@/lib/commerce-actions";
export function ReorderButton({ publicId }: { publicId: string }) {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [copied, setCopied] = useState<{
    added: number;
    rejected: number;
  } | null>(null);
  return (
    <div aria-busy={pending}>
      <button
        type="button"
        className="secondary"
        disabled={pending || copied !== null}
        onClick={() =>
          void perform(async () => {
            const r = await copyOrderToCart(publicId);
            setCopied({ added: r.added.length, rejected: r.rejected.length });
          })
        }
      >
        {text(
          pending ? "Copying saved items…" : "Reorder into saved cart",
          pending ? "جارٍ نسخ المنتجات…" : "إعادة الطلب إلى السلة المحفوظة",
        )}
      </button>
      {copied ? (
        <p role="status">
          {text(
            `${copied.added} line(s) copied as unselected saved items; ${copied.rejected} unavailable line(s) skipped. Review current prices and stock. No new order or payment was created.`,
            `تم نسخ ${copied.added} منتجات غير محددة وتجاوز ${copied.rejected} منتجات غير متوفرة. راجع الأسعار والمخزون الحالي. لم يُنشأ طلب أو دفع جديد.`,
          )}{" "}
          <Link href="/cart">
            {text("Review saved cart", "راجع السلة المحفوظة")}
          </Link>
        </p>
      ) : null}
      <p aria-live={live}>{message}</p>
    </div>
  );
}
