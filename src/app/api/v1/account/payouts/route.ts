import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { getPayoutAvailability, requestPayout } from "@/lib/payouts/service";
import { requireTrustedMutation } from "@/lib/security/request";
import { getPayoutProviderStatus } from "@/lib/payouts/provider";

export async function GET() {
  try {
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await getPayoutAvailability(account.id));
  } catch {
    return apiError(403, { code: "ACCOUNT_REQUIRED", message: "A customer account is required." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await requestPayout(account.id, await request.json()), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PAYOUT_REQUEST_FAILED";
    return apiError(code === "PAYOUT_PROVIDER_UNAVAILABLE" ? 503 : 422, { code, message: getPayoutProviderStatus().reason });
  }
}
