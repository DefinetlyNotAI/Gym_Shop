import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { listDriverAssignments } from "@/lib/commerce/fulfillment";
import { driverCashPosition } from "@/lib/finance/service";

export async function GET() {
  const actor = await getCurrentAccount();
  if (!actor || actor.role !== "DELIVERY_AGENT") {
    return apiError(403, {
      code: "PERMISSION_DENIED",
      message: "Permission denied.",
    });
  }
  const [assignments, cashPosition] = await Promise.all([
    listDriverAssignments(actor.id),
    driverCashPosition(actor.id),
  ]);
  return apiSuccess({ assignments, cashPosition });
}
