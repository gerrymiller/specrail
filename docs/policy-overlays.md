# Policy Overlays

Policy overlays are JSON files that define how capabilities are governed. They are the primary mechanism for controlling what agents can and cannot do.

## Format

```json
{
  "$schema": "https://specrail.dev/schemas/policy-overlay-v1.json",
  "version": "1.0",
  "name": "my-policy",
  "description": "Custom policy for production use",
  "rules": [
    {
      "match": { "classification": ["write", "delete", "admin"] },
      "effect": "deny",
      "reason": "Destructive operations require explicit approval"
    },
    {
      "match": { "classification": ["read"] },
      "effect": "allow"
    }
  ],
  "defaults": {
    "sensitivity": "internal",
    "requiresApproval": false,
    "exportVisible": true
  }
}
```

## Rule Evaluation

Rules are evaluated **top-to-bottom**. The **first matching rule wins** for the allow/deny decision.

If no rule matches, the capability is **denied** (fail-closed).

### Match Conditions

All specified conditions in a rule must match (AND logic). Unspecified conditions are ignored.

| Condition        | Type       | Description                                 |
| ---------------- | ---------- | ------------------------------------------- |
| `classification` | `string[]` | Match if capability's class is in this list |
| `operationId`    | `string`   | Exact match on operationId                  |
| `pathPattern`    | `string`   | Glob-like match on path (`*` = wildcard)    |
| `method`         | `string`   | Match on HTTP method (case-insensitive)     |

### Effects

| Effect  | Description                                                 |
| ------- | ----------------------------------------------------------- |
| `allow` | Capability can be executed and exported                     |
| `deny`  | Capability cannot be executed. May still appear in exports. |

### Rule Overrides

Individual rules can override default values:

- `sensitivity`: Override the sensitivity level for matched capabilities
- `requiresApproval`: Override whether human approval is required
- `exportVisible`: Override whether the capability appears in exports

## Operation Classification

The classifier maps HTTP methods to operation classes:

| Method             | Default Class | Notes                                              |
| ------------------ | ------------- | -------------------------------------------------- |
| GET, HEAD, OPTIONS | `read`        | Safe, no side effects                              |
| POST               | `write`       | May be `action` for paths like `/send`, `/trigger` |
| PUT, PATCH         | `write`       | Updates existing data                              |
| DELETE             | `delete`      | Removes data                                       |

`admin` and `action` require manual classification via policy rules.

## Built-in Default Policy

If no `--policy` flag is provided, Specrail uses the built-in default:

- **Allow:** `read`, `action`
- **Deny:** `write`, `delete`, `admin`
- **Default sensitivity:** `internal`

## Custom Overlay Examples

### Allow specific writes

```json
{
  "version": "1.0",
  "name": "allow-pet-creation",
  "rules": [
    {
      "match": { "operationId": "createPet" },
      "effect": "allow"
    },
    {
      "match": { "classification": ["write", "delete", "admin"] },
      "effect": "deny",
      "reason": "Other writes denied"
    },
    {
      "match": { "classification": ["read", "action"] },
      "effect": "allow"
    }
  ],
  "defaults": {}
}
```

### Require approval for deletes

```json
{
  "version": "1.0",
  "name": "guarded-deletes",
  "rules": [
    {
      "match": { "classification": ["delete"] },
      "effect": "allow",
      "requiresApproval": true
    },
    {
      "match": { "classification": ["write", "admin"] },
      "effect": "deny"
    },
    {
      "match": { "classification": ["read", "action"] },
      "effect": "allow"
    }
  ],
  "defaults": {}
}
```

## Future

- Per-field redaction rules
- Approval workflow integration
- Time-based policies (allow during business hours)
- Rate limiting per capability
- Audit logging of policy decisions
