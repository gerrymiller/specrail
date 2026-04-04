# AGENTS.md — Specrail

Portable instructions for AI coding assistants (Claude Code, Droid, Cursor, Zed AI, etc.).

## Bootstrap Order

1. If your tool has a user-level or global instruction file, read it first.
2. Read `LEARNINGS.md` at repo root.
3. Read this file.
4. Only pull in `docs/` files when a task explicitly requires deep context.

Do **not** preload the entire `docs/` directory. It exists for reference, not warm-up.

## Project Summary

Specrail turns API specs into governed capability bundles for agents. TypeScript monorepo: `pnpm` + `turbo` + `tsup` + `vitest`.

Packages: `@specrail/{core, ingest, policy, cache, runtime, export, cli}` under `packages/`.

## Essential Commands

```bash
pnpm install              # Install deps
pnpm build                # Build all packages (turbo)
pnpm test                 # Run all tests (vitest)
pnpm test:coverage        # Run with coverage (90% threshold enforced)
pnpm lint                 # Lint all packages
pnpm lint:fix             # Auto-fix lint issues
pnpm format               # Prettier format
pnpm format:check         # Check formatting
pnpm typecheck            # TypeScript type checking
```

## Git Workflow

**Never commit directly to `main`.** Use gitflow:

- `develop` — integration branch
- `feature/*` — new work
- `bugfix/*` — fixes
- `chore/*` — maintenance
- `hotfix/*` — critical production fixes (from `main`, merge to both)

Before every commit: `git rev-parse --abbrev-ref HEAD` — if it says `main`, stop.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(ingest): add OpenAPI 3.1 support
fix(policy): correct first-match rule evaluation
test(cache): add two-tier lookup integration tests
chore(deps): bump vitest to 3.1
```

## Code Standards

- TypeScript strict mode (`strict: true` in tsconfig)
- ESLint: `@eslint/js` recommended + `typescript-eslint` recommended
- Prettier: single quotes, semicolons, trailing commas, 100-char width
- Tests: vitest, 90% coverage minimum (statements, branches, functions, lines)
- Every new source file gets a corresponding test file
- Test before commit. Always.

## Architecture Rules

- Generated bundles are **never** committed to the repo (`.specrail/` is gitignored)
- Auth credentials never appear in bundles or cache — env vars only at runtime
- Policy overlays are the authority for what gets exposed
- The canonical `CapabilityBundle` model (in `@specrail/core`) is the center of gravity
- All cross-package types flow through `@specrail/core`

## Key Files

| Path                    | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `packages/core/src/`    | Canonical model, Zod schemas, shared types |
| `packages/ingest/src/`  | OpenAPI parser, doc fetcher, normalizer    |
| `packages/policy/src/`  | Policy engine, operation classifier        |
| `packages/cache/src/`   | Two-tier cache (local + global)            |
| `packages/runtime/src/` | Direct API execution through policy gate   |
| `packages/export/src/`  | MCP + SKILLS.md generators                 |
| `packages/cli/src/`     | CLI entry point and commands               |
| `fixtures/specs/`       | Test OpenAPI specs                         |
| `fixtures/policies/`    | Test policy overlays                       |

## Deep Documentation

When needed, consult `docs/`:

- `docs/architecture.md` — package graph, data flow, trust boundaries
- `docs/canonical-capability-schema.md` — full schema reference
- `docs/policy-overlays.md` — policy format and rule evaluation
- `docs/security-model.md` — credential handling, trust boundaries
- `docs/cache-model.md` — cache tiers, directory structure
- `docs/execution-model.md` — runtime execution flow

## Attribution

All work is authored by Gerry Miller. Do not add AI co-author attributions to commits.
