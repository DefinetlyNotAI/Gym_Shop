import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createPickupLocation, listPickupLocations } from "@/lib/admin/configuration";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";

const inputSchema = z.object({
  nameEn: z.string().min(2),
  nameAr: z.string().min(2),
  address: z.record(z.string(), z.unknown()),
  hours: z.record(z.string(), z.unknown()),
});

export async function GET() {
  try {
    await requirePermission(await getCurrentAccount(), "delivery.manage");
    return apiSuccess({ pickups: await listPickupLocations() });
  } catch {
    return apiError(403, { code: "PERMISSION_DENIED", message: "Permission denied." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "delivery.manage");
    return apiSuccess(await createPickupLocation(inputSchema.parse(await request.json()), actor.id), { status: 201 });
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "PICKUP_CREATE_FAILED", message: "Pickup location could not be created." });
  }
}
