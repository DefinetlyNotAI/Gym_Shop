# Pricing, coupons, sales and campaigns

One authoritative server-side pricing engine with distinct concepts: sale changes effective item price; discount defines eligibility/value; code references a discount; campaign coordinates rules and presentation. [Referrals](referrals.md) owns attribution/reward, not a second discount engine.

## Requirements

- **PRI-01 — Rule definitions:** IDs, internal/customer names/descriptions, enabled state, timestamps/actors, schedules/no-expiry/day/time windows; percentage/fixed reductions and caps; sale fixed-final-price support. Eligibility/inclusions/exclusions by product, variant, category, collection, account/group, verified status, first-order, account age/purchase count, quantity and minimum spend. Configure whether tax/shipping count toward minimums. Discount definitions may have many codes. Support manual, automatic, referral, account-assigned and admin-issued application.
- **PRI-02 — Precedence:** Product default then variant override form base price. Apply the highest applicable sale; sales do not stack. Warn admins about overlaps and identify winning rules. Sale and coupon must both permit their combination for the affected line. Ordinary coupon combinations, priority and maximum count are configured. **Referral discounts bypass coupon combination restrictions and apply after coupons, before delivery/fixed costs**, while retaining referral eligibility/limits. Do not restore the older blanket stacking restriction. WAL-03 converts points to wallet outside checkout; wallet is tender with no percentage cap. Automatic-offer ordering, ties, money rounding and remaining interactions need DEC-03.
- **PRI-03 — Automatic offers:** Buy X/get Y free or discounted, quantity tiers, spend-threshold rewards/free shipping and bundles. Specify qualifying/reward items, quantities, value, maximum applications/order and repeating behavior. Cheapest qualifying reward item receives reduction. Bundle stock remains on selected component variants; no separate bundle inventory. Flash sales reuse scheduled sales with optional countdown/quantity limits.
- **PRI-04 — Campaign administration:** Campaigns group sales, codes, automatic/shipping offers, banners, badges and featured content. Create/draft/preview/schedule/activate/pause/end/duplicate/archive; inspect affected products, overlaps and customer terms. Enforce global/per-account/per-order usage, quantity/value caps and campaign budgets atomically; track successful uses and source orders. Preview/simulate a customer/cart/region/coupon/referral/wallet combination using the real calculation rules without reserving stock, funds, counters or creating orders.
- **PRI-05 — Quote contract:** Return base/sale/offer/coupon/referral allocations, eligibility and rejection explanations, shipping/tax inputs and resulting totals. Never overwrite base catalog prices; snapshot applied definitions/amounts/eligible lines on orders. Shipping quote comes from Delivery; wallet contribution from Wallet. Define counter reservation/consumption/release at order/payment boundaries to prevent concurrent oversubscription; DEC-03/05. Financial rules cannot be inferred from example values.

## Acceptance examples

- 50 JOD with overlapping 10% and 20% sales becomes 40, never 36.
- 100 JOD, 20% sale and mutually permitted 10% coupon becomes 72 before other stages.
- A 20% coupon capped at 15 JOD on eligible 100 JOD reduces by 15.
- An eligible referral still applies after a coupon that forbids other discounts; invalid/self/repeat referrals remain rejected.
- Buy-two/get-one with two permitted applications yields four paid/two free among six qualifying items.
- Concurrent final-budget/usage requests cannot both exceed the configured limit. Simulation leaves every business ledger/counter unchanged.
