"use client";

import { useEffect, useState } from "react";

type Item = { id: string; category: string; entity_type: string; entity_id: string; event_type: string; read_at: string | null; created_at: string };
type SimulatedMessage={eventType:string;channel:string;destination:string;token:string;expiresAt:string;createdAt:string};
const labels: Record<string, string> = { identity: "Account security update", orders: "Order update", payments: "Payment update", delivery: "Delivery update", support: "Support update", privacy: "Privacy update" };

export function NotificationCenter() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const[simulatedMessages,setSimulatedMessages]=useState<SimulatedMessage[]>([]);

  async function load(before?: string) {
    const response = await fetch(`/api/v1/account/notifications${before ? `?before=${encodeURIComponent(before)}` : ""}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.code ?? "NOTIFICATIONS_UNAVAILABLE");
    setItems((current) => before ? [...current, ...body.data.notifications] : body.data.notifications);
    setUnread(body.data.unreadCount); setCursor(body.data.nextCursor);
  }
  useEffect(() => { let cancelled = false; void fetch("/api/v1/account/notifications").then((response) => response.json().then((body) => ({ response, body }))).then(({ response, body }) => { if (!cancelled && response.ok) { setItems(body.data.notifications); setUnread(body.data.unreadCount); setCursor(body.data.nextCursor); } }).catch(() => undefined);void fetch("/api/v1/simulation/inbox").then(response=>response.ok?response.json():null).then(body=>{if(!cancelled&&body)setSimulatedMessages(body.data.messages);}).catch(()=>undefined); return () => { cancelled = true; }; }, []);

  async function mark(input: { all: true } | { id: string }) {
    const response = await fetch("/api/v1/account/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    if (!response.ok) { setMessage("Could not update notification state."); return; }
    const all = "all" in input;
    setItems((current) => current.map((item) => all || item.id === input.id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    setUnread(all ? 0 : Math.max(0, unread - 1));
  }

  async function preference(channel: "EMAIL" | "WHATSAPP", enabled: boolean) {
    const response = await fetch("/api/v1/account/notification-preferences", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category: "marketing", channel, enabled }) });
    setMessage(response.ok ? "Marketing preference saved." : "Preference could not be saved.");
  }

  return <><section className="panel"><h2>{unread} unread</h2><button className="secondary" onClick={() => mark({ all: true })} disabled={unread === 0}>Mark all read</button><div className="list">{items.length === 0 ? <p>No notifications yet.</p> : items.map((item) => <article key={item.id}><strong>{labels[item.category] ?? "Store update"}</strong><span>{item.event_type} · {new Date(item.created_at).toLocaleString("en-JO")}</span>{!item.read_at ? <button className="secondary" onClick={() => mark({ id: item.id })}>Mark read</button> : null}</article>)}</div>{cursor ? <button className="secondary" onClick={() => load(cursor)}>Load older</button> : null}</section>{simulatedMessages.length?<section className="panel"><h2>Captured simulation messages / رسائل المحاكاة</h2><p>These tokens stay in the memory-only simulator and are visible only to their recipient account.</p><div className="list">{simulatedMessages.map(item=><article key={`${item.eventType}:${item.createdAt}`}><strong>{item.channel} · {item.eventType}</strong><span>{item.destination}</span><code>{item.token}</code></article>)}</div></section>:null}<section className="panel"><h2>Optional marketing / التسويق الاختياري</h2><p>Necessary order and security messages cannot be disabled here.</p><button className="secondary" onClick={() => preference("EMAIL", false)}>Stop marketing email</button><button className="secondary" onClick={() => preference("EMAIL", true)}>Allow marketing email</button><button className="secondary" onClick={() => preference("WHATSAPP", false)}>Stop marketing WhatsApp</button></section><p aria-live="polite">{message}</p></>;
}
