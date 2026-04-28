import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Capability } from '@specrail/core';
import { resolveAuth } from './auth.js';

// Execution options for a direct API call
export interface ExecOptions {
  params?: Record<string, unknown>;
  authEnvPrefix?: string;
  dryRun?: boolean;
}

// Result of executing a capability
export interface ExecResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  dryRun: boolean;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
}

// Error thrown when policy denies an operation.
// This is the enforcement point -- the wall between "could" and "allowed to."
export class PolicyDeniedError extends Error {
  constructor(
    public readonly capabilityId: string,
    public readonly reason: string,
  ) {
    super(`Operation denied by policy: "${reason}"`);
    this.name = 'PolicyDeniedError';
  }
}

function loadQboEnvForDefaults(): void {
  const file = join(homedir(), '.config', 'openclaw', 'quickbooks.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    if (key && process.env[key] === undefined) process.env[key] = rest.join('=');
  }
}

function applyDefaultParams(capability: Capability, options: ExecOptions): ExecOptions {
  if (options.authEnvPrefix !== 'QBO') return options;
  loadQboEnvForDefaults();
  const realmId = process.env.QBO_REALM_ID;
  if (!realmId) return options;
  const params = { ...(options.params ?? {}) };
  if (params.realmId === undefined) params.realmId = realmId;
  if (capability.operation.path.includes('/companyinfo/{id}') && params.id === undefined) {
    params.id = realmId;
  }
  return { ...options, params };
}

// Execute a capability directly against the target API.
//
// TRUST BOUNDARY: This is the most sensitive function in Specrail.
// It makes real HTTP requests to external APIs. Every call must pass
// through policy enforcement first. If a capability is denied,
// this function throws PolicyDeniedError and does NOT make the request.
export async function execute(
  capability: Capability,
  options: ExecOptions = {},
): Promise<ExecResult> {
  options = applyDefaultParams(capability, options);

  // Policy gate: denied operations cannot execute
  if (!capability.policy.allowed) {
    throw new PolicyDeniedError(
      capability.id,
      capability.policy.denyReason ?? 'Operation not allowed by policy',
    );
  }

  const { operation } = capability;
  const server = operation.servers[0] ?? '';
  const resolvedPath = resolvePath(operation.path, options.params);
  // Concatenate server base URL and path correctly.
  // new URL('/pets', 'https://example.com/v1') drops the /v1 because /pets is absolute.
  // Instead, ensure the server ends with / and strip leading / from path.
  const normalizedServer = server.endsWith('/') ? server : `${server}/`;
  const normalizedPath = resolvedPath.startsWith('/') ? resolvedPath.slice(1) : resolvedPath;
  const url = new URL(normalizedPath, normalizedServer);

  // Resolve auth from env vars
  const auths = resolveAuth(capability.auth, options.authEnvPrefix);

  // Build request headers
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  // Apply auth headers and query params
  for (const auth of auths) {
    Object.assign(headers, auth.headers);
    for (const [key, value] of Object.entries(auth.queryParams)) {
      url.searchParams.set(key, value);
    }
  }

  // Apply query parameters from options
  for (const param of operation.parameters) {
    if (param.location === 'query' && options.params?.[param.name] !== undefined) {
      url.searchParams.set(param.name, String(options.params[param.name]));
    }
    if (param.location === 'header' && options.params?.[param.name] !== undefined) {
      headers[param.name] = String(options.params[param.name]);
    }
  }

  // Build request body for methods that support it
  let body: unknown = undefined;
  if (operation.requestBody && ['post', 'put', 'patch'].includes(operation.method)) {
    headers['Content-Type'] = 'application/json';
    // Extract body params (those not in path/query/header parameters)
    const paramNames = new Set(operation.parameters.map((p) => p.name));
    const bodyParams: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (!paramNames.has(key)) {
        bodyParams[key] = value;
      }
    }
    if (Object.keys(bodyParams).length > 0) {
      body = bodyParams;
    }
  }

  const request = {
    method: operation.method.toUpperCase(),
    url: url.toString(),
    headers,
    body,
  };

  // Dry run: return the request that would be made without executing
  if (options.dryRun) {
    return {
      status: 0,
      headers: {},
      body: null,
      dryRun: true,
      request,
    };
  }

  // Make the actual HTTP request
  const response = await fetch(url.toString(), {
    method: request.method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  let responseBody: unknown;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    responseBody = await response.json();
  } else {
    responseBody = await response.text();
  }

  return {
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
    dryRun: false,
    request,
  };
}

// Replace path parameters like {petId} with actual values from params
function resolvePath(pathTemplate: string, params?: Record<string, unknown>): string {
  if (!params) return pathTemplate;
  return pathTemplate.replace(/\{(\w+)\}/g, (_, name) => {
    const value = params[name];
    return value !== undefined ? encodeURIComponent(String(value)) : `{${name}}`;
  });
}
