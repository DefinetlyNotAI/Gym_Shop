# API Error Toasts Implementation Plan

> **For agentic workers:** Execute inline under the user's explicit continuation approval. Use TDD and verification-before-completion; do not pause for another design approval or delegate implementation.

**Goal:** Replace raw API-code feedback with readable, accessible, localized error toasts across the customer and staff UI.

**Architecture:** Each independently built site owns the same dependency-free error contract and toast component. Request helpers retain typed code/status diagnostics; presentation uses a vetted code/status mapping rather than arbitrary server text. A browser notification event connects request consumers to the root toast stack without intercepting global fetch or changing server authorization.

**Tech Stack:** Existing Next.js 16.3.4, React 19.2.8, TypeScript 5.9.3, Node test runner and CSS.

**Spec:** `docs/release_evidence/v0.2-endpoint-ui-audit.md`, Required API error presentation follow-up.

## Global constraints

- Preserve trusted-origin, authentication, permission and financial boundaries.
- Keep errors until explicitly dismissed; never steal focus when a toast appears.
- Preserve forms after failure; no automatic retry of mutations, payments or orders.
- Do not copy paid Skiper components or add packages for decorative effects.
- Root `PLAN` remains untouched. Keep unrelated changes out of commits.

## Task 1: Error contract and toast stack

**Files in both clients:** `src/lib/api-errors.ts`, `src/components/api-toasts.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `scripts/api-errors.test.mjs`.

**Interfaces:** `apiErrorFromPayload(payload: unknown, status: number): ApiFailure`; `errorNotice(error: unknown): ErrorNotice`; `presentApiError(error: unknown): string`; `appendNotice(current: ErrorNotice[], notice: ErrorNotice): ErrorNotice[]`. Notices expose localized title/description, sanitized code, HTTP status, a stable deduplication key and safe recovery classification.

- [x] Write failing production-module tests for known-code guidance/localization, status fallback, unsafe unknown server text, network errors and duplicate notices.
- [x] Observe failure, implement the contract and rerun the tests.
- [x] Render `ApiToasts` within the existing language provider in both root layouts. Each notice has a title, description, icon, native dismiss button, alert announcement and optional safe sign-in link; diagnostics are collapsed by default.
- [x] Add logical positioning, mobile sizing/scrolling, 44 px dismissal, contrast and reduced-motion styling.

## Task 2: Existing request consumers

**Files:** client request helpers (`customer-actions.ts`, `catalog-actions.ts`, `support-actions.ts`) and checkout, support, review, cancellation and logout consumers; corresponding existing request tests.

**Interface consumption:** Failed API responses throw `apiErrorFromPayload(payload, response.status)` instead of `Error(rawCode)`. User-action catches call `presentApiError(error)` once and use its safe localized description for local feedback. Success remains based on the actual response only.

```ts
if (!response.ok) throw apiErrorFromPayload(payload, response.status);
// In the owning action's catch:
setMessage(presentApiError(error));
```

- [x] Preserve existing API method/body/encoded-ID request tests; load the actual imported production normalization module rather than a mock.
- [ ] Migrate remaining customer/staff request consumers by inspected workflow; track unmigrated consumers explicitly, not as completed.
- [ ] Browser-test validation, stale closed-ticket edits, private-note isolation and English/Arabic/mobile toast presentation. Confirm inputs and pending controls recover.
- [ ] Run affected client tests, lint, production builds, independent read-only review and staged diff checks. Commit each client's coherent implementation and record evidence in the central audit.

## Broader acceptance still required

The full audit remains open until every UI-accessible request family is migrated and tested, including authentication/MFA/recovery, subscriptions, wallet/referrals, partner verification, uploads, driver actions and all staff operations. Server-rendered page-load failures need their own appropriate error-page presentation rather than a browser toast before hydration. APS withdrawal capability remains separately unverified.

## Initial implementation evidence

The contract tests were observed failing before implementation, then passing in both independently built clients. A further non-JSON-response regression went red before `readApiData` was introduced; customer checkout/referral/quote shape tests went red against the unvalidated production helper before runtime guards were added. An array-valued checkout status was separately reproduced and rejected using strict equality. Known-code/status mapping and safe diagnostics are shared as identical source, not via an unavailable cross-repository package.

Initial consumers migrated: customer checkout/referral/quote, logout, cancellation and review helpful/report action failures; staff catalog request helpers and support actions. This does not complete the remaining-consumer or whole-release checkboxes. Real SIM browser acceptance covered the wallet rejection and support assignment validation, retained fields and re-enabled controls, duplicate-toast suppression, keyboard dismissal, collapsed diagnostics, and English/Arabic customer mobile presentation. Independent review identified and verified corrections for catalog's non-toasted live validation, duplicate live announcements and malformed checkout response guards. See the central endpoint audit for scope and remaining checks.
