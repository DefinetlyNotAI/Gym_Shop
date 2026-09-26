import { describe, expect, it } from "vitest";
import { retryDelaySeconds } from "./outbox";

describe("outbox retry policy", () => {
  it("backs off exponentially and caps at one hour", () => {
    expect(retryDelaySeconds(1)).toBe(2);
    expect(retryDelaySeconds(5)).toBe(32);
    expect(retryDelaySeconds(20)).toBe(3600);
  });
});
