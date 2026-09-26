For the API, I would also keep the plan as guardrails instead of predefining every endpoint. Let the implementation agent derive endpoints from the domain model and actual UI needs.

The API should be versioned, consistent, permission-aware, and optimized for the real client flows on `example.com` and `admin.example.com`.

Core rules:

- Use `api.example.com` as the single backend API.

- Keep customer and admin capabilities in the same API surface where practical, with authorization deciding access.

- Prefer resource-oriented REST-style endpoints unless a workflow clearly benefits from an action endpoint.

- Do not create endpoints just because a database table exists.

- Design endpoints around actual business operations and UI flows.

- Avoid overly chatty APIs that require many sequential requests for one screen.

- Avoid giant endpoints returning unrelated data.

- Support pagination, filtering, sorting, and search consistently.

- Use stable public identifiers where appropriate instead of exposing raw sequential database IDs everywhere.

- Validate every request server-side.

- Never trust prices, discounts, totals, stock, roles, wallet balances, or permissions sent by the client.

Authentication:

- Secure cookie-based sessions for the web clients.

- CSRF protection for state-changing requests.

- Session rotation after login and privilege changes.

- Recent-authentication checks for sensitive operations.

- Admin authorization checked on every request.

- Verified Customer status is separate from staff authorization.

- CTO-only operations must be enforced server-side.

Response conventions:

- Consistent success and error shapes.

- Stable machine-readable error codes.

- Human-readable messages where useful.

- Validation errors should identify fields cleanly.

- Never leak stack traces, SQL errors, internal IDs, secrets, or authorization details.

Example error concept:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "The selected variant is no longer available in the requested quantity."
  }
}
```

Idempotency:

- Required for operations that must never execute twice accidentally.

- Payments

- Order creation where applicable

- CliQ payout requests

- Wallet adjustments

- Replacement creation

- Inventory-sensitive operations

- Webhook/event processing

Concurrency:

- API operations that touch inventory, wallet balances, payouts, referral rewards, or other scarce state must use transactions and atomic backend checks.

- Never rely on a previous frontend availability check.

Customer API should cover the implemented needs of:

- Catalog

- Search/filtering

- Cart

- Checkout

- Account

- Addresses

- Orders

- Reviews

- Support

- Referrals

- Verification

- Wallet/loyalty

- Notifications

- Back-in-stock subscriptions

- Internal delivery tracking

Admin API should cover authorized operations for:

- Dashboard

- Products

- Collections

- Inventory

- Orders

- Logistics

- Delivery

- Customers

- Support

- Finance

- CliQ payouts

- Promotions

- Referrals

- Verification

- Reviews

- Notifications

- Analytics

- Audits

- Staff

- Settings

Staff APIs should return only what the role is allowed to see.

For example, Logistic Staff requesting audits should receive only logistics-relevant audits. Unrelated audit records should not be returned at all.

Audit hierarchy should be enforced in API serialization:

- CTO can access all authorized audit details.

- Super Admin cannot access CTO-level audit details.

- Admin cannot access Super Admin or CTO details.

- Relevant higher-level records may return only a locked placeholder.

- Operational roles do not receive unrelated records.

- Sensitive audit details require a session refreshed within the last 2 hours.

Settings API:

- Every runtime-adjustable setting and feature flag lives in the database.

- API reads settings from the database.

- Setting writes require the correct permission.

- Validate type, scope, bounds, and dependencies.

- Critical CTO-only settings must never be writable by lower roles.

Maintenance mode:

- Until the single CTO account completes initialization, normal API functionality is disabled.

- Only the minimum endpoints necessary for CTO authentication and initialization should work.

- Customer, admin, and other operational requests should receive a maintenance response.

- Do not rely only on the frontend maintenance page.

File uploads:

- Use dedicated upload flows for product media, support evidence, verification evidence, review media, and delivery proof.

- Validate MIME type, size, ownership, and authorization.

- Store files outside the relational database where practical.

- Keep file metadata and references in the database.

- Private files require authenticated, authorized access.

Search:

- Use normal database-backed search initially where sufficient.

- Do not introduce Elasticsearch or another search service prematurely.

- Add specialized search infrastructure only when actual scale or quality requirements justify it.

Caching:

- Cache public catalog data where it materially helps.

- Be careful with personalized, inventory, wallet, pricing, and authorization-dependent responses.

- Cache invalidation must follow product, sale, promotion, and inventory changes.

Webhooks/internal events:

- External or internal event handlers must be idempotent.

- Verify authenticity where applicable.

- Record event receipt and processing status.

- Failed notification processing must not roll back successful business operations.

Rate limiting should exist for:

- Login

- Registration

- Password reset

- Email verification resend

- Support submission

- Review submission

- Referral attribution

- Verification applications

- Uploads

- Other abuse-prone endpoints

API versioning can start as:

```text
/api/v1/...
```

Breaking changes should create a new version rather than silently changing existing contracts.

Performance guardrails:

- Avoid N+1 database access.

- Return only fields needed by the client.

- Batch related data where one screen clearly needs it.

- Paginate large collections.

- Use indexes that match real endpoint query patterns.

- Keep expensive analytics separate from transactional requests.

- Do not calculate massive reports during ordinary customer requests.

Documentation:

- `docs.example.com` after v1.

- Generate API documentation from the actual contracts where practical.

- Document auth, permissions, errors, pagination, filters, idempotency, and examples.

- Internal/admin endpoints can have restricted documentation if desired.

The main architectural rule is:

```text
Frontend
   ↓
API
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Domain service
   ↓
Database transaction
   ↓
Audit/event generation
   ↓
Response
```

Do not let route handlers directly become the business logic layer.


