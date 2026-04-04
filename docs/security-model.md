# Security Model

Specrail's security model is built around trust boundaries, credential isolation, and fail-closed policy evaluation.

## Trust Boundaries

### 1. Spec Source (Untrusted)

API specifications come from external URLs or local files. They are validated structurally (well-formed OpenAPI) but their content is not trusted for execution without policy evaluation. A malicious spec could define destructive operations -- the policy layer prevents these from executing.

### 2. Policy Files (Trusted)

Policy overlays are authored by the operator and define what is allowed. They are the security boundary between raw API capabilities and what agents can access. Policy files should be version-controlled and reviewed like code.

### 3. Execution Targets (External)

HTTP requests go to servers defined in the API spec. These are external systems that Specrail has no control over. The executor makes requests but does not validate that the target server is trustworthy -- that is the operator's responsibility.

## Credential Handling

### Principles

1. Credentials are resolved from environment variables at execution time
2. Credentials are used for a single HTTP request
3. Credentials never appear in capability bundles, cache files, or export artifacts
4. Credentials never appear in logs or error messages
5. Missing credentials result in null auth resolution, not errors

### Env Var Convention

| Auth Type | Variable |
|-----------|----------|
| API Key | `SPECRAIL_AUTH_APIKEY` |
| Bearer Token | `SPECRAIL_AUTH_BEARER` |
| Basic Auth | `SPECRAIL_AUTH_USER`, `SPECRAIL_AUTH_PASS` |

Prefix is configurable via `--auth-env`.

## Policy as Security Boundary

The policy enforcer is the gatekeeper:

- **Fail-closed:** If no policy rule matches, the capability is denied
- **Writes denied by default:** The built-in policy denies write, delete, and admin operations
- **No bypass:** There is no `--force` flag to override policy denial
- **Classification-driven:** Policy operates on semantic operation classes, not raw HTTP methods

## Sensitivity Classification

Capabilities carry a sensitivity level that controls handling:

| Level | Description |
|-------|-------------|
| `public` | Safe for broad exposure |
| `internal` | Default. Standard handling. |
| `confidential` | Restricted exposure. Consider redaction. |
| `restricted` | Highly sensitive. May require approval. |

## Redaction Framework

The schema supports per-capability redaction rules (JSONPath expressions targeting fields to mask). This is modeled but not fully implemented in MVP. The foundation exists for future fine-grained data handling.

## What Specrail Does NOT Do

- **Does not validate target server identity** (no certificate pinning)
- **Does not encrypt cached bundles** (they are plain JSON)
- **Does not sign bundles** (planned for future)
- **Does not implement OAuth2 token exchange** (deferred to post-MVP)
- **Does not audit-log policy decisions** (planned for future)

These limitations are documented, not hidden. Each is a candidate for future hardening.
