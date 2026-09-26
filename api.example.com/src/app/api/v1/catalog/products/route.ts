import { ZodError } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentAccount } from "@/lib/auth/session";
import { requirePermission } from "@/lib/auth/authorization";
import { createProduct, listProducts } from "@/lib/commerce/catalog";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams.get("q") ?? "";
  return apiSuccess({ products: await listProducts(search) });
}

export async function POST(request: Request) {
  try {
    requireTrustedMutation(request);
    const actor = await requirePermission(await getCurrentAccount(), "catalog.write");
    return apiSuccess(await createProduct(await request.json(), actor.id), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return apiError(422,{code:"VALIDATION_ERROR",message:"Product data is invalid."});
    return apiError(403,{code:"PRODUCT_CREATE_DENIED",message:"The product could not be created."});
  }
}
