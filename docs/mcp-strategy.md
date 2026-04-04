# MCP Strategy

Specrail exposes a compressed broker-level MCP surface: 5 tools that work with any registered provider. This replaces the naive approach of generating one MCP tool per API operation.

## Problem

A provider like Stripe has 300+ operations. Generating one MCP tool per operation means 300+ tool definitions in the agent's context window. This is wasteful, noisy, and scales poorly across multiple providers.

## Solution

Specrail serves as an MCP server (`specrail serve`) that exposes exactly 5 tools. Agents discover capabilities dynamically, inspect them on demand, and execute through a single governed endpoint.

Adding a new provider does not change the MCP surface.

## MCP Server Configuration

```json
{
  "mcpServers": {
    "specrail": {
      "command": "specrail",
      "args": ["serve"]
    }
  }
}
```

## Tool Definitions

### specrail_capabilities

List available governed capabilities for a provider.

```json
{
  "name": "specrail_capabilities",
  "description": "List available governed capabilities for a provider. Returns capability IDs, names, classifications, and policy status. Use this to discover what operations are available before executing.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "description": "Provider name (e.g., 'stripe', 'github')"
      },
      "classification": {
        "type": "string",
        "enum": ["read", "write", "delete", "admin", "action"],
        "description": "Filter by operation class"
      }
    },
    "required": ["provider"]
  }
}
```

### specrail_exec

Execute a governed API capability through the policy gate.

```json
{
  "name": "specrail_exec",
  "description": "Execute a governed API capability through Specrail's policy gate. The capability must be allowed by policy. Auth is resolved from environment variables at runtime.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": { "type": "string" },
      "capability": {
        "type": "string",
        "description": "Capability ID (e.g., 'listPets', 'getUser')"
      },
      "params": {
        "type": "object",
        "description": "Parameters for the API call"
      }
    },
    "required": ["provider", "capability"]
  },
  "annotations": { "openWorldHint": true }
}
```

### specrail_inspect

Get detailed information about a specific capability.

```json
{
  "name": "specrail_inspect",
  "description": "Get detailed information about a specific capability including its parameters, auth requirements, request/response schemas, and policy status.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": { "type": "string" },
      "capability": { "type": "string" }
    },
    "required": ["provider", "capability"]
  }
}
```

### specrail_providers

List all registered providers.

```json
{
  "name": "specrail_providers",
  "description": "List all registered providers with their status, capability counts, and cache freshness.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  }
}
```

### specrail_refresh

Force rebuild a provider's capability bundle.

```json
{
  "name": "specrail_refresh",
  "description": "Force re-resolve and rebuild the capability bundle for a provider. Use when you suspect the bundle may be stale.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "provider": { "type": "string" }
    },
    "required": ["provider"]
  }
}
```

## Agent Workflow

A well-behaved agent interacts with Specrail in two steps:

1. **Discover:** Call `specrail_capabilities` to see what's available and what policy allows.
2. **Execute:** Call `specrail_exec` with the chosen capability ID and parameters.

Optionally, the agent can call `specrail_inspect` to get full parameter schemas before executing. This is useful for complex operations where the agent needs to know required fields and types.

## Why This Is Better

| Concern           | Per-Operation Tools          | Broker Tools                 |
| ----------------- | ---------------------------- | ---------------------------- |
| Context window    | 300+ tools per provider      | 5 tools total                |
| Adding a provider | +N new tools                 | No change                    |
| Policy visibility | Baked into tool descriptions | Dynamic via capabilities     |
| Discovery         | Implicit (scan tool list)    | Explicit (call capabilities) |
| Governance        | Per-tool annotations         | Centralized policy gate      |

## Flat Export (Legacy)

The per-operation MCP export still exists for use cases where the consumer wants static tool definitions:

```bash
specrail export mcp <provider> --flat
```

This generates one MCP tool per allowed capability, identical to the current v0.1 behavior. It is an export format, not the primary MCP integration path.
