import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { duplicateCampaign } from "@/lib/pricing/admin";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "promotions.manage");
    const { id } = await params;
    return apiSuccess(await duplicateCampaign(actor.id, id, await request.json()), { status: 201 });
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "CAMPAIGN_DUPLICATE_FAILED",
      message: "The campaign could not be duplicated.",
    });
  }
}
