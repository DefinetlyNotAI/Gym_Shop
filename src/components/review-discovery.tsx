"use client";

import { useEffect, useState } from "react";

type Review = { publicId: string; rating: number; body: string; fit: string | null; approvedBadge: boolean; helpfulCount: number; verifiedPurchase: boolean; createdAt: string };
type ReviewListing = { reviews: Review[]; count: number; average: number; distribution: { rating: number; count: number }[] };

export function ReviewDiscovery({ slug }: { slug: string }) {
  const [listing, setListing] = useState<ReviewListing | null>(null);
  const [sort, setSort] = useState("recent");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/catalog/products/${encodeURIComponent(slug)}/reviews?sort=${sort}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => setListing(payload.data ?? null))
      .catch((error: unknown) => { if ((error as { name?: string }).name !== "AbortError") setMessage("Reviews could not be loaded."); });
    return () => controller.abort();
  }, [slug, sort]);

  async function helpful(publicId: string) {
    const response = await fetch(`/api/v1/reviews/${publicId}/helpful`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.code ?? "Vote failed");
    setListing((current) => current ? { ...current, reviews: current.reviews.map((review) => review.publicId === publicId ? { ...review, helpfulCount: payload.data.count } : review) } : current);
  }

  return <section className="panel">
    <div className="inline-actions"><h2>Customer reviews / مراجعات العملاء</h2><select value={sort} onChange={(event)=>setSort(event.target.value)} aria-label="Sort reviews"><option value="recent">Recent</option><option value="helpful">Helpful</option><option value="highest">Highest</option><option value="lowest">Lowest</option></select></div>
    {listing ? <><p><strong>{listing.average.toFixed(1)} / 5</strong> · {listing.count} reviews · {listing.distribution.map((item)=>`${item.rating}★ ${item.count}`).join(" · ")}</p><div className="list">{listing.reviews.map((review)=><article key={review.publicId}><div><strong>{review.rating} / 5 {review.verifiedPurchase ? "· Verified purchase" : ""} {review.approvedBadge ? "· Approved" : ""}</strong><small>{new Date(review.createdAt).toISOString()} {review.fit ? `· fit ${review.fit.toLowerCase()}` : ""}</small></div><p>{review.body}</p><button type="button" onClick={()=>helpful(review.publicId)}>Helpful · {review.helpfulCount}</button></article>)}</div>{!listing.count?<p>No published reviews yet. / لا توجد مراجعات منشورة بعد.</p>:null}</> : <p>Loading reviews… / جارٍ تحميل المراجعات…</p>}
    <p aria-live="polite">{message}</p>
  </section>;
}
