# Canonical Capability Schema

The canonical capability model is the center of gravity for Specrail. Every API operation is normalized into this model regardless of its source format.

## CapabilityBundle

The top-level container. One bundle per ingested API spec.

| Field | Type | Description |
|-------|------|-------------|
| `version` | `"1.0"` | Schema version for forward compatibility |
| `source` | `CapabilitySource` | Where the bundle was sourced from |
| `generatedAt` | `string` | ISO 8601 timestamp of generation |
| `bundleHash` | `string` | SHA-256 hash of normalized content |
| `policy` | `BundlePolicyMeta` | Summary of policy decisions |
| `capabilities` | `Capability[]` | The governed capabilities |

## CapabilitySource

| Field | Type | Description |
|-------|------|-------------|
| `specUrl` | `string` | URL or path to the original spec |
| `specFormat` | `"openapi-3.0" \| "openapi-3.1"` | Detected spec format |
| `title` | `string` | API title from spec |
| `version` | `string` | API version from spec |
| `docsUrl` | `string?` | External docs URL if provided |
| `context7LibraryId` | `string?` | Context7 library ID if augmented |

## Capability

A single governed API operation -- the atomic unit of the Specrail model.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique ID: `"bundleName:operationId"` |
| `name` | `string` | Human-readable name |
| `description` | `string` | Description, potentially augmented |
| `operationId` | `string?` | Original operationId from spec |
| `operation` | `CapabilityOperation` | Normalized HTTP operation |
| `classification` | `OperationClass` | Policy classification |
| `policy` | `CapabilityPolicy` | Policy evaluation result |
| `auth` | `AuthRequirement[]` | Required auth |
| `augmentation` | `Augmentation?` | External docs augmentation |

## OperationClass

Classification determines what kind of side effects an operation has. This is the primary axis for policy decisions.

| Value | Meaning | Default HTTP Methods |
|-------|---------|---------------------|
| `read` | Retrieves data, no side effects | GET, HEAD, OPTIONS |
| `write` | Creates or updates data | POST (default), PUT, PATCH |
| `delete` | Removes data | DELETE |
| `admin` | Administrative operations | (manual classification) |
| `action` | Side-effecting, non-CRUD | POST to action-like paths |

## CapabilityPolicy

The result of evaluating a capability against a policy overlay.

| Field | Type | Description |
|-------|------|-------------|
| `allowed` | `boolean` | Whether execution is permitted |
| `denyReason` | `string?` | Why denied, from matching rule |
| `sensitivity` | `SensitivityLevel` | Data classification |
| `requiresApproval` | `boolean` | Requires human approval |
| `exportVisible` | `boolean` | Include in MCP/SKILLS exports |
| `redaction` | `RedactionRule[]` | Fields to mask |

Sensitivity levels: `public`, `internal`, `confidential`, `restricted`

## AuthRequirement

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"api-key" \| "bearer" \| "basic" \| "oauth2"` | Auth mechanism |
| `name` | `string?` | Header/param name for api-key |
| `location` | `"header" \| "query"` | Where api-key is sent |
| `tokenUrl` | `string?` | OAuth2 token endpoint |
| `scopes` | `string[]?` | OAuth2 scopes |

## Validation

All types have corresponding Zod schemas in `@specrail/core`. Parse any JSON through the schema to get strong typing:

```typescript
import { CapabilityBundleSchema } from '@specrail/core';
const bundle = CapabilityBundleSchema.parse(json);
```

## Example

```json
{
  "id": "petstore-api:listPets",
  "name": "List Pets",
  "description": "List all pets in the store",
  "operationId": "listPets",
  "operation": {
    "method": "get",
    "path": "/pets",
    "servers": ["https://petstore.example.com/v1"],
    "parameters": [
      { "name": "limit", "location": "query", "required": false, "schema": { "type": "integer" } }
    ],
    "responses": { "200": { "description": "A list of pets" } }
  },
  "classification": "read",
  "policy": {
    "allowed": true,
    "sensitivity": "internal",
    "requiresApproval": false,
    "exportVisible": true,
    "redaction": []
  },
  "auth": [{ "type": "api-key", "name": "X-API-Key", "location": "header" }]
}
```
