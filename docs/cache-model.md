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

## Cache Invalidation

Bundles are identified by name and include a SHA-256 hash of their content. There is no automatic invalidation -- re-running `specrail ingest` regenerates and overwrites the cached bundle. This is intentional: bundles should be regenerated explicitly when specs or policies change.

## CLI Commands

```bash
specrail cache list    # List all cached bundles (local + global)
specrail cache clean   # Remove all bundles from local cache
specrail cache path    # Show local and global cache directories
```
