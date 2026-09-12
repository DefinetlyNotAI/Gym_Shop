# Amazon Payment Services provider replacement

The user's 2026-09-12 instruction explicitly authorizes changing the previously protected sibling `PLAN`: remove the old payout-provider assumption and replace it with [Amazon Payment Services](https://paymentservices.amazon.com/docs/api).

## Canonical amendment

The active scope, decision register, security review, release v0.2, payments, wallet, orders, platform, README and user-decision coverage now select APS. The existing `PLAN/reference/jordan-payout-options.md` now evaluates APS withdrawal capability rather than recommending other vendors. Archived originals remain historical, non-authoritative and unchanged.

Card checkout already implements APS Hosted Checkout, signed response validation, status queries and original-transaction refunds. The provider selection does not establish an arbitrary all-source wallet withdrawal API: the published [Refund API](https://paymentservices.amazon.com/docs/api/managing-payments/refund) requires an original captured transaction and limits refunds to its remaining refundable amount. [Merchant settlement](https://paymentservices.amazon.com/support-center/faq) concerns payment proceeds sent to the merchant, not wallet withdrawals sent to customers.

PAY-05 and WAL-04 retain all-source verified withdrawal eligibility, Finance approval, verification/freeze/destination rechecks, holds, idempotency and UNKNOWN reconciliation. APS withdrawal capability, merchant/use-case approval, actual beneficiary-transfer documentation, tariff and sandbox evidence must be verified before enabling this flow. An unsupported product requires a new explicit user decision, not an invented endpoint or a substitution of card refunds for rewards.

## Change boundary

This is a planning amendment, not a claim of live APS disbursement integration. Existing software still exposes the historical provider-specific readiness field/blocker until a separately verified runtime-contract migration replaces it. No credentials, external account or live financial operation were created.

`PLAN` is outside the three Git repositories and has no Git metadata. This decision record commits the amendment's intent and implementation boundary in the API repository; the canonical sibling edits cannot themselves be committed without moving the plan or creating a new repository, neither of which the user requested.

## Verification

The active plan has no remaining old provider-name references (archived originals excluded). All 146 active local Markdown links resolve, and all 20 source hashes match `PLAN/reference/original-sha256.json`. Customer and admin worktrees remain unchanged. No production code changed in this planning amendment, so software tests/builds are not presented as new evidence for APS withdrawal support.
