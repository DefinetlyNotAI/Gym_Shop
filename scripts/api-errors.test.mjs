import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile(
  new URL("../src/lib/api-errors.ts", import.meta.url),
  "utf8",
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  },
}).outputText;
const { apiErrorFromPayload, errorNotice, appendNotice, readApiData } =
  await import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );

test("phone verification failures explain the specific recovery without exposing tokens", () => {
  for (const [code, pattern] of [
    ["PHONE_INVALID", /962|Jordan/i],
    ["EMAIL_VERIFICATION_REQUIRED", /email/i],
    ["PHONE_CODE_INVALID", /latest|expired|code/i],
    ["PHONE_VERIFICATION_FAILED", /phone|verification/i],
  ]) {
    const notice = errorNotice(
      apiErrorFromPayload({ error: { code, message: "private token" } }, 409),
    );
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.doesNotMatch(JSON.stringify(notice), /private token/);
  }
});

test("profile and address failures offer specific safe recovery", () => {
  for (const [code, pattern] of [
    ["PROFILE_UPDATE_FAILED", /profile/i],
    ["ADDRESS_FAILED", /address/i],
    ["ADDRESS_NOT_FOUND", /address|saved/i],
  ]) {
    const notice = errorNotice(
      apiErrorFromPayload({ error: { code, message: "private" } }, 422),
    );
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.doesNotMatch(JSON.stringify(notice), /private/);
  }
});
test("referral and notice errors provide specific localized recovery", () => {
  for (const [code, pattern] of [
    ["VERIFICATION_REQUIRED", /partner|verification/i],
    ["REFERRAL_CODE_INVALID", /6|24|characters/i],
    ["NOTIFICATION_UPDATE_FAILED", /notification/i],
    ["PREFERENCE_INVALID", /marketing|preference/i],
    ["CURSOR_INVALID", /refresh|latest/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
  }
});
test("commerce and fulfillment codes explain the specific action to correct", () => {
  for (const [code, pattern] of [
    ["CART_UPDATE_FAILED", /cart/i],
    ["DRIVER_INVALID", /driver/i],
    ["PICKUP_PIN_INVALID", /pin/i],
    ["COLLECTION_MISMATCH", /cash|amount/i],
    ["POINT_CONVERSION_WEEKLY_LIMIT", /week/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 409));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.equal(notice.title.en.includes(code), false);
    assert.ok(notice.description.ar);
  }
});

test("damage claim decisions show specific, non-technical recovery", () => {
  for (const [code, pattern] of [
    ["CLAIM_DECISION_INVALID", /decision|reason/i],
    ["CLAIM_NOT_DECIDABLE", /decided|refresh|state/i],
    ["REPLACEMENT_STOCK_UNAVAILABLE", /stock|replacement/i],
    ["REFUND_EXCEEDS_COLLECTED", /refund|collected/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
  }
});

test("return, discrepancy and template errors show actionable guidance", () => {
  for (const [code, pattern] of [
    ["RETURN_INSPECTION_INVALID", /order|return|reason/i],
    ["RETURN_NOT_PENDING", /pending|return/i],
    ["DISCREPANCY_INVALID", /driver|amount|reference/i],
    ["TEMPLATE_INVALID", /template|event|body/i],
    ["TEMPLATE_VARIABLE_NOT_ALLOWED", /variable|placeholder/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
  }
});

test("delivery configuration errors preserve entered fields and explain correction", () => {
  for (const [code, pattern] of [
    ["ZONE_CREATE_INVALID", /zone|fee|window/i],
    ["ZONE_CREATE_FAILED", /zone|configuration/i],
    ["PICKUP_CREATE_INVALID", /pickup|address|hours/i],
    ["PICKUP_CREATE_FAILED", /pickup|location/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
  }
});

test("launch configuration errors explain the safe next action", () => {
  for (const [code, pattern] of [
    ["SETTING_UPDATE_INVALID", /setting|reason/i],
    ["SETTING_UPDATE_FAILED", /setting|current/i],
    ["STOREFRONT_ACTIVATION_BLOCKED", /requirement|readiness/i],
    ["TERMS_CREATE_INVALID", /terms|language/i],
    ["TERMS_CREATE_DENIED", /sign|permission|publish/i],
    ["EVIDENCE_INVALID", /evidence|notes|drill/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
  }
});

test("driver cash and recovery errors show actionable localized guidance", () => {
  for (const [code, pattern] of [
    ["AMOUNT_INVALID", /amount|fils/i],
    ["HANDOVER_EXCEEDS_HELD", /held|custody|cash/i],
    ["ASSIGNMENT_NOT_FOUND", /assignment|refresh/i],
    ["PIN_REQUIRED", /pin|six-digit/i],
    ["DRIVER_CASH_LIMIT", /cash|finance|handover/i],
    ["RECOVERY_SEND_COOLDOWN", /minute|wait|replacement/i],
    ["RECOVERY_SEND_LIMIT", /limit|restart|security/i],
    ["RECOVERY_EXPIRED", /expired|restart/i],
    ["RECOVERY_STEP_OUT_OF_ORDER", /step|restart/i],
    ["RECOVERY_FACTOR_UNAVAILABLE", /factor|contact/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 409));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar.length > 4);
    assert.ok(notice.description.ar.length > 8);
  }
});

test("non-JSON failures retain HTTP guidance and malformed success is not confirmed", async () => {
  for (const status of [403, 503]) {
    await assert.rejects(
      readApiData(new Response("<html>private diagnostic</html>", { status })),
      (error) =>
        error.status === status &&
        !error.message.includes("private diagnostic"),
    );
  }
  await assert.rejects(
    readApiData(new Response("not JSON", { status: 200 })),
    (error) => error.code === "INVALID_RESPONSE" && error.status === 200,
  );
  assert.deepEqual(
    await readApiData(Response.json({ data: { accepted: true } })),
    { accepted: true },
  );
});

test("closed-ticket errors offer refresh guidance without showing a raw code as the title", () => {
  const error = apiErrorFromPayload(
    {
      error: {
        code: "MESSAGE_NOT_EDITABLE",
        message: "Message could not be edited.",
      },
    },
    422,
  );
  const notice = errorNotice(error);
  assert.equal(error.code, "MESSAGE_NOT_EDITABLE");
  assert.equal(error.status, 422);
  assert.match(notice.description.en, /refresh|reopen/i);
  assert.match(notice.title.ar, /[\u0600-\u06ff]/u);
  assert.notEqual(notice.title.en, "MESSAGE_NOT_EDITABLE");
  assert.doesNotMatch(error.message, /MESSAGE_NOT_EDITABLE/);
});
test("wallet and unavailable payout errors provide truthful financial guidance", () => {
  const wallet = errorNotice(
    apiErrorFromPayload(
      { error: { code: "WALLET_BALANCE_INSUFFICIENT" } },
      422,
    ),
  );
  assert.match(wallet.description.en, /wallet|balance/i);
  const payout = errorNotice(
    apiErrorFromPayload(
      { error: { code: "PAYOUT_PROVIDER_UNAVAILABLE" } },
      503,
    ),
  );
  assert.match(payout.description.en, /unavailable|not available/i);
  assert.equal(payout.recovery, "none");
});
test("status fallbacks classify session, permission, stale state and rate limits", () => {
  for (const [status, recovery] of [
    [401, "signin"],
    [403, "none"],
    [409, "refresh"],
    [429, "wait"],
  ]) {
    const notice = errorNotice(apiErrorFromPayload(null, status));
    assert.equal(notice.recovery, recovery);
    assert.ok(notice.title.en && notice.description.ar);
  }
});
test("unknown or malicious server messages and fields never become toast text", () => {
  const notice = errorNotice(
    apiErrorFromPayload(
      {
        error: {
          code: "ODD_SERVER_CODE",
          message: "SQL password=secret customer@example.test",
          fields: { phone: ["private phone number"] },
        },
      },
      500,
    ),
  );
  assert.equal(notice.code, "ODD_SERVER_CODE");
  assert.doesNotMatch(
    JSON.stringify(notice),
    /secret|customer@example|private phone/,
  );
  const unsafe = errorNotice(
    apiErrorFromPayload({ error: { code: "<script>secret</script>" } }, 503),
  );
  assert.equal(unsafe.code, "REQUEST_FAILED");
});
test("safe API diagnostic references are preserved without accepting arbitrary text", () => {
  const safe = apiErrorFromPayload({ error: { code: "VALIDATION_ERROR", reference: "err_0123456789abcdef0123456789abcdef" } }, 422);
  assert.equal(errorNotice(safe).reference, "err_0123456789abcdef0123456789abcdef");
  const unsafe = apiErrorFromPayload({ error: { code: "VALIDATION_ERROR", reference: "customer@example.test" } }, 422);
  assert.equal(errorNotice(unsafe).reference, null);
});
test("network failures never offer automatic mutation retries", () => {
  const notice = errorNotice(
    new TypeError("Failed to fetch https://secret.test"),
  );
  assert.equal(notice.code, "NETWORK_ERROR");
  assert.match(notice.description.en, /order|payment/i);
  assert.doesNotMatch(JSON.stringify(notice), /secret.test/);
  assert.equal(notice.recovery, "none");
});
test("duplicate errors produce one notice while distinct errors remain until dismissed", () => {
  const notice = errorNotice(
    apiErrorFromPayload({ error: { code: "MESSAGE_NOT_EDITABLE" } }, 422),
  );
  let queue = appendNotice([], notice);
  queue = appendNotice(queue, notice);
  assert.equal(queue.length, 1);
  queue = appendNotice(queue, errorNotice(apiErrorFromPayload(null, 401)));
  assert.equal(queue.length, 2);
  assert.equal(queue[0].code, "MESSAGE_NOT_EDITABLE");
});
