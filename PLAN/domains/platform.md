# Selected platform and integration readiness

## PLT-01 — User-selected stack

Next.js with React, npm workspaces, Vercel hosting, Cloudflare and Neon PostgreSQL. Maintain three independently buildable/deployable roots: `example.com` for customers, `admin.example.com` for staff, and `api.example.com` for API/domain/database code. The UI applications communicate with the sole backend over its versioned HTTP contract; do not colocate API routes or database services in either UI application.

Use Neon transactions/constraints for stock, rewards, wallet and idempotency. Choose connection pooling/driver that supports the required multi-statement transactional boundaries in the actual Vercel runtime; never assume independent serverless SQL calls share a transaction. Scoped app DB role, separate migration/owner/recovery roles, environment-specific secrets and private networking/access controls where supported. Preview uses isolated nonproduction data and payment endpoints, never live customer money.

## PLT-02 — Runtime, media and jobs

Vercel serves Next.js; Cloudflare supplies DNS/media protection/delivery and configured public caching. Specify ownership of caching per response to avoid double caching authenticated content. Use private object access for support/verification/proof, public transformations for catalog media. Do not create or overwrite Sites hosting metadata; user selected their own stack.

Database-backed durable events/queue and scheduled workers handle reservation/payment reconciliation, notifications, reviews, retention and cash alerts. A request returning does not guarantee in-process background work continues. Select and verify scheduler/job provider retries, authentication and limits before relying on them. No local filesystem/session memory is durable production stock, wallet, uploaded file or job storage. Observe event lag, failed jobs, payment unknown states and cash discrepancies with accountable alerts.

`npm run simmode` is the explicit exception for local simulation. It starts all three applications without an env file, applies migrations and deterministic fixtures to an ephemeral in-memory database, captures email/WhatsApp locally, and simulates APS success, failure, pending, replay and refund outcomes. Every surface displays simulation state. It must refuse production mode/credentials, never call external providers, and discard all data on shutdown.

## PLT-03 — Integration gates

- Card: Amazon Payment Services merchant credentials, request/response SHA phrases, JOD/3DS/fee/chargeback contract, Hosted Checkout return URL, webhook allowlisting, sandbox cards and signed purchase/status/refund evidence.
- WhatsApp: approved sender/templates, phone number ownership verification, tariffs, consent and retry/delivery semantics. SMS is not configured or supported.
- Wallet withdrawals: APS merchant-approved Jordan/JOD beneficiary disbursement capability, documented API, tariff and sandbox evidence; purchase/refund support or merchant settlement alone does not satisfy PAY-05.
- Neon/Vercel/Cloudflare: environment secrets, auth isolation, allowed origins/cookies, pooled transactions, object privacy, backups and restore behavior.
- Maps: configured provider key/restrictions/costs and usable manual-address fallback.
- Review classifier: selected service/model or local classification system with output schema, Arabic/English support, timeout/failure/manual fallback, privacy limits and model-version records.

A missing integration blocks its activation, not unrelated planning. Version release gates say which dependency prevents a complete release; never silently replace card+COD with COD-only or present simulated payout success.

## Acceptance

Production money/secrets cannot leak into previews/browser logs. Simultaneous updates are verified with the actual chosen Neon driver. Restart/serverless interruption does not lose committed business jobs. Provider unknown/failure paths produce truthful user/staff state. Cloudflare/Vercel caches never expose private identity or wallet responses.
