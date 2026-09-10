import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { completePickup } from "@/lib/commerce/fulfillment";
import { requireTrustedMutation } from "@/lib/security/request";

const inputSchema = z.object({ pin: z.string().regex(/^\d{6}$/), collectedFils: z.number().int().nonnegative().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "orders.fulfill");
    return apiSuccess(await completePickup((await params).publicId, actor.id, inputSchema.parse(await request.json())));
  } catch (error) {
    return apiError(409, { code: error instanceof Error ? error.message : "PICKUP_FAILED", message: "Pickup could not be completed." });
  }
}
