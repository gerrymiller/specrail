# Architecture

Specrail is a **runtime capability broker** built as a modular TypeScript monorepo. It resolves API providers, ensures governed capability bundles are current, and serves capabilities to agents and humans through a stable broker interface.

Every API operation -- regardless of its source format -- is normalized into a single governed representation that policy, cache, and export systems operate on. The canonical capability model is the center of gravity.

## Product Model

Specrail is not a build-time code generator. Users register API providers once; the broker handles resolution, caching, freshness checking, and rebuilding automatically. The stable interface is the broker -- the CLI and MCP server are thin wrappers over it.

See [Runtime Broker](./runtime-broker.md) for the full design reference.

## Package Dependency Graph

```
@specrail/cli
  -> @specrail/broker
       -> @specrail/resolver  -> @specrail/core
       -> @specrail/ingest    -> @specrail/core
       -> @specrail/policy    -> @specrail/core
       -> @specrail/cache     -> @specrail/core
       -> @specrail/runtime   -> @specrail/core, @specrail/policy
       -> @specrail/export    -> @specrail/core, @specrail/policy
  -> @specrail/core (for types only)
```

Total: 9 packages. `@specrail/core` is the foundation -- it defines the canonical types and schemas that every other package depends on. No package other than `core` defines shared types.

The CLI does not import ingest, policy, or cache directly. All orchestration goes through the broker.

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

## Data Flow

### Broker-mediated flow (primary)

```
Agent / CLI / MCP
       |
       v
   [Broker.ensure]
       |
       +-- [Resolver] -- registry lookup, URL/file passthrough, well-known probing
       +-- [Cache] -- check freshness (generator, policy, source, docs)
       |
       v  (if stale or missing)
   [Ingest] -- parse, validate, resolve $refs
       |
       +-- [Augment] -- fetch external docs, Context7 API
       |
       v
   [Normalize] -- map to canonical Capability model
       |
       v
   [Classify] -- assign OperationClass (read/write/delete/admin/action)
       |
       v
   [Policy] -- evaluate overlay rules, enforce allow/deny
       |
       v
   [Bundle] -- assemble CapabilityBundle with hash + freshness metadata
       |
       +---> [Cache] -- write bundle + meta to .specrail/ or ~/.cache/specrail/
       |
       v
   [Return current bundle]
       |
       +---> [Inspect]      -- inspect bundle metadata and capabilities
       +---> [Export MCP]    -- generate broker-level or flat MCP tools
       +---> [Export SKILLS] -- generate provider-centric SKILLS
       +---> [Execute]       -- policy-gated HTTP request
```

### Legacy ingest flow (escape hatch)

The manual `specrail ingest <spec> --name <name>` command is preserved for one-off specs not registered as providers. It bypasses the resolver and writes directly to cache.

## Trust Boundaries

1. **Spec source is untrusted.** API specs come from external URLs or local files. They are validated structurally but their content is not trusted for execution without policy evaluation.

2. **Provider registry is operator-controlled.** The registry maps provider names to spec URLs, policy overlays, and auth prefixes. It is authored by the operator and should be reviewed like configuration. See [Provider Registry](./provider-registry.md).

3. **Policy is the security boundary.** The policy enforcer sits between "what an API can do" and "what an agent is allowed to do." Every capability must pass through policy enforcement before execution or export. The default policy denies all side-effecting operations (write, delete, admin, action).

4. **Credentials never persist.** Auth credentials are resolved from environment variables at execution time. They never appear in bundles, cache files, logs, or export artifacts.

5. **Generated bundles are ephemeral state.** Bundles are generated artifacts stored in cache directories outside the repository. They are inspectable but not version-controlled. The broker manages their lifecycle automatically.

## Why the Canonical Model Matters

The canonical capability model (`Capability` type in `@specrail/core`) is the center of gravity. It provides:

- **Vendor independence.** The model is not tied to OpenAPI, MCP, or any specific agent framework. It normalizes across spec formats.
- **Policy attachment point.** Every capability carries its own policy evaluation result. Policy decisions travel with the capability.
- **Export agnosticism.** MCP and SKILLS exporters consume the same canonical model. Adding new export formats requires no changes to ingestion or policy.
- **Inspectability.** The model serializes to clean JSON. No binary formats, no opaque databases.

## Cache Architecture

Two-tier caching keeps generated artifacts out of the repository:

- **Local cache** (`.specrail/` in project root): Per-project bundles. Gitignored.
- **Global cache** (`~/.cache/specrail/` via XDG): Shared bundles across projects.

Lookup order: local first, then global. See [Cache Model](./cache-model.md) for the full freshness model, including the four staleness causes (generator, policy, source, docs).

## MCP Architecture

Specrail serves as an MCP server (`specrail serve`) exposing a compressed broker-level surface: 5 tools that work with any registered provider. This replaces per-operation tool generation as the primary MCP integration path.

See [MCP Strategy](./mcp-strategy.md) for tool definitions and rationale.
