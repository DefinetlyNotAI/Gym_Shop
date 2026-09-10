import { describe, expect, it } from "vitest";
import { requireOperational, type PlatformState } from "./state";

describe("platform operation guard", () => {
  it.each<PlatformState>([
    { kind: "maintenance", reason: "not_initialized" },
    { kind: "maintenance", reason: "disabled" },
    { kind: "maintenance", reason: "lockdown" },
    { kind: "maintenance", reason: "unavailable" },
  ])("rejects maintenance state %#", (state) => {
    expect(() => requireOperational(state)).toThrow("PLATFORM_MAINTENANCE");
  });

  it("allows initialized, unlocked operation", () => {
    expect(() => requireOperational({ kind: "operational" })).not.toThrow();
  });
});
