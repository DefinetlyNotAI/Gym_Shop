import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { getWalletSummary } from "@/lib/wallet/service";

export async function GET() {
  try {
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await getWalletSummary(account.id));
  } catch {
    return apiError(403, { code: "ACCOUNT_REQUIRED", message: "A customer account is required." });
  }
}
