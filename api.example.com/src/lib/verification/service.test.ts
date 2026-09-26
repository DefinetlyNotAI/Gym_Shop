import { describe, expect, it } from "vitest";
import { submitVerification } from "./service";

describe("verification input", () => {
  it("rejects incomplete evidence before opening a database transaction", async () => {
    await expect(submitVerification("not-used", {
      publicName: "P",
      reason: "short",
      platforms: [],
      evidenceMediaIds: [],
    })).rejects.toThrow();
  });
});
