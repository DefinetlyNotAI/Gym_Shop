import type { DatabaseClient } from "@/lib/db/client";

export async function appendAudit(
  client: DatabaseClient,
  input: {
    actorId?: string;
    actorRole?: string;
    action: string;
    targetType: string;
    targetId: string;
    domain: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    result?: string;
    sensitive?: boolean;
    requestContext?: Record<string, unknown>;
  },
): Promise<void> {
  await client.execute(
    `INSERT INTO audit_event
      (actor_id, actor_role, action, target_type, target_id, domain, before_value,
       after_value, reason, result, sensitive, request_context)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb)`,
    [
      input.actorId ?? null, input.actorRole ?? null, input.action, input.targetType, input.targetId,
      input.domain, JSON.stringify(input.before ?? null), JSON.stringify(input.after ?? null),
      input.reason ?? null, input.result ?? "SUCCESS", input.sensitive ?? false,
      JSON.stringify(input.requestContext ?? {}),
    ],
  );
}
