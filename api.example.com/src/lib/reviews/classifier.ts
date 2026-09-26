export type ReviewClassification = {
  outcome: "ACCEPTABLE" | "FLAGGED" | "UNCERTAIN" | "UNAVAILABLE";
  version: string;
  reasons: string[];
};

const VERSION = "local-privacy-baseline-v1";
const unsafePatterns = [
  { pattern: /https?:\/\/|www\./iu, reason: "EXTERNAL_LINK" },
  { pattern: /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu, reason: "PERSONAL_CONTACT" },
  { pattern: /(?:\+?962|0)7\d{8}\b/u, reason: "PERSONAL_CONTACT" },
  { pattern: /\b(?:buy now|promo code|whatsapp me)\b/iu, reason: "SPAM_SIGNAL" },
];

export async function classifyReview(text: string): Promise<ReviewClassification> {
  if (process.env.REVIEW_CLASSIFIER_DISABLED === "true") {
    return { outcome: "UNAVAILABLE", version: VERSION, reasons: ["CLASSIFIER_DISABLED"] };
  }
  const reasons = unsafePatterns.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => reason);
  if (reasons.length) return { outcome: "FLAGGED", version: VERSION, reasons };
  if (text.trim().length < 20) return { outcome: "UNCERTAIN", version: VERSION, reasons: ["INSUFFICIENT_CONTEXT"] };
  return { outcome: "ACCEPTABLE", version: VERSION, reasons: [] };
}

export function levenshteinDistance(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}
