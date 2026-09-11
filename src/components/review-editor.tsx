"use client";

import { useState } from "react";

type ReviewAccountData = {
  awaiting: { order_line_id: string; order_public_id: string; slug: string; name_en: string; name_ar: string; sku: string; delivered_at: string }[];
  reviews: { public_id: string; status: string; current_version: number; name_en: string; name_ar: string; rating: number; body: string; approved_badge: boolean }[];
};

async function mutate(path: string, method: string, body?: unknown) {
  const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.code ?? "REVIEW_REQUEST_FAILED");
  return payload.data;
}

export function ReviewEditor({ data }: { data: ReviewAccountData }) {
  const [message, setMessage] = useState("");
  async function run(work: () => Promise<unknown>) { try { setMessage("Saving…"); await work(); location.reload(); } catch (error) { setMessage(error instanceof Error ? error.message : "Review request failed"); } }
  return <>
    <section className="panel"><h2>Awaiting your review / بانتظار مراجعتك</h2><p>Reviews open one day after delivery. The first eligible submission each Amman week earns 10 points, regardless of rating or moderation status.</p><div className="list">{data.awaiting.map((item)=><article key={item.order_line_id}><strong>{item.name_en} / {item.name_ar}</strong><small>{item.order_public_id} · {item.sku}</small><form action={(form)=>run(()=>mutate(`/api/v1/catalog/products/${item.slug}/reviews`,"POST",{orderLineId:item.order_line_id,rating:Number(form.get("rating")),body:form.get("body"),fit:form.get("fit")||undefined,qualityRating:form.get("quality")?Number(form.get("quality")):undefined,comfortRating:form.get("comfort")?Number(form.get("comfort")):undefined}))}><input name="rating" type="number" min="1" max="5" required placeholder="Rating 1–5"/><textarea name="body" minLength={10} maxLength={5000} required placeholder="Your review"/><select name="fit" defaultValue=""><option value="">Fit (optional)</option><option value="SMALL">Small</option><option value="TRUE">True</option><option value="LARGE">Large</option></select><input name="quality" type="number" min="1" max="5" placeholder="Quality 1–5"/><input name="comfort" type="number" min="1" max="5" placeholder="Comfort 1–5"/><button className="primary">Submit review</button></form></article>)}</div>{!data.awaiting.length?<p>No purchases are awaiting review.</p>:null}</section>
    <section className="panel"><h2>Your review history / سجل مراجعاتك</h2><div className="list">{data.reviews.map((review)=><article key={review.public_id}><strong>{review.name_en} / {review.name_ar} · {review.status} · v{review.current_version} {review.approved_badge?"· Approved":""}</strong><form action={(form)=>run(()=>mutate(`/api/v1/account/reviews/${review.public_id}`,"PATCH",{rating:Number(form.get("rating")),body:form.get("body")}))}><input name="rating" type="number" min="1" max="5" defaultValue={review.rating} required/><textarea name="body" minLength={10} maxLength={5000} defaultValue={review.body} required/><button className="secondary">Edit after cooldown</button></form><button type="button" onClick={()=>run(()=>mutate(`/api/v1/account/reviews/${review.public_id}`,"DELETE"))}>Delete review</button></article>)}</div></section>
    <p aria-live="polite">{message}</p>
  </>;
}
