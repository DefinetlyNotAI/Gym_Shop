"use client";

import { useState } from "react";

export type ReferralOperation = {
  id: string;
  code: string;
  active: boolean;
  custom: boolean;
  owner_public_id: string;
  reward_count: number;
  completed_fils: string;
};

export type ReferralOperationsData = {
  codes: ReferralOperation[];
  rewards: { id: string; status: string; reward_fils: string; recovery_required: boolean; status_reason: string | null; referrer_public_id: string; order_public_id: string }[];
};

export function ReferralOperations({ referrals }: { referrals: ReferralOperationsData }) {
  const [message, setMessage] = useState("");

  async function disable(codeId: string, reason: string) {
    const response = await fetch("/api/v1/admin/referrals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "DISABLE_CODE", codeId, reason }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.code ?? "Referral operation failed");
    location.reload();
  }

  async function invalidate(rewardId: string, reason: string) {
    const response = await fetch("/api/v1/admin/referrals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "INVALIDATE_REWARD", rewardId, reason }),
    });
    const payload = await response.json();
    if (!response.ok) return setMessage(payload.error?.code ?? "Referral operation failed");
    location.reload();
  }

  return <section id="referrals">
    <h2>Referrals / الإحالات</h2>
    <p>Search is available through the referrals API. Customer identities are represented only by public IDs here.</p>
    <p aria-live="polite">{message}</p>
    <div className="list">{referrals.codes.length ? referrals.codes.map((entry) => <article key={entry.id}>
      <div><strong>{entry.code}</strong><small>{entry.owner_public_id} · {entry.custom ? "custom" : "random"} · {entry.active ? "active" : "disabled"}</small></div>
      <span>{entry.reward_count} rewards · {(Number(entry.completed_fils)/1000).toFixed(3)} JOD completed</span>
      {entry.active ? <form action={(form)=>disable(entry.id, String(form.get("reason") ?? ""))}><input name="reason" required placeholder="Reason for disable/invalidation"/><button className="secondary">Disable and invalidate unlocked referrals</button></form> : null}
    </article>) : <p>No referral codes yet.</p>}</div>
    <h3>Reward review / مراجعة المكافآت</h3>
    <div className="list">{referrals.rewards.length ? referrals.rewards.map((reward) => <article key={reward.id}>
      <div><strong>{reward.status} · {(Number(reward.reward_fils)/1000).toFixed(3)} JOD</strong><small>{reward.referrer_public_id} · {reward.order_public_id}</small></div>
      <span>{reward.recovery_required ? "Manual Finance recovery required" : reward.status_reason ?? "No active flag"}</span>
      {!["REJECTED","REVOKED"].includes(reward.status) ? <form action={(form)=>invalidate(reward.id, String(form.get("reason") ?? ""))}><input name="reason" required placeholder="Fraud/refund reason"/><button className="secondary">Invalidate, freeze or recover</button></form> : null}
    </article>) : <p>No referral rewards yet.</p>}</div>
  </section>;
}
