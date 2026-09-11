"use client";

import { useState } from "react";

export type ReviewQueueItem = {
  public_id: string;
  status: string;
  current_version: number;
  rating: number;
  body: string;
  classifier_outcome: string;
  classifier_reasons: string[];
  change_characters: number;
  change_percent: string;
  name_en: string;
  name_ar: string;
  sku: string;
  order_public_id: string;
  account_public_id: string;
  report_count: number;
};

export function ReviewOperations({ reviews }: { reviews: ReviewQueueItem[] }) {
  const [message, setMessage] = useState("");
  async function decide(publicId: string, decision: string, reason: string) {
    const response = await fetch(`/api/v1/admin/reviews/${publicId}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.code ?? "Review decision failed");
    location.reload();
  }
  return <section id="reviews"><h2>Review moderation / مراجعة المحتوى</h2><p>Moderators can change status and approve the current version; customer rating and text cannot be rewritten.</p><p aria-live="polite">{message}</p><div className="list">{reviews.length ? reviews.map((review)=><article key={review.public_id}><div><strong>{review.name_en} / {review.name_ar} · {review.rating}/5 · {review.status}</strong><small>{review.account_public_id} · {review.order_public_id} · {review.sku} · v{review.current_version}</small></div><p>{review.body}</p><small>Classifier {review.classifier_outcome} · {(review.classifier_reasons??[]).join(", ")||"no flags"} · edit {review.change_characters} chars / {Number(review.change_percent).toFixed(1)}% · reports {review.report_count}</small><form action={(form)=>decide(review.public_id,String(form.get("decision")),String(form.get("reason"))) }><select name="decision"><option>APPROVE</option><option>REJECT</option><option>HIDE</option></select><input name="reason" required minLength={3} placeholder="Moderation reason"/><button className="secondary">Record decision</button></form></article>) : <p>No reviews in the queue.</p>}</div></section>;
}
