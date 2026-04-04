// @specrail/resolver -- Provider registry and resolution chain
//
// The resolver is the entry point for the runtime-broker model.
// Users register providers once; the resolver maps names to spec URLs,
// policy overlays, auth prefixes, and TTLs. The registry is the product.
// Well-known probing is a courtesy fallback, not the primary path.

export {
  loadRegistry,
  lookupProvider,
  addProvider,
  removeProvider,
  listProviders,
  getLocalRegistryPath,
  getGlobalRegistryPath,
} from './registry.js';

export { resolveProvider, ProviderNotFoundError, type ResolveOptions } from './resolve.js';
