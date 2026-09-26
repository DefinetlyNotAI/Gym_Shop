import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { listProductReviews, submitReview } from "@/lib/reviews/service";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const query = new URL(request.url).searchParams;
    return apiSuccess(await listProductReviews(slug, {
      sort: query.get("sort") ?? undefined,
      rating: query.get("rating") ? Number(query.get("rating")) : undefined,
      fit: query.get("fit") ?? undefined,
      photos: query.get("photos") === "true",
    }));
  } catch {
    return apiError(422, { code: "REVIEWS_UNAVAILABLE", message: "Reviews could not be loaded." });
  }
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const account = requireCustomer(await getCurrentAccount());
    return apiSuccess(await submitReview(account.id, await request.json()), { status: 201 });
  } catch (error) {
    return apiError(422, { code: error instanceof Error ? error.message : "REVIEW_SUBMIT_FAILED", message: "The review could not be submitted." });
  }
}
