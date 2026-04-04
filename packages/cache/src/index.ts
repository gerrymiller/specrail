// @specrail/cache -- Local and global caching for governed capability bundles
//
// Bundles are generated artifacts and NEVER belong in the repository.
// This package manages two cache tiers:
//   - Local (.specrail/ in project root) for per-project bundles
//   - Global (~/.cache/specrail/ via XDG) for shared bundles
//
// Bundles are inspectable JSON files by design. No binary formats,
// no opaque databases. `cat .specrail/bundles/petstore/bundle.json` works.

export { getLocalCachePath, getGlobalCachePath, getBundlePath } from './paths.js';
export { writeBundle, readBundle, listBundles, cleanCache, type BundleMeta } from './store.js';
