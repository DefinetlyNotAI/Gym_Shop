import { apiError, apiSuccess } from "@/lib/api/response";
import { getRuntimeConfig } from "@/lib/config/env";
import { getPlatformState } from "@/lib/platform/state";
import { withDatabaseClient } from "@/lib/db/client";
import { v02ReleaseReadiness } from "@/lib/platform/release-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getRuntimeConfig();
    const state = await getPlatformState();
    if (state.kind !== "operational") {
      return apiError(503, { code: "PLATFORM_NOT_READY", message: "The platform is not ready for normal operation." });
    }
    const v02 = await withDatabaseClient(v02ReleaseReadiness);
    return apiSuccess({ status: "ready", environment: config.APP_ENV, releases: { v01StoreEnabled: true, v02 } });
  } catch {
    return apiError(503, { code: "PLATFORM_NOT_READY", message: "The platform is not ready for normal operation." });
  }
}
