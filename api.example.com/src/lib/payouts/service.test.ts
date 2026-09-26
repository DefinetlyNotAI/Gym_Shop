import { describe, expect, it } from "vitest";
import { getPayoutProviderStatus } from "./provider";
import { requestPayout } from "./service";

describe("payout provider gate", () => {
  it("is explicit and rejects before touching storage", async () => {
    expect(getPayoutProviderStatus()).toMatchObject({ available: false, code: "PAYOUT_PROVIDER_UNAVAILABLE" });
    await expect(requestPayout("not-used", {
      destinationId: "00000000-0000-4000-8000-000000000001",
      amountFils: 1_000,
      idempotencyKey: "provider-gate-test",
    })).rejects.toThrow("PAYOUT_PROVIDER_UNAVAILABLE");
  });
});
