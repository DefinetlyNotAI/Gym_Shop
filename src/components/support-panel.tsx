"use client";

import { useCallback, useEffect, useState } from "react";
import { PrivateMediaUpload } from "@/components/private-media-upload";
import { useApiAction } from "@/components/use-api-action";
import { useLanguage } from "@/components/language-provider";
import { ApiFailure, presentApiError, readApiData } from "@/lib/api-errors";
import {
  loadSupportConversation,
  loadSupportTickets,
  type SupportConversation,
  type SupportTicket,
} from "@/lib/support-actions";

async function supportRequest<T>(path: string, init: RequestInit): Promise<T> {
  return readApiData<T>(await fetch(path, init));
}

function claimName(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "en" in value) {
    return String((value as { en: unknown }).en);
  }
  return fallback;
}

export function SupportPanel() {
  const { text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [conversation, setConversation] = useState<SupportConversation | null>(
    null,
  );
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setTickets(await loadSupportTickets());
  }, []);

  useEffect(() => {
    let active = true;
    void loadSupportTickets()
      .then((items) => {
        if (active) setTickets(items);
      })
      .catch((error) => {
        if (active) presentApiError(error);
      });
    return () => {
      active = false;
    };
  }, []);

  function open(publicId: string) {
    return perform(async () => {
      setConversation(await loadSupportConversation(publicId));
    });
  }

  function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    void perform(
      async () => {
        const created = await supportRequest<{ public_id: string }>(
          "/api/v1/support/tickets",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              category: values.get("category"),
              subject: values.get("subject"),
              message: values.get("message"),
              orderId: values.get("orderId") || undefined,
              mediaIds,
            }),
          },
        );
        if (!created.public_id) throw new ApiFailure("INVALID_RESPONSE");
        await refresh();
        setConversation(await loadSupportConversation(created.public_id));
        setMediaIds([]);
        form.reset();
      },
      { en: "Support ticket created.", ar: "تم إنشاء تذكرة الدعم." },
    );
  }

  function reply(form: HTMLFormElement) {
    if (!conversation) return;
    const id = conversation.public_id;
    const values = new FormData(form);
    void perform(
      async () => {
        await supportRequest(
          `/api/v1/support/tickets/${encodeURIComponent(id)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message: values.get("message") }),
          },
        );
        setConversation(await loadSupportConversation(id));
        await refresh();
        form.reset();
      },
      { en: "Reply sent.", ar: "تم إرسال الرد." },
    );
  }

  function change(action: "CLOSE" | "REOPEN") {
    if (!conversation) return;
    const id = conversation.public_id;
    void perform(
      async () => {
        await supportRequest(
          `/api/v1/support/tickets/${encodeURIComponent(id)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
        setConversation(await loadSupportConversation(id));
        await refresh();
      },
      {
        en: action === "CLOSE" ? "Ticket closed." : "Ticket reopened.",
        ar: action === "CLOSE" ? "تم إغلاق التذكرة." : "تمت إعادة فتح التذكرة.",
      },
    );
  }

  function edit(messageId: string, form: HTMLFormElement) {
    if (!conversation) return;
    const id = conversation.public_id;
    const values = new FormData(form);
    void perform(
      async () => {
        await supportRequest(
          `/api/v1/support/tickets/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body: values.get("body") }),
          },
        );
        setConversation(await loadSupportConversation(id));
      },
      { en: "Message updated.", ar: "تم تحديث الرسالة." },
    );
  }

  const closed =
    conversation?.status === "CLOSED" || conversation?.status === "RESOLVED";

  return (
    <div className="support-center" aria-busy={pending}>
      <section className="panel support-create">
        <div>
          <p className="eyebrow">{text("New request", "طلب جديد")}</p>
          <h2>{text("How can we help?", "كيف يمكننا مساعدتك؟")}</h2>
          <p>
            {text(
              "For damaged delivered items, open the order and use its evidence-backed damage report.",
              "للمنتجات التالفة بعد التسليم، افتح الطلب واستخدم بلاغ التلف المرفق بالأدلة.",
            )}
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
        >
          <div className="form-grid">
            <label>
              {text("Category", "التصنيف")}
              <select name="category" disabled={pending}>
                {[
                  "ORDER",
                  "DELIVERY",
                  "PAYMENT",
                  "ACCOUNT",
                  "PRODUCT",
                  "REFERRAL",
                  "VERIFICATION",
                  "PROMOTION",
                  "OTHER",
                ].map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              {text("Order reference (optional)", "مرجع الطلب (اختياري)")}
              <input name="orderId" disabled={pending} />
            </label>
            <label>
              {text("Subject", "الموضوع")}
              <input
                name="subject"
                required
                minLength={3}
                maxLength={200}
                disabled={pending}
              />
            </label>
            <label className="support-message-field">
              {text("Message", "الرسالة")}
              <textarea
                name="message"
                required
                rows={6}
                maxLength={10000}
                disabled={pending}
                dir="auto"
              />
            </label>
          </div>
          {mediaIds.length < 5 ? (
            <PrivateMediaUpload
              onUploaded={(id) =>
                setMediaIds((current) =>
                  current.includes(id) ? current : [...current, id],
                )
              }
              accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
            />
          ) : null}
          <small>
            {text(
              `${mediaIds.length} private attachment(s) ready`,
              `${mediaIds.length} مرفق خاص جاهز`,
            )}
          </small>
          <button className="primary" disabled={pending}>
            {text(
              pending ? "Sending…" : "Send request",
              pending ? "جارٍ الإرسال…" : "إرسال الطلب",
            )}
          </button>
        </form>
      </section>

      <section
        className="support-history"
        aria-labelledby="support-history-title"
      >
        <div className="support-history-heading">
          <div>
            <p className="eyebrow">{text("Your history", "سجل طلباتك")}</p>
            <h2 id="support-history-title">
              {text("Support tickets", "تذاكر الدعم")}
            </h2>
          </div>
          <button
            className="secondary"
            disabled={pending}
            onClick={() => void perform(refresh)}
          >
            {text("Refresh", "تحديث")}
          </button>
        </div>
        <div className="support-customer-layout">
          <nav
            className="support-customer-list"
            aria-label={text("Your tickets", "تذاكرك")}
          >
            {!tickets.length ? (
              <p className="empty">
                {text("No tickets yet.", "لا توجد تذاكر بعد.")}
              </p>
            ) : null}
            {tickets.map((ticket) => (
              <button
                key={ticket.public_id}
                type="button"
                className={`secondary support-customer-ticket${conversation?.public_id === ticket.public_id ? " is-selected" : ""}`}
                aria-current={
                  conversation?.public_id === ticket.public_id
                    ? "true"
                    : undefined
                }
                disabled={pending}
                onClick={() => void open(ticket.public_id)}
              >
                <strong dir="auto">{ticket.subject}</strong>
                <span>
                  {ticket.category} · {ticket.status}
                </span>
                <small className="reference">{ticket.public_id}</small>
              </button>
            ))}
          </nav>

          {conversation ? (
            <article className="panel support-customer-conversation">
              <header>
                <div>
                  <small className="reference">{conversation.public_id}</small>
                  <h3 dir="auto">{conversation.subject}</h3>
                </div>
                <span className="status-badge">{conversation.status}</span>
              </header>
              {conversation.claim ? (
                <section className="customer-claim-status">
                  <div className="claim-heading">
                    <div>
                      <p className="eyebrow">
                        {text("Damage report", "بلاغ تلف")}
                      </p>
                      <h4>
                        {claimName(
                          conversation.claim.name_snapshot,
                          conversation.claim.sku,
                        )}{" "}
                        · ×{conversation.claim.quantity}
                      </h4>
                    </div>
                    <span className="status-badge">
                      {conversation.claim.status}
                    </span>
                  </div>
                  <p dir="auto">{conversation.claim.description}</p>
                  {conversation.claim.customer_safe_reason ? (
                    <div className="claim-customer-outcome">
                      <strong>{text("Decision", "القرار")}</strong>
                      <p dir="auto">
                        {conversation.claim.customer_safe_reason}
                      </p>
                      {conversation.claim.replacement_order_public_id ? (
                        <small>
                          {text("Replacement order", "طلب الاستبدال")} ·{" "}
                          {conversation.claim.replacement_order_public_id}
                        </small>
                      ) : null}
                    </div>
                  ) : (
                    <small>
                      {text(
                        "Our team is reviewing your evidence.",
                        "يقوم فريقنا بمراجعة الأدلة.",
                      )}
                    </small>
                  )}
                </section>
              ) : null}
              <div className="support-customer-messages">
                {conversation.messages.map((item) => (
                  <article key={item.id} className="support-customer-message">
                    <header>
                      <strong>{item.author_name}</strong>
                      <time dateTime={item.created_at}>
                        {new Date(item.created_at).toLocaleString("en-JO")}
                      </time>
                    </header>
                    <p dir="auto">{item.body}</p>
                    {item.edited_at ? (
                      <small>
                        {text("Edited", "تم التعديل")} · {item.revision_count}
                      </small>
                    ) : null}
                    {item.editable ? (
                      <details>
                        <summary>
                          {text("Edit this message", "تعديل هذه الرسالة")}
                        </summary>
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            edit(item.id, event.currentTarget);
                          }}
                        >
                          <textarea
                            name="body"
                            defaultValue={item.body}
                            required
                            maxLength={10000}
                            disabled={pending}
                          />
                          <button className="secondary" disabled={pending}>
                            {text("Save edit", "حفظ التعديل")}
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
              {!closed ? (
                <form
                  className="support-customer-reply"
                  onSubmit={(event) => {
                    event.preventDefault();
                    reply(event.currentTarget);
                  }}
                >
                  <label>
                    {text("Reply", "رد")}
                    <textarea
                      name="message"
                      required
                      maxLength={10000}
                      disabled={pending}
                      dir="auto"
                    />
                  </label>
                  <button className="primary" disabled={pending}>
                    {text("Send reply", "إرسال الرد")}
                  </button>
                </form>
              ) : null}
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={() => change(closed ? "REOPEN" : "CLOSE")}
              >
                {text(
                  closed ? "Reopen ticket" : "Close ticket",
                  closed ? "إعادة فتح التذكرة" : "إغلاق التذكرة",
                )}
              </button>
            </article>
          ) : (
            <article className="panel support-customer-empty">
              <h3>{text("Select a ticket", "اختر تذكرة")}</h3>
              <p>
                {text(
                  "Open a conversation to review its latest status and replies.",
                  "افتح محادثة لمراجعة أحدث حالتها وردودها.",
                )}
              </p>
            </article>
          )}
        </div>
      </section>
      <p aria-live={live} className="operation-message">
        {message}
      </p>
    </div>
  );
}
