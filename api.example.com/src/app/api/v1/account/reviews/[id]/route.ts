import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { deleteReview, editReview } from "@/lib/reviews/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const { id } = await params;
    return apiSuccess(await editReview(account.id, id, await request.json()));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REVIEW_EDIT_FAILED", message: "The review could not be edited." });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    const { id } = await params;
    return apiSuccess(await deleteReview(account.id, id));
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REVIEW_DELETE_FAILED", message: "The review could not be deleted." });
  }
}
