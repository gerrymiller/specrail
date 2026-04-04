# Competitive Landscape

Specrail occupies a specific position: governed, dynamic capability generation from API specs for agents. Here is how it compares to existing approaches.

## Simple OpenAPI-to-MCP Generators

Tools that take an OpenAPI spec and produce MCP tool definitions directly.

**What they do well:** Fast path from spec to tools. Low ceremony.

**What they miss:**
- No governance layer. Every operation is exposed equally.
- No policy model. Writes and deletes are as accessible as reads.
- No classification. Agents cannot distinguish safe from destructive operations.
- Static generation. Output is typically committed to the repo, creating drift.
- No augmentation. Descriptions are limited to what the spec provides.
- No execution. They generate definitions but do not execute requests.

**Specrail's difference:** Policy evaluation, operation classification, dynamic generation with caching outside the repo, documentation augmentation, and direct execution with policy gating.

## Manual MCP Server Implementations

Custom MCP servers hand-built for specific APIs.

**What they do well:** Full control over tool behavior, descriptions, and error handling.

**What they miss:**
- Bespoke per-API. Each server is a separate codebase.
- No shared governance model. Policy is ad hoc per implementation.
- Expensive to maintain. Every API change requires code changes.
- No canonical model. Each server defines its own abstractions.

**Specrail's difference:** One engine handles any API with an OpenAPI spec. Policy is declarative and shared across all APIs. Adding a new API means running `specrail ingest`, not writing code.

## API Gateway Approaches

Infrastructure-level API management platforms (Kong, Apigee, AWS API Gateway).

**What they do well:** Rate limiting, auth, monitoring at infrastructure level.

**What they miss:**
- Not agent-aware. They manage HTTP traffic, not agent capabilities.
- No capability model. They operate on routes, not semantic operations.
- No export to agent formats (MCP, SKILLS).
- Heavyweight infrastructure that may not be relevant for agent use cases.

**Specrail's difference:** Agent-native. The output is capability bundles that agents consume directly. Policy operates at the semantic level (read vs write vs delete), not at the HTTP level.

## Why This Approach

The right model for agent capabilities has four properties:

1. **Dynamic generation.** Capabilities are derived from specs, not hand-coded. When the spec changes, regenerate.
2. **Governance by default.** Every capability passes through policy evaluation before exposure. Writes are denied until explicitly allowed.
3. **Caching outside the repo.** Generated artifacts are ephemeral state, not version-controlled code. This prevents drift and keeps the repo clean.
4. **Canonical normalization.** A single internal model that all exporters consume. Adding MCP, SKILLS, or future formats requires no changes to ingestion or policy.
