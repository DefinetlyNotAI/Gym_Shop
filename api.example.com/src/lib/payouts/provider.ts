import {
  getRuntimeConfig,
  type RuntimeConfig,
} from "@/lib/config/env";

export type PayoutProviderMode = "SIMULATION" | "UNAVAILABLE";
export type PayoutSimulationOutcome = "COMPLETED" | "FAILED" | "UNKNOWN";

const unavailableReason =
  "Amazon Payment Services is the selected payment integration. All-source wallet withdrawals remain unavailable until APS beneficiary-disbursement capability, merchant approval, API contract, tariff and sandbox evidence are verified. Card refunds and merchant settlement are not wallet payouts.";

const simulationReason =
  "Local simulation exercises the complete wallet-payout lifecycle without contacting Amazon Payment Services or moving real money. It is proof-of-concept evidence only and cannot be enabled in preview or production.";

export function getPayoutProviderStatus(
  config: RuntimeConfig = getRuntimeConfig(),
) {
  if (config.SIM_MODE) {
    return {
      name: "Amazon Payment Services",
      available: true,
      mode: "SIMULATION" as const,
      code: "PAYOUT_PROVIDER_SIMULATION",
      reason: simulationReason,
    };
  }
  return {
    name: "Amazon Payment Services",
    available: false,
    mode: "UNAVAILABLE" as const,
    code: "PAYOUT_PROVIDER_UNAVAILABLE",
    reason: unavailableReason,
  };
}

export async function executePayoutProvider(
  input: {
    publicId: string;
    amountFils: number;
    destinationAlias: string;
    simulationOutcome: PayoutSimulationOutcome;
  },
  config: RuntimeConfig = getRuntimeConfig(),
) {
  if (!config.SIM_MODE) throw new Error("PAYOUT_PROVIDER_UNAVAILABLE");
  return {
    reference: `sim_payout_${input.publicId}`,
    status: input.simulationOutcome,
    evidence: {
      source: "simulation" as const,
      amountFils: input.amountFils,
      destinationAlias: input.destinationAlias,
      outcome: input.simulationOutcome,
    },
  };
}
