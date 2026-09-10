import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { acceptDeliveryCustody } from "@/lib/commerce/fulfillment";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) { try { requireTrustedMutation(request); const driver = await requirePermission(await getCurrentAccount(), "delivery.own"); return apiSuccess(await acceptDeliveryCustody((await params).publicId, driver.id)); } catch (error) { return apiError(409, { code: error instanceof Error ? error.message : "CUSTODY_ACCEPT_FAILED", message: "Custody could not be accepted." }); } }
