# Roadmap

## v0.1 (Current) -- Vertical Slice MVP

The first release proves the full pipeline end-to-end.

- [x] OpenAPI 3.0/3.1 spec ingestion
- [x] Context7 documentation augmentation
- [x] Operation classification (read/write/delete/admin/action)
- [x] JSON policy overlays with first-match-wins evaluation
- [x] Default deny for writes
- [x] Governed capability bundle generation
- [x] Two-tier cache (local .specrail/ + global XDG)
- [x] Bundle inspection (JSON)
- [x] MCP tool definition export
- [x] SKILLS.md generation
- [x] Direct execution with policy gating
- [x] Auth support: API key, bearer, basic
- [x] Dry-run mode
- [x] CLI with ingest, inspect, export, exec, cache commands
- [x] Vitest test suite
- [x] CI workflow (GitHub Actions)

## v0.2 -- Advanced Policy and Multi-Spec

- [ ] Path pattern matching in policy rules (glob expressions)
- [ ] Per-field redaction rules
- [ ] Multiple specs per project (bundle registry)
- [ ] Bundle diffing (compare two versions of a bundle)
- [ ] Policy linting and validation CLI command
- [ ] GraphQL spec ingestion (experimental)

## v0.3 -- Auth and Extensibility

- [ ] OAuth2 token exchange (client credentials flow)
- [ ] Plugin system for custom classifiers
- [ ] Plugin system for custom exporters
- [ ] Custom auth strategy plugins
- [ ] Bundle signing for integrity verification

## v0.4 -- MCP Server Mode

- [ ] Serve MCP tools directly (stdio/SSE transport)
- [ ] Streaming execution for long-running operations
- [ ] Dynamic tool registration/deregistration
- [ ] Health check and metrics endpoints

## v1.0 -- Production Ready

- [ ] Stable public API (semver guarantees)
- [ ] Comprehensive documentation site
- [ ] Published npm packages
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Migration guide from v0.x

## Future

- Go interoperability layer (core types + executor in Go)
- Distributed cache (shared team cache via object storage)
- Enterprise policy management (centralized policy server)
- Audit logging with structured output
- Approval workflow integration (Slack, email, webhook)
- Rate limiting per capability
- Cost estimation per execution
- Multi-tenant isolation
