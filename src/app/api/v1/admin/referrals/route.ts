import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { disableReferralCode, invalidateReferralReward, listReferralOperations } from "@/lib/referrals/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET(request: Request) {
  try {
    await requirePermission(await getCurrentAccount(), "referrals.manage");
    return apiSuccess(await listReferralOperations(new URL(request.url).searchParams.get("search") ?? undefined));
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Referral access is denied." });
  }
}

export async function PATCH(request: Request) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "referrals.manage");
    const body = await request.json() as { action?: "DISABLE_CODE" | "INVALIDATE_REWARD"; codeId?: string; rewardId?: string; reason?: string };
    if (body.action === "INVALIDATE_REWARD") {
      return apiSuccess(await invalidateReferralReward(actor.id, body.rewardId ?? "", body.reason ?? ""));
    }
    return apiSuccess(await disableReferralCode(actor.id, body.codeId ?? "", body.reason ?? ""));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REFERRAL_OPERATION_FAILED", message: "The referral operation could not be completed." });
  }
}
