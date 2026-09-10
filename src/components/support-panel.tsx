"use client";

import { useCallback, useEffect, useState } from "react";
import { PrivateMediaUpload } from "@/components/private-media-upload";

type Ticket = { public_id: string; category: string; priority: string; status: string; subject: string };
type Message = { id: string; body: string; created_at: string; edited_at: string | null; author_name: string; editable: boolean; revision_count: number };
type Conversation = { public_id: string; status: string; subject: string; messages: Message[] };

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.code ?? "SUPPORT_REQUEST_FAILED");
  return body.data;
}

export function SupportPanel() {
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try { setTickets((await jsonRequest("/api/v1/support/tickets")).tickets); } catch { setTickets([]); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    void jsonRequest("/api/v1/support/tickets").then((data) => { if (!cancelled) setTickets(data.tickets); }).catch(() => { if (!cancelled) setTickets([]); });
    return () => { cancelled = true; };
  }, []);

  async function open(publicId: string) {
    try { setConversation(await jsonRequest(`/api/v1/support/tickets/${encodeURIComponent(publicId)}`)); } catch (error) { setMessage(error instanceof Error ? error.message : "Ticket unavailable"); }
  }

  async function submit(form: FormData) {
    try {
      const created = await jsonRequest("/api/v1/support/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: form.get("category"), subject: form.get("subject"), message: form.get("message"), orderId: form.get("orderId") || undefined, mediaIds }) });
      setMediaIds([]); setMessage("Ticket created / تم إنشاء الطلب"); await refresh(); await open(created.public_id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ticket could not be created"); }
  }

  async function reply(form: FormData) {
    if (!conversation) return;
    try { await jsonRequest(`/api/v1/support/tickets/${conversation.public_id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: form.get("message") }) }); await open(conversation.public_id); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Reply failed"); }
  }

  async function change(action: "CLOSE" | "REOPEN") {
    if (!conversation) return;
    try { await jsonRequest(`/api/v1/support/tickets/${conversation.public_id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }); await open(conversation.public_id); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); }
  }

  async function edit(messageId: string, form: FormData) {
    if (!conversation) return;
    try { await jsonRequest(`/api/v1/support/tickets/${conversation.public_id}/messages/${messageId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: form.get("body") }) }); await open(conversation.public_id); } catch (error) { setMessage(error instanceof Error ? error.message : "Edit failed"); }
  }

  return <div className="list">
    <form className="panel" action={submit}>
      <label>Category / التصنيف<select name="category"><option>ORDER</option><option>DAMAGE</option><option>DELIVERY</option><option>PAYMENT</option><option>ACCOUNT</option><option>PRODUCT</option><option>REFERRAL</option><option>VERIFICATION</option><option>PROMOTION</option><option>OTHER</option></select></label>
      <label>Order reference (optional)<input name="orderId" /></label>
      <label>Subject / الموضوع<input name="subject" required minLength={3} maxLength={200} /></label>
      <label>Message / الرسالة<textarea name="message" required rows={6} maxLength={10000} /></label>
      {mediaIds.length < 5 ? <PrivateMediaUpload onUploaded={(id) => setMediaIds((current) => current.includes(id) ? current : [...current, id])} accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" /> : null}
      <small>{mediaIds.length} private attachment(s) ready</small>
      <button className="primary">Send / إرسال</button>
    </form>
    <section className="panel"><h2>Your tickets / طلباتك</h2>{tickets.length === 0 ? <p>No tickets yet.</p> : tickets.map((ticket) => <button key={ticket.public_id} className="secondary" onClick={() => open(ticket.public_id)}>{ticket.public_id} · {ticket.subject} · {ticket.status}</button>)}</section>
    {conversation ? <section className="panel"><h2>{conversation.subject}</h2><p>{conversation.public_id} · {conversation.status}</p>{conversation.messages.map((item) => <article key={item.id}><strong>{item.author_name}</strong><span>{new Date(item.created_at).toLocaleString("en-JO")}{item.edited_at ? ` · edited (${item.revision_count} prior version)` : ""}</span><p>{item.body}</p>{item.editable ? <details><summary>Edit this message</summary><form action={(form) => edit(item.id, form)}><textarea name="body" defaultValue={item.body} required maxLength={10000} /><button className="secondary">Save edit</button></form></details> : null}</article>)}{conversation.status !== "CLOSED" ? <form action={reply}><textarea name="message" required maxLength={10000} /><button className="primary">Reply / رد</button></form> : null}<button className="secondary" onClick={() => change(conversation.status === "CLOSED" || conversation.status === "RESOLVED" ? "REOPEN" : "CLOSE")}>{conversation.status === "CLOSED" || conversation.status === "RESOLVED" ? "Reopen" : "Close"}</button></section> : null}
    <p aria-live="polite">{message}</p>
  </div>;
}
