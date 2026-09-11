import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { listVerificationQueue } from "@/lib/verification/service";

export async function GET(request: Request) {
  try {
    await requirePermission(await getCurrentAccount(), "verification.review");
    return apiSuccess(await listVerificationQueue(new URL(request.url).searchParams.get("status") ?? undefined));
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Verification review access is denied." });
  }
}
