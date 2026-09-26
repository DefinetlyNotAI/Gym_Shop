# Gym Shop v0.2 Complete Visual System Plan

> **Execution:** Implement inline in the current session. The user approved both completing the visual system and improving the current dark athletic direction where needed.

**Goal:** Replace the partially styled v0.2 interfaces with one production-quality visual system across the storefront, account area, admin operations console, delivery workflow, and recovery/setup surfaces without changing the established product architecture or release behavior.

**Visual thesis:** A focused athletic command center: near-black green surfaces, precise lime emphasis, strong information hierarchy, compact operational density, and restrained motion. Decoration must support orientation and action; every interactive or data state must look intentional.

**Architecture:** Keep each Next.js application and its existing component model. Extend the shared CSS foundations in each app, add semantic component classes and accessible field structure where raw markup prevents robust styling, and use logical CSS properties so the same layout works in English and Arabic RTL. No new styling framework or runtime dependency is required.

**Verification:** Treat the existing visual audit as the red baseline. Use lint, type checking, production builds, and real-browser inspection at desktop (1440x900) and mobile (390x844), including Arabic RTL, focus states, empty/error states, console errors, horizontal overflow, and minimum 44px interactive targets.

---

### Task 1: Establish the complete shared UI foundation

**Files:**
- Modify: `example.com/src/app/globals.css`
- Modify: `admin.example.com/src/app/globals.css`

- [x] Define consistent color, typography, spacing, radius, border, elevation, focus, motion, and responsive tokens.
- [x] Finish button variants and states: primary, secondary, ghost, destructive, disabled, loading, icon-only, and grouped actions.
- [x] Finish fields and states: labels, hints, validation, checkboxes, selects, text areas, disabled controls, alerts, notices, status badges, empty states, and loading surfaces.
- [x] Guarantee visible keyboard focus and at least 44px hit areas for buttons, navigation links, and checkbox rows.
- [x] Use logical properties and reduced-motion handling throughout.

### Task 2: Complete the storefront and account experience

**Files:**
- Modify: `example.com/src/app/globals.css`
- Modify: `example.com/src/app/layout.tsx`
- Modify: `example.com/src/app/page.tsx`
- Modify: `example.com/src/app/account/**/*.tsx`
- Modify: `example.com/src/app/cart/**/*.tsx`
- Modify: `example.com/src/app/checkout/**/*.tsx`
- Modify: `example.com/src/app/shop/**/*.tsx`
- Modify: `example.com/src/components/**/*.tsx` only where semantic structure or accessibility is required

- [x] Refine the global navigation, language/cart utilities, responsive menu behavior, and footer as a single clear shell.
- [x] Complete home, catalog, product, cart, and checkout hierarchy, including product imagery, price/action hierarchy, delivery context, form grouping, and order feedback.
- [x] Give every account capability a consistent page header, local navigation, content panel, state treatment, and responsive action layout.
- [x] Verify long content, empty data, success/error notices, disabled actions, and authenticated/unauthenticated states do not fall back to raw browser styling.

### Task 3: Turn the admin page into a compact operations workspace

**Files:**
- Modify: `admin.example.com/src/app/globals.css`
- Modify: `admin.example.com/src/app/layout.tsx`
- Modify: `admin.example.com/src/app/page.tsx`
- Modify: `admin.example.com/src/components/operations-console.tsx`
- Modify: `admin.example.com/src/components/**/*.tsx` where section structure, labels, or status metadata is needed

- [x] Create a responsive operations shell with a sticky desktop section rail and horizontally scrollable mobile rail.
- [x] Give every domain a consistent work-section header, compact metrics, form grid, data list, badges, and action hierarchy.
- [x] Reduce the extremely long all-expanded page by grouping secondary create/edit workflows while keeping monitoring data and queues visible.
- [x] Replace unlabeled or visually ambiguous raw fields with accessible labeled controls and intentional help text.
- [x] Ensure CTO, admin, delivery, support, finance, catalog, inventory, customer, promotion, campaign, referral, review, verification, payout, notification, audit, and staff surfaces all receive finished styling.

### Task 4: Complete operational edge surfaces

**Files:**
- Modify: `admin.example.com/src/app/delivery/**/*.tsx`
- Modify: `admin.example.com/src/app/setup/**/*.tsx`
- Modify: `admin.example.com/src/app/recovery/**/*.tsx`
- Modify: `admin.example.com/src/app/enrollment/**/*.tsx`
- Modify: relevant shared components and CSS

- [x] Apply the same shell, card, field, alert, action, and responsive rules to delivery, setup, recovery, enrollment, and auth-related screens.
- [x] Verify destructive and irreversible actions are visually distinct and retain clear confirmation context.
- [x] Verify keyboard, mobile, overflow, and empty/error behavior for each edge workflow.

### Task 5: Perform full visual and release verification

**Files:**
- Modify: `docs/release-evidence/v0.2.md`
- Modify: `docs/superpowers/plans/2026-09-11-v0.2-release.md`

- [x] Run targeted lint and type checking after each coherent application slice.
- [x] Run production builds for storefront and admin after the CSS/markup changes.
- [x] Start the integrated simulator only after confirming ports are free, then inspect the complete storefront and admin route matrix in a real browser.
- [x] Check 1440x900 and 390x844 layouts, English and Arabic RTL, focus visibility, interactive target sizing, scroll/overflow, console errors, and background request errors.
- [x] Re-run the API unit, v0.1 acceptance, v0.2 acceptance, migration, lint, typecheck, and production build gates so the visual work cannot regress release behavior.
- [x] Record concrete visual acceptance evidence and the external APS beneficiary-disbursement activation blocker in v0.2 release evidence.
- [x] Confirm the protected sibling `PLAN` directory is unchanged.
- [x] Review diffs, exclude unrelated changes, and create focused Conventional Commits in each affected repository.
