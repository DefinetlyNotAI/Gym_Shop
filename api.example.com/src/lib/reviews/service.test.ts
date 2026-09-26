import { describe, expect, it } from "vitest";
import { classifyReview, levenshteinDistance } from "./classifier";

describe("review classifier", () => {
  it("publishes contextual clean text and flags privacy or spam signals", async () => {
    await expect(classifyReview("The stitching stayed strong through several training sessions.")).resolves.toMatchObject({ outcome: "ACCEPTABLE" });
    await expect(classifyReview("WhatsApp me at +962790000000 for a promo code")).resolves.toMatchObject({ outcome: "FLAGGED" });
    await expect(classifyReview("Good bench")).resolves.toMatchObject({ outcome: "UNCERTAIN" });
  });

  it("calculates deterministic Unicode character edit distance", () => {
    expect(levenshteinDistance("bench", "branch")).toBe(2);
    expect(levenshteinDistance("قوي", "قوية")).toBe(1);
  });
});
