# Product scope and release boundaries

## Fixed direction

- **SCP-01:** Bilingual Arabic/English gym apparel/accessories store; Arabic RTL, JOD and Asia/Amman business boundaries.
- **SCP-02:** Account/verified-phone checkout, no guest purchase; persistent selected/unselected cart replaces wishlist.
- **SCP-03:** Three separate deployable applications: customer storefront in `example.com`, one role-aware staff application in `admin.example.com`, and the sole backend in `api.example.com`; admin-configured Amman/surrounding delivery and pickup, PINs/windows, card-prepaid leave-at-door. UI applications consume the versioned API and never embed backend routes or database/domain services.
- **SCP-04:** Card and COD, independently reconciled driver cash; pre-pack full cancellation refund, seven-day in-app damage reporting, replacement or unavailable-stock refund, requested failed-attempt policy with prelaunch review.
- **SCP-05:** Dynamic catalog/options/tags/settings/thresholds and granular role permissions. Strong staff/partner security, one CTO, restricted suspension/export/support and de-identification rather than transaction deletion.
- **SCP-06:** Sales/coupons/campaigns, referral rewards, verification/all-source wallet payouts with Amazon Payment Services as the selected integration subject to PAY-05 capability evidence, no-expiry points/wallet, classification-based reviews, notifications, retention and explainable reporting complete by v1 as allocated below.

## Release contract

| Release                  | Meaning                         | Outcome                                                                                                                                                                        |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [v0.1](releases/v0.1.md) | Bare essentials                 | Secure sell/collect/deliver/refund/support workflow with mandatory privacy and cash controls                                                                                   |
| [v0.2](releases/v0.2.md) | All important features          | Core discounts, loyalty/referrals, reviews, verification/payout, newsletter/back-stock and useful KPIs                                                                         |
| [v0.3](releases/v0.3.md) | More QoL                        | Bulk staff/catalog operations, richer discovery, retention, reporting, simulation and operational convenience                                                                  |
| [v1](releases/v1.md)     | Complete product                | Advanced campaigns and all remaining current-product requirements, integrated and verified                                                                                     |
| [v2](releases/v2.md)     | Other features previously later | Warehouses/splits, routing, tiers, advanced analytics and other explicitly later extensions                                                                                    |
| v2.1                     | Native Mobile Apps              | New repos for apple and android; native apps that also allow access to the entire sites; 2 Repo's for the normal site and 2 Repo's for the admin site (aka delivery and staff) |

Releases are cumulative. A smaller release may defer optional features, never controls required to safely run features it exposes. v0.1 software implementation is complete and locally verified; later-release software tasks remain Not started. Provider/legal dependencies can block production activation; do not silently remove requirements or pretend a disabled integration is complete.

## Explicit exclusions and later boundaries

No separate wishlist or wishlist analytics; no LLM business-advice feature; no external carrier APIs; no SMS transport; no v1 customer impersonation; no peer wallet transfers/gifting/top-ups. Staff view simulation is read-only and remains included. One stock location and normally one shipment/package per order through v1. v2 preserves previously later suggestions without making them implicit v1 requirements.

Selected stack: Vercel, Cloudflare, Next.js, React, npm, Neon PostgreSQL and Amazon Payment Services Hosted Checkout/API. WhatsApp is the only phone-message transport; ordinary email/in-site notifications remain. `npm run simmode` supplies an explicit zero-credential, memory-only local environment for safe workflow simulation and never represents production evidence. User-fixed values and chosen/proposed defaults are distinguished in [Defaults](04-defaults.md); provider pricing/tax/legal facts are not invented. [Decisions](02-decisions.md) lists only remaining uncertainty alongside resolved policy.
