import { apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export function GET() {
  return apiSuccess({ status: "ok", service: "gym-shop-api", version: "0.2.0" });
}
