import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { listPayoutOperations } from "@/lib/payouts/service";

export async function GET(request: Request) {
  try {
    await requirePermission(await getCurrentAccount(), "payouts.review");
    return apiSuccess(await listPayoutOperations(new URL(request.url).searchParams.get("status") ?? undefined));
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Payout review access is denied." });
  }
}
