import { join } from 'node:path';
import envPaths from 'env-paths';

// XDG-compliant global cache path.
// On macOS: ~/Library/Caches/specrail
// On Linux: ~/.cache/specrail
// On Windows: %LOCALAPPDATA%/specrail/Cache
const globalPaths = envPaths('specrail', { suffix: '' });

// Local project cache directory name.
// This directory is always in .gitignore and contains per-project bundles.
const LOCAL_CACHE_DIR = '.specrail';

export function getLocalCachePath(cwd?: string): string {
  return join(cwd ?? process.cwd(), LOCAL_CACHE_DIR);
}

export function getGlobalCachePath(): string {
  return globalPaths.cache;
}

export function getBundlePath(cacheRoot: string, bundleName: string): string {
  return join(cacheRoot, 'bundles', bundleName);
}
