# v0.1 platform and deployment contract

Gym Shop is three independently buildable Next.js applications:

- `example.com` is the customer storefront. It contains no API routes or backend domain code.
- `admin.example.com` is the role-aware staff application. It contains no customer pages or backend domain code.
- `api.example.com` is the only API, business-domain, job, media, database, and migration application.

The two user interfaces call `/api/v1/*` through same-origin rewrites to the configured API origin. This preserves host-only, HttpOnly session cookies without exposing API credentials or importing backend modules into either UI. Production DNS must route each hostname to its matching application and redirect `www.example.com` to `example.com`.

## Local simulation

`npm run simmode` starts all three applications on ports 3000, 3001, and 3002. It overrides inherited provider/database credentials, creates an in-memory PGlite database, applies every migration, loads deterministic fixtures, simulates Amazon Payment Services, and captures email/WhatsApp work in the in-memory notification records. No `.env` file or external account is used. The simulation banner and role switchers identify the environment, and all state disappears when the process stops.

Simulation is not production evidence. Preview and production reject `SIM_MODE`, fail when required provider/storage/security variables are absent, and require the production APS endpoint in production.

## Runtime and data

- Next.js 16, React 19, TypeScript, npm workspaces, and Node.js 20.9 or newer.
- Neon PostgreSQL is the durable authority. Runtime uses a scoped pooled application URL; migrations use a separately controlled owner URL.
- Cloudflare R2 stores blobs. PostgreSQL stores ownership, access class, verified metadata, scan state, and retention references.
- Multi-step mutations use one checked-out connection with explicit `BEGIN`/`COMMIT` boundaries.
- Scarce and replay-sensitive operations use row locks, constraints, append-only ledgers, and idempotency records.
- Business transactions append immutable domain events in the same transaction. The leased outbox worker retries with bounded exponential delay and dead-letters after twelve attempts.

API success is `{ "data": ... }`; API failure is `{ "error": { "code", "message", "fields"? } }`. Personalized/API responses are private and not shared-cacheable. Public catalog media may be cached; private evidence is authorization checked and issued through short-lived access.

## Selected provider surface

Card checkout uses only the Amazon Payment Services features required by v0.1:

1. signed Hosted Checkout `PURCHASE` forms;
2. signed return and webhook validation;
3. signed `CHECK_STATUS` reconciliation for uncertain payments;
4. signed `REFUND` requests.

The implementation binds one merchant reference to one order and exact JOD minor-unit amount, validates the merchant/access identifiers and response signature, deduplicates business effects, and never stores PAN or CVV. Payment links, token storage, recurring charges, installments, and other optional products are intentionally absent.

Messaging supports in-site, email, and WhatsApp only. WhatsApp is the only phone verification/PIN channel. Messaging failures never roll back committed order or payment state.

## Production activation gates

The database starts with no initialized CTO and the storefront disabled. Normal traffic remains in maintenance until CTO password/MFA/recovery setup, bilingual terms, reviewed tax treatment, a reviewed delivery window or pickup, COD policy review, and explicit activation are complete. Preview/production configuration additionally requires:

- isolated Neon, APS sandbox/production, R2, messaging, CAPTCHA, and origin configuration;
- scoped runtime/migration/recovery credentials and a tested backup/deletion replay procedure;
- an authenticated scheduler with monitoring for outbox lag, dead events, unknown payments, and cash discrepancies;
- approved APS merchant credentials, response phrases, return/webhook registration, and sandbox evidence;
- approved email and WhatsApp senders/templates;
- malware scanning and private-object access verification;
- a passed, immutable two-key CTO recovery drill record;
- owner/legal review of tax, consumer terms, COD redelivery, retention, and accounting obligations.

These external and human gates are deliberately fail-closed; the complete application and local simulator remain testable without inventing provider facts.
