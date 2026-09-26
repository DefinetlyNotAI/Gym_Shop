"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { useApiAction } from "@/components/use-api-action";
import {
  errorNotice,
  presentApiError,
  type ErrorNotice,
} from "@/lib/api-errors";
import {
  loadNotifications,
  loadNotificationPreferences,
  loadSimulationInbox,
  markNotifications,
  updateMarketingPreference,
  type NotificationPage,
  type NotificationPreference,
  type SimulatedMessage,
} from "@/lib/account-notices";

const categories: Record<string, { en: string; ar: string; href?: string }> = {
  identity: {
    en: "Account security update",
    ar: "تحديث أمان الحساب",
    href: "/account/settings",
  },
  orders: { en: "Order update", ar: "تحديث الطلب", href: "/account/orders" },
  payments: {
    en: "Payment update",
    ar: "تحديث الدفع",
    href: "/account/orders",
  },
  delivery: {
    en: "Delivery update",
    ar: "تحديث التوصيل",
    href: "/account/orders",
  },
  support: { en: "Support update", ar: "تحديث الدعم", href: "/contact" },
  privacy: {
    en: "Privacy update",
    ar: "تحديث الخصوصية",
    href: "/account/settings",
  },
};
export function NotificationCenter() {
  const { language, text } = useLanguage();
  const { pending, perform, message, live } = useApiAction();
  const [page, setPage] = useState<NotificationPage | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [initialNotice, setInitialNotice] = useState<ErrorNotice | null>(null);
  const [simulatedMessages, setSimulatedMessages] = useState<
    SimulatedMessage[]
  >([]);
  const [simulationFailed, setSimulationFailed] = useState(false);
  const busy = loading || pending;
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-JO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Amman",
    }).format(new Date(value));

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void Promise.all([
      loadNotifications(undefined, fetch, controller.signal),
      loadNotificationPreferences(fetch, controller.signal),
    ])
      .then(([result, saved]) => {
        if (!cancelled) {
          setPage(result);
          setPreferences(saved);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadFailed(true);
          setInitialNotice(errorNotice(error));
          presentApiError(error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void loadSimulationInbox(fetch, controller.signal)
      .then((result) => {
        if (!cancelled) setSimulatedMessages(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setSimulationFailed(true);
          presentApiError(error);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  async function refresh() {
    setInitialNotice(null);
    const accepted = await perform(
      async () => {
        const [result, saved] = await Promise.all([
          loadNotifications(),
          loadNotificationPreferences(),
        ]);
        setPage(result);
        setPreferences(saved);
        setLoadFailed(false);
      },
      { en: "Notifications refreshed.", ar: "تم تحديث الإشعارات." },
    );
    if (!accepted) setLoadFailed(true);
  }
  function older() {
    if (!page?.nextCursor) return;
    const before = page.nextCursor;
    void perform(async () => {
      const result = await loadNotifications(before);
      setPage((current) =>
        current
          ? {
              ...result,
              notifications: [
                ...current.notifications,
                ...result.notifications.filter(
                  (item) =>
                    !current.notifications.some(
                      (existing) => existing.id === item.id,
                    ),
                ),
              ],
            }
          : result,
      );
    });
  }
  function mark(input: { all: true } | { id: string }) {
    void perform(
      async () => {
        await markNotifications(input);
        const now = new Date().toISOString();
        setPage((current) => {
          if (!current) return current;
          const all = "all" in input;
          const newlyRead = current.notifications.filter(
            (item) => !item.read_at && (all || item.id === input.id),
          ).length;
          return {
            ...current,
            unreadCount: all ? 0 : Math.max(0, current.unreadCount - newlyRead),
            notifications: current.notifications.map((item) =>
              all || item.id === input.id
                ? { ...item, read_at: item.read_at ?? now }
                : item,
            ),
          };
        });
      },
      {
        en: "Notification read state saved.",
        ar: "تم حفظ حالة قراءة الإشعارات.",
      },
    );
  }
  function preference(channel: "EMAIL" | "WHATSAPP", enabled: boolean) {
    void perform(
      async () => {
        await updateMarketingPreference(channel, enabled);
        setPreferences((current) => [
          ...current.filter(
            (item) =>
              !(item.category === "marketing" && item.channel === channel),
          ),
          {
            category: "marketing",
            channel,
            enabled,
            updated_at: new Date().toISOString(),
          },
        ]);
      },
      {
        en: "Optional marketing preference saved.",
        ar: "تم حفظ تفضيل التسويق الاختياري.",
      },
    );
  }
  function preferenceText(channel: "EMAIL" | "WHATSAPP") {
    const saved = preferences.find(
      (item) => item.category === "marketing" && item.channel === channel,
    );
    return saved
      ? saved.enabled
        ? text("Allowed", "مسموح")
        : text("Stopped", "متوقف")
      : text("No explicit preference saved", "لم يتم حفظ تفضيل صريح");
  }

  return (
    <>
      <section className="panel" aria-busy={busy}>
        <div className="notice-heading">
          <div>
            <p className="eyebrow">{text("YOUR INBOX", "صندوق الإشعارات")}</p>
            <h2>
              {page
                ? text(
                    `${page.unreadCount} unread`,
                    `${page.unreadCount} غير مقروء`,
                  )
                : text("Notification history", "سجل الإشعارات")}
            </h2>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void refresh()}
            >
              {text(
                pending ? "Updating…" : "Refresh",
                pending ? "جارٍ التحديث…" : "تحديث",
              )}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || !page?.unreadCount}
              onClick={() => mark({ all: true })}
            >
              {text("Mark all read", "تحديد الكل كمقروء")}
            </button>
          </div>
        </div>
        {loading ? (
          <p role="status">
            {text("Loading your notifications…", "جارٍ تحميل إشعاراتك…")}
          </p>
        ) : null}
        {loadFailed ? (
          <p className="notice">
            {text(
              page
                ? "Notifications couldn't be refreshed. Use Refresh to try again; the last loaded history is kept below."
                : "Notifications couldn't be loaded. Use Refresh to try again.",
              page
                ? "تعذّر تحديث الإشعارات. استخدم زر التحديث للمحاولة مجددًا؛ يُحتفظ بآخر سجل محمّل أدناه."
                : "تعذّر تحميل الإشعارات. استخدم زر التحديث للمحاولة مجددًا.",
            )}
          </p>
        ) : null}
        <div className="list">
          {page?.notifications.length ? (
            page.notifications.map((item) => {
              const category = categories[item.category] ?? {
                en: "Store update",
                ar: "تحديث المتجر",
              };
              return (
                <article key={item.id} className="notification-item">
                  <div className="notice-heading">
                    <strong>{category[language]}</strong>
                    <span className="status-badge">
                      {item.read_at
                        ? text("Read", "مقروء")
                        : text("Unread", "غير مقروء")}
                    </span>
                  </div>
                  <time dateTime={item.created_at}>
                    {formatDate(item.created_at)}
                  </time>
                  <div className="action-row">
                    {category.href ? (
                      <Link className="ghost" href={category.href}>
                        {text("View related activity", "عرض النشاط المرتبط")}
                      </Link>
                    ) : null}
                    {!item.read_at ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => mark({ id: item.id })}
                      >
                        {text("Mark read", "تحديد كمقروء")}
                      </button>
                    ) : null}
                  </div>
                  <details className="notification-diagnostics">
                    <summary>{text("Event details", "تفاصيل الحدث")}</summary>
                    <code>{item.event_type}</code>
                  </details>
                </article>
              );
            })
          ) : !loading && !loadFailed ? (
            <p className="empty">
              {text(
                "No notifications yet. Order and security updates will appear here.",
                "لا توجد إشعارات بعد. ستظهر تحديثات الطلبات والأمان هنا.",
              )}
            </p>
          ) : null}
        </div>
        {page?.nextCursor ? (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={older}
          >
            {text("Load older notifications", "تحميل إشعارات أقدم")}
          </button>
        ) : null}
      </section>
      {simulatedMessages.length ? (
        <section className="panel">
          <h2>{text("Captured simulation messages", "رسائل المحاكاة")}</h2>
          <p>
            {text(
              "These tokens stay in the memory-only simulator and are visible only to their recipient account.",
              "تبقى هذه الرموز في ذاكرة المحاكاة وتظهر فقط للحساب المستلم.",
            )}
          </p>
          <div className="list">
            {simulatedMessages.map((item) => (
              <article key={item.eventType + ":" + item.createdAt}>
                <strong>
                  {item.channel} · {item.eventType}
                </strong>
                <span>{item.destination}</span>
                <code>{item.token}</code>
                <small>
                  {text("Expires", "تنتهي")} {formatDate(item.expiresAt)}
                </small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {simulationFailed ? (
        <p className="notice">
          {text(
            "The optional simulator inbox couldn't be loaded. Your normal notifications are separate.",
            "تعذّر تحميل صندوق المحاكاة الاختياري. إشعاراتك العادية منفصلة.",
          )}
        </p>
      ) : null}
      <section className="panel" aria-busy={busy}>
        <p className="eyebrow">{text("YOUR CHOICE", "اختيارك")}</p>
        <h2>{text("Optional marketing", "التسويق الاختياري")}</h2>
        <p>
          {text(
            "Necessary order and security messages cannot be disabled here. These choices only affect optional marketing.",
            "لا يمكن تعطيل رسائل الطلبات والأمان الضرورية هنا. تؤثر هذه الاختيارات على التسويق الاختياري فقط.",
          )}
        </p>
        <div className="preference-grid">
          <article className="preference-card">
            <h3>{text("Marketing email", "البريد التسويقي")}</h3>
            <p>{preferenceText("EMAIL")}</p>
            <div className="action-row">
              <button
                type="button"
                className="secondary"
                disabled={busy || loadFailed}
                onClick={() => preference("EMAIL", false)}
              >
                {text("Stop emails", "إيقاف البريد")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || loadFailed}
                onClick={() => preference("EMAIL", true)}
              >
                {text("Allow emails", "السماح بالبريد")}
              </button>
            </div>
          </article>
          <article className="preference-card">
            <h3>{text("Marketing WhatsApp", "واتساب التسويقي")}</h3>
            <p>{preferenceText("WHATSAPP")}</p>
            <div className="action-row">
              <button
                type="button"
                className="secondary"
                disabled={busy || loadFailed}
                onClick={() => preference("WHATSAPP", false)}
              >
                {text("Stop marketing WhatsApp", "إيقاف واتساب التسويقي")}
              </button>
            </div>
          </article>
        </div>
      </section>
      {initialNotice ? (
        <p aria-live="off">{initialNotice.description[language]}</p>
      ) : null}
      {message ? <p aria-live={live}>{message}</p> : null}
    </>
  );
}
