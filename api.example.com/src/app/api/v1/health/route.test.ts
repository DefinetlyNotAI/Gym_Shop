import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/health/route";

describe("health route", () => {
  it("reports the v0.2 release contract", async () => {
    const response = GET();
    await expect(response.json()).resolves.toEqual({
      data: { status: "ok", service: "gym-shop-api", version: "0.2.0" },
    });
  });
});
