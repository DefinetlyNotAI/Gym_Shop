# Multi-page Admin and Professional Storefront Implementation Plan

**Goal:** Complete v0.2 visuals using independent admin pages and a softer, professional customer experience.

**Authorization:** The user requested separate admin pages and a softer palette, then explicitly instructed immediate implementation without further design questions. Execute inline in the existing three repositories; do not introduce additional approval or handoff gates.

**Design:** Warm ivory canvas, white and stone surfaces, graphite text, sage-green primary actions, terracotta warning accents. Use one semantic token system, consistent spacing and field states, restrained motion, and real product media. Shopify's single-purpose page guidance, Carbon's persistent side navigation, and Atlassian's token model inform the implementation; no design-system dependency is required.

**Architecture:** `admin.example.com/src/lib/operations-routes.ts` owns destination metadata, role visibility, and page-specific API requests. `src/components/admin-navigation.tsx` renders the persistent responsive navigation. `src/components/operations-page.tsx` loads the selected page's data; `src/app/[section]/page.tsx` validates the destination. Domain components remain reusable and preserve existing mutation contracts. Root becomes a compact overview, not a hidden copy of all sections. The customer app uses the existing shared header/footer and an editorial product-led home/catalog layout.

## Tasks

- [x] Add and run routing regression tests before implementation: independent URLs, unknown routes rejected, finance/customer permission isolation, inventory-only data loading, and role-filtered overview requests.
- [x] Implement destination metadata and loader selection; replace the root admin page with a focused overview and create separate pages for orders, support, delivery settings, analytics, promotions, campaigns, referrals, reviews, verification, payouts, catalog, inventory, customers, finance, notification templates, audits, staff, and launch settings.
- [x] Add persistent grouped side navigation with active-page state and mobile menu; preserve delivery-agent, enrollment, setup, recovery, and sign-in flows.
- [x] Replace both accumulated global stylesheets with one finished light professional foundation; complete all controls, visible labels, metadata, messages, cards, forms, list layouts, focus states, disabled states, 44px targets, RTL, and reduced motion.
- [x] Improve the customer home: editorial hero, clear catalog access, imagery-led product cards and featured collections, purposeful category presentation, compact marketing controls, responsive account shell and checkout forms.
- [x] Run routing tests, lint/typecheck/build in both UI repositories, then browser-test every admin destination and customer/account route at 1440x900 and 390x844, including RTL and console/network errors. Verify unauthorized destinations do not leak data.
- [x] Re-run API unit, v0.1/v0.2 acceptance, migration, lint/typecheck/build verification; reconcile release evidence with current state, preserve PLAN hashes, review diffs, and commit focused changes in the affected repositories.

## Acceptance

Each operations URL renders only its selected domain and uses a readable global shell. No horizontally overflowing page, invisible button label, unstyled field/action, tiny interactive link, raw analytics JSON presentation, duplicated header, or all-in-one section stack is acceptable. Form creation/editing is explicit and does not hide monitoring data. APS beneficiary-disbursement activation remains honestly unavailable without real provider integration evidence.

## Verified outcome

Implemented and browser-checked 19 admin destinations and 22 customer routes at both breakpoints (82 checks). All three static/build matrices and API acceptance/migrations passed; 6 route/reporting regressions passed. Independent review findings on inclusive reporting dates and a campaign textarea label were fixed. Release evidence remains explicit that verified APS beneficiary-disbursement support is absent and blocks payout integration and the v0.2 release gate; these task checks represent delivered software/UI work, not provider activation.
