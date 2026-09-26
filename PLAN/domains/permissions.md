# Granular permission plan

This is the proposed default matrix requested by the user. Persist permission classes/actions and role assignments in the database, with explicit scopes and audited edits. Deny by default; a menu is not a permission boundary.

## PER-01 — Default operational grants

| Capability | Delivery Agent | Support Agent | Logistic Staff | Finance Staff |
| --- | --- | --- | --- | --- |
| Orders | Assigned package, due amount and needed recipient only | Related support order/context | Pick/pack/dispatch and needed customer context | Payment/refund financial context |
| Catalog | Package identity only | Relevant product read | Catalog operational edit; pricing grant separate | Financial product/cost read where needed |
| Stock | Custody acknowledgment only | Availability read, no quantity edit | Receive/adjust with reason, allocate through order flow | Value/history read, no physical edit |
| Delivery | Own attempts/collection/proof; no fee edits | Related status and reschedule | Assign/batch/reschedule and custody | Cash/settlement read; no proof fabrication |
| Support/reviews | Own delivery dispute context | Tickets/claims; approve refunds for unavailable replacements; moderate/badge reviews | Related packing/stock context | Refund evidence needed to execute only |
| Wallet/payout | None | Customer-safe related balance/status; no adjustments | None | Review/execute approved financial workflows; protected adjustment proposals |
| Customers | Assigned delivery minimum | Relevant support profile; suspension portal assistance | Fulfillment minimum | Financial identity/destination minimum |
| Analytics/export | Own delivery/cash acknowledgment | Support/review/claim domain | Stock/fulfillment/delivery domain | Financial/payment/wallet/reward domain |

Review classification automatically publishes acceptable content; human Support approval is a separate action/badge. Customer can manage only own account/orders/cart/support/reviews/referrals/wallet under status and verification constraints; customer verification grants no staff permission.

## PER-02 — Management and configuration

Admin gets broad operational product/promotion/customer/support/referral/verification/delivery/reporting grants, subject to money approval and audit restrictions. Super Admin additionally manages ordinary staff lifecycle and sensitive operational policies; cannot create staff, manage Super Admin access, change CTO or override emergency/security invariants. CTO alone creates/bulk-creates any staff, changes management-role assignments/Super Admin access and configures critical security/integrations/permission architecture.

Proposed Super Admin staff delegation: disable/re-enable operational/Admin accounts, revoke their sessions, force secure reenrollment; never read secrets, assign self/higher privilege or change own recovery contact. Admin may suspend customers with reason but cannot permanently de-identify them without policy workflow. Permanent-ban/deletion action requires higher-authority approval and the fourteen-day user window. CTO changes need step-up and highest-priority audit.

Business settings are assigned by domain: Logistics zone/window/stock defaults; Admin merchandising/campaign defaults; Finance financial thresholds proposes with independent approval; Support ticket/category templates within grants. Startup/provider secrets are never ordinary settings. Values affecting security/fees require validated bounds and versioning.

## PER-03 — Financial separation

Support authorizes unavailable-replacement refund cases; Finance executes after verifying entitlement and actual collections. Automatic before-pack cancellation refund follows deterministic order policy. Manual balance changes, exceptional refunds, cash discrepancies and payout requests need a distinct authorized approver from executor/proposer. A reviewer cannot approve their own account's funds, own driver handover or own correction. Finance cannot alter delivery evidence, customer verification to enable its own payout, or destroy ledger history. Driver cannot set amount due or settle itself.

Where only the CTO can perform an emergency action, do not pretend two distinct people approved: explicitly record single-owner exception/reason/step-up and immutable high-priority audit. No normal role setting can grant silent financial-history deletion or allow duplicate money effects.

## PER-04 — Audits and simulation

One audit page/API. Management sees detail for same/lower privilege, locked detail-free placeholders for relevant higher management records. Operational roles receive only relevant domain events, redacted to permitted fields; any higher-role-sensitive payload stays hidden, unrelated events do not appear at all. Sensitive details additionally require the two-hour refreshed-auth policy. Exports/analytics do not bypass it.

Admin and Super Admin with simulation grant may view Operational Staff roles only; Super Admin cannot simulate Admin. CTO additionally simulates Admin, Super Admin and exact users. Simulation is server-enforced read-only, with visible mode/exit and start/end audit. Effective data permissions intersect the simulated subject's scope and actor's permitted simulation scope; no side effect or higher-role audit disclosure.

## Acceptance

Permission changes immediately affect server reads/mutations/export; preview does not mutate or expose higher data. Driver cannot see other route or Finance details. Support cannot settle money it approves. Finance cannot self-approve or edit proof. Super Admin cannot create staff or manage higher accounts. Deleted actor substitution preserves traceability without leaking erased personal fields.
