# Decision register

Updated from the user's thirteen answers and follow-up clarifications. **Resolved policy** means product intent is known, not implemented. **Remaining** entries are specific details/provider/legal checks; block only affected activation. Defaults delegated to the agent are labeled selected versus proposed in [Defaults](04-defaults.md).

| ID | Accepted direction | Remaining dependency / policy question |
| --- | --- | --- |
| DEC-01 | Five cumulative releases: v0.1 essentials, v0.2 important, v0.3 QoL, v1 complete, v2 previously later | Release allocation supplied in Backlog; changes require explicit scope update, no automatic deferral |
| DEC-02 | WhatsApp is the only phone-message transport; SMS is completely excluded. Staff MFA at onboarding, strongest practical partner security. Relevant partner newsletters/ads required in requested policy | Approved WhatsApp sender/templates and exact essential-versus-unnecessary partner ad categories and lawful opt-out/status behavior |
| DEC-03 | No direct checkout points or percentage cap. 100 points = 1 JOD in blocks; maximum 5 JOD per Monday–Sunday week (confirmed). Referral 2% after discounts/before fees; wallet is tender. No expiry | Tax/invoice policy, precision and proposed allocation/free-shipping basis. Selected earning default now 1 point/JOD and review 10 points to preserve prior monetary value |
| DEC-04 | COD only: second attempt courtesy-free if completed there; making third attempt adds 2D once covering retries two and three; third failure cancels. Prepaid-card absence uses safe doorstep plus notification. Admin delivery configuration/PIN/windows | Free/discounted shipping fee basis; authorization and enforceability; collected mixed-tender/no-refund treatment, merchant/driver fault and unsafe-drop exceptions before activation |
| DEC-05 | Driver/money safeguards delegated and approved; Amazon Payment Services is the selected integration, per the user's 2026-09-12 replacement instruction | APS purchase/status/refund APIs govern card payments. All-source wallet withdrawals require APS capability confirmation, a documented beneficiary-transfer contract, tariff and sandbox evidence; card refunds and merchant settlement do not prove this capability |
| DEC-06 | Full refund before PACKED; no customer cancellation after. Seven-day in-app damage reports; unavailable replacement may be refunded, alternatives only with agreement | Partial-damage shipping refund treatment, COD refund operational rail until business API, and legally required exceptions. Default line allocation proposed |
| DEC-07 | Bonuses after successful delivery. Link code displayed, new code errors until prior removed. 2% referral basis fixed | Proposed thirty-day attribution window; concurrent first-order lock and exact snapshot/reversal behavior specified in domain contracts |
| DEC-08 | Convert points to wallet; no expiry. Finance approves payouts. Current verification enables all existing available wallet funds, revocation disables all withdrawals | Validate proposed 25 JOD payout floor against real tariff; proposed spend order/destination cooldown and controls. Pending/unknown transfer handling specified |
| DEC-09 | Detailed configurable role matrix requested. Suspended users only support/export page. Management MFA mandatory | Proposed exact grants/session limits/dual-control thresholds need operational review; no open ambiguity about CTO-only staff creation |
| DEC-10 | Fourteen-day restricted deletion/permaban phase retains original identity; after deadline replace identifying references and remove identifying payload while preserving business events. Attachment clock resets/freezes on reopen | Retention exceptions, processor/backup handling and lawful deadlines need validation; alias alone is not anonymization. Versioned T&C acceptance required; unrelated advertising consent remains separate |
| DEC-11 | Approved five-step CTO recovery: CAPTCHA, email OTP, onboarding 12-token passphrase, phone OTP, WebAuthn within thirty minutes; OTPs five minutes; restricted one-hour emergency session, fresh assertions, rotation, lockdown and detailed immutable audits | SEC-01/SEC-03 include approved spare-key enrollment, saved-passphrase checks and prelaunch recovery drill. Required existing factors must remain available; no all-factor-loss bypass authorized. Provider and authenticator behavior requires implementation verification |
| DEC-12 | Classifier acceptable -> publish; flagged -> Support. Human-approved version badge, staff can remove. Immediate once-per-Monday-week reward. No wishlist; selected cart. Rule/tag/metadata suggestions | Select classifier with Arabic/English/privacy/failure guarantees; proposed edit-distance metric retained; no LLM advisor required |

## Latest overrides

- Card/COD acceptance and dispatch-based stock replace the old payment-only fulfillment assumption.
- Pre-pack full refund and unavailable-replacement refund replace the old blanket no-cash-refund description.
- All currently verified available wallet sources are withdrawable; permanently store-only/referral-only cash classes are superseded. Origin still matters for refund and audit traces.
- Points/wallet do not expire. Scheduled coupon/promotion expiry remains.
- Fourteen-day de-identification preserves records; the final user correction supersedes their earlier phrase “everything ... deleted.”
- Review classification/manual Approved badge, Monday cap and selected cart replace earlier optional/unspecified rules.
- Staff/partner privacy, consent and security risks are surfaced in [Security review](05-security-review.md); no requirement is silently replaced by a safer alternative.
- Amazon Payment Services Hosted Checkout and its signed status/refund/webhook APIs are the selected card provider contract. Optional payment products are out of scope unless a later requirement explicitly needs them.
- 2026-09-12: the user's linked [Amazon Payment Services API reference](https://paymentservices.amazon.com/docs/api) replaces the previous payout-provider assumption throughout the active plan. Verified all-source wallet withdrawals remain required, not silently converted into refunds; PAY-05 records the unverified APS disbursement capability separately from supported card APIs.
- SMS transport, SMS verification fees and SMS provider dependencies are removed from every active release.
- The three source/deployment roots are `example.com`, `api.example.com` and `admin.example.com`; UI and backend code must not be mixed.
- Zero-config `simmode` is part of v0.1 and uses only ephemeral local state and simulated external providers.

## Resolution protocol

Record future answer with affected requirement IDs, exact rule/example, date/source, and update canonical domain text. Do not duplicate policy into release task descriptions. Provider information may be configured later but missing required integration is a real activation gate, not permission to invent a fake API.
