# Monorepo migration design

Date: 2026-09-26

## Objective

Convert the Gym Shop workspace into one root Git repository while retaining the complete histories of `example.com`, `api.example.com`, and `admin.example.com` under their existing directory names. Include `PLAN/` and `run-sites.mjs`, preserve all current tracked and ignored working files, commit every current uncommitted change, and finish with a clean root worktree and no nested Git repositories.

## Current state

- The workspace root is not a Git repository.
- All three applications use branch `main`, have no configured remotes, and pass `git fsck --no-dangling`.
- The application histories contain 36 storefront commits, 42 API commits, and 35 admin commits.
- Each application currently has uncommitted `.gitignore` and generated `next-env.d.ts` changes.
- `PLAN/` and `run-sites.mjs` are outside every current repository.
- Ignored local dependencies and build artifacts must remain ignored and must not enter history.

## Selected approach

Use non-squashed Git subtree imports into a new root repository.

1. Commit each child repository's current tracked changes with a focused Conventional Commit.
2. Create recoverable Git bundles for all three completed child histories.
3. Move the three application directories to a validated temporary sibling directory so the root paths are available for subtree import. The complete directories move together, retaining ignored local files and nested Git metadata during the transition.
4. Initialize the root repository on `main` and commit the root-owned `PLAN/`, `run-sites.mjs`, and root ignore/configuration files.
5. Import each child `main` history without `--squash` at its original path using `git subtree add --prefix=...`.
6. Restore ignored local files such as `node_modules`, `.next`, local instruction files and TypeScript build metadata from the temporary copies without restoring nested `.git` directories.
7. Verify history reachability, tracked-file parity, absence of nested repositories, root ignore behavior, application tests/build checks, plan integrity and a clean root status.
8. Remove the temporary directories and bundles only after every verification passes and the root history contains all three original tips.

This approach is preferred over a clean snapshot because it retains authorship, commit messages and historical blame. It is preferred over submodules because the requested result is one repository, not four linked repositories.

## Root repository structure

```text
Gym Shop/
├── .git/
├── .gitignore
├── README.md
├── PLAN/
├── run-sites.mjs
├── example.com/
├── api.example.com/
└── admin.example.com/
```

The root `README.md` will explain the three applications, local ports and common commands. The root `.gitignore` will cover root-level editor/OS artifacts and recursive dependency/build outputs; application-specific ignore files remain in place.

No npm workspace abstraction or shared package is introduced. The applications keep their independent package manifests, lockfiles, commands and deployment boundaries. This migration changes version-control ownership only.

## Commit structure

1. Storefront: `chore(repo): preserve pending workspace changes`
2. API: `chore(repo): preserve pending workspace changes`
3. Admin: `chore(repo): preserve pending workspace changes`
4. Root bootstrap: `chore(repo): initialize monorepo root`
5. One Git-generated subtree merge commit per application history.
6. Final root cleanup/documentation commit: `chore(repo): complete monorepo migration`

The subtree merge commits remain distinct so each imported history has an obvious integration boundary.

## Safety and rollback

- Record each child tip and tracked-file list before migration.
- Create one full Git bundle per child after its pending-change commit.
- Refuse to move or remove any path that does not resolve beneath the Gym Shop workspace or the exact generated temporary directory.
- Do not delete the temporary repositories or bundles until root history, file parity and checks succeed.
- If an import fails, restore the moved directories to their original paths; their `.git` directories remain intact in the temporary copies.
- Preserve ignored local files but never stage them.

## Verification

- `git fsck --no-dangling` succeeds at the root.
- Each recorded child tip is an ancestor of root `HEAD`.
- Root tracked files under each application match the child tracked-file inventory.
- No `.git` entry exists below the root.
- `git status --short` is empty; ignored dependency/build paths remain ignored.
- `PLAN` hashes and local Markdown links still pass.
- All three application tests, lint, type checks and production builds pass.
- The shared launcher parses and the local port contract remains 3030/4000/5000.

## Non-goals

- No application refactor, dependency update, package-manager workspace, shared dependency hoisting, deployment change or remote creation.
- No squashing or rewriting of child histories.
- No staging of `node_modules`, `.next`, build metadata, local secrets or ignored instruction files.
