import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { updateCampaignLifecycle } from "@/lib/pricing/admin";
import { requireTrustedMutation } from "@/lib/security/request";

const lifecycleInput = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "ARCHIVED"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "promotions.manage");
    const { id } = await params;
    const input = lifecycleInput.parse(await request.json());
    return apiSuccess(await updateCampaignLifecycle(actor.id, id, input.status));
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "CAMPAIGN_LIFECYCLE_FAILED",
      message: "The campaign status could not be changed.",
    });
  }
}
