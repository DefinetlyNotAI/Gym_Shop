import { describe, expect, it } from "vitest";
import { customizeReferralCode, setCheckoutReferral } from "./service";

describe("referral code validation", () => {
  it("rejects unsupported and undersized codes before persistence", async () => {
    await expect(setCheckoutReferral("account", { code: "bad code", source: "MANUAL" })).rejects.toThrow("REFERRAL_CODE_INVALID");
    await expect(customizeReferralCode("account", "tiny")).rejects.toThrow("REFERRAL_CODE_INVALID");
  });
});
