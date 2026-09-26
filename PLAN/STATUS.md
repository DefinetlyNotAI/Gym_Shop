# Implementation and activation status

Snapshot date: 2026-09-26.

This is the authoritative status summary for the archived plan. The requirement documents describe the intended product; this file records what the current repositories actually implement and what still prevents real production use.

## Status vocabulary

- **Software complete:** Required application code and local/test interfaces exist and the release acceptance checks have passed.
- **Locally verified:** Automated checks and documented simulation/browser journeys passed. This does not prove production provider access or operator readiness.
- **Activation blocked:** Software may be complete, but the feature or release must remain unavailable in preview/production until the listed external evidence exists.
- **Not started:** No release-level implementation or acceptance evidence has been recorded. Incidental foundations from earlier releases do not change this status.

## Release summary

| Release | Software status | Production status | Evidence / next step |
| --- | --- | --- | --- |
| [v0.1](releases/v0.1.md) | **Software complete; locally verified** | **Activation blocked** | [v0.1 evidence](../api.example.com/docs/v0.1-release-evidence.md). Supply real Neon, APS card, messaging, R2/scanning and production-domain configuration, then record the human two-key recovery drill. |
| [v0.2](releases/v0.2.md) | **Software complete; locally verified**, including a local/test payout proof of concept | **Activation blocked** | [v0.2 evidence](../api.example.com/docs/release-evidence/v0.2.md). Obtain an APS merchant-approved beneficiary-disbursement contract, credentials, tariff, signed callback/status behavior and sandbox evidence before enabling wallet withdrawals. |
| [v0.3](releases/v0.3.md) | **Not started** | Not applicable | Begin only after accepting or resolving the v0.2 activation gate and revalidating its inherited checks. |
| [v1](releases/v1.md) | **Not started** | Not applicable | Depends on the complete v0.3 gate. |
| [v2](releases/v2.md) | **Not started** | Not applicable | Optional future extensions; each requires a separately approved contract. |

## v0.2 task status

| Task | Software | Activation note |
| --- | --- | --- |
| R02-01 pricing and promotions | Complete | No separate external blocker recorded. |
| R02-02 wallet and loyalty | Complete | Real withdrawals inherit the R02-05 provider gate. |
| R02-03 referrals | Complete | Production messaging and policy configuration remain deployment concerns. |
| R02-04 reviews and rewards | Complete | No separate external blocker recorded. |
| R02-05 partner verification and payouts | Complete in software and local/test simulation | Real APS beneficiary disbursement is unavailable and must fail closed. |
| R02-06 campaigns and restock alerts | Complete | Real provider credentials, approved templates and lawful consent configuration remain required. |
| R02-07 analytics and reconciliation | Complete | Production totals must still be reconciled against real provider/accounting data. |
| R02-08 integrated gate | Software acceptance passed | Production activation remains blocked by R02-05 and inherited deployment/operator gates. |

## Current local topology

| Application | Directory | Local URL |
| --- | --- | --- |
| Storefront | `example.com/` | `http://localhost:3030` |
| Staff application | `admin.example.com/` | `http://localhost:4000` |
| API | `api.example.com/` | `http://localhost:5000` |

The three applications are independent Git and package repositories. `PLAN/` and the shared `run-sites.mjs` launcher are siblings outside those repositories. Commit or archive the workspace root separately if this plan and launcher must travel with the applications.

## Resume checklist

1. Read this file, [Scope](00-scope.md), [Decisions](02-decisions.md) and the target release.
2. Treat archived originals as provenance only; active documents own current requirements.
3. Re-run the target release acceptance, migration, test, lint, type-check and production-build gates before relying on old evidence.
4. Keep simulation visibly labelled and disabled in preview/production.
5. Do not mark a release production-ready until every activation blocker has current external or operator evidence.
