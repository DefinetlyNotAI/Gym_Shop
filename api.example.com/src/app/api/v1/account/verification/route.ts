import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { getVerificationSummary, submitVerification } from "@/lib/verification/service";

export async function GET() {
  try {
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await getVerificationSummary(account.id));
  } catch {
    return apiError(403, { code: "ACCOUNT_REQUIRED", message: "A customer account is required." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await submitVerification(account.id, await request.json()), { status: 201 });
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "VERIFICATION_SUBMISSION_FAILED", message: "The verification application could not be submitted." });
  }
}
