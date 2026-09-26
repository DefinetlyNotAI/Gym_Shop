# Source map and cleanup record

All 20 original files are preserved byte-for-byte under archive/originals. Active documents replace the originals' conversational format, repeated examples, duplicated business logic and competing role/route lists. The archive is non-authoritative.

| Original file | Active owner(s) |
| --- | --- |
| Account & Auth.md | [Identity](../domains/identity-access.md), [Architecture](../01-architecture.md) |
| Roles.md | [Identity](../domains/identity-access.md) |
| Admin System.md | [Interfaces](../domains/interfaces-analytics.md), [Identity](../domains/identity-access.md); business actions in their domain |
| API Guardrails.md | [Architecture](../01-architecture.md) |
| DB Guardrails.md | [Architecture](../01-architecture.md) |
| Subdomains.md | [Architecture](../01-architecture.md), [Scope](../00-scope.md) |
| Features.md | [Scope](../00-scope.md), [Backlog](../03-backlog.md); detailed behavior in domains |
| Main Site Endpoints.md | [Interfaces](../domains/interfaces-analytics.md) (these are frontend routes, not API endpoints) |
| Products & Stock.md | [Catalog](../domains/catalog.md); quantity ownership in [Inventory](../domains/inventory.md) |
| Inventory.md | [Inventory](../domains/inventory.md), subscription delivery in [Notifications](../domains/notifications.md) |
| Coupons & Referrals.md | [Pricing](../domains/pricing.md), [Referrals](../domains/referrals.md), [Identity](../domains/identity-access.md), [Wallet](../domains/wallet-loyalty.md) |
| Sales & Promos.md | [Pricing](../domains/pricing.md) |
| Loyalty & Wallet.md | [Wallet](../domains/wallet-loyalty.md) |
| Orders.md | [Orders](../domains/orders.md) |
| Delivery.md | [Delivery](../domains/delivery.md) |
| Customer Service.md | [Support](../domains/support-reviews.md) |
| Reviews.md | [Reviews](../domains/support-reviews.md) |
| Notifications.md | [Notifications](../domains/notifications.md) |
| Analytics.md | [Analytics](../domains/interfaces-analytics.md) |
| Costs & External [Not part of plan].txt | [Historical external estimates](external-costs.txt); excluded from implementation scope |

## Consolidations

- Centralized authentication, maintenance, permission checks, configuration, event delivery, upload privacy and persistence guardrails.
- Split coupon pricing, referral attribution, verification and wallet/payout ownership.
- Removed repeated stock and replacement logic from consuming domains; replaced with contracts to the owner.
- Consolidated all UI route/navigation requirements and analytics inventories without creating separate business engines.
- Retained explicit later/optional candidates in Scope; unresolved release choices remain open rather than being dropped.
- Moved illustrative rates, long state diagrams and repeated sample catalogs out of the active reading path; unique thresholds and explicit overrides remain in active specs.
- Recorded source conflicts and unspecified behavior in Decisions rather than guessing policy.
- Preserved every original file and the original directory name Plan. No application code, configuration, dependencies or services were created or modified.

## Verification record

The cleanup checks archived originals against captured SHA-256 hashes, checks all active relative Markdown links, requirement/task/decision identifier uniqueness and references, and confirms no original source file was omitted from this mapping. This is documentation verification, not implementation/runtime validation.

The workspace had no Git repository at discovery. The user later authorized initialization; baseline cleanup is commit 4d61a6e. The policy/release follow-up is a separate documentation commit. Originals remain unchanged; current explicit decisions override them.

## Follow-up provenance

User decisions cover all thirteen clarification groups, the later WhatsApp-only/SMS-removal override, Neon, Amazon Payment Services, the three-application source boundary and after-discount/before-fee reward basis. The final deletion correction preserves business records and replaces/removes required personal data. [Decisions](../02-decisions.md) distinguishes accepted choices from proposals and provider/legal dependencies. [Backlog](../03-backlog.md) replaces the flat T01–T19 plan with five releases.

Git line-ending normalization initially changed archived blob bytes in the baseline while leaving source files intact. Plan/.gitattributes now preserves original archive bytes without text normalization; the follow-up commit restores those exact blobs. Active Markdown uses consistent LF. Original SHA-256 manifest remains unchanged.
