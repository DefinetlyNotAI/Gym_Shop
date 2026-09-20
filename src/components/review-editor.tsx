"use client";

import { useRouter } from "next/navigation";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { requestApi } from "@/lib/client-api";

type ReviewAccountData = {
  awaiting: { order_line_id: string; order_public_id: string; slug: string; name_en: string; name_ar: string; sku: string; delivered_at: string }[];
  reviews: { public_id: string; status: string; current_version: number; name_en: string; name_ar: string; rating: number; body: string; approved_badge: boolean }[];
};

export function ReviewEditor({ data }: { data: ReviewAccountData }) {
  const { text } = useLanguage();
  const router = useRouter();
  const { pending, perform, message, live } = useApiAction();
  async function run(work: () => Promise<unknown>, success: { en: string; ar: string }) {
    const completed = await perform(() => work().then(() => undefined), success);
    if (completed) router.refresh();
  }
  return <>
    <section className="panel"><h2>{text("Awaiting your review", "بانتظار مراجعتك")}</h2><p>{text("Reviews open one day after delivery. The first eligible submission each Amman week earns 10 points, regardless of rating or moderation status.", "تتاح المراجعات بعد يوم من التسليم. يمنح أول إرسال مؤهل كل أسبوع في عمّان 10 نقاط بغض النظر عن التقييم أو حالة الإشراف.")}</p><div className="list">{data.awaiting.map((item) => <article key={item.order_line_id}><strong>{text(item.name_en, item.name_ar)}</strong><small>{item.order_public_id} · {item.sku}</small><form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() => requestApi(`/api/v1/catalog/products/${encodeURIComponent(item.slug)}/reviews`, { method: "POST", body: { orderLineId: item.order_line_id, rating: Number(values.get("rating")), body: values.get("body"), fit: values.get("fit") || undefined, qualityRating: values.get("quality") ? Number(values.get("quality")) : undefined, comfortRating: values.get("comfort") ? Number(values.get("comfort")) : undefined } }), { en: "Review submitted.", ar: "تم إرسال المراجعة." }); }}><input name="rating" type="number" min="1" max="5" required placeholder={text("Rating 1–5", "التقييم 1–5")} /><textarea name="body" minLength={10} maxLength={5000} required placeholder={text("Your review", "مراجعتك")} /><select name="fit" defaultValue=""><option value="">{text("Fit (optional)", "المقاس (اختياري)")}</option><option value="SMALL">{text("Small", "صغير")}</option><option value="TRUE">{text("True", "مناسب")}</option><option value="LARGE">{text("Large", "كبير")}</option></select><input name="quality" type="number" min="1" max="5" placeholder={text("Quality 1–5", "الجودة 1–5")} /><input name="comfort" type="number" min="1" max="5" placeholder={text("Comfort 1–5", "الراحة 1–5")} /><button className="primary" disabled={pending}>{text("Submit review", "إرسال المراجعة")}</button></form></article>)}</div>{!data.awaiting.length ? <p className="empty">{text("No purchases are awaiting review.", "لا توجد مشتريات بانتظار المراجعة.")}</p> : null}</section>
    <section className="panel"><h2>{text("Your review history", "سجل مراجعاتك")}</h2><div className="list">{data.reviews.map((review) => <article key={review.public_id}><strong>{text(review.name_en, review.name_ar)} · {review.status} · v{review.current_version} {review.approved_badge ? `· ${text("Approved", "معتمدة")}` : ""}</strong><form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void run(() => requestApi(`/api/v1/account/reviews/${encodeURIComponent(review.public_id)}`, { method: "PATCH", body: { rating: Number(values.get("rating")), body: values.get("body") } }), { en: "Review updated.", ar: "تم تحديث المراجعة." }); }}><input name="rating" type="number" min="1" max="5" defaultValue={review.rating} required /><textarea name="body" minLength={10} maxLength={5000} defaultValue={review.body} required /><button className="secondary" disabled={pending}>{text("Edit after cooldown", "التعديل بعد مهلة الانتظار")}</button></form><button type="button" disabled={pending} onClick={() => void run(() => requestApi(`/api/v1/account/reviews/${encodeURIComponent(review.public_id)}`, { method: "DELETE" }), { en: "Review deleted.", ar: "تم حذف المراجعة." })}>{text("Delete review", "حذف المراجعة")}</button></article>)}</div></section>
    <p aria-live={live}>{message}</p>
  </>;
}
