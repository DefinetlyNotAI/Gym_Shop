import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/authorization";
import { createCampaign, listCampaigns } from "@/lib/pricing/admin";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET() {
  try {
    await requirePermission(await getCurrentAccount(), "promotions.manage");
    return apiSuccess(await listCampaigns());
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Promotion access is denied." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "promotions.manage");
    return apiSuccess(await createCampaign(actor.id, await request.json()), { status: 201 });
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "PROMOTION_CREATE_FAILED",
      message: "The campaign could not be created.",
    });
  }
}
