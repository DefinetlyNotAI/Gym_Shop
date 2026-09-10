import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { registerAccount } from "@/lib/auth/service";
import { requireTrustedMutation } from "@/lib/security/request";
import { checkRateLimit, requestRateKey } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const body=await request.json();
    await checkRateLimit("registration",requestRateKey(request,String(body.email)),5,3600);
    return apiSuccess(await registerAccount(body), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return apiError(422, { code: "VALIDATION_ERROR", message: "Invalid registration data.", fields: error.flatten().fieldErrors as Record<string,string[]> });
    if (error instanceof Error && error.message === "TERMS_VERSION_INVALID") return apiError(409, { code: error.message, message: "The selected terms are not available." });
    return apiError(409, { code: "REGISTRATION_FAILED", message: "Registration could not be completed." });
  }
}
