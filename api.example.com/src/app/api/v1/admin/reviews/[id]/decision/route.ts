import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { moderateReview } from "@/lib/reviews/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "reviews.moderate");
    const { id } = await params;
    return apiSuccess(await moderateReview(actor.id, id, await request.json()));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REVIEW_DECISION_FAILED", message: "The moderation decision could not be applied." });
  }
}
