# LEARNINGS.md — Specrail

Project-specific learnings. AI assistants: read this at session start, update when you discover something new.

---

## 2026-04-04 — Project Bootstrap

- **Monorepo structure**: pnpm workspaces + turborepo. All packages under `packages/`. Workspace defined in `pnpm-workspace.yaml`.
- **Build tooling**: `tsup` for each package build, `turbo` for orchestration. Build order respects `dependsOn: ["^build"]` in `turbo.json`.
- **Test framework**: vitest with workspace mode (`vitest.workspace.ts` points to `packages/*`). Coverage via `@vitest/coverage-v8` with 90% threshold on all four metrics.
- **TypeScript config**: `ES2022` target, `ESNext` module, `bundler` moduleResolution. Strict mode enabled. Separate `tsconfig.build.json` excludes test files from declarations.
- **Linting**: Flat ESLint config (`eslint.config.js`) using `@eslint/js` recommended + `typescript-eslint` recommended. Unused vars with `_` prefix allowed.
- **Formatting**: Prettier with single quotes, semicolons, trailing commas everywhere, 100-char line width, 2-space indent, LF line endings.
- **Generated bundles must never be committed**: `.specrail/`, `*.generated.json`, `*.bundle.json` are all in `.gitignore`. This is a core architectural invariant.
- **Package naming**: `@specrail/{name}` scoped packages. Seven total: core, ingest, policy, cache, runtime, export, cli.
- **Node requirements**: Node >= 20.0.0, pnpm >= 9.0.0. Package manager pinned to `pnpm@9.15.0`.
- **Fixture directories**: `fixtures/specs/` for test OpenAPI specs, `fixtures/policies/` for test policy overlays. Both currently empty, to be populated.
- **License**: MIT, copyright 2026 Gerry Miller.
- **Repo**: `https://github.com/gerrymiller/specrail`

## 2026-04-04 — Design Decisions

- **Policy-first**: The decision to deny writes by default was made before any code. This is non-negotiable — it's the entire point of Specrail vs. naive generators.
- **Canonical model**: All packages depend on `@specrail/core` for the `CapabilityBundle` type. Raw OpenAPI types should never leak past the ingest boundary.
- **Two-tier cache**: Project-local (`.specrail/`) takes precedence over global (`~/.cache/specrail/`). This mirrors how tools like turbo and pnpm handle caching.
- **Auth at runtime only**: Auth credentials are resolved from environment variables at execution time. They never appear in the canonical model, bundles, or cache. This is a security boundary.
- **Zod for validation**: The canonical model is defined as Zod schemas in `@specrail/core`. Runtime validation happens at bundle creation and deserialization boundaries.
