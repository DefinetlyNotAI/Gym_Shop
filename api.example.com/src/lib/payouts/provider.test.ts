import { describe, expect, it } from "vitest";
import { parseRuntimeConfig } from "@/lib/config/env";
import {
  executePayoutProvider,
  getPayoutProviderStatus,
} from "./provider";

const localSimulation = parseRuntimeConfig({
  APP_ENV: "test",
  SIM_MODE: "1",
});

describe("payout provider proof of concept", () => {
  it("exposes a clearly labelled provider only in explicit simulation mode", () => {
    expect(getPayoutProviderStatus(localSimulation)).toMatchObject({
      name: "Amazon Payment Services",
      available: true,
      mode: "SIMULATION",
      code: "PAYOUT_PROVIDER_SIMULATION",
    });

    expect(
      getPayoutProviderStatus(parseRuntimeConfig({ APP_ENV: "local", SIM_MODE: "0" })),
    ).toMatchObject({
      available: false,
      mode: "UNAVAILABLE",
      code: "PAYOUT_PROVIDER_UNAVAILABLE",
    });
  });

  it.each(["COMPLETED", "FAILED", "UNKNOWN"] as const)(
    "returns deterministic %s simulation evidence without an external request",
    async (outcome) => {
      await expect(
        executePayoutProvider(
          {
            publicId: "pay_simulation_contract",
            amountFils: 12_500,
            destinationAlias: "bank-••42",
            simulationOutcome: outcome,
          },
          localSimulation,
        ),
      ).resolves.toEqual({
        reference: "sim_payout_pay_simulation_contract",
        status: outcome,
        evidence: {
          source: "simulation",
          amountFils: 12_500,
          destinationAlias: "bank-••42",
          outcome,
        },
      });
    },
  );

  it("refuses execution when simulation is not explicitly enabled", async () => {
    await expect(
      executePayoutProvider(
        {
          publicId: "pay_no_provider",
          amountFils: 1_000,
          destinationAlias: "bank-••42",
          simulationOutcome: "COMPLETED",
        },
        parseRuntimeConfig({ APP_ENV: "local", SIM_MODE: "0" }),
      ),
    ).rejects.toThrow("PAYOUT_PROVIDER_UNAVAILABLE");
  });
});
