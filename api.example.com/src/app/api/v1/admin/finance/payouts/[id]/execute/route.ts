import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { executePayout } from "@/lib/payouts/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(
      await getCurrentAccount(),
      "payouts.review",
    );
    const { id } = await params;
    return apiSuccess(
      await executePayout(actor.id, id, await request.json()),
    );
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : "";
    const code = /^[A-Z][A-Z0-9_]+$/.test(rawCode)
      ? rawCode
      : "PAYOUT_EXECUTION_INVALID";
    return apiError(code === "PAYOUT_PROVIDER_UNAVAILABLE" ? 503 : 422, {
      code,
      message: "The simulated payout execution could not be applied.",
    });
  }
}
