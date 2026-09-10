import { z } from "zod";
import { appendAudit } from "@/lib/audit/service";
import { withTransaction } from "@/lib/db/client";

const inputSchema = z.object({ result: z.enum(["PASSED", "FAILED"]), notes: z.string().trim().min(10).max(2000) });

export async function recordRecoveryDrill(actorId: string, raw: unknown) {
  const input = inputSchema.parse(raw);
  return withTransaction(async (client) => {
    const actor = await client.query("SELECT 1 FROM staff_account WHERE account_id=$1 AND role_id='CTO' AND status='ACTIVE'", [actorId]);
    if (!actor.rowCount) throw new Error("CTO_REQUIRED");
    const evidence = await client.query<{ id: string }>("INSERT INTO release_evidence(release_version,evidence_type,result,actor_id,notes) VALUES('v0.1','CTO_RECOVERY_DRILL',$1,$2,$3) RETURNING id", [input.result, actorId, input.notes]);
    await appendAudit(client, { actorId, actorRole: "CTO", action: "release.recovery_drill.recorded", targetType: "release_evidence", targetId: evidence.rows[0].id, domain: "security", sensitive: true, result: input.result === "PASSED" ? "SUCCESS" : "FAILED", reason: input.notes });
    return { evidenceId: evidence.rows[0].id, ...input };
  });
}
