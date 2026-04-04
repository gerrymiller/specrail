// @specrail/broker -- Runtime capability brokerage
//
// The broker is the orchestration center of Specrail. It replaces the
// manual ingest-first workflow with an automatic resolve → check freshness →
// rebuild if stale loop. The CLI and MCP server are thin wrappers over it.

export {
  ensure,
  capabilities,
  execute,
  refresh,
  inspect,
  registerProvider,
  unregisterProvider,
  providers,
  type BrokerOptions,
} from './broker.js';

export {
  checkFreshness,
  getGeneratorVersion,
  computeExpiresAt,
  type FreshnessResult,
  type StalenessReason,
} from './freshness.js';
