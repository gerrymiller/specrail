# Provider Registry

The provider registry maps provider names to their resolution metadata. It is the primary path for interacting with Specrail -- users register a provider once, and all subsequent commands resolve automatically.

## Format

The registry is a versioned, schema-validated JSON file:

```json
{
  "$schema": "https://specrail.dev/schemas/provider-registry-v1.json",
  "version": "1.0",
  "providers": {
    "petstore": {
      "specUrl": "https://petstore3.swagger.io/api/v3/openapi.json",
      "docsUrl": "https://petstore.swagger.io/",
      "context7Library": "petstore",
      "authEnvPrefix": "PETSTORE",
      "policyOverlay": "./policies/petstore.json",
      "ttl": 3600
    },
    "stripe": {
      "specUrl": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
      "authEnvPrefix": "STRIPE",
      "ttl": 86400
    }
  }
}
```

## Fields

| Field             | Type   | Required | Description                                                    |
| ----------------- | ------ | -------- | -------------------------------------------------------------- |
| `specUrl`         | string | Yes      | URL or file path to the OpenAPI spec                           |
| `docsUrl`         | string | No       | External documentation URL for augmentation                    |
| `context7Library` | string | No       | Context7 library name for doc augmentation                     |
| `authEnvPrefix`   | string | No       | Env var prefix for auth credentials (default: `SPECRAIL_AUTH`) |
| `policyOverlay`   | string | No       | Path to a policy overlay JSON file                             |
| `ttl`             | number | No       | Cache TTL in seconds (default: 3600)                           |

## Two-Tier Registry

| Tier   | Location                            | Purpose                  |
| ------ | ----------------------------------- | ------------------------ |
| Local  | `.specrail/providers.json`          | Project-scoped providers |
| Global | `~/.config/specrail/providers.json` | User-scoped providers    |

Local entries override global entries with the same name.

The local registry can be committed to version control or gitignored, depending on the team's preference. Spec URLs and policy paths are not secrets.

## Schema Validation

The registry is validated through `ProviderRegistrySchema.parse()` on every read. If validation fails, Specrail refuses to proceed and reports the exact Zod issue path.

Invariants:

- The `version` field is required and must be `"1.0"`.
- Unknown fields are allowed (forward compatibility) but not preserved on write.
- The `$schema` field is optional but included in generated registries for editor autocompletion.

## CLI Commands

```bash
# Register a provider
specrail provider add petstore \
  --spec-url https://petstore3.swagger.io/api/v3/openapi.json \
  --docs-url https://petstore.swagger.io/ \
  --policy ./policies/petstore.json \
  --auth-env PETSTORE \
  --ttl 3600

# List registered providers
specrail provider list

# Show a provider's configuration
specrail provider show petstore

# Remove a provider
specrail provider remove petstore
```

## Resolution Order

When a command receives a provider argument:

1. **Exact URL or file path?** Use directly (escape hatch).
2. **Provider registry lookup** -- Check local registry, then global. First match wins.
3. **Well-known probing** -- Try `https://{name}/.well-known/openapi.json` and `https://api.{name}.com/openapi.json`. Silent fallback only.
4. **Fail clearly** -- Error with guidance: `Provider '{name}' not found. Register it: specrail provider add {name} --spec-url <url>`

## Examples

### Minimal registration (spec URL only)

```bash
specrail provider add httpbin --spec-url https://httpbin.org/spec.json
specrail capabilities httpbin
```

### Full registration with policy and auth

```bash
specrail provider add github \
  --spec-url https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json \
  --auth-env GITHUB \
  --policy ./policies/github-readonly.json \
  --ttl 86400

# Set auth credentials
export GITHUB_BEARER="ghp_xxxxxxxxxxxx"

# Use it
specrail exec github listRepos --params '{"per_page": 5}'
```

### Local file spec (no network)

```bash
specrail provider add internal-api --spec-url ./specs/internal-api.yaml
specrail inspect internal-api
```
