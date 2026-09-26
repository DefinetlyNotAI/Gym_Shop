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
test("account security, review and verification errors provide safe next steps", () => {
  for (const [code, pattern] of [
    ["INVALID_CREDENTIALS", /email|password|credentials/i],
    ["RESET_TOKEN_INVALID", /reset|link|token/i],
    ["SESSION_REVOKE_FAILED", /session/i],
    ["DELETION_CONFIRMATION_INVALID", /delete|confirmation/i],
    ["DELETION_REQUEST_FAILED", /deletion|account/i],
    ["REVIEW_NOT_ELIGIBLE", /review|delivery/i],
    ["REVIEW_EDIT_COOLDOWN", /day|wait|edit/i],
    ["VERIFIED_CONTACTS_REQUIRED", /email|phone/i],
    ["PHISHING_RESISTANT_MFA_REQUIRED", /security key|verification/i],
    ["SAVED_RECOVERY_SECRET_REQUIRED", /recovery/i],
    ["VERIFICATION_REAPPLICATION_COOLDOWN", /reapply|month|wait/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
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

test("damage claim failures explain eligibility, evidence and safe recovery", () => {
  for (const [code, pattern] of [
    ["CLAIM_INVALID", /claim|report|fields/i],
    ["CLAIM_NOT_ELIGIBLE", /eligible|delivered|order/i],
    ["CLAIM_WINDOW_EXPIRED", /seven|7|window/i],
    ["CLAIM_QUANTITY_EXCEEDED", /quantity/i],
    ["CLAIM_MEDIA_REQUIRED", /photo|evidence/i],
    ["MEDIA_NOT_READY", /scan|ready/i],
    ["CLAIM_NOT_DECIDABLE", /decided|refresh|state/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.equal(notice.title.en.includes(code), false);
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
  for (const [code, pattern] of [
    ["PAYOUT_AMOUNT_INVALID", /amount|greater than zero/i],
    ["PAYOUT_REQUEST_INVALID", /request|details/i],
    ["PAYOUT_DESTINATION_REQUIRED", /destination|label/i],
    ["PAYOUT_SIMULATION_DESTINATION_REQUIRED", /simulation|destination/i],
    ["PAYOUT_VERIFICATION_OR_RECENT_AUTH_REQUIRED", /verification|sign in|authentication/i],
    ["PAYOUT_DESTINATION_UNAVAILABLE", /destination|available/i],
  ]) {
    const notice = errorNotice(apiErrorFromPayload({ error: { code } }, 422));
    assert.match(notice.title.en + " " + notice.description.en, pattern);
    assert.ok(notice.title.ar && notice.description.ar);
    assert.notEqual(notice.title.en, code);
  }
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
