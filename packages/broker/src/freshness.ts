import { readFile } from 'node:fs/promises';
import { type BundleMeta, computeHash } from '@specrail/core';

const SPECRAIL_VERSION = '0.2.0';

export type StalenessReason = 'generator' | 'policy' | 'source' | 'missing';

export interface FreshnessResult {
  fresh: boolean;
  reason?: StalenessReason;
}

// Check whether a cached bundle is still fresh.
// Returns { fresh: true } or { fresh: false, reason } explaining what's stale.
//
// Check order (cheapest first):
// 1. Generator version changed
// 2. Policy overlay changed (hash the file)
// 3. Hard TTL expired → check source (HEAD or hash)
export async function checkFreshness(
  meta: BundleMeta,
  policyPath?: string,
): Promise<FreshnessResult> {
  // 1. Generator stale
  if (meta.generatorVersion && meta.generatorVersion !== SPECRAIL_VERSION) {
    return { fresh: false, reason: 'generator' };
  }

  // 2. Policy stale
  if (policyPath && meta.policyHash) {
    try {
      const policyContent = await readFile(policyPath, 'utf-8');
      const currentHash = computeHash(policyContent);
      if (currentHash !== meta.policyHash) {
        return { fresh: false, reason: 'policy' };
      }
    } catch {
      // Policy file missing or unreadable — rebuild to be safe
      return { fresh: false, reason: 'policy' };
    }
  }

  // 3. TTL check
  if (meta.expiresAt) {
    const expires = new Date(meta.expiresAt);
    if (expires > new Date()) {
      return { fresh: true };
    }
  }

  // TTL expired (or no TTL set). Check source if we have a spec hash.
  if (meta.specUrl && meta.specHash) {
    const sourceResult = await checkSourceFreshness(meta);
    if (!sourceResult.fresh) {
      return sourceResult;
    }
  }

  return { fresh: true };
}

async function checkSourceFreshness(meta: BundleMeta): Promise<FreshnessResult> {
  const isUrl = meta.specUrl.startsWith('http://') || meta.specUrl.startsWith('https://');

  if (isUrl) {
    return checkUrlSourceFreshness(meta);
  }

  // Local file: hash and compare
  try {
    const content = await readFile(meta.specUrl, 'utf-8');
    const currentHash = computeHash(content);
    if (currentHash !== meta.specHash) {
      return { fresh: false, reason: 'source' };
    }
    return { fresh: true };
  } catch {
    return { fresh: false, reason: 'source' };
  }
}

async function checkUrlSourceFreshness(meta: BundleMeta): Promise<FreshnessResult> {
  try {
    const resp = await fetch(meta.specUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      // Can't verify — assume stale
      return { fresh: false, reason: 'source' };
    }

    // Check ETag
    const etag = resp.headers.get('etag');
    if (etag && meta.specETag) {
      if (etag === meta.specETag) return { fresh: true };
      return { fresh: false, reason: 'source' };
    }

    // Check Last-Modified
    const lastModified = resp.headers.get('last-modified');
    if (lastModified && meta.specLastModified) {
      if (lastModified === meta.specLastModified) return { fresh: true };
      return { fresh: false, reason: 'source' };
    }

    // No ETag or Last-Modified — can't tell from HEAD alone.
    // Do a full fetch and compare hashes.
    return checkUrlSourceByHash(meta);
  } catch {
    // Network error — can't verify, assume stale
    return { fresh: false, reason: 'source' };
  }
}

async function checkUrlSourceByHash(meta: BundleMeta): Promise<FreshnessResult> {
  try {
    const resp = await fetch(meta.specUrl, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) return { fresh: false, reason: 'source' };
    const content = await resp.text();
    const currentHash = computeHash(content);
    if (currentHash !== meta.specHash) {
      return { fresh: false, reason: 'source' };
    }
    return { fresh: true };
  } catch {
    return { fresh: false, reason: 'source' };
  }
}

export function getGeneratorVersion(): string {
  return SPECRAIL_VERSION;
}

export function computeExpiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}
