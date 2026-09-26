import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { convertPoints } from "@/lib/wallet/service";

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await convertPoints(account.id, await request.json()));
  } catch (error) {
    return apiError(422, {
      code: error instanceof Error ? error.message : "POINT_CONVERSION_FAILED",
      message: "Points could not be converted.",
    });
  }
}
