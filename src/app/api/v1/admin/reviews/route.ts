import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { listModerationQueue } from "@/lib/reviews/service";

export async function GET(request: Request) {
  try {
    await requirePermission(await getCurrentAccount(), "reviews.moderate");
    return apiSuccess(await listModerationQueue(new URL(request.url).searchParams.get("status") ?? undefined));
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Review moderation access is denied." });
  }
}
