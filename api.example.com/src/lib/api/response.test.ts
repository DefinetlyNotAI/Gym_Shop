import { describe, expect, it } from "vitest";
import { apiError } from "@/lib/api/response";

describe("API error envelopes", () => {
  it("includes one safe diagnostic reference in the body and response header", async () => {
    const response = apiError(422, {
      code: "VALIDATION_ERROR",
      message: "Review the submitted fields.",
    });
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.reference).toMatch(/^err_[0-9a-f]{32}$/);
    expect(response.headers.get("x-error-reference")).toBe(
      payload.error.reference,
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
