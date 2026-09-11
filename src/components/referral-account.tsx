"use client";

import { useState } from "react";

type ReferralSummary = {
  code: string;
  sharePath: string;
  pending: number;
  completed: number;
  rejected: number;
  earningsFils: number;
  history: { id: string; status: string; reward_fils: string; created_at: string; completed_at: string | null; status_reason: string | null }[];
};

export function ReferralAccount({ summary, origin }: { summary: ReferralSummary; origin: string }) {
  const [customCode, setCustomCode] = useState(summary.code);
  const [message, setMessage] = useState("");
  const shareUrl = `${origin}${summary.sharePath}`;

  async function customize() {
    const response = await fetch("/api/v1/account/referrals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: customCode }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.code ?? "Code update failed");
    location.reload();
  }

  return <>
    <section className="panel">
      <p className="eyebrow">Your code / رمزك</p>
      <h2>{summary.code}</h2>
      <p>{shareUrl}</p>
      <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy link / نسخ الرابط</button>
      <label>Verified custom code<input value={customCode} onChange={(event)=>setCustomCode(event.target.value.toUpperCase())} minLength={6} maxLength={24}/></label>
      <button className="secondary" type="button" onClick={customize}>Update code / تحديث الرمز</button>
      <p aria-live="polite">{message}</p>
    </section>
    <section className="panel">
      <h2>Referral progress / تقدم الإحالات</h2>
      <p>Pending {summary.pending} · completed {summary.completed} · rejected {summary.rejected} · earned {(summary.earningsFils/1000).toFixed(3)} JOD</p>
      <div className="list">{summary.history.map((reward)=><article key={reward.id}><strong>{reward.status}</strong><p>{(Number(reward.reward_fils)/1000).toFixed(3)} JOD</p><small>{new Date(reward.created_at).toISOString()}{reward.status_reason?` · ${reward.status_reason}`:""}</small></article>)}</div>
    </section>
  </>;
}
