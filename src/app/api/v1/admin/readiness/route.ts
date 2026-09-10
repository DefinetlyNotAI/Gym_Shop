import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient } from "@/lib/db/client";
import { recordRecoveryDrill } from "@/lib/platform/release-evidence";
import { launchBlockers } from "@/lib/platform/release-readiness";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET() { try { await requirePermission(await getCurrentAccount(), "settings.manage"); const blockers = await withDatabaseClient(launchBlockers); return apiSuccess({ ready: blockers.length === 0, blockers }); } catch (error) { return apiError(403, { code: error instanceof Error ? error.message : "PERMISSION_DENIED", message: "Readiness details are unavailable." }); } }
export async function POST(request: Request) { try { requireTrustedMutation(request); const actor = await requirePermission(await getCurrentAccount(), "settings.manage"); return apiSuccess(await recordRecoveryDrill(actor.id, await request.json()), { status: 201 }); } catch (error) { return apiError(422, { code: error instanceof Error ? error.message : "EVIDENCE_INVALID", message: "Recovery-drill evidence could not be recorded." }); } }
