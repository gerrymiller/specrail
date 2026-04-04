# Execution Model

Specrail supports direct execution of capabilities against their target APIs. This is the most sensitive operation in the system and carries the strongest safety guarantees.

## Broker-Mediated Execution

In the runtime-broker model, execution is always broker-mediated:

```
specrail exec <provider> <capability> --params '{...}'
       |
       v
   [Broker.ensure] -- resolve provider, check freshness, rebuild if stale
       |
       v
   [Find capability in bundle]
       |
       v
   [Policy gate] -- hard deny if not allowed
       |
       v
   [Auth resolution] -- env vars only, per-provider prefix
       |
       v
   [HTTP request] -- constructed from canonical model
```

The caller never manually ingests or manages bundles. The broker ensures the bundle is current before locating the capability and passing it to the executor.

Via MCP, the same flow is triggered by the `specrail_exec` tool, which calls `broker.execute()` internally.

## Policy Gate

Every execution attempt passes through the policy gate first:

```
Execute request
  -> Check capability.policy.allowed
  -> If false: throw PolicyDeniedError (request never reaches network)
  -> If true: proceed to auth resolution and request construction
```

This is a hard gate, not a warning. Denied operations throw an error and the HTTP request is never made. There is no bypass, no override flag, no force mode.

The default policy denies all side-effecting operations: write, delete, admin, and action. Only reads are allowed without explicit policy configuration.

## Auth Resolution

Credentials are resolved from environment variables at execution time:

| Auth Type | Env Var                           | Header/Param                    |
| --------- | --------------------------------- | ------------------------------- |
| API Key   | `{PREFIX}_APIKEY`                 | Header or query (per spec)      |
| Bearer    | `{PREFIX}_BEARER`                 | `Authorization: Bearer {token}` |
| Basic     | `{PREFIX}_USER` + `{PREFIX}_PASS` | `Authorization: Basic {base64}` |
| OAuth2    | `{PREFIX}_BEARER` (MVP)           | `Authorization: Bearer {token}` |

Default prefix: `SPECRAIL_AUTH`. Override with `--auth-env`.

Credentials are used for a single request and never persisted to cache, bundles, logs, or error messages.

## Request Construction

The executor builds HTTP requests from the canonical capability model:

1. **Server selection:** Use the first server URL from `operation.servers`
2. **Path resolution:** Replace `{paramName}` placeholders with values from `--params`
3. **Query parameters:** Append parameters with `location: "query"` to the URL
4. **Headers:** Set auth headers, `Accept: application/json`, and parameter headers
5. **Body:** For POST/PUT/PATCH, serialize non-parameter fields as JSON body

## Dry-Run Mode

`specrail exec --dry-run` constructs the full request (including auth) but does not send it. The output shows exactly what would be sent:

```json
{
  "method": "GET",
  "url": "https://petstore.example.com/v1/pets?limit=10",
  "headers": { "Accept": "application/json", "X-API-Key": "..." },
  "body": null
}
```

This is useful for debugging, auditing, and building trust before enabling live execution.

## Response Handling

- JSON responses are parsed and returned as structured data
- Non-JSON responses are returned as raw text
- HTTP errors (4xx, 5xx) are returned with status code and body -- not swallowed
- Network errors and timeouts (30s default) throw standard errors

## Error Hierarchy

- `PolicyDeniedError`: Capability is not allowed by policy. Request never made.
- `Error` (network): DNS failure, connection refused, timeout.
- `Error` (HTTP): Server returned an error status. Response body included.
