# Release backlog and agent workflow

The v0.1 implementation and implementable v0.2 software are **Complete and locally verified**. Production activation remains blocked by the external and operator gates in [Status](STATUS.md). v0.3 and later tasks are **Not started**. The plan is split into the user's five cumulative releases. Read only the current release task, its canonical domains and relevant decisions; do not implement later-release scope opportunistically.

| Release | Task range | Prerequisite | Completion outcome |
| --- | --- | --- | --- |
| [v0.1 — Bare essentials](releases/v0.1.md) | R01-01 to R01-11 | No implemented baseline | Secure card/COD shop with cash reconciliation, delivery, cancellation/damage support and privacy |
| [v0.2 — All important features](releases/v0.2.md) | R02-01 to R02-08 | v0.1 gate | Core discounts, no-expiry loyalty/referrals, review rewards, verified payout, retention essentials |
| [v0.3 — More QoL](releases/v0.3.md) | R03-01 to R03-06 | v0.2 gate | Bulk editing, richer discovery, convenience, simulation and actionable reports |
| [v1 — Complete product](releases/v1.md) | R04-01 to R04-04 | v0.3 gate | Advanced campaigns and remaining current product, complete acceptance evidence |
| [v2 — Previously later features](releases/v2.md) | R05-01 to R05-06 | v1 gate and selected extension contracts | Future operational/product extensions without bloating v1 |

This is sequencing, not implementation authorization in the current planning-only task. Disabled/unavailable required card, verification or payout provider integration is not a passed release. Work on independent documents/contracts may continue around blockers.

## Task contract

Each table row is a bounded feature slice, not necessarily one agent turn. Read the linked canonical requirements for data/state/permissions/side effects and acceptance. Split a large row into named child slices before coding; retain parent requirement coverage and dependencies. Include the necessary API, minimal staff/customer UI, audit/events and targeted verification with each slice. Do not leave security/refunds/COD reconciliation to final polishing.

Dependencies refer to completed task deliverables or explicit earlier-release gates. Same-release rows can run independently only after their shared contracts exist; this does not authorize spawning agents or overlapping edits.

## Handoff template

- Release/task and exact requirement IDs/slice:
- Outcome and explicit exclusions:
- Dependencies met and unresolved decision/provider gates:
- Canonical specs and actual repo/instructions read:
- State/permission/setting/event/money/stock contracts affected:
- Concrete success, rejection, concurrency/retry and privacy examples:
- Existing checks to run and evidence:
- Implementation result, gaps and commit:

## Coverage and evidence

A requirement may span releases (for example core catalog creation versus later duplication). Completion of an early slice does not mark its whole requirement complete. Each task must record covered clauses and remaining clauses; final release reconciliation reads every canonical clause against evidence.

SCP-01 through SCP-06 and ARC-01 through ARC-17 are inherited by every affected slice; R01-01 establishes their shared contracts and R04-04 checks full coverage. Domain ownership is in README; domain IDs remain stable. The new PAY, PER, SEC, PRV and PLT contracts cover newly clarified requirements, not separate optional work.

## Migration from the original flat tasks

| Previous task | Current home |
| --- | --- |
| T01 platform | R01-01 |
| T02 identity/access | R01-02, R01-09, R03-01 |
| T03 notification foundation | R01-03 |
| T04 catalog | R01-04, R03-02, R04-02 |
| T05 stock | R01-05 |
| T06 pricing | R01-06 base, R02-01 |
| T07 zones | R01-06 |
| T08 wallet | R02-02 |
| T09 orders/payment | R01-07, R02-02 integration |
| T10 delivery | R01-08 |
| T11 referrals/verification | R02-03, R02-05 |
| T12 payout | R02-05 |
| T13 support | R01-09, R03-04 |
| T14 reviews | R02-04 |
| T15 campaigns | R04-01 |
| T16 marketing/subscriptions | R02-06, R03-03 |
| T17 interfaces | Each feature slice, R01-10, R03-05 |
| T18 analytics | R02-07, R03-06 |
| T19 release audit | Gate task in every release |

## Done means

Actual selected behavior and denial/failure cases verified, meaningful relevant checks completed, evidence linked by requirement/clauses, remaining blockers explicit, documentation current and reviewed changes committed. A plan, mock provider response or green test unrelated to a requirement is not evidence that it works.
