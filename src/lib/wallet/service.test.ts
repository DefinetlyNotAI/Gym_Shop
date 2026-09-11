import { describe, expect, it } from "vitest";
import { convertPoints } from "./service";

describe("wallet conversion validation", () => {
  it("rejects fractional, empty, and over-quota block requests before mutation", async () => {
    await expect(convertPoints("account", { blocks: 0, idempotencyKey: "conversion-invalid-zero" })).rejects.toThrow("POINT_CONVERSION_BLOCKS_INVALID");
    await expect(convertPoints("account", { blocks: 1.5, idempotencyKey: "conversion-invalid-fraction" })).rejects.toThrow("POINT_CONVERSION_BLOCKS_INVALID");
    await expect(convertPoints("account", { blocks: 6, idempotencyKey: "conversion-invalid-limit" })).rejects.toThrow("POINT_CONVERSION_WEEKLY_LIMIT");
  });
});
