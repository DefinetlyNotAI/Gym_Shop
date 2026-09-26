"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PrivateMediaUpload } from "@/components/private-media-upload";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { submitDamageClaim } from "@/lib/damage-claims";

type ClaimLine = {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  refundedQuantity: number;
};

export function DamageClaimForm({ lines }: { lines: ClaimLine[] }) {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [lineId, setLineId] = useState(lines[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [mediaIds, setMediaIds] = useState<string[]>([]);
  const [ticketId, setTicketId] = useState("");
  const selected = useMemo(
    () => lines.find((line) => line.id === lineId),
    [lineId, lines],
  );
  const maximum = Math.max(
    1,
    (selected?.quantity ?? 1) - (selected?.refundedQuantity ?? 0),
  );

  if (!lines.length) return null;

  return (
    <section className="panel claim-panel" aria-labelledby="damage-claim-title">
      <div className="claim-heading">
        <div>
          <p className="eyebrow">
            {text("After-delivery care", "خدمة ما بعد التسليم")}
          </p>
          <h2 id="damage-claim-title">
            {text("Report a damaged item", "الإبلاغ عن منتج تالف")}
          </h2>
        </div>
        <span className="status-badge">
          {text("7-day window", "خلال 7 أيام")}
        </span>
      </div>
      <p>
        {text(
          "Choose the affected item, explain what arrived damaged, and attach a clear photo. Your evidence remains private to authorized staff.",
          "اختر المنتج المتأثر، واشرح الضرر عند الاستلام، وأرفق صورة واضحة. تبقى الأدلة خاصة بالموظفين المخولين.",
        )}
      </p>
      {ticketId ? (
        <div className="claim-confirmation" role="status">
          <strong>{text("Report submitted", "تم إرسال البلاغ")}</strong>
          <p>
            {text(
              `Support ticket ${ticketId} was created. We will update you in the support center.`,
              `تم إنشاء تذكرة الدعم ${ticketId}. سنطلعك على المستجدات في مركز الدعم.`,
            )}
          </p>
          <Link className="secondary" href="/contact">
            {text("Open support center", "فتح مركز الدعم")}
          </Link>
        </div>
      ) : (
        <form
          className="claim-form"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(
              async () => {
                const result = await submitDamageClaim({
                  orderLineId: lineId,
                  quantity,
                  description,
                  mediaIds,
                });
                setTicketId(result.ticketId);
              },
              {
                en: "Your damage report was submitted.",
                ar: "تم إرسال بلاغ التلف.",
              },
            );
          }}
        >
          <div className="form-grid">
            <label>
              {text("Affected item", "المنتج المتأثر")}
              <select
                value={lineId}
                disabled={pending}
                onChange={(event) => {
                  setLineId(event.target.value);
                  setQuantity(1);
                }}
              >
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name} · {line.sku}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {text("Damaged quantity", "الكمية التالفة")}
              <input
                type="number"
                min={1}
                max={maximum}
                step={1}
                value={quantity}
                disabled={pending}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            <label className="claim-description">
              {text("What was damaged?", "ما هو الضرر؟")}
              <textarea
                required
                minLength={10}
                maxLength={5000}
                value={description}
                disabled={pending}
                placeholder={text(
                  "Describe the damage, packaging condition, and when you noticed it.",
                  "اشرح الضرر وحالة التغليف ومتى لاحظته.",
                )}
                onChange={(event) => setDescription(event.target.value)}
              />
              <small>{description.length} / 5000</small>
            </label>
          </div>
          <div className="claim-evidence">
            <div>
              <strong>{text("Photo evidence", "دليل مصور")}</strong>
              <p>{text("Required · up to 5 images", "مطلوب · حتى 5 صور")}</p>
            </div>
            {mediaIds.length < 5 ? (
              <PrivateMediaUpload
                required
                onUploaded={(id) =>
                  setMediaIds((current) =>
                    current.includes(id) ? current : [...current, id],
                  )
                }
              />
            ) : null}
            {mediaIds.length ? (
              <div className="claim-evidence-count" role="status">
                <span>
                  {text(
                    `${mediaIds.length} image${mediaIds.length === 1 ? "" : "s"} attached`,
                    `تم إرفاق ${mediaIds.length} صورة`,
                  )}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={pending}
                  onClick={() => setMediaIds([])}
                >
                  {text("Remove all", "إزالة الكل")}
                </button>
              </div>
            ) : null}
          </div>
          <p aria-live={live} className="operation-message">
            {message}
          </p>
          <button
            className="primary"
            disabled={
              pending ||
              !lineId ||
              description.trim().length < 10 ||
              mediaIds.length === 0
            }
          >
            {text(
              pending ? "Submitting report…" : "Submit damage report",
              pending ? "جارٍ إرسال البلاغ…" : "إرسال بلاغ التلف",
            )}
          </button>
        </form>
      )}
    </section>
  );
}
