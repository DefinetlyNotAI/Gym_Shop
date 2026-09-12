# Gym Shop API

API, domain logic, jobs, persistence, payments, and notification orchestration. Run `npm install`, then `npm run dev`; simulation mode is supplied by the root runner.

Local port: `3001`.

## v0.2 release evidence

Run `npm run test:acceptance:v02` for the migrated end-to-end domain journey and requirement-file audit. The readiness endpoint reports software readiness separately from activation with `payoutProviderAvailable` and `PAYOUT_PROVIDER_UNAVAILABLE`. Amazon Payment Services is the selected integration; all-source wallet withdrawals remain unavailable until APS beneficiary-disbursement capability, merchant approval, API specification, tariffs and sandbox evidence are verified. Card refunds and merchant settlement are not customer wallet payouts; the verifier exercises the real fail-closed integration journey rather than substituting a mock transfer.
