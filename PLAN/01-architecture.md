# Shared architecture and contracts

All domains inherit these rules. Domain specs own business policy; UI, API, notifications and analytics do not create competing implementations.

## Surfaces and authorization

- **ARC-01:** Source and deployment boundaries are mandatory: `example.com/` contains only the customer storefront, `admin.example.com/` contains only the role-aware staff application, and `api.example.com/` contains the single backend/domain/data implementation, initially versioned as `/api/v1/...`. `www.example.com` redirects to the storefront. Storefront and admin may share documented wire contracts, but they do not contain API routes, import backend domain/database code, or serve each other's pages. Developer docs and status sites are later.
- **ARC-02:** Validate authentication, granular permissions, record ownership and field visibility on every operation. UI hiding is not authorization. Customer IDs supplied by clients never establish ownership. Audit visibility is owned by ID-07.
- **ARC-03:** Secure server-managed cookie sessions with HttpOnly, Secure, appropriate SameSite, CSRF/origin protection, rotation after login/privilege change, revocation and recent-auth checks. Derive precise cross-subdomain cookie/CORS configuration from the selected deployment; do not expose long-lived credentials in browser storage.
- **ARC-04:** Before CTO initialization, enforce maintenance on storefront, admin and API. Only minimal authentication/initialization operations remain accessible; ID-03 owns completion conditions.

## Data and settings

- **ARC-05:** Derive a simple normalized domain model. Use unique constraints, foreign keys, migrations, query-driven indexes and pagination. Avoid duplicate derived state without a measured need; avoid N+1 access and premature abstraction.
- **ARC-06** — Database-managed settings in Neon cover flags/defaults/limits/pricing/shipping/security/notifications/role assignments. Validate scope/type/bounds/dependencies; authorize/audit edits. Startup/safety constants remain exceptions. Provider/database/setup secrets use managed deployment secrets, not general settings rows, client bundles or logs. [Platform](domains/platform.md) and [Security](domains/security-recovery.md) own provisioning.
- **ARC-07** — Preserve historical monetary/order facts and append-only stock/money/audit events. Required personal-data erasure overrides identifiable snapshots; minimize/separate personal payloads from stable entity references so DELETED_USER_###### substitution and redaction preserve business history. PRV-01/02 define processor/backup/retention treatment. Append-only does not justify keeping unnecessary plaintext personal data forever.
- **ARC-08:** Transactions and atomic checks protect scarce state: inventory, wallet, payout holds, reward grants and promotion limits. Clients never determine authoritative money, stock, role or eligibility values.
- **ARC-09:** Idempotency is required for order/payment processing, payout requests, wallet adjustments, inventory mutations, replacement creation and event/webhook handling. Duplicate requests must not repeat their business effect.

## API and events

- **ARC-10:** Derive resource-oriented API operations from real customer/staff workflows, not tables. Use action operations where appropriate. Keep route handlers separate from domain logic. Avoid giant unrelated responses and unnecessary sequential calls.
- **ARC-11:** Use consistent success/errors, stable machine-readable codes, field validation errors, search/filter/sort/pagination conventions and stable public identifiers. Do not leak secrets, SQL/stack traces or unauthorized fields. Version breaking contract changes.
- **ARC-12:** Rate-limit login, signup, reset/verification resend, referral attribution, applications, tickets, reviews, uploads and other abuse-prone operations. Verify authenticity of external events; record receipt, processing status and failures.
- **ARC-13:** Domain transitions generate audit/business events. The notification system handles templates and delivery asynchronously. A messaging failure must not undo a successful payment/order. Before implementing event processing, define durable commit-to-event delivery and retry semantics; do not allow a crash between commit and enqueue to silently lose required work.
- **ARC-14:** Keep analytics read-only and expensive aggregation outside customer transactions. Start with database-backed search and add specialized infrastructure only when justified. Document implemented contracts, including permission/error/idempotency behavior.

## Files and caching

- **ARC-15:** Cloudflare-backed media delivery applies to products, review media, support evidence, verification evidence and delivery proof. Keep blobs outside relational records and store metadata/references. Validate actual file type, MIME, size, count, ownership and permission. Use malware scanning where supported.
- **ARC-16:** Public catalog media may be aggressively cached. Private support/verification/proof files require authorized access and controlled temporary URLs; public caching must not expose them. Revalidate/invalidate public catalog, sale and inventory caches on relevant changes. Do not share-cache personalized pricing, balances or permission-dependent responses.
- **ARC-17** — [Privacy](domains/privacy-retention.md) owns retention: support attachments fourteen days after each closure, reopening resets/freezes; deletion/permaban fourteen-day support/export-only phase then de-identification, not wholesale transaction deletion. Other durations are proposals. Jobs atomically recheck lifecycle/holds before deleting and retain minimal records.

## Selected platform

User-selected Vercel, Next.js/React, npm, Cloudflare and Neon PostgreSQL; [Platform](domains/platform.md) owns deployment/provider prerequisites. This does not deploy or provision paid services.

## Simulation boundary

- **ARC-18:** `npm run simmode` starts all three applications locally with generated safe defaults, an ephemeral in-memory PostgreSQL-compatible database, simulated Amazon Payment Services outcomes, and captured local email/WhatsApp delivery. It requires no `.env` file or external account. Simulation is explicitly labelled, uses no production credentials or network provider calls, supports deterministic success/failure/replay scenarios, and loses all state when stopped. Production and preview remain fail-closed when required credentials are absent.

## Shared acceptance evidence

Unauthorized record/field access is denied; maintenance is enforced through the API; repeated/concurrent scarce-state operations have one valid effect; old order facts survive edits; private uploads cannot be fetched by unrelated users; failed notification delivery leaves committed business state intact. Each implementation task selects relevant checks rather than rerunning every domain's tests.
