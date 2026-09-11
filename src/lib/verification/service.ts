import { z } from "zod";
import type { DatabaseClient } from "@/lib/db/client";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";

const platformInput = z.object({
  name: z.string().trim().min(1).max(80),
  url: z.string().url().max(500),
});

const applicationInput = z.object({
  publicName: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(20).max(2_000),
  platforms: z.array(platformInput).max(10).default([]),
  evidenceMediaIds: z.array(z.string().uuid()).min(1).max(5),
});

const decisionInput = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().trim().min(3).max(2_000),
});

async function assertHardenedAccount(client: DatabaseClient, accountId: string) {
  const prerequisites = await client.execute<{
    email_verified_at: string | null;
    phone_verified_at: string | null;
    has_independent_key: boolean;
    has_saved_recovery: boolean;
  }>(
    `SELECT account.email_verified_at,account.phone_verified_at,
            EXISTS(SELECT 1 FROM webauthn_credential WHERE account_id=account.id AND independent_key) AS has_independent_key,
            EXISTS(SELECT 1 FROM recovery_secret WHERE account_id=account.id AND saved_check_at IS NOT NULL AND consumed_at IS NULL) AS has_saved_recovery
     FROM account WHERE account.id=$1 FOR UPDATE`,
    [accountId],
  );
  const row = prerequisites.rows[0];
  if (!row) throw new Error("ACCOUNT_NOT_FOUND");
  if (!row.email_verified_at || !row.phone_verified_at) throw new Error("VERIFIED_CONTACTS_REQUIRED");
  if (!row.has_independent_key) throw new Error("PHISHING_RESISTANT_MFA_REQUIRED");
  if (!row.has_saved_recovery) throw new Error("SAVED_RECOVERY_SECRET_REQUIRED");
}

async function assertPrivateEvidence(client: DatabaseClient, accountId: string, mediaIds: string[]) {
  const result = await client.execute<{ count: number }>(
    `SELECT count(*)::int AS count FROM media_object
     WHERE id=ANY($1::uuid[]) AND owner_type='ACCOUNT_UPLOAD' AND owner_id=$2
       AND access_class='PRIVATE' AND scan_status='CLEAN' AND deleted_at IS NULL
       AND (verified_mime LIKE 'image/%' OR verified_mime='application/pdf')`,
    [mediaIds, accountId],
  );
  if (result.rows[0].count !== mediaIds.length) throw new Error("VERIFICATION_EVIDENCE_INVALID");
}

export async function submitVerification(accountId: string, raw: unknown) {
  const input = applicationInput.parse(raw);
  return withTransaction(async (client) => {
    await assertHardenedAccount(client, accountId);
    await assertPrivateEvidence(client, accountId, input.evidenceMediaIds);
    const latest = await client.execute<{ status: string; rejected_until: string | Date | null }>(
      "SELECT status,rejected_until FROM verification_application WHERE account_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 1 FOR UPDATE",
      [accountId],
    );
    if (["PENDING", "UNDER_REVIEW", "APPROVED"].includes(latest.rows[0]?.status ?? "")) {
      throw new Error("VERIFICATION_APPLICATION_OPEN");
    }
    if (latest.rows[0]?.status === "REJECTED" && latest.rows[0].rejected_until
      && new Date(latest.rows[0].rejected_until).getTime() > Date.now()) {
      throw new Error("VERIFICATION_REAPPLICATION_COOLDOWN");
    }
    const inserted = await client.execute<{ id: string; public_id: string }>(
      `INSERT INTO verification_application(account_id,public_name,reason,platforms,evidence_media_ids,status)
       VALUES($1,$2,$3,$4::jsonb,$5::uuid[],'PENDING') RETURNING id,public_id`,
      [accountId, input.publicName, input.reason, JSON.stringify(input.platforms), input.evidenceMediaIds],
    );
    await client.execute(
      "INSERT INTO verification_transition(application_id,to_status,action,actor_id) VALUES($1,'PENDING','SUBMITTED',$2)",
      [inserted.rows[0].id, accountId],
    );
    return { publicId: inserted.rows[0].public_id, status: "PENDING" as const };
  });
}

export async function decideVerification(actorId: string, publicId: string, raw: unknown) {
  const input = decisionInput.parse(raw);
  return withTransaction(async (client) => {
    const application = await client.execute<{ id: string; account_id: string; status: string }>(
      "SELECT id,account_id,status FROM verification_application WHERE public_id=$1 FOR UPDATE",
      [publicId],
    );
    const row = application.rows[0];
    if (!row) throw new Error("VERIFICATION_APPLICATION_NOT_FOUND");
    if (row.account_id === actorId) throw new Error("VERIFICATION_SELF_REVIEW_DENIED");
    if (!["PENDING", "UNDER_REVIEW"].includes(row.status)) throw new Error("VERIFICATION_APPLICATION_NOT_REVIEWABLE");
    if (row.status === "PENDING") {
      await client.execute(
        "INSERT INTO verification_transition(application_id,from_status,to_status,action,actor_id) VALUES($1,'PENDING','UNDER_REVIEW','REVIEW_STARTED',$2)",
        [row.id, actorId],
      );
    }
    const nextStatus = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await client.execute(
      `UPDATE verification_application SET status=$2,reviewer_id=$3,decision_reason=$4,decided_at=now(),
         rejected_until=CASE WHEN $2='REJECTED' THEN (current_date+interval '6 months')::date ELSE NULL END,updated_at=now()
       WHERE id=$1`,
      [row.id, nextStatus, actorId, input.reason],
    );
    await client.execute(
      "INSERT INTO verification_transition(application_id,from_status,to_status,action,reason,actor_id) VALUES($1,'UNDER_REVIEW',$2,$3,$4,$5)",
      [row.id, nextStatus, input.decision === "APPROVE" ? "APPROVED" : "REJECTED", input.reason, actorId],
    );
    return { publicId, status: nextStatus };
  });
}

export async function revokeVerification(accountId: string, reason: string) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3) throw new Error("REASON_REQUIRED");
  return withTransaction(async (client) => {
    const application = await client.execute<{ id: string }>(
      "SELECT id FROM verification_application WHERE account_id=$1 AND status='APPROVED' ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE",
      [accountId],
    );
    if (!application.rows[0]) throw new Error("VERIFICATION_NOT_ACTIVE");
    await client.execute(
      "UPDATE verification_application SET status='CANCELLED',decision_reason=$2,updated_at=now() WHERE id=$1",
      [application.rows[0].id, normalizedReason],
    );
    await client.execute(
      "INSERT INTO verification_transition(application_id,from_status,to_status,action,reason,actor_id) VALUES($1,'APPROVED','CANCELLED','REVOKED',$2,$3)",
      [application.rows[0].id, normalizedReason, accountId],
    );
    return { status: "CANCELLED" as const };
  });
}

export async function reinstateVerification(actorId: string, publicId: string, reason: string) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 3) throw new Error("REASON_REQUIRED");
  return withTransaction(async (client) => {
    const application = await client.execute<{ id: string; account_id: string; status: string }>(
      "SELECT id,account_id,status FROM verification_application WHERE public_id=$1 FOR UPDATE",
      [publicId],
    );
    const row = application.rows[0];
    if (!row) throw new Error("VERIFICATION_APPLICATION_NOT_FOUND");
    if (row.account_id === actorId) throw new Error("VERIFICATION_SELF_REVIEW_DENIED");
    if (row.status !== "CANCELLED") throw new Error("VERIFICATION_NOT_REINSTATABLE");
    const open = await client.execute(
      "SELECT 1 FROM verification_application WHERE account_id=$1 AND status IN('PENDING','UNDER_REVIEW','APPROVED') AND id<>$2",
      [row.account_id, row.id],
    );
    if (open.rowCount) throw new Error("VERIFICATION_APPLICATION_OPEN");
    await client.execute(
      "UPDATE verification_application SET status='APPROVED',reviewer_id=$2,decision_reason=$3,decided_at=now(),updated_at=now() WHERE id=$1",
      [row.id, actorId, normalizedReason],
    );
    await client.execute(
      "INSERT INTO verification_transition(application_id,from_status,to_status,action,reason,actor_id) VALUES($1,'CANCELLED','APPROVED','REINSTATED',$2,$3)",
      [row.id, normalizedReason, actorId],
    );
    return { publicId, status: "APPROVED" as const };
  });
}

export async function getVerificationSummary(accountId: string) {
  return withDatabaseClient(async (client) => {
    const application = await client.execute<{
      public_id: string; public_name: string; status: string; decision_reason: string | null;
      submitted_at: string | Date; decided_at: string | Date | null; rejected_until: string | Date | null;
    }>(
      `SELECT public_id,public_name,status,decision_reason,submitted_at,decided_at,rejected_until
       FROM verification_application WHERE account_id=$1 ORDER BY submitted_at DESC,id DESC LIMIT 1`,
      [accountId],
    );
    const row = application.rows[0];
    if (!row) return { status: "NOT_SUBMITTED" as const, verified: false, application: null, history: [] };
    const history = await client.execute(
      `SELECT transition.from_status,transition.to_status,transition.action,transition.reason,transition.created_at
       FROM verification_transition AS transition
       JOIN verification_application AS application ON application.id=transition.application_id
       WHERE application.account_id=$1 ORDER BY transition.created_at DESC,transition.id DESC LIMIT 100`,
      [accountId],
    );
    return { status: row.status, verified: row.status === "APPROVED", application: row, history: history.rows };
  });
}

export async function listVerificationQueue(status?: string) {
  return withDatabaseClient(async (client) => {
    const filter = status?.trim() || null;
    const applications = await client.execute(
      `SELECT application.public_id,application.public_name,application.reason,application.platforms,
              application.evidence_media_ids,application.status,application.submitted_at,application.decided_at,
              application.rejected_until,application.decision_reason,account.public_id AS account_public_id,
              reviewer.public_id AS reviewer_public_id
       FROM verification_application AS application
       JOIN account ON account.id=application.account_id
       LEFT JOIN account AS reviewer ON reviewer.id=application.reviewer_id
       WHERE $1::text IS NULL OR application.status=$1
       ORDER BY CASE application.status WHEN 'UNDER_REVIEW' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END,application.submitted_at ASC
       LIMIT 200`,
      [filter],
    );
    return { applications: applications.rows };
  });
}
