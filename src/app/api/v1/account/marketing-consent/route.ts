import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireCustomer } from "@/lib/auth/authorization";
import { getCurrentAccount } from "@/lib/auth/session";
import { withDatabaseClient } from "@/lib/db/client";
import { requireTrustedMutation } from "@/lib/security/request";

export async function GET() { try { const account = requireCustomer(await getCurrentAccount()); const consent = await withDatabaseClient(async (client) => (await client.query<{ granted: boolean; occurred_at: Date }>("SELECT granted,occurred_at FROM consent_event WHERE account_id=$1 AND purpose='MARKETING_EMAIL' ORDER BY occurred_at DESC LIMIT 1", [account.id])).rows[0] ?? null); return apiSuccess({ consent }); } catch { return apiError(401, { code: "AUTH_REQUIRED", message: "Authentication is required." }); } }
export async function POST(request: Request) { try { requireTrustedMutation(request); const account = requireCustomer(await getCurrentAccount()); const granted = z.object({ granted: z.boolean() }).parse(await request.json()).granted; await withDatabaseClient((client) => client.query("INSERT INTO consent_event(account_id,purpose,channel,granted,affirmative_action) VALUES($1,'MARKETING_EMAIL','EMAIL',$2,$3)", [account.id, granted, granted ? "homepage_opt_in_v0.1" : "account_withdrawal_v0.1"]).then(() => undefined)); return apiSuccess({ granted }); } catch (error) { return apiError(422, { code: error instanceof Error ? error.message : "CONSENT_UPDATE_FAILED", message: "Consent could not be updated." }); } }
