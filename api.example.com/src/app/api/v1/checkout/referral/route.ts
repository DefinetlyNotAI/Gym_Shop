import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { removeCheckoutReferral, setCheckoutReferral } from "@/lib/referrals/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const body = await request.json() as { code?: string; source?: "LINK" | "MANUAL" };
    return apiSuccess(await setCheckoutReferral(account.id, { code: body.code ?? "", source: body.source ?? "MANUAL" }));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REFERRAL_ATTRIBUTION_FAILED", message: "The referral code could not be applied. Remove an existing referral before replacing it." });
  }
}

export async function DELETE(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await removeCheckoutReferral(account.id));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REFERRAL_REMOVE_FAILED", message: "The referral code could not be removed." });
  }
}
