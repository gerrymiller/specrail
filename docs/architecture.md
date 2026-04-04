# Architecture

Specrail is a modular TypeScript monorepo organized around a canonical capability model. Every API operation -- regardless of its source format -- is normalized into a single governed representation that policy, cache, and export systems operate on.

## Package Dependency Graph

```
@specrail/cli
  -> @specrail/core
  -> @specrail/ingest   -> @specrail/core
  -> @specrail/policy   -> @specrail/core
  -> @specrail/cache    -> @specrail/core
  -> @specrail/runtime  -> @specrail/core, @specrail/policy
  -> @specrail/export   -> @specrail/core, @specrail/policy
```

`@specrail/core` is the foundation. It defines the canonical types and schemas that every other package depends on. No package other than `core` defines shared types.

## Data Flow

```
OpenAPI Spec (URL or file)
       |
       v
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
   [Bundle] -- assemble CapabilityBundle with hash
       |
       +---> [Cache]   -- write to .specrail/ or ~/.cache/specrail/
       +---> [Inspect]  -- read cached bundle as JSON
       +---> [Export MCP] -- generate MCP tool definitions
       +---> [Export SKILLS] -- generate SKILLS.md
       +---> [Execute]  -- policy-gated HTTP request
```

## Trust Boundaries

1. **Spec source is untrusted.** API specs come from external URLs or local files. They are validated structurally but their content is not trusted for execution without policy evaluation.

2. **Policy is the security boundary.** The policy enforcer sits between "what an API can do" and "what an agent is allowed to do." Every capability must pass through policy enforcement before execution or export.

3. **Credentials never persist.** Auth credentials are resolved from environment variables at execution time. They never appear in bundles, cache files, logs, or export artifacts.

4. **Generated bundles are ephemeral state.** Bundles are generated artifacts stored in cache directories outside the repository. They are inspectable but not version-controlled.

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

Lookup order: local first, then global. See [Cache Model](./cache-model.md) for details.
