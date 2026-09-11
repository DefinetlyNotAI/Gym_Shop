# Gym Shop API

API, domain logic, jobs, persistence, payments, and notification orchestration. Run `npm install`, then `npm run dev`; simulation mode is supplied by the root runner.

Local port: `3001`.

## v0.2 release evidence

Run `npm run test:acceptance:v02` for the migrated end-to-end domain journey and requirement-file audit. The readiness endpoint reports software readiness separately from activation. v0.2 payout activation intentionally remains blocked with `BUSINESS_CLIQ_PROVIDER_UNAVAILABLE` until a real business CliQ contract, API specification, credentials, tariffs, and sandbox evidence are configured; the verifier never substitutes a mock transfer.
