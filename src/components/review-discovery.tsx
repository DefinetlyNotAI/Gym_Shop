"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { customerAction, reviewReportFromForm } from "@/lib/customer-actions";

type Review = {
  publicId: string;
  rating: number;
  body: string;
  fit: string | null;
  approvedBadge: boolean;
  helpfulCount: number;
  verifiedPurchase: boolean;
  createdAt: string;
};
type ReviewListing = {
  reviews: Review[];
  count: number;
  average: number;
  distribution: { rating: number; count: number }[];
};

function ReviewCard({
  review,
  onVote,
}: {
  review: Review;
  onVote: (id: string, count: number) => void;
}) {
  const { language, text } = useLanguage();
  const [pending, setPending] = useState<"helpful" | "report" | null>(null);
  const [error, setError] = useState("");
  const [reported, setReported] = useState(false);
  async function helpful() {
    if (pending) return;
    setPending("helpful");
    setError("");
    try {
      const result = await customerAction({
        kind: "helpful",
        id: review.publicId,
      });
      if (typeof result.count !== "number")
        throw new Error(
          text("Unexpected vote response", "استجابة تصويت غير متوقعة"),
        );
      onVote(review.publicId, result.count);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : text("Vote failed", "تعذر التصويت"),
      );
    } finally {
      setPending(null);
    }
  }
  async function report(form: FormData) {
    if (pending) return;
    setPending("report");
    setError("");
    try {
      const result = await customerAction({
        kind: "report",
        id: review.publicId,
        input: reviewReportFromForm(form),
      });
      if (result.reported !== true)
        throw new Error(
          text("Report was not confirmed", "لم يتم تأكيد البلاغ"),
        );
      setReported(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : text("Report failed", "تعذر إرسال البلاغ"),
      );
    } finally {
      setPending(null);
    }
  }
  const date = new Date(review.createdAt);
  const fit =
    review.fit === "SMALL"
      ? text("Runs small", "أصغر من المتوقع")
      : review.fit === "LARGE"
        ? text("Runs large", "أكبر من المتوقع")
        : review.fit
          ? text("True to size", "مطابق للمقاس")
          : null;
  return (
    <article className="review-card">
      <div className="review-card-header">
        <strong
          aria-label={text(
            `${review.rating} out of 5 stars`,
            `${review.rating} من 5 نجوم`,
          )}
        >
          {review.rating} / 5
        </strong>
        <div className="review-badges">
          {review.verifiedPurchase ? (
            <span>{text("Verified purchase", "شراء موثّق")}</span>
          ) : null}
          {review.approvedBadge ? (
            <span>{text("Approved", "معتمد")}</span>
          ) : null}
        </div>
      </div>
      <small>
        {Number.isNaN(date.getTime())
          ? ""
          : date.toLocaleDateString(language === "ar" ? "ar-JO" : "en-JO", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
        {fit ? ` · ${fit}` : ""}
      </small>
      <p className="review-body" dir="auto">
        {review.body}
      </p>
      <div className="review-actions">
        <button
          type="button"
          className="secondary"
          disabled={pending !== null}
          onClick={helpful}
        >
          {pending === "helpful"
            ? text("Saving…", "جارٍ الحفظ…")
            : text("Helpful", "مفيد")}{" "}
          · {review.helpfulCount}
        </button>
        <details className="review-report">
          <summary>{text("Report review", "الإبلاغ عن المراجعة")}</summary>
          {reported ? (
            <p role="status">
              {text(
                "Report received. Our team will review it.",
                "تم استلام البلاغ. سيراجعه فريقنا.",
              )}
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void report(new FormData(event.currentTarget));
              }}
            >
              <fieldset disabled={pending !== null}>
                <legend>
                  {text("Tell us what is wrong", "أخبرنا عن المشكلة")}
                </legend>
                <p className="muted">
                  {text(
                    "Sign in to report content. Disagreement with a rating is not a reason to remove it.",
                    "سجّل الدخول للإبلاغ عن المحتوى. الاختلاف مع التقييم ليس سببًا لحذفه.",
                  )}
                </p>
                <label>
                  {text("Reason", "السبب")}
                  <select name="reason" required defaultValue="SPAM">
                    <option value="SPAM">{text("Spam", "محتوى مزعج")}</option>
                    <option value="OFFENSIVE">
                      {text("Offensive content", "محتوى مسيء")}
                    </option>
                    <option value="PERSONAL_INFO">
                      {text("Personal information", "معلومات شخصية")}
                    </option>
                    <option value="IRRELEVANT">
                      {text("Unrelated content", "محتوى غير متعلق")}
                    </option>
                    <option value="OTHER">{text("Other", "سبب آخر")}</option>
                  </select>
                </label>
                <label>
                  {text("Details (optional)", "التفاصيل (اختياري)")}
                  <textarea name="details" maxLength={1000} rows={3} />
                </label>
                <button className="secondary">
                  {pending === "report"
                    ? text("Sending…", "جارٍ الإرسال…")
                    : text("Send report", "إرسال البلاغ")}
                </button>
              </fieldset>
            </form>
          )}
        </details>
      </div>
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function ReviewDiscovery({ slug }: { slug: string }) {
  const { text } = useLanguage();
  const [listing, setListing] = useState<ReviewListing | null>(null);
  const [sort, setSort] = useState("recent");
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/v1/catalog/products/${encodeURIComponent(slug)}/reviews?sort=${sort}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Review loading failed");
        const payload = await response.json();
        if (!payload.data || !Array.isArray(payload.data.reviews))
          throw new Error("Invalid review listing");
        if (!controller.signal.aborted) setListing(payload.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [slug, sort, retry]);
  function reset() {
    setListing(null);
    setFailed(false);
  }
  return (
    <section className="panel reviews-panel">
      <div className="review-toolbar">
        <h2>{text("Customer reviews", "مراجعات العملاء")}</h2>
        <label>
          {text("Sort reviews", "ترتيب المراجعات")}
          <select
            value={sort}
            onChange={(event) => {
              reset();
              setSort(event.target.value);
            }}
          >
            <option value="recent">{text("Most recent", "الأحدث")}</option>
            <option value="helpful">
              {text("Most helpful", "الأكثر فائدة")}
            </option>
            <option value="highest">
              {text("Highest rating", "الأعلى تقييمًا")}
            </option>
            <option value="lowest">
              {text("Lowest rating", "الأقل تقييمًا")}
            </option>
          </select>
        </label>
      </div>
      {failed ? (
        <div role="alert">
          <p>{text("Reviews could not be loaded.", "تعذر تحميل المراجعات.")}</p>
          <button
            className="secondary"
            onClick={() => {
              reset();
              setRetry((value) => value + 1);
            }}
          >
            {text("Try again", "حاول مجددًا")}
          </button>
        </div>
      ) : listing ? (
        <>
          <div className="review-summary">
            <strong>{listing.average.toFixed(1)} / 5</strong>
            <span>
              {listing.count} {text("reviews", "مراجعة")}
            </span>
            {listing.distribution.length ? (
              <div
                className="review-distribution"
                aria-label={text("Rating distribution", "توزيع التقييمات")}
              >
                {listing.distribution.map((item) => (
                  <span key={item.rating}>
                    {item.rating} ★ · {item.count}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="review-list">
            {listing.reviews.map((review) => (
              <ReviewCard
                key={review.publicId}
                review={review}
                onVote={(id, count) =>
                  setListing((current) =>
                    current
                      ? {
                          ...current,
                          reviews: current.reviews.map((item) =>
                            item.publicId === id
                              ? { ...item, helpfulCount: count }
                              : item,
                          ),
                        }
                      : current,
                  )
                }
              />
            ))}
          </div>
          {!listing.count ? (
            <p className="muted">
              {text("No published reviews yet.", "لا توجد مراجعات منشورة بعد.")}
            </p>
          ) : null}
        </>
      ) : (
        <p role="status">{text("Loading reviews…", "جارٍ تحميل المراجعات…")}</p>
      )}
    </section>
  );
}
