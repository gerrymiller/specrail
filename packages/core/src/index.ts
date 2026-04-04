// @specrail/core -- Canonical schema, shared types, and contracts
//
// This package is the center of gravity for Specrail. Every other package
// depends on the types and schemas defined here. The canonical capability
// model is intentionally opinionated: it normalizes diverse API specs into
// a single governed representation that policy, cache, and export can work with.

export * from './types/index.js';
export * from './utils.js';
