# Runtime Broker Architecture

Specrail is a **runtime capability broker**, not a build-time code generator. The broker resolves API providers, ensures governed capability bundles are current, and serves capabilities to agents and humans through a stable interface.

This document is the authoritative design reference for the runtime-broker model.

## Product Model

The core shift: users and agents should not manually provide OpenAPI spec paths, run ingest commands, or manage bundle lifecycles. Specrail handles resolution, caching, freshness, and rebuilding automatically. The user registers a provider once; after that, every interaction goes through the broker.

```
Agent / CLI / MCP
      |
      v
   [Broker]  -- the stable interface
      |
      +-- resolve provider (registry, URL, or file)
      +-- check cache freshness (generator, policy, source, docs)
      +-- rebuild if stale (ingest -> classify -> enforce -> bundle -> cache)
      +-- return current bundle
      |
      v
   [Execute / Export / Inspect]
```

## Resolution Order

Provider resolution is deterministic and inspectable:

1. **Exact URL or file path** -- If the input is a URL or file path, use it directly. This is the escape hatch.
2. **Provider registry lookup** -- The primary path. The user registers providers with `specrail provider add`. The registry maps names to spec URLs, policy overlays, auth prefixes, and TTLs.
3. **Well-known probing** -- Silent fallback. Tries `https://{name}/.well-known/openapi.json` and `https://api.{name}.com/openapi.json`. If neither responds 200 with valid JSON, stops. No crawling, no heuristic chains.
4. **Fail clearly** -- Error message guides toward `specrail provider add`.

The registry is the product. Probing is a courtesy.

## Broker API

The broker is the programmatic center of gravity. The CLI and MCP server are thin wrappers over it.

```typescript
interface Broker {
  // Core operations
  resolve(provider: string): Promise<ResolvedProvider>;
  ensure(opts: BrokerOptions): Promise<CapabilityBundle>;
  capabilities(opts: BrokerOptions): Promise<Capability[]>;
  execute(provider: string, capability: string, params: ExecOptions): Promise<ExecResult>;
  inspect(provider: string): Promise<BundleInspection>;
  refresh(provider: string): Promise<CapabilityBundle>;

  // Provider management
  registerProvider(name: string, config: ProviderConfig): Promise<void>;
  listProviders(): Promise<ProviderEntry[]>;
  removeProvider(name: string): Promise<void>;

  // Export
  exportMcp(provider: string, opts?: McpExportOptions): Promise<McpToolDefinition[]>;
  exportSkills(provider: string, opts?: SkillsExportOptions): Promise<string>;
}
```

`ensure()` is the key method. Every operation that needs a bundle calls `ensure()` first. It runs the resolve-check-rebuild loop and returns a current bundle.

## Freshness Model

Four independent causes of staleness, each with a different detection mechanism:

| Cause           | What Changed                 | Detection                                         | Cost        |
| --------------- | ---------------------------- | ------------------------------------------------- | ----------- |
| Generator stale | Specrail version changed     | Compare `generatorVersion` in meta                | <1ms        |
| Policy stale    | Policy overlay file changed  | Hash overlay, compare against `policyHash`        | <1ms        |
| Source stale    | Upstream API spec changed    | HEAD for ETag/Last-Modified, or full fetch + hash | ~50ms-500ms |
| Docs stale      | Augmentation sources changed | TTL-based only                                    | 0ms         |

Generator and policy staleness are checked first (free, no I/O). Source staleness is only checked when the hard TTL has expired. Docs staleness piggybacks on source rebuilds and never triggers a rebuild on its own.

See [Cache Model](./cache-model.md) for the full freshness check flow.

## Default Policy

Reads only. All side-effecting operations are denied by default, including `action`:

| Class  | Default | Rationale                             |
| ------ | ------- | ------------------------------------- |
| read   | ALLOW   | No side effects                       |
| action | DENY    | Side effects (send, trigger, execute) |
| write  | DENY    | Creates or modifies data              |
| delete | DENY    | Removes data                          |
| admin  | DENY    | Administrative operations             |

You opt in to danger, not out of it.

## Package Graph

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

Total: 9 packages (core, ingest, policy, cache, runtime, export, resolver, broker, cli).

The CLI no longer imports ingest/policy/cache directly. Everything goes through the broker.

## CLI Shape

Every command has a verb. No bare `specrail <provider>`.

```bash
# Provider-centric operations (all auto-resolve + ensure)
specrail inspect <provider>
specrail capabilities <provider>
specrail exec <provider> <capability> [--params '{}'] [--dry-run]
specrail export mcp <provider> [--output file] [--flat]
specrail export skills <provider> [--output file]
specrail refresh <provider>

# Provider management
specrail provider add <name> --spec-url <url> [--docs-url <url>] [--policy <path>]
specrail provider list
specrail provider show <name>
specrail provider remove <name>

# MCP server
specrail serve [--providers <p1,p2,...>]

# Cache management
specrail cache list
specrail cache clean
specrail cache path

# Escape hatch (backward compat)
specrail ingest <spec-path-or-url> --name <name> [--policy <path>]
```

## MCP Server

`specrail serve` starts a stdio MCP server exposing 5 broker-level tools. Agents connect via standard MCP server configuration. See [MCP Strategy](./mcp-strategy.md) for tool definitions.

## Phased Implementation

- **Phase 1: Foundation** -- `@specrail/resolver`, `@specrail/cache` freshness extensions, `@specrail/broker`, default policy change (deny `action`)
- **Phase 2: CLI + MCP Server** -- New CLI commands over broker, `specrail serve`, compressed MCP tools
- **Phase 3: SKILLS + Export Rework** -- Provider-centric SKILLS template, `--flat` flag for legacy MCP export
- **Phase 4: Harden** -- Known providers, OAuth2 token exchange, `specrail doctor`, rate limiting

## Design Constraints

- Generated bundles remain runtime/cache artifacts only, never committed
- Auth credentials are resolved from env vars at execution time, never persisted
- Policy overlays are the authority for what gets exposed
- The canonical `CapabilityBundle` model in `@specrail/core` is the center of gravity
- OpenAPI is first; architecture leaves room for other spec types later
