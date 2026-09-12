"use client";

import { useState } from "react";

export type VerificationQueue = { applications: {
  public_id: string; public_name: string; reason: string; platforms: { name: string; url: string }[];
  evidence_media_ids: string[]; status: string; submitted_at: string; rejected_until: string | null;
  decision_reason: string | null; account_public_id: string; reviewer_public_id: string | null;
}[] };

export type PayoutQueue = { payouts: {
  public_id: string; amount_fils: string; status: string; requested_at: string; account_public_id: string; alias_masked: string;
}[]; provider: { name: string; available: false; code: string; reason: string } };

async function mutate(path:string,body:unknown){const response=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const payload=await response.json();if(!response.ok)throw new Error(payload.error?.code??"REQUEST_FAILED");location.reload();}

export function VerificationOperations({ queue }: { queue: VerificationQueue }) {
  const [message,setMessage]=useState("");
  return <section id="verification"><h2>Partner verification</h2><p>Review identity evidence independently. Follower counts and platform metrics never auto-approve an application.</p><p aria-live="polite">{message}</p><div className="list">{queue.applications.length?queue.applications.map((item)=><article key={item.public_id}><div><strong>{item.public_name} · {item.status}</strong><small>{item.account_public_id} · submitted {new Date(item.submitted_at).toISOString()}</small></div><p>{item.reason}</p><small>Private evidence: {item.evidence_media_ids.length} file(s) · profiles: {item.platforms.map((platform)=>platform.name).join(", ")||"none"}</small>{["PENDING","UNDER_REVIEW"].includes(item.status)?<form action={async(form)=>{try{await mutate(`/api/v1/admin/verification/${item.public_id}/decision`,{decision:form.get("decision"),reason:form.get("reason")});}catch(error){setMessage(error instanceof Error?error.message:"Decision failed");}}}><select name="decision"><option>APPROVE</option><option>REJECT</option></select><input name="reason" required minLength={3} placeholder="Independent review reason"/><button className="secondary">Record decision</button></form>:null}{item.status==="CANCELLED"?<button className="secondary" onClick={async()=>{try{await mutate(`/api/v1/admin/verification/${item.public_id}/decision`,{decision:"REINSTATE",reason:"Reinstated after independent review"});}catch(error){setMessage(error instanceof Error?error.message:"Reinstatement failed");}}}>Reinstate</button>:null}</article>):<p>No verification applications.</p>}</div></section>;
}

export function PayoutOperations({ queue }: { queue: PayoutQueue }) {
  return <section id="payouts"><h2>{queue.provider.name} · Wallet payout operations</h2><p><strong>Withdrawals unavailable.</strong> {queue.provider.reason}</p><p>No payout can be requested, approved, executed, or marked complete without documented APS beneficiary-disbursement capability and verified integration evidence.</p><div className="list">{queue.payouts.length?queue.payouts.map((item)=><article key={item.public_id}><strong>{item.public_id} · {item.status}</strong><span>{item.account_public_id} · {(Number(item.amount_fils)/1000).toFixed(3)} JOD · {item.alias_masked}</span></article>):<p>No payout records. UNKNOWN payouts, if any, are sorted first for reconciliation.</p>}</div></section>;
}
