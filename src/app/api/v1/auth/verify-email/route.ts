import { apiError, apiSuccess } from "@/lib/api/response";
import { resendEmailVerification, verifyEmailToken } from "@/lib/auth/service";
import { requireTrustedMutation } from "@/lib/security/request";
import { checkRateLimit, requestRateKey } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const { token,email } = await request.json();
    if(!token){await checkRateLimit("email-verification-resend",requestRateKey(request,String(email)),3,3600);return apiSuccess(await resendEmailVerification(String(email)),{status:202});}
    await verifyEmailToken(token);
    return apiSuccess({ verified: true });
  } catch {
    return apiError(400, { code: "TOKEN_INVALID", message: "The verification link is invalid or expired." });
  }
}
