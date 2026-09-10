import { apiError, apiSuccess } from "@/lib/api/response";
import { authenticate } from "@/lib/auth/service";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";
import { checkRateLimit, requestRateKey } from "@/lib/security/rate-limit";
import { clearAnonymousCartToken, readAnonymousCartToken } from "@/lib/auth/cart-cookie";
import { mergeAnonymousCart } from "@/lib/commerce/cart";

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const { email, password } = await request.json();
    await checkRateLimit("login",requestRateKey(request,String(email)),10,900);
    const result = await authenticate(email, password);
    if(result.mfaRequired)return apiSuccess(result);
    const anonymousCart=await readAnonymousCartToken();
    const merge=anonymousCart?await mergeAnonymousCart(result.accountId,anonymousCart):{merged:0,selectionConfirmationRequired:false};
    if(anonymousCart)await clearAnonymousCartToken();
    const token = await createSession(result.accountId, { userAgent: request.headers.get("user-agent") ?? undefined });
    await setSessionCookie(token);
    return apiSuccess({ authenticated: true, cartMerge:merge });
  } catch {
    return apiError(401, { code: "INVALID_CREDENTIALS", message: "Email or password is invalid." });
  }
}
