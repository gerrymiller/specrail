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

## 2026-04-04 — Truth-and-Ship Pass Findings

- **`specrail policy apply` never existed**: README Quick Start referenced this command but the CLI only has: ingest, inspect, export, exec, cache. Policy is applied at ingest time via `--policy` flag. README corrected.
- **Package not published**: `pnpm add -g specrail` in README was aspirational. Changed to build-from-source instructions.
- **ingest package had zero test coverage**: All four source files (openapi.ts, augmenter.ts, context7.ts, index.ts) had 0% coverage. Added tests in openapi.test.ts, augmenter.test.ts, context7.test.ts.
- **Coverage attribution quirk**: Calling context7.ts through augmenter.ts mock chain doesn't always attribute coverage correctly in vitest workspace mode. Fix: add direct test file for context7.ts.
- **policy/src/classifier.ts had 0% coverage**: It's a thin wrapper around core's classifyOperation. Added classifier.test.ts.
- **Unused imports block lint**: `stat` in cache/store.ts and `type ResolvedAuth` in runtime/executor.ts were unused. Fixed.
- **`store.ts` `seen.has` branch and `?? getLocalCachePath()` fallbacks**: Hard to test without mocking module internals or writing to real cache. These 3 branch lines remain uncovered at 88% branch for store.ts — acceptable since they're cache deduplication logic.
- **openapi.ts defensive branches**: Lines 143, 146, 171, 204 guard against malformed inputs (null responses, unresolved $refs, missing scheme definitions) that swagger-parser normally catches before they reach the code. These remain at ~69% branch for openapi.ts — unreachable with any valid spec.
- **Vertical slice fully verified**: ingest → inspect → export mcp → export skills → exec dry-run → policy denial all work correctly against the petstore fixture.
- **Overall coverage achieved**: 97% statements, 90.3% branches, 97.95% functions — all above the 90% threshold.

## 2026-04-04 — Design Decisions

- **Policy-first**: The decision to deny writes by default was made before any code. This is non-negotiable — it's the entire point of Specrail vs. naive generators.
- **Canonical model**: All packages depend on `@specrail/core` for the `CapabilityBundle` type. Raw OpenAPI types should never leak past the ingest boundary.
- **Two-tier cache**: Project-local (`.specrail/`) takes precedence over global (`~/.cache/specrail/`). This mirrors how tools like turbo and pnpm handle caching.
- **Auth at runtime only**: Auth credentials are resolved from environment variables at execution time. They never appear in the canonical model, bundles, or cache. This is a security boundary.
- **Zod for validation**: The canonical model is defined as Zod schemas in `@specrail/core`. Runtime validation happens at bundle creation and deserialization boundaries.
