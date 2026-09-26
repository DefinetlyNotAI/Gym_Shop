import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { revokeVerification } from "@/lib/verification/service";

const input = z.object({ reason: z.string().trim().min(3).max(2_000) });

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await revokeVerification(account.id, input.parse(await request.json()).reason));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "VERIFICATION_REVOCATION_FAILED", message: "Verification could not be revoked." });
  }
}
