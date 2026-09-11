import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { customizeReferralCode, getReferralSummary } from "@/lib/referrals/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET() {
  try {
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await getReferralSummary(account.id));
  } catch {
    return apiError(403, { code: "ACCOUNT_REQUIRED", message: "A customer account is required." });
  }
}

export async function PATCH(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const body = await request.json() as { code?: string };
    return apiSuccess(await customizeReferralCode(account.id, body.code ?? ""));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REFERRAL_CODE_UPDATE_FAILED", message: "The referral code could not be updated." });
  }
}
