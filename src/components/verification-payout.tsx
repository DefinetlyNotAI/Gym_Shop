"use client";

import { useState } from "react";
import { PrivateMediaUpload } from "@/components/private-media-upload";

export type VerificationSummary = {
  status: string;
  verified: boolean;
  application: null | { public_name: string; decision_reason: string | null; submitted_at: string; rejected_until: string | null };
  history: { from_status: string | null; to_status: string; action: string; reason: string | null; created_at: string }[];
};

export type PayoutAvailability = {
  verified: boolean;
  withdrawableFils: number;
  minimumFils: number | null;
  providerAvailable: boolean;
  provider: { name: string; code: string; reason: string };
  history: { public_id: string; amount_fils: string; status: string; requested_at: string; alias_masked: string }[];
};

async function post(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.code ?? "REQUEST_FAILED");
  location.reload();
}

export function VerificationPanel({ summary }: { summary: VerificationSummary }) {
  const [evidenceMediaIds, setEvidenceMediaIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function submit(form: FormData) {
    try {
      await post("/api/v1/account/verification", {
        publicName: form.get("publicName"), reason: form.get("reason"), evidenceMediaIds,
        platforms: String(form.get("platformUrl") ?? "").trim() ? [{ name: "Primary profile", url: form.get("platformUrl") }] : [],
      });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed"); }
  }
  return <>
    <section className="panel"><p className="eyebrow">Partner status</p><h2>{summary.status}</h2><p>Approval requires verified email and phone, an independent WebAuthn security key, a saved recovery secret, and manual staff review. Audience size never triggers automatic approval.</p>{summary.application?<small>Submitted {new Date(summary.application.submitted_at).toISOString()}{summary.application.rejected_until?` · Reapply after ${summary.application.rejected_until}`:""}{summary.application.decision_reason?` · ${summary.application.decision_reason}`:""}</small>:null}<div className="list">{summary.history.map((entry,index)=><article key={`${entry.action}-${entry.created_at}-${index}`}><strong>{entry.action}</strong><small>{entry.from_status??"NEW"} → {entry.to_status} · {new Date(entry.created_at).toISOString()}{entry.reason?` · ${entry.reason}`:""}</small></article>)}</div></section>
    {summary.status==="NOT_SUBMITTED"||summary.status==="REJECTED"||summary.status==="CANCELLED"?<form className="panel form-grid" action={submit}><h2>Apply for verification</h2><input name="publicName" minLength={2} maxLength={120} required placeholder="Public name"/><input name="platformUrl" type="url" placeholder="Primary profile or website URL"/><textarea name="reason" minLength={20} maxLength={2000} required placeholder="Why should this partner identity be verified?"/><PrivateMediaUpload accept="image/jpeg,image/png,image/webp,application/pdf" onUploaded={(id)=>setEvidenceMediaIds((current)=>current.includes(id)?current:[...current,id])}/><small>{evidenceMediaIds.length} private evidence file(s) ready</small><button disabled={!evidenceMediaIds.length}>Submit for independent review</button></form>:null}
    {summary.verified?<button className="secondary" type="button" onClick={async()=>{try{await post("/api/v1/account/verification/revoke",{reason:"Revoked by account owner"});}catch(error){setMessage(error instanceof Error?error.message:"Revocation failed");}}}>Revoke verification</button>:null}<p aria-live="polite">{message}</p>
  </>;
}

export function PayoutPanel({ availability }: { availability: PayoutAvailability }) {
  return <>
    <section className="panel"><p className="eyebrow">Withdrawable wallet</p><h2>{(availability.withdrawableFils/1000).toFixed(3)} JOD</h2><p>{availability.verified?"All settled, undisputed wallet sources are eligible.":"Partner verification is required before wallet funds become withdrawable."}</p></section>
    <section className="panel"><h2>{availability.provider.name} · Wallet withdrawals</h2><p><strong>Unavailable</strong></p><p>{availability.provider.reason}</p><button type="button" disabled>Request payout</button><small>No wallet funds will be held while the provider is unavailable.</small><div className="list">{availability.history.map((item)=><article key={item.public_id}><strong>{item.public_id} · {item.status}</strong><small>{(Number(item.amount_fils)/1000).toFixed(3)} JOD · {item.alias_masked} · {new Date(item.requested_at).toISOString()}</small></article>)}</div></section>
  </>;
}
