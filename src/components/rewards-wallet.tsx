"use client";

import { useState } from "react";

type RewardsSummary = {
  pointMilliBalance: number;
  pointMilliLifetimeEarned: number;
  pointMilliLifetimeSpent: number;
  walletAvailableFils: number;
  walletHeldFils: number;
  walletPendingFils: number;
  walletLifetimeEarnedFils: number;
  walletLifetimeSpentFils: number;
  walletLifetimePaidOutFils: number;
  conversionWeekStart: string;
  weeklyBlocksRemaining: number;
  expires: false;
  history: { ledger: string; kind: string; direction: string; amount: string; source_type: string; source_id: string; created_at: string }[];
};

const points = (milliPoints: number) => (milliPoints / 1_000).toFixed(3);
const jod = (fils: number) => (fils / 1_000).toFixed(3);

export function RewardsWallet({ summary }: { summary: RewardsSummary }) {
  const [blocks, setBlocks] = useState(1);
  const [message, setMessage] = useState("");

  async function convert() {
    setMessage("Converting… / جارٍ التحويل…");
    const response = await fetch("/api/v1/account/rewards/convert", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blocks, idempotencyKey: crypto.randomUUID() }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error?.code ?? "Point conversion failed / تعذر تحويل النقاط");
      return;
    }
    location.reload();
  }

  return <>
    <section className="panel">
      <p className="eyebrow">Wallet / المحفظة</p>
      <h2>{jod(summary.walletAvailableFils)} JOD available</h2>
      <p>Held {jod(summary.walletHeldFils)} JOD · pending {jod(summary.walletPendingFils)} JOD</p>
      <p>Lifetime earned {jod(summary.walletLifetimeEarnedFils)} · spent {jod(summary.walletLifetimeSpentFils)} · paid out {jod(summary.walletLifetimePaidOutFils)} JOD</p>
      <strong>Wallet funds and points never expire. / أموال المحفظة والنقاط لا تنتهي صلاحيتها.</strong>
    </section>
    <section className="panel">
      <p className="eyebrow">Points / النقاط</p>
      <h2>{points(summary.pointMilliBalance)} points</h2>
      <p>Lifetime earned {points(summary.pointMilliLifetimeEarned)} · spent {points(summary.pointMilliLifetimeSpent)}</p>
      <p>100 points convert to 1 JOD. {summary.weeklyBlocksRemaining} of 5 blocks remain for the week beginning {summary.conversionWeekStart}.</p>
      <label>Blocks to convert<input type="number" min="1" max={Math.min(5, summary.weeklyBlocksRemaining)} value={blocks} onChange={(event)=>setBlocks(Number(event.target.value))} /></label>
      <button className="primary" type="button" onClick={convert} disabled={summary.weeklyBlocksRemaining < 1}>Convert points / تحويل النقاط</button>
      <p aria-live="polite">{message}</p>
    </section>
    <section className="panel">
      <h2>Recent provenance / السجل الأخير</h2>
      <div className="list">{summary.history.length ? summary.history.map((entry, index) => <article key={`${entry.ledger}-${entry.source_id}-${index}`}>
        <strong>{entry.ledger} · {entry.kind} · {entry.direction}</strong>
        <p>{entry.ledger === "POINTS" ? `${points(Number(entry.amount))} points` : `${jod(Number(entry.amount))} JOD`} · {entry.source_type}</p>
        <small>{entry.source_id} · {new Date(entry.created_at).toISOString()}</small>
      </article>) : <p>No reward activity yet. / لا يوجد نشاط مكافآت بعد.</p>}</div>
    </section>
  </>;
}
