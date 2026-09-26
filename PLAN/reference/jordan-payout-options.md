# Amazon Payment Services withdrawal capability evaluation

Updated 2026-09-12 after the user selected [Amazon Payment Services](https://paymentservices.amazon.com/docs/api) as the replacement integration. This replaces the previous vendor shortlist; no alternate payout rail is selected. Keep this existing filename so canonical cross-links remain valid.

## Supported contract versus required capability

The public APS API reference documents payment acceptance, payment status and transaction refunds. The [Refund API](https://paymentservices.amazon.com/docs/api/managing-payments/refund) identifies an original captured transaction using its merchant reference or Fort ID and cannot exceed its remaining refundable amount. It does not establish an API for paying arbitrary all-source wallet balances to customer beneficiaries.

APS [settlement guidance](https://paymentservices.amazon.com/support-center/faq) concerns proceeds paid to the merchant's business bank account. Merchant settlement must not be confused with withdrawals by verified customers. No APS beneficiary-disbursement API for the required reward/wallet use case was verified in the linked public documentation. This is a capability gap to confirm, not a claim that APS can never provide such a contracted product.

## Evidence required from APS

Obtain written confirmation that the merchant account supports Jordan/JOD customer-beneficiary transfers for cash-convertible loyalty, review, referral and all-source verified wallet funds. Require the actual API documentation, merchant/use-case approval, recipient ownership/validation, credentials, idempotency, final-status and receipt queries, signed event verification, UNKNOWN reconciliation and sandbox evidence before implementing or enabling PAY-05.

Obtain setup/monthly/API charges, per-transfer fixed/percentage fee, minimum/cap, tax, funding requirements, recipient charges, failed/reversed-transfer fees and reconciliation exports. The proposed 25 JOD minimum remains provisional; payment-acquiring fees do not establish withdrawal costs.

Finance approval and verification/freeze/destination rechecks remain required. A definitive failure releases its hold once; an unknown transfer is reconciled before retry. Card refunds, merchant settlement or simulated success cannot pass the wallet withdrawal gate. If APS cannot support this use case, ask the user for an explicit policy/provider decision rather than inventing a transfer endpoint or silently narrowing wallet eligibility.

## Sources

- [APS API reference](https://paymentservices.amazon.com/docs/api)
- [APS Refund API](https://paymentservices.amazon.com/docs/api/managing-payments/refund)
- [APS merchant settlement and account FAQ](https://paymentservices.amazon.com/support-center/faq)
