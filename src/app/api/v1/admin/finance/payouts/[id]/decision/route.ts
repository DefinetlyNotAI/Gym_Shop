import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { decidePayout } from "@/lib/payouts/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "payouts.review");
    const { id } = await params;
    return apiSuccess(await decidePayout(actor.id, id, await request.json()));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "PAYOUT_DECISION_FAILED", message: "The payout decision could not be applied." });
  }
}
