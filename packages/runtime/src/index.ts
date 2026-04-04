// @specrail/runtime -- Auth handling and policy-gated direct execution
//
// This is where Specrail makes real HTTP requests to external APIs.
// Every execution passes through the policy gate first. Denied operations
// throw and never reach the network. Auth credentials are resolved from
// environment variables at execution time and are never persisted.

export { resolveAuth, type ResolvedAuth } from './auth.js';
export { execute, PolicyDeniedError, type ExecOptions, type ExecResult } from './executor.js';
