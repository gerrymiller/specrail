# Cache Model

Generated capability bundles are ephemeral artifacts. They live in cache directories outside the repository and are never committed to version control. This is a core architectural invariant.

## Two-Tier Cache

| Tier   | Location                             | Purpose                        |
| ------ | ------------------------------------ | ------------------------------ |
| Local  | `.specrail/` in project root         | Per-project bundles and config |
| Global | `~/.cache/specrail/` (XDG-compliant) | Shared bundles across projects |

The global cache path is determined by the `env-paths` library, which respects XDG base directory conventions:

- Linux: `~/.cache/specrail/`
- macOS: `~/Library/Caches/specrail/`
- Windows: `%LOCALAPPDATA%/specrail/Cache/`

## Bundle Directory Structure

Each cached bundle gets its own directory:

```
.specrail/
  bundles/
    petstore-api/
      bundle.json    # Full capability bundle (the primary artifact)
      meta.json      # Lightweight metadata for listing/indexing
```

- `bundle.json` contains the complete `CapabilityBundle` with all capabilities, policy decisions, and augmentation data. This is what exporters and the executor consume.
- `meta.json` contains a lightweight summary (name, hash, timestamp, capability count) for fast listing without loading the full bundle.

## Lookup Order

When reading a bundle by name:

1. Check local cache (`.specrail/bundles/{name}/`)
2. If not found, check global cache (`~/.cache/specrail/bundles/{name}/`)
3. If not found in either, return null

Writing always goes to local cache by default. Use `--output` to override.

## Inspectability Principle

Bundles are plain JSON files. No binary formats, no databases, no proprietary encoding. You can inspect any bundle with standard tools:

```bash
cat .specrail/bundles/petstore-api/bundle.json | jq .
```

This is deliberate. Governance requires auditability, and auditability requires inspectability.

## Bundle Metadata (Extended)

In the runtime-broker model, `meta.json` carries freshness tracking fields alongside the existing index fields:

| Field              | Type    | Description                                    |
| ------------------ | ------- | ---------------------------------------------- |
| `bundleName`       | string  | Bundle identifier                              |
| `provider`         | string  | Provider name from the registry                |
| `generatedAt`      | string  | ISO 8601 generation timestamp                  |
| `bundleHash`       | string  | SHA-256 of normalized bundle content           |
| `capabilityCount`  | number  | Number of capabilities                         |
| `specUrl`          | string  | URL or file path to the source spec            |
| `specHash`         | string  | SHA-256 of raw spec content at ingest time     |
| `specVersion`      | string  | `info.version` from the spec                   |
| `specETag`         | string? | ETag from HTTP response (URL sources)          |
| `specLastModified` | string? | Last-Modified from HTTP response (URL sources) |
| `policyHash`       | string  | SHA-256 of the policy overlay used             |
| `docsExpiresAt`    | string? | TTL expiry for augmentation data               |
| `generatorVersion` | string  | Specrail package version that built this       |
| `expiresAt`        | string? | Hard TTL expiry (ISO 8601)                     |

## Freshness Model

The broker checks freshness on every `ensure()` call. There are four independent causes of staleness:

| Cause               | What Changed                 | Detection                                         | Cost      |
| ------------------- | ---------------------------- | ------------------------------------------------- | --------- |
| **Generator stale** | Specrail version changed     | Compare `generatorVersion` against current        | <1ms      |
| **Policy stale**    | Policy overlay file changed  | Hash overlay, compare against `policyHash`        | <1ms      |
| **Source stale**    | Upstream API spec changed    | HEAD for ETag/Last-Modified, or full fetch + hash | ~50-500ms |
| **Docs stale**      | Augmentation sources changed | TTL-based only                                    | 0ms       |

### Check order

1. **Generator stale** -- Free. If Specrail was upgraded, the normalization logic may have changed. Rebuild.
2. **Policy stale** -- Free. Read the policy overlay file, hash it, compare against stored `policyHash`. If different, rebuild.
3. **Hard TTL expired?** -- If `expiresAt` is in the future, use cached. Skip source check entirely.
4. **Source stale** -- For URL sources: send a HEAD request and compare ETag/Last-Modified. If the server doesn't return these headers, fall back to full fetch + hash compare. For local file sources: hash the file and compare against `specHash`.
5. **Docs stale** -- Docs staleness never triggers a rebuild on its own. It piggybacks on source or policy rebuilds when `docsExpiresAt` has passed.

After a successful HEAD check confirms the spec hasn't changed, the broker touches `expiresAt` to reset the TTL without rebuilding.

### When to rebuild

- Bundle missing from cache
- Generator version changed
- Policy overlay file changed (hash mismatch)
- TTL expired AND upstream spec changed (ETag/hash mismatch)
- User explicitly runs `specrail refresh <provider>`

## Cache Invalidation (Legacy)

For bundles created via the escape-hatch `specrail ingest` command, there is no automatic invalidation. Re-running `specrail ingest` regenerates and overwrites the cached bundle. The freshness model applies only to broker-managed bundles (those with a `provider` and `generatorVersion` in their metadata).

## CLI Commands

```bash
specrail cache list    # List all cached bundles (local + global)
specrail cache clean   # Remove all bundles from local cache
specrail cache path    # Show local and global cache directories
specrail refresh <p>   # Force rebuild for a specific provider
```
