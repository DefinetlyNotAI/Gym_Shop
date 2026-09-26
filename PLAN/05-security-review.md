# Concrete security and policy review

Requested behavior is retained in the canonical plans. This file records consequences and specific preproduction checks; it is not a claim that planned controls are already implemented or legally approved.

## CTO recovery and MFA

The approved five-step flow in SEC-03 replaces both earlier recovery proposals. It requires existing email, phone, recovery passphrase and WebAuthn access; it therefore does not recover simultaneous loss of those factors. Emergency access is narrowly scoped, expires absolutely, and requires fresh assertions for sensitive mutations. Failed attempts and security changes produce immutable audit events.

OWASP recommends consistent recovery responses and secure single-use, expiring tokens. Its MFA guidance treats factor recovery as a separate security-sensitive operation. Sources: [Password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Money loss and driver controls

PAY-02/03 specifies independent customer receipt, package custody, driver cash liability, Finance handover and bank reconciliation. PIN/proof alone cannot demonstrate cash reached the business. Limits and daily reconciliation reduce exposure; they cannot guarantee no theft or collusion.

Allowing all wallet funds to become withdrawable makes points/review/promotional/compensation value a potential cash liability. The user's weekly conversion limit is 5 JOD, but existing balances and other reward sources remain potential cash liabilities. There is no checkout percentage cap. Protect against fake reviews, self-referrals, chargebacks, compromised verification and self-approved staff credits through provenance, limits, delivery evidence and independent payout review. Do not silently narrow withdrawals to referral-only funds.

## Consent and deletion

Required partner newsletters/ads are a business request, but conditioning status on unrelated marketing consent may conflict with freely given, withdrawable consent where GDPR applies. Separate necessary partner-program communications from advertising, choose explicit categories and establish lawful enrollment/withdrawal policy before enforcing a status penalty. Source: [EDPB consent guidance](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en).

A DELETED_USER alias alone does not erase identity if other records still identify the person. Preserve needed transaction events while removing unnecessary identifying payloads and applying documented retention exceptions. Applicability and mandatory durations need review; fourteen days is the product grace policy, not an asserted universal legal deadline. Sources: [EDPB anonymisation/pseudonymisation](https://www.edpb.europa.eu/topics/ai-and-technology/anonymisation-pseudonymisation_en), [European Commission individual rights](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).

## Failed delivery and refunds

Only COD uses DEL-03 redelivery fees: attempt two is free if delivery ends there; making attempt three adds 2D once covering attempts two and three. Card-paid absence instead uses safe doorstep proof and notification. Third COD failure cancels, but no-refund wording cannot turn uncollected cash into retained payment. Confirm disclosure, charge authorization, mixed-tender treatment, merchant/driver-fault exceptions and disputed proof before launch; a checkbox does not remove mandatory consumer rights. The seven-day window is the in-app damage-report workflow. Reference authority for local review: [Jordan Ministry consumer-protection information](https://www.mit.gov.jo/AR/ListDetails/%D8%A7%D9%84%D9%85%D8%AF%D9%8A%D8%B1%D9%8A%D8%A7%D8%AA/26/16).

## Provider uncertainty

Amazon Payment Services is the selected integration. Its [public API reference](https://paymentservices.amazon.com/docs/api) documents payment acceptance and management; the [Refund API](https://paymentservices.amazon.com/docs/api/managing-payments/refund) requires an original captured transaction and cannot exceed its remaining refundable amount. This is not evidence that arbitrary loyalty/referral/review wallet balances can be paid to customer beneficiaries. Merchant settlement is also not a customer wallet withdrawal. Obtain written APS capability approval, beneficiary-transfer API documentation, tariff and sandbox evidence before implementing or enabling PAY-05; no invented endpoints or simulated success.

The selected stack is compatible as a direction, but actual driver/queue/provider configuration still needs verification during implementation. References: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs). No hosted services were provisioned here.

Selected-provider capability and quote criteria: [APS withdrawal evaluation](reference/jordan-payout-options.md). Terms versioning and consent requirements: [Terms and consent](domains/terms-consent.md).
