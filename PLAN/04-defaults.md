# Policy defaults and calculation examples

**User-fixed** rows reflect explicit decisions. **Selected default** is an initial business choice delegated to the planning agent, still editable through authorized admin settings. **Proposed** needs acceptance or provider/legal validation; do not confuse it with an externally verified tariff.

## Money and rewards

| Setting | Value / status |
| --- | --- |
| Currency | JOD; proposed integer fils (1/1000 JOD), round half-up at line/rule boundaries; provider precision compatibility must be verified |
| Business timezone | Asia/Amman; store timestamps consistently, localize boundaries |
| Purchase loyalty | Selected default: 1 point per 1 JOD qualifying merchandise; 100 points = 1 JOD preserves the selected 1% value-back rate |
| Point precision | Selected default: fixed-point points to 0.001; no floating arithmetic or whole-JOD truncation |
| Qualifying purchase base | Merchandise after sales/coupons/referral discounts, before tax/shipping/redelivery fees; wallet tender never reduces this base |
| Purchase award timing | User-fixed: successful delivery/confirmed pickup, with valid customer payment/collection; never on replacement/free value |
| Points/wallet expiry | User-fixed: none; refunds/fraud reversals/holds are not expiry |
| Loyalty conversion | User-fixed: whole 100-point blocks to 1 JOD each; maximum 5 JOD per Monday–Sunday week in Asia/Amman; atomic per-account value quota |
| Wallet checkout | User-fixed: no percentage cap; no direct point spending, converted wallet funds are ordinary tender |
| Referrer reward | User-fixed: 2% of merchandise after discounts, before fees; wallet tender does not reduce reward base |
| Referred-buyer incentive | Selected default: 5% on first-order merchandise after coupons, cap 5 JOD, minimum qualifying merchandise 20 JOD; admin configurable |
| Weekly review award | Selected default: 10 points (0.10 JOD equivalent); first eligible submission only, no positivity requirement |
| Review week | User-fixed Monday reset; selected timezone Monday 00:00 Asia/Amman |
| Wallet spend order | Proposed: available source lots oldest first; retain provenance for refunds; no expiry or source-based checkout cap |
| Payout minimum | Proposed 25 JOD; validate actual business payout tariffs/limits before activation |
| Wallet withdrawal sources | User-fixed: every available settled source if currently verified, including old funds; none if verification removed |
| Referral link attribution | Proposed 30 days; explicit remove-before-replace field behavior is user-fixed |
| Free shipping | Proposed merchandise subtotal after discounts, before fees/tender; admin chooses threshold; DEC-03 must confirm policy |

Admin may change earning rules prospectively, never rewrite already-issued points or historical order rule snapshots. The user-fixed 100:1 conversion and 5 JOD weekly limit are not ordinary admin-overridable earning settings. Purchase/review defaults were adjusted to preserve 1% purchase value and 0.10 JOD review value after the conversion correction.

## Worked amounts

These are policy examples, not configured product prices or tax advice.

- Original merchandise 50 reduced by discounts to 30: add 3 JOD shipping for 33 due (assuming no other fees/tax). Wallet may cover all 33. Referrer earns 0.600 JOD and buyer earns 30 points (0.300 JOD future value), after successful paid/collected delivery. Shipping earns neither.
- Convert 200 of 250 points: debit 200 points, credit 2 JOD and consume 2 of the week's 5 JOD conversion allowance atomically. Fifty points remain. A later 4 JOD request fails if only 3 JOD quota remains; the user may request 3 instead. No checkout percentage cap remains.
- Review Sunday 23:59 and another Monday 00:01 Asia/Amman belong to different reward weeks. Two simultaneous submissions in one week produce only one award. Use IANA timezone rules, not server local time or a hardcoded UTC offset.
- Wallet 10 loyalty-origin + 20 other-source JOD: unverified withdrawal = 0; newly verified available withdrawal = 30; revoked before submission = 0. Holds/disputes/uncertain existing transfers are handled separately, never double paid.

## Pricing tie/allocation proposal

Highest monetary reduction wins among eligible sales; equal result uses configured priority then stable ID. Evaluate allowed automatic offers in configured priority/stable order before ordinary coupons; allocate order-level reductions proportionally to eligible line amounts and distribute rounding remainder deterministically, never beyond a line's available amount. Referral benefit follows coupons even when coupon stacking is prohibited. Calculate merchandise discounts and applicable fees/tax before subtracting wallet/card/cash tender. Actual tax calculation may require a different legally correct tax base; DEC-03 remains open and must not be resolved by the examples.

## Operational defaults/proposals

- User-fixed: cancel/full refund before packed; no customer cancellation once packed; seven-day in-app damage report window.
- User-fixed COD: attempt two is a courtesy retry with no extra fee if delivery finishes there. Making attempt three adds 2x original snapshotted delivery cost once, covering attempts two and three; third failure cancels. Never count uncollected COD as money retained or auto-seize wallet funds. Zero/discounted-fee basis and enforceability require DEC-04.
- User-fixed: prepaid-card recipient absence uses safe doorstep delivery plus proof/notification, with the policy disclosed at checkout; no COD redelivery fees. Unsafe/inaccessible drops go to Support. PINs apply to attended delivery/pickup.
- User-fixed: fourteen-day deletion/permaban restricted phase with original identity retained until finalization; support file countdown fourteen days after closure, reset/freeze on reopen.
- Proposed edit distance: normalized Unicode text, Levenshtein character edits; percentage = edits / max(1, previous character count) x 100. Both greater than 5% and greater than 20 edits force manual re-review.
- Proposed hold/session/security/retention settings are in their domain files; all require bounds, role control and relevant preproduction review. Do not silently choose tax rates, delivery prices or provider fees.
