# v0.1 platform and deployment contract

Gym Shop is three independently buildable Next.js applications:

- `example.com` is the customer storefront. It contains no API routes or backend domain code.
- `admin.example.com` is the role-aware staff application. It contains no customer pages or backend domain code.
- `api.example.com` is the only API, business-domain, job, media, database, and migration application.

The two user interfaces call `/api/v1/*` through same-origin rewrites to the configured API origin. This preserves host-only, HttpOnly session cookies without exposing API credentials or importing backend modules into either UI. Production DNS must route each hostname to its matching application and redirect `www.example.com` to `example.com`.

## Browser and network boundary

- The API deliberately sends no cross-origin resource-sharing headers. Browsers communicate with it through the storefront or admin application's same-origin `/api/v1/*` rewrite.
- Every browser mutation must pass a route-specific origin policy. Customer routes accept only `STOREFRONT_ORIGIN`, staff and recovery routes accept only `ADMIN_ORIGIN`, the small explicitly shared route set accepts either, and an unclassified mutation is rejected.
- Cross-site Fetch Metadata requests are rejected before route handling. The only browser exception is the signed Amazon Payment Services return endpoint; provider webhooks and media scan callbacks use their own signatures/secrets.
- Storefront and admin responses use per-request nonce CSPs. External connections/images are limited to the exact configured R2 endpoint/public origin; storefront form submission additionally allows only the selected APS Hosted Checkout origin.
- Staff authentication, MFA, recovery, and WebAuthn ceremonies are restricted to the admin surface and `ADMIN_ORIGIN`. Customer and staff role families cannot create sessions on the wrong surface.
- Production session and cart cookies use the `__Host-` prefix, `Secure`, `HttpOnly` where applicable, `SameSite=Lax` (or `Strict` for recovery), high priority, and no `Domain` attribute.
- Application origins must be distinct exact HTTPS origins outside local/test. The WebAuthn RP ID must cover the admin host; PostgreSQL URLs must require TLS; provider, CAPTCHA, and R2 origins must be exact HTTPS origins without embedded credentials.

The storefront and admin deployment environments need the public `API_ORIGIN`, `R2_ENDPOINT`, and `R2_PUBLIC_BASE_URL` values so rewrites and CSP allowlists match the API configuration. Secret R2 credentials remain API-only.
The R2 bucket CORS policy must allow only the exact storefront and admin origins, only the required `PUT` method for direct uploads, and only the signed `content-type` and `x-amz-checksum-sha256` request headers. Signed URLs use path-style addressing so the browser stays on the single CSP-allowlisted `R2_ENDPOINT` host.

## Local simulation

Local simulation runs the storefront on port 3030, the API on port 5000, and the staff application on port 4000. It overrides inherited provider/database credentials, creates an in-memory PGlite database, applies every migration, loads deterministic fixtures, simulates Amazon Payment Services, and captures email/WhatsApp work in the in-memory notification records. No `.env` file or external account is used. The simulation banner and role switchers identify the environment, and all state disappears when the process stops.

Simulation is not production evidence. Preview and production reject `SIM_MODE`, fail when required provider/storage/security variables are absent, and require the production APS endpoint in production.

## Runtime and data

- Next.js 16, React 19, TypeScript, npm workspaces, and Node.js 20.19 or newer.
- Neon PostgreSQL is the durable authority. All runtime persistence and transactions go through Drizzle ORM's Neon driver and the generated typed schema; migrations use a separately controlled owner URL.
- Simmode uses the same Drizzle-facing client and transaction contract through Drizzle's PGlite driver. Only the underlying driver and storage lifetime differ.
- Cloudflare R2 stores blobs. PostgreSQL stores ownership, access class, verified metadata, scan state, and retention references.
- Multi-step mutations use Drizzle transactions on one scoped connection.
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
- edge/reverse-proxy TLS, request-size limits, rate limiting, and firewall rules that expose only the three intended application hosts;
- scoped runtime/migration/recovery credentials and a tested backup/deletion replay procedure;
- an authenticated scheduler with monitoring for outbox lag, dead events, unknown payments, and cash discrepancies;
- approved APS merchant credentials, response phrases, return/webhook registration, and sandbox evidence;
- approved email and WhatsApp senders/templates;
- malware scanning and private-object access verification;
- a passed, immutable two-key CTO recovery drill record;
- owner/legal review of tax, consumer terms, COD redelivery, retention, and accounting obligations.

These external and human gates are deliberately fail-closed; the complete application and local simulator remain testable without inventing provider facts.
