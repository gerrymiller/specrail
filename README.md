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

Specrail is a **runtime capability broker**. You register API providers once; Specrail automatically resolves their specs, builds governed capability bundles, caches them with freshness tracking, and serves capabilities to agents through a compressed MCP surface or CLI.

The result: your agent gets exactly the capabilities it should have, classified by risk, filtered by policy, with auth resolved at runtime. Nothing more. Nothing less.

## How It Works

```
Agent / CLI / MCP
       |
       v
   [Broker] -- resolve provider, check freshness, rebuild if stale
       |
       +-- Provider Registry (spec URL, policy, auth, TTL)
       +-- Two-tier Cache (.specrail/ + ~/.cache/specrail/)
       |
       v
   [Ingest] -> [Classify] -> [Policy] -> [Bundle] -> [Cache]
       |
       +---> MCP Server (5 broker-level tools)
       +---> SKILLS.md Export
       +---> Direct Execution
```

1. **Resolve** — Look up the provider in the registry, or accept a URL/file directly.
2. **Ensure** — Check cache freshness (generator version, policy hash, source ETag/hash, TTL). Rebuild if stale.
3. **Ingest** — Parse an OpenAPI 3.x spec. Optionally fetch supplementary documentation.
4. **Classify** — Assign each operation a class: `read`, `write`, `delete`, `admin`, or `action`.
5. **Policy** — Apply policy overlays. All side-effecting operations denied by default.
6. **Bundle** — Produce a `CapabilityBundle` with freshness metadata. Cache outside the repo.
7. **Serve** — Expose capabilities via MCP server, SKILLS export, or direct execution.

## Quick Start

```bash
# Clone and build from source (not yet published to npm)
git clone https://github.com/gerrymiller/specrail
cd specrail
pnpm install && pnpm build

# Register a provider
node packages/cli/dist/index.js provider add petstore \
  --spec-url https://petstore3.swagger.io/api/v3/openapi.json

# Inspect the provider (auto-resolves and builds the bundle)
node packages/cli/dist/index.js inspect petstore

# List capabilities
node packages/cli/dist/index.js capabilities petstore

# Export MCP tool definitions
node packages/cli/dist/index.js export mcp petstore

# Execute a capability (reads allowed by default)
node packages/cli/dist/index.js exec petstore listPets --dry-run
```

Write, delete, admin, and action operations are denied by default. To allow specific operations, add a policy overlay:

```bash
node packages/cli/dist/index.js provider add petstore \
  --spec-url https://petstore3.swagger.io/api/v3/openapi.json \
  --policy ./my-policy.json
node packages/cli/dist/index.js refresh petstore
```

### MCP Server

Agents connect to Specrail as an MCP server with 5 broker-level tools:

```json
{
  "mcpServers": {
    "specrail": { "command": "specrail", "args": ["serve"] }
  }
}
```

See [docs/mcp-strategy.md](docs/mcp-strategy.md) for tool definitions.

## Architecture

Specrail is a TypeScript monorepo with nine packages:

| Package              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `@specrail/core`     | Canonical capability model, shared types, Zod schemas      |
| `@specrail/resolver` | Provider registry, resolution chain, spec discovery        |
| `@specrail/ingest`   | OpenAPI parsing, documentation fetching, normalization     |
| `@specrail/policy`   | Policy overlay engine, operation classification, filtering |
| `@specrail/cache`    | Two-tier bundle cache with freshness tracking              |
| `@specrail/runtime`  | Direct API execution through the policy gate               |
| `@specrail/export`   | MCP tool definitions + SKILLS.md generation                |
| `@specrail/broker`   | Runtime orchestration: resolve, ensure, execute            |
| `@specrail/cli`      | CLI interface and MCP server (`specrail serve`)            |

For a deep dive into architecture, data flow, and trust boundaries, see [docs/architecture.md](docs/architecture.md).

## What's Different

Specrail is not another OpenAPI-to-MCP generator. Here's what sets it apart:

| Concern                  | Naive Generators         | Specrail                                                    |
| ------------------------ | ------------------------ | ----------------------------------------------------------- |
| Operation filtering      | None — expose everything | Policy overlays control every operation                     |
| Write safety             | Hope the agent behaves   | All side effects denied by default (write, delete, action)  |
| Operation classification | None                     | Every operation classified (read/write/delete/admin/action) |
| Auth handling            | Baked into config        | Resolved from env vars at runtime, never cached             |
| Generated artifacts      | Committed to repo, drift | Cached outside repo, auto-refreshed by the broker           |
| Canonical model          | Whatever the spec says   | Normalized model decoupled from any spec format             |
| MCP integration          | One tool per operation   | 5 broker-level tools for any number of providers            |
| Bundle lifecycle         | Manual regeneration      | Automatic freshness checking with 4 staleness causes        |
| Inspectability           | Opaque                   | Bundles are human-readable JSON, always inspectable         |

## Key Design Decisions

These are deliberate, opinionated choices:

- **Generated bundles never live in the repo.** They're cached in `.specrail/` (project-local) or `~/.cache/specrail/` (global). The spec and policy are source-of-truth; bundles are derived artifacts.
- **Policy-first.** Every operation passes through a policy gate. All side-effecting operations (write, delete, admin, action) are denied by default. You opt in to danger, not out of it.
- **Broker-first.** Specrail is a runtime capability broker, not a build-time generator. Users register providers once; the broker handles resolution, caching, freshness, and rebuilding automatically.
- **Canonical model at the center.** Specrail doesn't pass raw OpenAPI structures around. Everything is normalized into a `CapabilityBundle` with uniform types. This decouples the pipeline from any single spec format.
- **Auth credentials never in bundles or cache.** Credentials are resolved from environment variables at execution time. The cache stores capability metadata, never secrets.
- **Compressed MCP surface.** Specrail serves 5 broker-level MCP tools instead of one per API operation. Adding a provider doesn't change the MCP surface.

For the full set of design principles, see [docs/design-principles.md](docs/design-principles.md).

## Status

### What works now (v0.1 — MVP vertical slice)

- OpenAPI 3.x ingestion and normalization
- Canonical capability model with Zod validation
- Policy overlays with operation classification
- Two-tier bundle caching
- MCP tool definition export (per-operation, flat format)
- SKILLS.md export
- Direct execution through policy gate
- CLI orchestration (ingest-first workflow)

### In progress (v0.2 — Runtime broker pivot)

- **Provider registry** — Versioned, schema-validated provider configuration
- **Resolver** — Registry lookup, URL passthrough, well-known probing
- **Broker** — Resolve/ensure/execute orchestration with automatic freshness checking
- **Freshness model** — Four staleness causes: generator, policy, source, docs
- **Default policy change** — Deny `action` alongside write/delete/admin
- **`specrail serve`** — Stdio MCP server with 5 broker-level tools
- **Compressed MCP surface** — Provider-agnostic tools replace per-operation exports

### Planned

- **v0.3** — Provider-centric SKILLS template, OAuth2 token exchange
- **v1.0** — Stable public API, known-provider defaults, production hardening

See [docs/runtime-broker.md](docs/runtime-broker.md) for the full design reference.

## Documentation

| Document                                                | Description                                           |
| ------------------------------------------------------- | ----------------------------------------------------- |
| [Runtime Broker](docs/runtime-broker.md)                | Authoritative design reference for the broker model   |
| [Provider Registry](docs/provider-registry.md)          | Registry format, resolution order, examples           |
| [MCP Strategy](docs/mcp-strategy.md)                    | Compressed MCP surface, tool definitions, rationale   |
| [Architecture](docs/architecture.md)                    | Package dependency graph, data flow, trust boundaries |
| [Cache Model](docs/cache-model.md)                      | Two-tier cache, freshness model, staleness causes     |
| [Canonical Schema](docs/canonical-capability-schema.md) | Full schema reference for the capability model        |
| [Competitive Landscape](docs/competitive-landscape.md)  | How Specrail compares to alternatives                 |
| [Design Principles](docs/design-principles.md)          | Core design principles and rationale                  |
| [Execution Model](docs/execution-model.md)              | Broker-mediated API execution                         |
| [Policy Overlays](docs/policy-overlays.md)              | Policy system reference                               |
| [Security Model](docs/security-model.md)                | Security considerations and trust boundaries          |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branch conventions, and contribution guidelines.

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Gerry Miller
