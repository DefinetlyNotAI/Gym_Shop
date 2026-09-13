"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { editSupportMessage } from "@/lib/support-actions";
import {
  ApiFailure,
  apiErrorFromPayload,
  presentApiError,
} from "@/lib/api-errors";

type Ticket = {
  public_id: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  customer_name: string;
};
type Message = {
  id: string;
  author_name: string;
  body: string;
  private_note: boolean;
  created_at: string;
  edited_at: string | null;
  editable: boolean;
  revision_count: number;
};
type Conversation = {
  public_id: string;
  subject: string;
  status: string;
  messages: Message[];
};
type QueueUpdate = {
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string | null;
};

async function send<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw apiErrorFromPayload(result, response.status);
  if (!result || !Object.hasOwn(result, "data"))
    throw new ApiFailure("INVALID_RESPONSE");
  return result.data;
}

function ConversationMessage({
  item,
  busy,
  save,
}: {
  item: Message;
  busy: boolean;
  save: (id: string, body: string) => Promise<boolean>;
}) {
  const { language, text } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.body);
  const date = new Date(item.created_at);
  return (
    <article
      className={`support-message${item.private_note ? " is-private" : ""}`}
    >
      <header>
        <strong>{item.author_name}</strong>
        <span className="support-message-meta">
          {item.private_note ? (
            <span className="support-private-badge">
              {text("Staff only", "للموظفين فقط")}
            </span>
          ) : null}
          <time dateTime={item.created_at}>
            {Number.isNaN(date.getTime())
              ? "—"
              : new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(date)}
          </time>
        </span>
      </header>
      <p className="support-message-body" dir="auto">
        {item.body}
      </p>
      {item.edited_at ? (
        <small>
          {text("Edited", "تم التعديل")} · {item.revision_count}{" "}
          {text("revision(s)", "تعديل")}
        </small>
      ) : null}
      {item.editable ? (
        editing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save(item.id, draft).then((saved) => {
                if (saved) setEditing(false);
              });
            }}
          >
            <label>
              {text("Edit your message", "عدّل رسالتك")}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                required
                maxLength={10000}
                disabled={busy}
                dir="auto"
              />
            </label>
            <div className="support-action-row">
              <button className="primary" disabled={busy || !draft.trim()}>
                {text(
                  busy ? "Saving…" : "Save message",
                  busy ? "جارٍ الحفظ…" : "حفظ الرسالة",
                )}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditing(false)}
              >
                {text("Cancel", "إلغاء")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="secondary support-edit-button"
            disabled={busy}
            onClick={() => {
              setDraft(item.body);
              setEditing(true);
            }}
          >
            {text("Edit your message", "عدّل رسالتك")}
          </button>
        )
      ) : null}
    </article>
  );
}

export function SupportOperations({
  initialTickets,
}: {
  initialTickets: Ticket[];
}) {
  const { text } = useLanguage();
  const [tickets, setTickets] = useState(initialTickets);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [message, setMessage] = useState<string | { en: string; ar: string }>(
    "",
  );
  const [busy, setBusy] = useState(false);
  const [toasted, setToasted] = useState(false);
  const working = useRef(false);
  const ticketPath = (id: string) =>
    `/api/v1/admin/support/tickets/${encodeURIComponent(id)}`;
  async function refresh(id: string) {
    const conversation = await send<Conversation>(ticketPath(id), "GET");
    setSelected(conversation);
    setTickets((current) =>
      current.map((ticket) =>
        ticket.public_id === id
          ? { ...ticket, status: conversation.status }
          : ticket,
      ),
    );
  }
  async function perform(action: () => Promise<void>): Promise<boolean> {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setMessage("");
    setToasted(false);
    try {
      await action();
      return true;
    } catch (error) {
      setToasted(true);
      setMessage(presentApiError(error));
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  function open(id: string) {
    return perform(() => refresh(id));
  }
  async function afterMutation(
    id: string,
    success: { en: string; ar: string },
  ) {
    try {
      await refresh(id);
      setMessage(success);
    } catch {
      setMessage({
        en: "Saved, but the conversation could not refresh. Reopen the ticket to see the latest state.",
        ar: "تم الحفظ، لكن تعذّر تحديث المحادثة. أعد فتح التذكرة لعرض أحدث حالة.",
      });
    }
  }
  function update(body: QueueUpdate) {
    if (!selected) return Promise.resolve(false);
    const id = selected.public_id;
    return perform(async () => {
      await send(ticketPath(id), "PATCH", body);
      setTickets((current) =>
        current.map((ticket) =>
          ticket.public_id === id
            ? {
                ...ticket,
                ...(body.priority ? { priority: body.priority } : {}),
                ...(body.category ? { category: body.category } : {}),
              }
            : ticket,
        ),
      );
      await afterMutation(id, {
        en: "Ticket updated.",
        ar: "تم تحديث التذكرة.",
      });
    });
  }
  function reply(form: HTMLFormElement) {
    if (!selected) return;
    const id = selected.public_id;
    const data = new FormData(form);
    void perform(async () => {
      const body = String(data.get("message") ?? "").trim();
      if (!body) throw new ApiFailure("MESSAGE_INVALID");
      await send(ticketPath(id), "POST", {
        message: body,
        privateNote: data.get("privateNote") === "on",
      });
      form.reset();
      await afterMutation(id, { en: "Message sent.", ar: "تم إرسال الرسالة." });
    });
  }
  function saveMessage(id: string, body: string) {
    if (!selected) return Promise.resolve(false);
    const ticketId = selected.public_id;
    return perform(async () => {
      await editSupportMessage(ticketId, id, body);
      await afterMutation(ticketId, {
        en: "Message saved.",
        ar: "تم حفظ الرسالة.",
      });
    });
  }
  return (
    <section id="support" className="support-workspace" aria-busy={busy}>
      <h2>{text("Support operations", "عمليات الدعم")}</h2>
      <p className="support-feedback" role={toasted ? undefined : "status"}>
        {(typeof message === "string"
          ? message
          : text(message.en, message.ar)) ||
          (busy ? text("Updating conversation…", "جارٍ تحديث المحادثة…") : "")}
      </p>
      <div className="support-layout">
        <nav
          className="support-ticket-list"
          aria-label={text("Support tickets", "تذاكر الدعم")}
        >
          {!tickets.length ? (
            <p>{text("No support tickets yet.", "لا توجد تذاكر دعم بعد.")}</p>
          ) : null}
          {tickets.map((ticket) => (
            <button
              type="button"
              className={`secondary support-ticket${selected?.public_id === ticket.public_id ? " is-selected" : ""}`}
              key={ticket.public_id}
              disabled={busy}
              aria-current={
                selected?.public_id === ticket.public_id ? "true" : undefined
              }
              onClick={() => void open(ticket.public_id)}
            >
              <strong dir="auto">{ticket.subject}</strong>
              <span dir="auto">{ticket.customer_name}</span>
              <small>
                {ticket.public_id} · {ticket.priority} · {ticket.status}
              </small>
            </button>
          ))}
        </nav>
        {selected ? (
          <article
            className="panel support-conversation"
            key={selected.public_id}
          >
            <header>
              <small>
                {selected.public_id} · {selected.status}
              </small>
              <h3 dir="auto">{selected.subject}</h3>
            </header>
            <div className="support-messages">
              {selected.messages.map((item) => (
                <ConversationMessage
                  key={item.id}
                  item={item}
                  busy={busy}
                  save={saveMessage}
                />
              ))}
            </div>
            {selected.status !== "CLOSED" ? (
              <form
                className="support-reply"
                onSubmit={(event) => {
                  event.preventDefault();
                  reply(event.currentTarget);
                }}
              >
                <label>
                  {text("New reply", "رد جديد")}
                  <textarea
                    name="message"
                    required
                    maxLength={10000}
                    disabled={busy}
                    dir="auto"
                  />
                </label>
                <label className="check">
                  <input name="privateNote" type="checkbox" disabled={busy} />
                  {text(
                    "Private staff note — hidden from the customer",
                    "ملاحظة خاصة للموظفين — لا تظهر للعميل",
                  )}
                </label>
                <button className="primary" disabled={busy}>
                  {text("Send message", "إرسال الرسالة")}
                </button>
              </form>
            ) : (
              <p>
                {text(
                  "This ticket is closed. Replies and edits are unavailable.",
                  "هذه التذكرة مغلقة. لا يمكن الرد أو التعديل.",
                )}
              </p>
            )}
            <div className="support-action-row">
              <button
                type="button"
                className="secondary"
                disabled={busy || selected.status === "CLOSED"}
                onClick={() => void update({ status: "IN_REVIEW" })}
              >
                {text("In review", "قيد المراجعة")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || selected.status === "CLOSED"}
                onClick={() => void update({ status: "RESOLVED" })}
              >
                {text("Resolve", "حل التذكرة")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void update({ priority: "URGENT" })}
              >
                {text("Mark urgent", "تحديد كعاجلة")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void open(selected.public_id)}
              >
                {text("Refresh conversation", "تحديث المحادثة")}
              </button>
            </div>
            <details className="support-queue">
              <summary>
                {text("Queue and assignment", "قائمة الانتظار والتعيين")}
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const assignedTo = String(
                    form.get("assignedTo") ?? "",
                  ).trim();
                  const category = String(form.get("category") ?? "");
                  void update({
                    ...(assignedTo
                      ? { assignedTo }
                      : form.get("unassign") === "on"
                        ? { assignedTo: null }
                        : {}),
                    ...(category ? { category } : {}),
                  });
                }}
              >
                <label>
                  {text(
                    "Support staff account UUID (optional)",
                    "معرّف حساب موظف الدعم UUID (اختياري)",
                  )}
                  <input name="assignedTo" disabled={busy} />
                </label>
                <label className="check">
                  <input name="unassign" type="checkbox" disabled={busy} />
                  {text(
                    "Remove the current assignment if no account is entered",
                    "إزالة التعيين الحالي إذا لم يُدخل حساب",
                  )}
                </label>
                <label>
                  {text("Category", "الفئة")}
                  <select name="category" defaultValue="" disabled={busy}>
                    <option value="">
                      {text("Keep category", "إبقاء الفئة")}
                    </option>
                    {[
                      "ORDER",
                      "DAMAGE",
                      "DELIVERY",
                      "PAYMENT",
                      "ACCOUNT",
                      "PRODUCT",
                      "OTHER",
                    ].map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <button className="secondary" disabled={busy}>
                  {text("Update queue fields", "تحديث قائمة الانتظار")}
                </button>
              </form>
            </details>
          </article>
        ) : (
          <article className="panel support-empty">
            <h3>{text("Select a ticket", "اختر تذكرة")}</h3>
            <p>
              {text(
                "Read the conversation, respond to the customer or add a private staff note.",
                "اقرأ المحادثة وردّ على العميل أو أضف ملاحظة خاصة للموظفين.",
              )}
            </p>
          </article>
        )}
      </div>
    </section>
  );
}
