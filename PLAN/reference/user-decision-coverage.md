# User clarification coverage

This maps the user's thirteen answer groups and later clarifications to canonical requirements and release slices. “Recorded” means documented, not implemented. Read Decisions for unresolved exact fees/provider/legal details.

| User group | Recorded behavior | Canonical owner / implementation slice |
| --- | --- | --- |
| 1 | v0.1 essentials, v0.2 important, v0.3 QoL, v1 complete, v2 earlier later-features | [Backlog](../03-backlog.md), all five release files |
| 2 | Card/COD only at checkout; driver collection/custody/Finance settlement/anti-theft; APS is the selected integration, with all-source wallet disbursement capability unverified | PAY-01, PAY-02, PAY-03, PAY-05; R01-07, R02-05 |
| 3 | WhatsApp-only phone messaging; SMS removed; partner relevant newsletter/ads requirement and strong security, consent review explicit | NOT-01, NOT-04, ID-05, SEC-02; R01-02, R01-03, R02-05 |
| 4 (superseded) | Latest correction removes checkout percentage cap and direct point spending; wallet is tender | WAL-03, Defaults; R02-02 |
| 5 | Points convert to wallet; agent-selected earn/convert defaults; points/wallet no expiry; referral 2% discounted pre-fee merchandise | WAL-01, WAL-03, REF-03 and Defaults; R02-02, R02-03 |
| 6 | Successful-delivery bonuses; link code shown, new code rejected until remove; no silent override | REF-02, REF-03; R02-03 |
| 7 | Finance first approval, minimum proposed against unknown tariff; verification grants all existing available funds withdrawal, revocation removes it | WAL-04, PAY-05, PER-03; R02-05 |
| 8 (corrected) | COD second retry courtesy-free; making third attempt adds 2D once; third failure cancels. Card-paid absence uses safe doorstep and notice | DEL-01, DEL-03, DEL-04, PAY-03; R01-06, R01-08 |
| 9 | Pre-packed full cancellation refund; packed locks cancellation; delivered seven-day damage; unavailable replacement refund without alternative search unless customer agrees | ORD-04, SUP-02, SUP-03, PAY-04; R01-07, R01-09 |
| 10 | Detailed permissions; one support/export page for suspension; deletion/permaban fourteen-day warning period; database CTO OTP after three failures, critical email/audit, MFA mandatory onboarding | PER-01 through PER-04, PRV-01, ID-06, SEC-01 through SEC-03; R01-02, R01-09, R03-01 |
| 11 | Attachment countdown resets/freezes on reopen; minimal deletion record; proposed other retention periods | SUP-04, PRV-03, PRV-04; R01-09 |
| 12 | Classification publishes acceptable, manual Support queue otherwise; human Approved badge even for published reviews, staff takedown; immediate weekly reward reset Monday; cart checkboxes instead of wishlist; rule/tag/metadata suggestions | REV-02, REV-04, ORD-01, ANA-02; R01-07, R02-04, R03-06 |
| 13 | Vercel/Cloudflare/Next.js/React/npm, Neon clarified later; improved unique CTO onboarding; Git initialized | PLT-01, SEC-01, R01-01; actual baseline commit 4d61a6e |
| Final deletion correction | Replace references with DELETED_USER_######; preserve transaction/history, remove only required/unneeded identifying information; no wholesale record wipe | PRV-02, ARC-07, ID-06; R01-09 |
| Security question | CTO enumeration/database secret, MFA recovery, wallet-to-cash abuse, driver collusion, consent/de-identification and failed-delivery policy risks explicitly surfaced | [Security review](../05-security-review.md), SEC-03, PAY-03, PRV-02 |

## Remaining uncertainty is not lost scope

APS payment/withdrawal capability and messaging provider access/tariffs, third-attempt fee collection/free-shipping basis, exact partner ad/withdrawal policy, legally required retention/refund exceptions and recovery hardening are in [Decisions](../02-decisions.md). They are not silently guessed, removed from launch or represented as implemented. Proposed defaults are distinguishable from fixed answers.

Latest confirmed conversion: 100-point blocks, 5 JOD per Monday–Sunday week; 250 points may become 2 JOD plus 50 points. Identity replacement starts after the fourteen-day deletion phase. Required versioned T&C and separate marketing consent: TER-01 through TER-03, R01-10. CTO recovery is now the approved five-step SEC-03 flow with thirty-minute verification and a one-hour restricted emergency session. Driver controls are approved/delegated. The 2026-09-12 provider replacement selects APS; supported card APIs and unverified wallet disbursement capability are distinguished in PAY-05.

Additional approved safeguards: independent spare security key at CTO onboarding; secure saved-passphrase confirmation at onboarding and emergency recovery; mandatory evidenced prelaunch recovery drill. SEC-01/SEC-03 own the requirements, R01-02 implements them and R01-11 gates launch on the drill.
