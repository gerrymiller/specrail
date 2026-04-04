# Design Principles

These principles guide every architectural and implementation decision in Specrail.

## 1. Specs Are Primary Truth

The API specification is the authoritative source of what an API can do. Documentation augments the spec; it does not replace it. If the spec says an endpoint exists, it exists. If the spec says a parameter is required, it is required. External docs and Context7 data enrich descriptions but never override structural facts.

## 2. Policy Before Exposure

No capability is exposed to agents without passing through policy evaluation. This is non-negotiable. The policy enforcer sits between raw API capabilities and what agents are allowed to do. Write operations are denied by default. Read operations are allowed by default. Everything else requires explicit policy configuration.

## 3. Generated Artifacts Stay Out of the Repo

The repository contains the engine. Generated capability bundles, MCP tool definitions, and SKILLS files are runtime artifacts that live in cache directories (`.specrail/` or `~/.cache/specrail/`). They are never committed to version control. This keeps the repo clean, avoids stale artifact drift, and ensures bundles are always regenerated from current specs and policies.

## 4. Canonical Model as Center of Gravity

Every API operation normalizes into a single `Capability` type. This canonical model is vendor-agnostic, policy-attachable, and export-agnostic. Adding support for a new spec format means writing a new ingester that produces `Capability` objects. Adding a new export format means writing a new exporter that consumes them. The model never changes to accommodate a specific vendor.

## 5. Inspectability by Default

Every generated artifact is plain JSON. No binary formats, no databases, no proprietary encoding. You can inspect a bundle with `cat` and `jq`. You can diff two bundles with standard tools. Governance requires auditability, and auditability requires inspectability.

## 6. Safety Over Convenience

When in doubt, deny. The policy system is fail-closed: if no rule matches a capability, it is denied. Writes are denied by default. Auth credentials are never cached. These defaults exist because the cost of accidentally exposing a destructive operation to an agent is higher than the cost of requiring explicit policy configuration.

## 7. Fail-Closed Policy Evaluation

If the policy engine encounters an unrecognized operation, an unmatched rule set, or an error during evaluation, the result is always "deny." There is no fallback to "allow." This is the same principle used in firewalls and security systems.

## 8. Auth Credentials Never Persist

Authentication credentials are resolved from environment variables at execution time and used for a single request. They never appear in capability bundles, cache files, logs, export artifacts, or error messages. The canonical model describes what auth is required (type, header name, scopes), never the actual credential values.

## 9. Modular by Default

Each concern lives in its own package with explicit dependencies. Ingestion does not know about caching. Policy does not know about export formats. The CLI wires things together. This modularity enables testing, replacement, and future Go interoperability.

## 10. Opinionated but Configurable

Specrail ships with strong defaults (deny writes, use internal sensitivity, export all visible capabilities). These defaults can be overridden with policy overlays. The system is opinionated about safety and governance but flexible about specific policy decisions.
