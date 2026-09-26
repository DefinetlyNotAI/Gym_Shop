import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/authorization";
import { updatePromotionRule } from "@/lib/pricing/admin";
import { requireTrustedMutation } from "@/lib/security/request";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "promotions.manage");
    const { id } = await params;
    return apiSuccess(await updatePromotionRule(actor.id, id, await request.json()));
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "PROMOTION_UPDATE_FAILED",
      message: "The promotion could not be updated.",
    });
  }
}
