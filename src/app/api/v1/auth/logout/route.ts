import { apiSuccess } from "@/lib/api/response";
import { clearSession } from "@/lib/auth/session";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request) {
  requireTrustedMutation(request);
  await clearSession();
  return apiSuccess({ authenticated: false });
}
