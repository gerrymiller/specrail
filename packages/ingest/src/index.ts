// @specrail/ingest -- OpenAPI parsing, docs fetching, and Context7 augmentation
//
// This package handles the "input" side of Specrail: turning external API specs
// and documentation into the raw materials that the policy and export systems
// work with. It is deliberately separate from policy and cache to maintain
// clear trust boundaries.

export { parseOpenApiSpec, type ParsedOperation, type ParseResult } from './openapi.js';
export {
  resolveLibraryId,
  getLibraryDocs,
  augmentWithContext7,
  type Context7Library,
  type Context7DocsOptions,
} from './context7.js';
export { buildAugmentation, type AugmentOptions } from './augmenter.js';
