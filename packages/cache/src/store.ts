import { mkdir, writeFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type CapabilityBundle, CapabilityBundleSchema } from '@specrail/core';
import { getBundlePath, getLocalCachePath, getGlobalCachePath } from './paths.js';

// Metadata written alongside each bundle for cache management
export interface BundleMeta {
  bundleName: string;
  generatedAt: string;
  bundleHash: string;
  specUrl: string;
  capabilityCount: number;
}

// Write a capability bundle to the local cache.
// Creates the cache directory structure if it doesn't exist.
//
// CRITICAL: This writes to .specrail/ or ~/.cache/specrail/ -- NEVER to the repo.
// The bundle.json is the full inspectable artifact. meta.json is a lightweight index.
export async function writeBundle(
  bundle: CapabilityBundle,
  bundleName: string,
  options?: { cacheDir?: string },
): Promise<string> {
  const cacheRoot = options?.cacheDir ?? getLocalCachePath();
  const bundleDir = getBundlePath(cacheRoot, bundleName);

  await mkdir(bundleDir, { recursive: true });

  // Write the full bundle -- this is the primary artifact
  const bundleJson = JSON.stringify(bundle, null, 2);
  await writeFile(join(bundleDir, 'bundle.json'), bundleJson, 'utf-8');

  // Write lightweight metadata for listing and quick lookups
  const meta: BundleMeta = {
    bundleName,
    generatedAt: bundle.generatedAt,
    bundleHash: bundle.bundleHash,
    specUrl: bundle.source.specUrl,
    capabilityCount: bundle.capabilities.length,
  };
  await writeFile(join(bundleDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  return bundleDir;
}

// Read a capability bundle from cache.
// Searches local cache first, then global cache.
export async function readBundle(
  bundleName: string,
  options?: { cacheDir?: string },
): Promise<CapabilityBundle | null> {
  // Try specified dir, then local, then global
  const searchDirs = options?.cacheDir
    ? [options.cacheDir]
    : [getLocalCachePath(), getGlobalCachePath()];

  for (const cacheRoot of searchDirs) {
    const bundlePath = join(getBundlePath(cacheRoot, bundleName), 'bundle.json');
    try {
      const raw = await readFile(bundlePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return CapabilityBundleSchema.parse(parsed);
    } catch {
      continue; // Not found in this cache tier, try next
    }
  }

  return null;
}

// List all cached bundles across local and global caches.
export async function listBundles(options?: { cacheDir?: string }): Promise<BundleMeta[]> {
  const searchDirs = options?.cacheDir
    ? [options.cacheDir]
    : [getLocalCachePath(), getGlobalCachePath()];

  const results: BundleMeta[] = [];
  const seen = new Set<string>();

  for (const cacheRoot of searchDirs) {
    const bundlesDir = join(cacheRoot, 'bundles');
    try {
      const entries = await readdir(bundlesDir);
      for (const entry of entries) {
        if (seen.has(entry)) continue;
        try {
          const metaPath = join(bundlesDir, entry, 'meta.json');
          const raw = await readFile(metaPath, 'utf-8');
          const meta = JSON.parse(raw) as BundleMeta;
          results.push(meta);
          seen.add(entry);
        } catch {
          // Corrupted or incomplete bundle, skip
        }
      }
    } catch {
      // Cache directory doesn't exist yet, skip
    }
  }

  return results;
}

// Remove all cached bundles from local cache.
export async function cleanCache(options?: { cacheDir?: string }): Promise<number> {
  const cacheRoot = options?.cacheDir ?? getLocalCachePath();
  const bundlesDir = join(cacheRoot, 'bundles');

  try {
    const entries = await readdir(bundlesDir);
    for (const entry of entries) {
      await rm(join(bundlesDir, entry), { recursive: true, force: true });
    }
    return entries.length;
  } catch {
    return 0;
  }
}
