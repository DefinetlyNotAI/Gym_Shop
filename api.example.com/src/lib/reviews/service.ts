import { z } from "zod";
import type { DatabaseClient } from "@/lib/db/client";
import { withDatabaseClient, withTransaction } from "@/lib/db/client";
import { creditPoints } from "@/lib/wallet/service";
import { classifyReview, levenshteinDistance } from "./classifier";

const contentInput = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(5_000),
  fit: z.enum(["SMALL", "TRUE", "LARGE"]).optional(),
  qualityRating: z.number().int().min(1).max(5).optional(),
  comfortRating: z.number().int().min(1).max(5).optional(),
  mediaIds: z.array(z.string().uuid()).max(5).default([]),
});

const submitInput = contentInput.extend({ orderLineId: z.string().uuid() });

async function validateReviewMedia(client: DatabaseClient, accountId: string, mediaIds: string[]) {
  if (!mediaIds.length) return;
  const media = await client.execute<{ count: number }>(
    `SELECT count(*)::int AS count FROM media_object
     WHERE id=ANY($1::uuid[]) AND owner_type='ACCOUNT_UPLOAD' AND owner_id=$2
       AND access_class='PRIVATE' AND scan_status='CLEAN' AND verified_mime LIKE 'image/%' AND deleted_at IS NULL`,
    [mediaIds, accountId],
  );
  if (media.rows[0].count !== mediaIds.length) throw new Error("REVIEW_MEDIA_INVALID");
}

async function grantWeeklyReviewReward(client: DatabaseClient, accountId: string, reviewId: string) {
  await client.execute("SELECT 1 FROM account WHERE id=$1 FOR UPDATE", [accountId]);
  const reward = await client.execute<{ id: string }>(
    `INSERT INTO review_weekly_reward(account_id,week_start,review_id,milli_points)
     VALUES($1,date_trunc('week',now() AT TIME ZONE 'Asia/Amman')::date,$2,10000)
     ON CONFLICT(account_id,week_start) DO NOTHING RETURNING id`,
    [accountId, reviewId],
  );
  if (!reward.rows[0]) return false;
  await creditPoints(client, {
    accountId,
    milliPoints: 10_000,
    sourceType: "REVIEW",
    sourceId: reward.rows[0].id,
    operationKey: `points:review:${reward.rows[0].id}`,
  });
  return true;
}

export async function submitReview(accountId: string, raw: unknown) {
  const input = submitInput.parse(raw);
  const classification = await classifyReview(input.body);
  return withTransaction(async (client) => {
    const eligible = await client.execute<{ order_id: string; product_id: string; variant_id: string }>(
      `SELECT line.order_id,line.product_id,line.variant_id FROM order_line AS line
       JOIN shop_order AS orders ON orders.id=line.order_id
       WHERE line.id=$1 AND orders.account_id=$2 AND orders.status='COMPLETED' AND orders.fulfillment_status='DELIVERED'
         AND orders.delivered_at<=now()-interval '1 day' FOR SHARE OF line,orders`,
      [input.orderLineId, accountId],
    );
    if (!eligible.rows[0]) throw new Error("REVIEW_NOT_ELIGIBLE");
    await validateReviewMedia(client, accountId, input.mediaIds);
    const existing = await client.execute(
      "SELECT 1 FROM product_review WHERE order_id=$1 AND product_id=$2",
      [eligible.rows[0].order_id, eligible.rows[0].product_id],
    );
    if (existing.rowCount) throw new Error("REVIEW_ALREADY_EXISTS");
    const status = classification.outcome === "ACCEPTABLE" ? "PUBLISHED" : "PENDING";
    const review = await client.execute<{ id: string; public_id: string }>(
      `INSERT INTO product_review(account_id,order_id,order_line_id,product_id,variant_id,status)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING id,public_id`,
      [accountId, eligible.rows[0].order_id, input.orderLineId, eligible.rows[0].product_id, eligible.rows[0].variant_id, status],
    );
    await client.execute(
      `INSERT INTO review_version(review_id,version,rating,body,fit,quality_rating,comfort_rating,media_ids,classifier_outcome,classifier_version,classifier_reasons)
       VALUES($1,1,$2,$3,$4,$5,$6,$7::uuid[],$8,$9,$10::jsonb)`,
      [review.rows[0].id, input.rating, input.body, input.fit ?? null, input.qualityRating ?? null,
        input.comfortRating ?? null, input.mediaIds, classification.outcome, classification.version, JSON.stringify(classification.reasons)],
    );
    const weeklyRewardGranted = await grantWeeklyReviewReward(client, accountId, review.rows[0].id);
    return { publicId: review.rows[0].public_id, status, version: 1, approvedBadge: false, weeklyRewardGranted, classification };
  });
}

export async function editReview(accountId: string, publicId: string, raw: unknown) {
  const input = contentInput.parse(raw);
  const classification = await classifyReview(input.body);
  return withTransaction(async (client) => {
    const current = await client.execute<{
      id: string; current_version: number; created_at: string | Date; edited_at: string | Date | null; body: string;
    }>(
      `SELECT review.id,review.current_version,review.created_at,review.edited_at,version.body
       FROM product_review AS review JOIN review_version AS version ON version.review_id=review.id AND version.version=review.current_version
       WHERE review.public_id=$1 AND review.account_id=$2 AND review.deleted_at IS NULL FOR UPDATE OF review`,
      [publicId, accountId],
    );
    const review = current.rows[0];
    if (!review) throw new Error("REVIEW_NOT_FOUND");
    const lastChange = new Date(review.edited_at ?? review.created_at).getTime();
    if (Date.now() - lastChange < 86_400_000) throw new Error("REVIEW_EDIT_COOLDOWN");
    await validateReviewMedia(client, accountId, input.mediaIds);
    const changes = levenshteinDistance(review.body.normalize(), input.body.normalize());
    const percent = changes / Math.max(1, review.body.length) * 100;
    const forceManual = changes > 20 && percent > 5;
    const status = classification.outcome === "ACCEPTABLE" && !forceManual ? "PUBLISHED" : "PENDING";
    const version = review.current_version + 1;
    await client.execute(
      `INSERT INTO review_version(review_id,version,rating,body,fit,quality_rating,comfort_rating,media_ids,classifier_outcome,classifier_version,classifier_reasons,change_characters,change_percent,approved_badge)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::uuid[],$9,$10,$11::jsonb,$12,$13,false)`,
      [review.id, version, input.rating, input.body, input.fit ?? null, input.qualityRating ?? null,
        input.comfortRating ?? null, input.mediaIds, classification.outcome, classification.version,
        JSON.stringify(classification.reasons), changes, percent],
    );
    await client.execute("UPDATE product_review SET current_version=$2,status=$3,edited_at=now() WHERE id=$1", [review.id, version, status]);
    return { publicId, version, status, approvedBadge: false, changeCharacters: changes, changePercent: percent, classification };
  });
}

export async function deleteReview(accountId: string, publicId: string) {
  return withTransaction(async (client) => {
    const review = await client.execute<{ id: string; current_version: number }>(
      "UPDATE product_review SET status='HIDDEN',deleted_at=now() WHERE public_id=$1 AND account_id=$2 AND deleted_at IS NULL RETURNING id,current_version",
      [publicId, accountId],
    );
    if (!review.rows[0]) throw new Error("REVIEW_NOT_FOUND");
    await client.execute(
      "INSERT INTO review_moderation(review_id,version,decision,reason,actor_id) VALUES($1,$2,'CUSTOMER_DELETE','Deleted by author',$3)",
      [review.rows[0].id, review.rows[0].current_version, accountId],
    );
    return { deleted: true };
  });
}

export async function moderateReview(actorId: string, publicId: string, raw: unknown) {
  const input = z.object({ decision: z.enum(["APPROVE", "REJECT", "HIDE"]), reason: z.string().trim().min(3).max(1_000) }).parse(raw);
  return withTransaction(async (client) => {
    const review = await client.execute<{ id: string; current_version: number }>(
      "SELECT id,current_version FROM product_review WHERE public_id=$1 FOR UPDATE",
      [publicId],
    );
    if (!review.rows[0]) throw new Error("REVIEW_NOT_FOUND");
    const status = input.decision === "APPROVE" ? "PUBLISHED" : input.decision === "REJECT" ? "REJECTED" : "HIDDEN";
    await client.execute("UPDATE product_review SET status=$2 WHERE id=$1", [review.rows[0].id, status]);
    if (input.decision === "APPROVE") {
      await client.execute("UPDATE review_version SET approved_badge=true WHERE review_id=$1 AND version=$2", [review.rows[0].id, review.rows[0].current_version]);
    }
    await client.execute(
      "INSERT INTO review_moderation(review_id,version,decision,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
      [review.rows[0].id, review.rows[0].current_version, input.decision, input.reason, actorId],
    );
    return { publicId, status, version: review.rows[0].current_version };
  });
}

export async function voteHelpful(accountId: string, publicId: string) {
  return withTransaction(async (client) => {
    const review = await client.execute<{ id: string; account_id: string }>(
      "SELECT id,account_id FROM product_review WHERE public_id=$1 AND status='PUBLISHED' FOR SHARE",
      [publicId],
    );
    if (!review.rows[0]) throw new Error("REVIEW_NOT_FOUND");
    if (review.rows[0].account_id === accountId) throw new Error("REVIEW_SELF_VOTE_DENIED");
    const removed = await client.execute("DELETE FROM review_vote WHERE review_id=$1 AND account_id=$2", [review.rows[0].id, accountId]);
    let helpful = false;
    if (!removed.rowCount) {
      await client.execute("INSERT INTO review_vote(review_id,account_id) VALUES($1,$2)", [review.rows[0].id, accountId]);
      helpful = true;
    }
    const count = await client.execute<{ count: number }>("SELECT count(*)::int AS count FROM review_vote WHERE review_id=$1", [review.rows[0].id]);
    return { helpful, count: count.rows[0].count };
  });
}

export async function reportReview(accountId: string, publicId: string, raw: unknown) {
  const input = z.object({ reason: z.enum(["SPAM", "OFFENSIVE", "PERSONAL_INFO", "IRRELEVANT", "OTHER"]), details: z.string().trim().max(1_000).optional() }).parse(raw);
  return withTransaction(async (client) => {
    const review = await client.execute<{ id: string }>("SELECT id FROM product_review WHERE public_id=$1 AND status='PUBLISHED'", [publicId]);
    if (!review.rows[0]) throw new Error("REVIEW_NOT_FOUND");
    await client.execute(
      "INSERT INTO review_report(review_id,account_id,reason,details) VALUES($1,$2,$3,$4) ON CONFLICT(review_id,account_id) DO UPDATE SET reason=excluded.reason,details=excluded.details,created_at=now()",
      [review.rows[0].id, accountId, input.reason, input.details ?? null],
    );
    return { reported: true };
  });
}

export async function listProductReviews(slug: string, options: { sort?: string; rating?: number; fit?: string; photos?: boolean }) {
  return withDatabaseClient(async (client) => {
    const orderBy = options.sort === "highest" ? "version.rating DESC,review.created_at DESC"
      : options.sort === "lowest" ? "version.rating,review.created_at DESC"
        : options.sort === "helpful" ? "helpful_count DESC,review.created_at DESC" : "review.created_at DESC";
    const reviews = await client.execute<{
      publicId: string; version: number; rating: number; body: string; fit: string | null; approvedBadge: boolean;
      helpfulCount: number; verifiedPurchase: boolean; createdAt: string | Date; mediaIds: string[];
    }>(
      `SELECT review.public_id AS "publicId",review.current_version AS version,version.rating,version.body,version.fit,
              version.approved_badge AS "approvedBadge",count(vote.account_id)::int AS "helpfulCount",true AS "verifiedPurchase",
              review.created_at AS "createdAt",version.media_ids AS "mediaIds"
       FROM product_review AS review JOIN product ON product.id=review.product_id
       JOIN review_version AS version ON version.review_id=review.id AND version.version=review.current_version
       LEFT JOIN review_vote AS vote ON vote.review_id=review.id
       WHERE product.slug=$1 AND review.status='PUBLISHED' AND ($2::int IS NULL OR version.rating=$2)
         AND ($3::text IS NULL OR version.fit=$3) AND (NOT $4::boolean OR cardinality(version.media_ids)>0)
       GROUP BY review.id,version.review_id,version.version
       ORDER BY ${orderBy} LIMIT 200`,
      [slug, options.rating ?? null, options.fit ?? null, options.photos ?? false],
    );
    const distribution = await client.execute<{ rating: number; count: number }>(
      `SELECT version.rating,count(*)::int AS count FROM product_review AS review JOIN product ON product.id=review.product_id
       JOIN review_version AS version ON version.review_id=review.id AND version.version=review.current_version
       WHERE product.slug=$1 AND review.status='PUBLISHED' GROUP BY version.rating ORDER BY version.rating`,
      [slug],
    );
    const count = reviews.rowCount;
    return {
      reviews: reviews.rows,
      count,
      average: count ? reviews.rows.reduce((sum, review) => sum + review.rating, 0) / count : 0,
      distribution: distribution.rows,
    };
  });
}

export async function listReviewEligibility(accountId: string) {
  return withDatabaseClient(async (client) => {
    const awaiting = await client.execute(
      `SELECT line.id AS order_line_id,orders.public_id AS order_public_id,product.slug,product.name_en,product.name_ar,variant.sku,orders.delivered_at
       FROM order_line AS line JOIN shop_order AS orders ON orders.id=line.order_id
       JOIN product ON product.id=line.product_id JOIN product_variant AS variant ON variant.id=line.variant_id
       LEFT JOIN product_review AS review ON review.order_id=orders.id AND review.product_id=product.id
       WHERE orders.account_id=$1 AND orders.status='COMPLETED' AND orders.fulfillment_status='DELIVERED'
         AND orders.delivered_at<=now()-interval '1 day' AND review.id IS NULL ORDER BY orders.delivered_at DESC`,
      [accountId],
    );
    const reviews = await client.execute(
      `SELECT review.public_id,review.status,review.current_version,review.created_at,review.edited_at,product.name_en,product.name_ar,
              version.rating,version.body,version.approved_badge
       FROM product_review AS review JOIN product ON product.id=review.product_id
       JOIN review_version AS version ON version.review_id=review.id AND version.version=review.current_version
       WHERE review.account_id=$1 ORDER BY review.created_at DESC`,
      [accountId],
    );
    return { awaiting: awaiting.rows, reviews: reviews.rows };
  });
}

export async function listModerationQueue(status?: string) {
  return withDatabaseClient((client) => client.execute(
    `SELECT review.public_id,review.status,review.current_version,review.created_at,version.rating,version.body,
            version.classifier_outcome,version.classifier_reasons,version.change_characters,version.change_percent,
            product.name_en,product.name_ar,variant.sku,orders.public_id AS order_public_id,
            account.public_id AS account_public_id,count(report.id)::int AS report_count
     FROM product_review AS review JOIN review_version AS version ON version.review_id=review.id AND version.version=review.current_version
     JOIN product ON product.id=review.product_id JOIN product_variant AS variant ON variant.id=review.variant_id
     JOIN shop_order AS orders ON orders.id=review.order_id JOIN account ON account.id=review.account_id
     LEFT JOIN review_report AS report ON report.review_id=review.id
     WHERE $1::text IS NULL OR review.status=$1
     GROUP BY review.id,version.review_id,version.version,product.id,variant.id,orders.id,account.id
     ORDER BY (review.status='PENDING') DESC,count(report.id) DESC,review.created_at DESC LIMIT 200`,
    [status ?? null],
  ).then((result) => result.rows));
}
