# Gym Shop

Gym Shop is a monorepo containing three independently deployable Next.js applications and their canonical product plan.

| Application | Directory | Local URL |
| --- | --- | --- |
| Storefront | `example.com/` | `http://localhost:3030` |
| Staff application | `admin.example.com/` | `http://localhost:4000` |
| API | `api.example.com/` | `http://localhost:5000` |

The applications retain separate `package.json` files, lockfiles, build commands and deployment boundaries. This repository does not use npm workspaces or dependency hoisting.

## Development

Start all three applications in local simulation mode from the repository root:

```powershell
node run-sites.mjs sim
```

Run an individual application from its directory with `npm run dev`. Each application also provides `test`, `lint`, `typecheck` and `build` scripts.

## Documentation

Start with [PLAN/README.md](PLAN/README.md). [PLAN/STATUS.md](PLAN/STATUS.md) distinguishes implemented software, local verification, production activation blockers and future releases.
