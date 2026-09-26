# Gym Shop Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three nested Git repositories with one clean root monorepo while preserving every application commit, current tracked change, ignored local working file, `PLAN/`, and the shared launcher.

**Architecture:** Commit and bundle each child repository first, move complete child directories into a validated temporary sibling directory, initialize the root, then import each child history without squashing through `git subtree add`. Restore only ignored local artifacts from the temporary copies, verify history and file parity, then remove the rollback copies.

**Tech Stack:** Git, Git subtree, PowerShell, Node.js, npm, Next.js 16.3.4

**Spec:** `PLAN/reference/2026-09-26-monorepo-migration-design.md`

## Global Constraints

- Preserve all 113 pre-migration commits and all three recorded child tips.
- Keep directories named `example.com`, `api.example.com`, and `admin.example.com`.
- Keep each application's package manifest, lockfile, commands, port and deployment boundary independent.
- Do not introduce npm workspaces, dependency hoisting, shared packages, remotes or application refactors.
- Commit every currently tracked change before importing histories.
- Never stage ignored dependencies, build output, local secrets, `AGENTS.md`, `CLAUDE.md`, or TypeScript build metadata.
- Keep rollback repositories and bundles until all verification passes.
- Prefix every shell command with `rtk`.

## Non-goals

- Do not refactor application code, update dependencies, add npm workspaces, hoist packages, create shared packages, change deployment boundaries or configure remotes.
- Do not squash or rewrite child histories.
- Do not stage dependency trees, build output, local secrets, ignored instruction files or rollback artifacts.

## Review Focus

- A failed subtree import must leave three recoverable child repositories and valid bundles.
- Existing ignored `node_modules` and `.next` trees must remain ignored and usable after migration, not enter Git history.
- Each original child tip must be reachable from root `HEAD`, proving history was imported rather than copied as a snapshot.
- Existing tracked-file content must match the post-commit child repositories after subtree import.
- Root status must be empty without discarding unrelated or generated working files.

---

### Task 1: Seal and inventory the child repositories

**Files:**
- Modify: `example.com/.gitignore`
- Modify: `example.com/next-env.d.ts`
- Modify: `api.example.com/.gitignore`
- Modify: `api.example.com/next-env.d.ts`
- Modify: `admin.example.com/.gitignore`
- Modify: `admin.example.com/next-env.d.ts`
- Create outside workspace: three tracked-file inventories and three Git bundles in the generated rollback directory

**Interfaces:**
- Consumes: the three child `main` branches and their complete working directories
- Produces: clean child repositories, recorded tip hashes, tracked-file SHA-256 inventories, and verified full-history bundles

- [ ] **Step 1: Record the pre-commit repository state**

For each child, record branch, `HEAD`, status, commit count, tracked files, ignored files and `git fsck --no-dangling`. Abort if a branch is not `main`, repository integrity fails, or an unexpected untracked non-ignored file exists.

- [ ] **Step 2: Inspect and commit current tracked changes**

Inspect each actual diff, stage only `.gitignore` and `next-env.d.ts`, and commit separately in each child as `chore(repo): preserve pending workspace changes`. Confirm `git status --short` is empty after each commit.

- [ ] **Step 3: Create the rollback directory and inventories**

Create one uniquely named temporary sibling of the workspace. Resolve and verify that it is outside but adjacent to the Gym Shop root. Save each child tip, `git ls-files`, and per-file SHA-256 values there.

- [ ] **Step 4: Create and verify full Git bundles**

Run `git bundle create <bundle> --all` in each child, then `git bundle verify <bundle>`. Expected: every bundle is complete and contains its `main` reference.

- [ ] **Step 5: Checkpoint**

Confirm three clean child repositories, three verified bundles, three inventories and exact post-commit tip hashes before any directory move.

### Task 2: Initialize the root repository

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Track: `PLAN/**`
- Track: `docs/superpowers/plans/2026-09-26-monorepo-migration.md`
- Track: `run-sites.mjs`

**Interfaces:**
- Consumes: the validated rollback directory and root-owned files
- Produces: a root `main` repository with no application snapshot committed yet

- [ ] **Step 1: Move complete child directories to rollback storage**

Resolve all six source/destination paths. Require each source to be a direct child of the Gym Shop root and each destination to be a direct child of the exact rollback directory. Move each application directory once; verify the source is absent and destination contains its `.git` directory and recorded tip.

- [ ] **Step 2: Create root repository metadata**

Run `git init -b main`. Create a root `.gitignore` for recursive `.next/`, `node_modules/`, `*.tsbuildinfo`, environment files except examples, editor/OS files and migration rollback artifacts. Create a concise root `README.md` with project layout, ports and per-app commands.

- [ ] **Step 3: Verify the initial root staging set**

Run `git status --short` and `git diff --cached --check` after staging root-owned files. Expected: no application directories, dependency directories, secrets or generated build artifacts are staged.

- [ ] **Step 4: Commit root bootstrap**

Commit as `chore(repo): initialize monorepo root`.

### Task 3: Import all application histories

**Files:**
- Create through subtree imports: `example.com/**`
- Create through subtree imports: `api.example.com/**`
- Create through subtree imports: `admin.example.com/**`

**Interfaces:**
- Consumes: the three moved repositories and their post-commit `main` tips
- Produces: three non-squashed subtree histories rooted at the original directory names

- [ ] **Step 1: Import storefront history**

Run `git subtree add --prefix=example.com <rollback-storefront-path> main` without `--squash`. Verify the recorded storefront tip is an ancestor of `HEAD` and its tracked-file inventory matches paths under `example.com/`.

- [ ] **Step 2: Import API history**

Run `git subtree add --prefix=api.example.com <rollback-api-path> main` without `--squash`. Verify the recorded API tip is an ancestor of `HEAD` and its tracked-file inventory matches paths under `api.example.com/`.

- [ ] **Step 3: Import admin history**

Run `git subtree add --prefix=admin.example.com <rollback-admin-path> main` without `--squash`. Verify the recorded admin tip is an ancestor of `HEAD` and its tracked-file inventory matches paths under `admin.example.com/`.

- [ ] **Step 4: Verify combined history**

Run `git fsck --no-dangling`, inspect `git log --graph --all --oneline`, and confirm all three recorded child tips satisfy `git merge-base --is-ancestor <tip> HEAD`.

### Task 4: Restore ignored local state and normalize monorepo documentation

**Files:**
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `PLAN/STATUS.md`
- Modify: `PLAN/README.md`
- Restore ignored only: application `node_modules/`, `.next/`, `*.tsbuildinfo`, `AGENTS.md`, `CLAUDE.md`, and other paths proven ignored by both the child and root rules

**Interfaces:**
- Consumes: imported application trees and the moved complete working directories
- Produces: the same usable local environment under a single root repository with accurate documentation

- [ ] **Step 1: Restore ignored paths without nested Git metadata**

Copy only paths that were recorded as ignored before migration. Explicitly exclude `.git` and refuse any copy target outside the matching application directory.

- [ ] **Step 2: Prove and complete the root ignore contract**

Run `git status --ignored --short` and `git check-ignore -v` on every restored dependency, build and local-instruction path class. Add only a missing recursive pattern from the Global Constraints, then repeat the check. Expected: ignored markers only; root `git status --short` remains empty.

- [ ] **Step 3: Update repository-layout documentation**

Change PLAN status/history language from three independent repositories to one monorepo with three independently deployable applications. Keep the external provider and release status unchanged.

- [ ] **Step 4: Commit migration cleanup**

Inspect the diff, stage only root documentation/configuration changes, run `git diff --cached --check`, and commit as `chore(repo): complete monorepo migration`.

### Task 5: Verify, clean and retire rollback state

**Files:**
- Verify: complete root repository
- Remove after verification only: exact generated rollback directory and its bundles/inventories

**Interfaces:**
- Consumes: the completed root monorepo and rollback material
- Produces: one clean, verified repository with no nested `.git` directories

- [ ] **Step 1: Verify PLAN integrity**

Recalculate all 20 archived-original SHA-256 values, resolve every local Markdown link and confirm no stale independent-repository language remains in active status documentation.

- [ ] **Step 2: Run repository checks**

Run `git fsck --no-dangling`, `git diff --check`, confirm each child tip is an ancestor of `HEAD`, compare every application tracked-file hash with its inventory, and search below the root for nested `.git` entries.

- [ ] **Step 3: Run application verification**

In each application run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`. In the API additionally run `npm run db:verify`, `npm run db:check`, `npm run test:acceptance`, and `npm run test:acceptance:v02`. Run `node --check run-sites.mjs` at the root.

- [ ] **Step 4: Verify final cleanliness before deleting rollback state**

Require all checks to pass and `git status --short` to be empty. Confirm the root repository contains the expected commits and the three post-commit child tips.

- [ ] **Step 5: Remove exact rollback directory**

Re-resolve the rollback directory, verify it is the generated sibling path and is not the workspace/root/home directory, then remove it recursively. Re-run `git status --short` and `git fsck --no-dangling`.

- [ ] **Step 6: Report final result**

Report the root commit hashes, preserved child tips and commit counts, full verification results, absence of nested repositories, and exact clean-status output.
