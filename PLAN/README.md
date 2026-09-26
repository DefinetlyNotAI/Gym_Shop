# Gym Shop implementation plan

Start here. This directory is the canonical product and release contract for the Gym Shop monorepo. Implementation lives in three independently deployable applications: `../example.com`, `../api.example.com`, and `../admin.example.com`.

For the archival snapshot of what is implemented, verified, blocked and not started, read [Implementation and activation status](STATUS.md) before using the requirement documents.

## Agent reading order

1. Read [Scope](00-scope.md) and choose the current release below.
2. Read [Backlog](03-backlog.md), then one dependency-ready release task and its linked canonical domain.
3. Check [Decisions](02-decisions.md), [Defaults](04-defaults.md) and relevant [Security review](05-security-review.md) entries.
4. Apply [Architecture](01-architecture.md), inspect actual repository/instructions/tooling, and implement only when explicitly authorized.
5. Report exact requirement clauses covered, verification evidence, remaining gaps and commit. A task table does not prove completion.

## Releases

| Release | Meaning | Tasks | Archived status |
| --- | --- | --- | --- |
| [v0.1](releases/v0.1.md) | Bare essentials | R01-01 to R01-11 | Software complete and locally verified; production activation blocked |
| [v0.2](releases/v0.2.md) | All important features | R02-01 to R02-08 | Software complete and locally verified; production payout activation blocked |
| [v0.3](releases/v0.3.md) | More QoL | R03-01 to R03-06 | Not started |
| [v1](releases/v1.md) | Complete product | R04-01 to R04-04 | Not started |
| [v2](releases/v2.md) | Features previously set as later | R05-01 to R05-06 | Not started |

Thirty-five implementation tasks. R01-01 through R01-11 and the implementable software for R02-01 through R02-08 are complete and locally verified. v0.3, v1 and v2 are not started. Releases are cumulative; software completion is not production activation, and missing provider, deployment, policy or operator evidence remains blocking. See [Status](STATUS.md) for the exact boundary.

## Canonical ownership

| Document | Owns |
| --- | --- |
| [Scope](00-scope.md) | Fixed product direction/exclusions |
| [Architecture](01-architecture.md) | Shared API/database/files/events contracts |
| [Decisions](02-decisions.md) | Accepted policy and remaining questions |
| [Defaults](04-defaults.md) | User-fixed versus delegated/proposed values and worked calculations |
| [Security review](05-security-review.md) | Concrete risks and official-source context |
| [Platform](domains/platform.md) | Vercel/Cloudflare/Next.js/React/npm/Neon and provider readiness |
| [Identity](domains/identity-access.md) | Customer/staff/verification/account lifecycle |
| [Security and recovery](domains/security-recovery.md) | CTO setup, MFA and database recovery |
| [Permissions](domains/permissions.md) | Granular role matrix, money separation, audit/simulation scopes |
| [Terms and consent](domains/terms-consent.md) | Versioned agreement, policy clauses and consent evidence |
| [Jordan payout evaluation](reference/jordan-payout-options.md) | Provider shortlist, quote requirements and integration gates |
| [Privacy and retention](domains/privacy-retention.md) | Restricted portal, exports, DELETED_USER references and retention |
| [Catalog](domains/catalog.md) | Product/variant/metadata/media |
| [Inventory](domains/inventory.md) | Stock allocation, dispatch, movements |
| [Pricing](domains/pricing.md) | Sales/coupons/offers/quotes |
| [Referrals](domains/referrals.md) | Attribution, code field and delivery reward qualification |
| [Wallet and loyalty](domains/wallet-loyalty.md) | Non-expiring point/credit ledgers, weekly conversion quota and withdrawals |
| [Orders](domains/orders.md) | Selected cart, order orchestration and snapshots |
| [Payments and COD](domains/payments-cod.md) | Amazon Payment Services card evidence, driver cash, refunds and withdrawal capability gates |
| [Delivery](domains/delivery.md) | Zones/windows/PIN/doorstep/attempts/custody |
| [Support and reviews](domains/support-reviews.md) | Claims, classification, human badges and Monday reward |
| [Notifications](domains/notifications.md) | Channels/templates/consent/durable delivery |
| [Interfaces and analytics](domains/interfaces-analytics.md) | Routes, admin, reports and rule suggestions |
| [User-decision coverage](reference/user-decision-coverage.md) | Mapping of every clarification group to updated requirements/releases |
| [Original source map](reference/source-map.md) | Historical sources and consolidation provenance |
| [External costs](reference/external-costs.txt) | Unverified historical estimates outside implementation scope |

Use domain owners instead of duplicating policy in route handlers, UI, notifications or reports. IDs remain stable; user answers override old examples. All runtime business settings are configurable within security/accounting constraints; secrets stay out of ordinary settings.

## History and verification

All twenty originals remain byte-preserved under archive/originals and are non-authoritative. Do not implement from archived contradictions. The cleanup baseline is Git commit 4d61a6e; commit 57ede7a records staged releases and accepted policies; subsequent documentation and application commits record corrections and implementation. The current software evidence lives in the API repository and is summarized in [Status](STATUS.md). Link/ID/dependency checks and source hashes verify document structure/preservation, not software behavior.
