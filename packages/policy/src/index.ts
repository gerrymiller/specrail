// @specrail/policy -- Policy model, overlays, and enforcement
//
// The policy system is the governance layer of Specrail. It sits between
// raw API capabilities and what agents are actually allowed to do.
// Key design decisions:
//   - Writes denied by default (fail-closed)
//   - Rules evaluated top-to-bottom, first match wins
//   - JSON-based overlays for auditability
//   - Classification-driven matching for broad rules
//   - OperationId/path matching for surgical overrides

export { classify, isValidClassification } from './classifier.js';
export { loadOverlay, DEFAULT_POLICY } from './overlay.js';
export { enforce, type EnforcementContext } from './enforcer.js';
