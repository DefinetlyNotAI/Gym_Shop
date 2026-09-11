import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { voteHelpful } from "@/lib/reviews/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const { id } = await params;
    return apiSuccess(await voteHelpful(account.id, id));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REVIEW_VOTE_FAILED", message: "The helpful vote could not be changed." });
  }
}
