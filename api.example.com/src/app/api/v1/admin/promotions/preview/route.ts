import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/authorization";
import { quoteSelectedCart } from "@/lib/commerce/orders";
import { requireTrustedMutation } from "@/lib/security/request";

const previewInput = z.object({
  accountId: z.string().uuid(),
  deliveryZoneId: z.string().uuid(),
  couponCode: z.string().trim().min(3).max(64).optional(),
});

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    await requirePermission(await getCurrentAccount(), "promotions.manage");
    const input = previewInput.parse(await request.json());
    const quote = await quoteSelectedCart(input.accountId, input.deliveryZoneId, { couponCode: input.couponCode });
    return apiSuccess({ ...quote, preview: true, mutatedCounters: false });
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "PROMOTION_PREVIEW_FAILED",
      message: "The promotion preview could not be calculated.",
    });
  }
}
