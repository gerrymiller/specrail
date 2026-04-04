# Specrail

[![CI](https://github.com/gerrymiller/specrail/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gerrymiller/specrail/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node ≥20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

**Turn API specs and docs into governed capabilities for agents.**

---

## The Problem

Every team building AI agents hits the same wall: you have APIs, you have documentation, and you have an agent that needs to call those APIs. The current approach is either hand-writing MCP tool definitions for every endpoint, or running a naive OpenAPI-to-MCP converter that blindly exposes every operation — including the ones that delete production data.

Neither works. Hand-written tools don't scale. Naive converters are dangerous.

Agents shouldn't need to discover API surfaces at runtime and hope for the best. They shouldn't have unconstrained access to every endpoint a spec describes. And the tool definitions they use shouldn't be stale artifacts committed to a repo that drift from the actual API within a week.

**Specrail exists because API capabilities for agents need governance, not just generation.**

It ingests OpenAPI specs (and optionally augments them with live documentation), applies policy overlays that control what gets exposed and how, generates canonical capability bundles cached outside your repo, and exports governed tool definitions — for MCP servers, SKILLS.md files, or direct execution.

The result: your agent gets exactly the capabilities it should have, classified by risk, filtered by policy, with auth resolved at runtime. Nothing more. Nothing less.

## How It Works

Specrail operates as a pipeline:

```
OpenAPI Spec ──┐
               ├──▶ Ingest ──▶ Normalize ──▶ Classify ──▶ Policy ──▶ Bundle ──▶ Cache
Documentation ─┘                                                         │
                                                                         ├──▶ MCP Export
                                                                         ├──▶ SKILLS Export
                                                                         └──▶ Direct Execute
```

1. **Ingest** — Parse an OpenAPI 3.x spec. Optionally fetch supplementary documentation.
2. **Normalize** — Transform raw spec operations into a canonical capability model with uniform structure.
3. **Classify** — Assign each operation a class: `read`, `write`, `delete`, `admin`, or `action`.
4. **Policy** — Apply policy overlays that filter, restrict, and annotate capabilities. Writes denied by default.
5. **Bundle** — Produce a `CapabilityBundle` — a self-contained, serializable representation of the governed API surface.
6. **Cache** — Store the bundle in a two-tier cache (project-local `.specrail/` or global `~/.cache/specrail/`). Never inside the repo.
7. **Export / Execute** — Generate MCP tool definitions, SKILLS.md files, or execute operations directly through the policy gate.

## Quick Start

```bash
# Clone and build from source (not yet published to npm)
git clone https://github.com/gerrymiller/specrail
cd specrail
pnpm install && pnpm build

# Ingest the Petstore spec with default policy (reads only)
node packages/cli/dist/index.js ingest fixtures/specs/petstore.yaml --name petstore

# Export MCP tool definitions
node packages/cli/dist/index.js export mcp petstore

# Or generate a SKILLS.md
node packages/cli/dist/index.js export skills petstore
```

You now have governed, policy-filtered tool definitions for the Petstore API. Write operations are denied by default. To allow specific writes, add a policy overlay:

```bash
# Re-ingest with a custom policy file
node packages/cli/dist/index.js ingest fixtures/specs/petstore.yaml --name petstore --policy ./my-policy.json
node packages/cli/dist/index.js export mcp petstore
```

## Architecture

Specrail is a TypeScript monorepo with seven packages:

| Package | Purpose |
|---------|---------|
| `@specrail/core` | Canonical capability model, shared types, Zod schemas |
| `@specrail/ingest` | OpenAPI parsing, documentation fetching, normalization |
| `@specrail/policy` | Policy overlay engine, operation classification, filtering |
| `@specrail/cache` | Two-tier bundle cache (local + global), lookup, invalidation |
| `@specrail/runtime` | Direct API execution through the policy gate |
| `@specrail/export` | MCP tool definition + SKILLS.md generation |
| `@specrail/cli` | CLI interface orchestrating all packages |

For a deep dive into architecture, data flow, and trust boundaries, see [docs/architecture.md](docs/architecture.md).

## What's Different

Specrail is not another OpenAPI-to-MCP generator. Here's what sets it apart:

| Concern | Naive Generators | Specrail |
|---------|-----------------|----------|
| Operation filtering | None — expose everything | Policy overlays control every operation |
| Write safety | Hope the agent behaves | Writes denied by default |
| Operation classification | None | Every operation classified (read/write/delete/admin/action) |
| Auth handling | Baked into config | Resolved from env vars at runtime, never cached |
| Generated artifacts | Committed to repo, drift | Cached outside repo, regenerated from source |
| Canonical model | Whatever the spec says | Normalized model decoupled from any spec format |
| Documentation augmentation | None | Enrich capabilities with live docs |
| Inspectability | Opaque | Bundles are human-readable JSON, always inspectable |

## Key Design Decisions

These are deliberate, opinionated choices:

- **Generated bundles never live in the repo.** They're cached in `.specrail/` (project-local) or `~/.cache/specrail/` (global). The spec and policy are source-of-truth; bundles are derived artifacts.
- **Policy-first.** Every operation passes through a policy gate. Writes are denied by default. You opt in to danger, not out of it.
- **Canonical model at the center.** Specrail doesn't pass raw OpenAPI structures around. Everything is normalized into a `CapabilityBundle` with uniform types. This decouples the pipeline from any single spec format.
- **Auth credentials never in bundles or cache.** Credentials are resolved from environment variables at execution time. The cache stores capability metadata, never secrets.
- **MCP and SKILLS are first-class exports.** Not afterthoughts. The export layer produces production-quality tool definitions and structured skill descriptions.

For the full set of design principles, see [docs/design-principles.md](docs/design-principles.md).

## Status

### What works now (v0.1 — MVP vertical slice)

- OpenAPI 3.x ingestion and normalization
- Canonical capability model with Zod validation
- Policy overlays with operation classification
- Two-tier bundle caching
- MCP tool definition export
- SKILLS.md export
- Direct execution through policy gate
- CLI orchestration

### Planned

- **v0.2** — Advanced policy rules, multiple simultaneous specs, policy composition
- **v0.3** — OAuth2 token exchange, plugin system for custom augmentation
- **v1.0** — Stable public API, production hardening

See [docs/roadmap.md](docs/roadmap.md) for the full roadmap.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Package dependency graph, data flow, trust boundaries |
| [Cache Model](docs/cache-model.md) | Two-tier cache design, directory structure, lookup order |
| [Canonical Schema](docs/canonical-capability-schema.md) | Full schema reference for the capability model |
| [Competitive Landscape](docs/competitive-landscape.md) | How Specrail compares to alternatives |
| [Design Principles](docs/design-principles.md) | Core design principles and rationale |
| [Execution Model](docs/execution-model.md) | How direct API execution works |
| [Policy Overlays](docs/policy-overlays.md) | Policy system reference |
| [Roadmap](docs/roadmap.md) | Project roadmap and versioning plan |
| [Security Model](docs/security-model.md) | Security considerations and trust boundaries |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch conventions, and contribution guidelines.

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Gerry Miller
