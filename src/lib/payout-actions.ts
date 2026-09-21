import { ApiFailure } from "@/lib/api-errors";
import { requestApi } from "@/lib/client-api";

type Requester = <T>(
  path: string,
  options: { method: "POST"; body: unknown },
) => Promise<T>;

type Decision = "APPROVE" | "REJECT" | "CANCEL";
type Outcome = "COMPLETED" | "FAILED" | "UNKNOWN";

export async function reviewPayout(
  publicId: string,
  decision: Decision,
  reason: string,
  requester: Requester = requestApi,
) {
  const response = await requester<{ publicId?: unknown; status?: unknown }>(
    `/api/v1/admin/finance/payouts/${encodeURIComponent(publicId)}/decision`,
    { method: "POST", body: { decision, reason } },
  );
  const expected =
    decision === "APPROVE"
      ? "APPROVED"
      : decision === "REJECT"
        ? "REJECTED"
        : "CANCELLED";
  if (response.publicId !== publicId || response.status !== expected) {
    throw new ApiFailure("INVALID_RESPONSE", 200);
  }
  return { publicId, status: expected };
}

export async function executeSimulatedPayout(
  publicId: string,
  simulationOutcome: Outcome,
  requester: Requester = requestApi,
) {
  const response = await requester<{
    publicId?: unknown;
    status?: unknown;
    providerReference?: unknown;
  }>(
    `/api/v1/admin/finance/payouts/${encodeURIComponent(publicId)}/execute`,
    { method: "POST", body: { simulationOutcome } },
  );
  if (
    response.publicId !== publicId ||
    response.status !== simulationOutcome ||
    typeof response.providerReference !== "string" ||
    !response.providerReference.startsWith("sim_payout_")
  ) {
    throw new ApiFailure("INVALID_RESPONSE", 200);
  }
  return {
    publicId,
    status: simulationOutcome,
    providerReference: response.providerReference,
  };
}
