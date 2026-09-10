"use client";

import { useState } from "react";

type Ticket = { public_id: string; category: string; priority: string; status: string; subject: string; customer_name: string };
type Conversation = { public_id: string; subject: string; status: string; messages: Array<{ id: string; author_name: string; body: string; private_note: boolean; created_at: string }> };

async function send(path: string, method: string, body?: unknown) { const response = await fetch(path, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined }); const result = await response.json(); if (!response.ok) throw new Error(result.error?.code ?? "SUPPORT_ACTION_FAILED"); return result.data; }

export function SupportOperations({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets] = useState(initialTickets);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [message, setMessage] = useState("");
  async function open(publicId: string) { try { setSelected(await send(`/api/v1/admin/support/tickets/${publicId}`, "GET")); } catch (error) { setMessage(error instanceof Error ? error.message : "Ticket unavailable"); } }
  async function update(body: unknown) { if (!selected) return; try { await send(`/api/v1/admin/support/tickets/${selected.public_id}`, "PATCH", body); await open(selected.public_id); setMessage("Ticket updated."); } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); } }
  async function reply(form: FormData) { if (!selected) return; try { await send(`/api/v1/admin/support/tickets/${selected.public_id}`, "POST", { message: form.get("message"), privateNote: form.get("privateNote") === "on" }); await open(selected.public_id); } catch (error) { setMessage(error instanceof Error ? error.message : "Reply failed"); } }
  return <section id="support"><h2>Support operations / عمليات الدعم</h2><div className="list">{tickets.map((ticket) => <button className="secondary" key={ticket.public_id} onClick={() => open(ticket.public_id)}>{ticket.priority} · {ticket.public_id} · {ticket.subject} · {ticket.customer_name}</button>)}</div>{selected ? <article className="panel"><h3>{selected.public_id} · {selected.subject}</h3>{selected.messages.map((item) => <p key={item.id}><strong>{item.private_note ? "PRIVATE · " : ""}{item.author_name}</strong><br />{item.body}</p>)}<form action={reply}><textarea name="message" required maxLength={10000} /><label className="check"><input name="privateNote" type="checkbox" />Private staff note</label><button className="primary">Reply</button></form><div className="quick-grid"><button className="secondary" onClick={() => update({ status: "IN_REVIEW" })}>In review</button><button className="secondary" onClick={() => update({ status: "RESOLVED" })}>Resolve</button><button className="secondary" onClick={() => update({ priority: "URGENT" })}>Mark urgent</button></div><form action={(form) => update({ assignedTo: form.get("assignedTo") || null, category: form.get("category") || undefined })}><input name="assignedTo" placeholder="Support staff account UUID (blank unassigns)" /><select name="category" defaultValue=""><option value="">Keep category</option><option>ORDER</option><option>DAMAGE</option><option>DELIVERY</option><option>PAYMENT</option><option>ACCOUNT</option><option>PRODUCT</option><option>OTHER</option></select><button className="secondary">Update queue fields</button></form></article> : null}<p aria-live="polite">{message}</p></section>;
}
