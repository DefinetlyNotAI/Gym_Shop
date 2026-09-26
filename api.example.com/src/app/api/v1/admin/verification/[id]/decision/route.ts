import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { decideVerification, reinstateVerification } from "@/lib/verification/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "verification.review");
    const { id } = await params;
    const input = await request.json() as { decision?: string; reason?: string };
    return apiSuccess(input.decision === "REINSTATE"
      ? await reinstateVerification(actor.id, id, input.reason ?? "")
      : await decideVerification(actor.id, id, input));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "VERIFICATION_DECISION_FAILED", message: "The verification decision could not be applied." });
  }
}
