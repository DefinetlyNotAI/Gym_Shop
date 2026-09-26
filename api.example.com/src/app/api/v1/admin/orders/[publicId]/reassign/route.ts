import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { reassignDelivery } from "@/lib/commerce/fulfillment";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) { try { requireTrustedMutation(request); const actor = await requirePermission(await getCurrentAccount(), "delivery.manage"); const { driverId } = z.object({ driverId: z.string().uuid() }).parse(await request.json()); return apiSuccess(await reassignDelivery((await params).publicId, driverId, actor.id)); } catch (error) { return apiError(409, { code: error instanceof Error ? error.message : "REASSIGNMENT_FAILED", message: "Delivery could not be reassigned." }); } }
