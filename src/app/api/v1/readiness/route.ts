import { apiError, apiSuccess } from "@/lib/api/response";
import { getRuntimeConfig } from "@/lib/config/env";
import { getPlatformState } from "@/lib/platform/state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getRuntimeConfig();
    const state = await getPlatformState();
    if (state.kind !== "operational") {
      return apiError(503, { code: "PLATFORM_NOT_READY", message: "The platform is not ready for normal operation." });
    }
    return apiSuccess({ status: "ready", environment: config.APP_ENV });
  } catch {
    return apiError(503, { code: "PLATFORM_NOT_READY", message: "The platform is not ready for normal operation." });
  }
}
