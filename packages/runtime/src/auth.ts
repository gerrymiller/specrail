import type { AuthRequirement } from '@specrail/core';

// Resolved credentials for a single auth requirement.
// These are populated at execution time from environment variables.
// SECURITY: Credentials are NEVER stored in bundles, cache, or logs.
export interface ResolvedAuth {
  type: AuthRequirement['type'];
  headers: Record<string, string>;
  queryParams: Record<string, string>;
}

// Resolve auth credentials from environment variables.
// Env var names follow the convention: {PREFIX}_APIKEY, {PREFIX}_BEARER, etc.
// Default prefix: SPECRAIL_AUTH
//
// TRUST BOUNDARY: This is where external secrets enter the system.
// We read them, use them for one request, and never persist them.
export function resolveAuth(
  requirements: AuthRequirement[],
  envPrefix: string = 'SPECRAIL_AUTH',
): ResolvedAuth[] {
  return requirements.map((req) => resolveOne(req, envPrefix)).filter(Boolean) as ResolvedAuth[];
}

function resolveOne(req: AuthRequirement, prefix: string): ResolvedAuth | null {
  switch (req.type) {
    case 'api-key': {
      const key = process.env[`${prefix}_APIKEY`];
      if (!key) return null;
      if (req.location === 'query' && req.name) {
        return { type: 'api-key', headers: {}, queryParams: { [req.name]: key } };
      }
      const headerName = req.name ?? 'X-API-Key';
      return { type: 'api-key', headers: { [headerName]: key }, queryParams: {} };
    }
    case 'bearer': {
      const token = process.env[`${prefix}_BEARER`];
      if (!token) return null;
      return { type: 'bearer', headers: { Authorization: `Bearer ${token}` }, queryParams: {} };
    }
    case 'basic': {
      const user = process.env[`${prefix}_USER`];
      const pass = process.env[`${prefix}_PASS`];
      if (!user || !pass) return null;
      const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
      return { type: 'basic', headers: { Authorization: `Basic ${encoded}` }, queryParams: {} };
    }
    case 'oauth2': {
      // OAuth2 token exchange is deferred to post-MVP.
      // For now, treat it like a bearer token if one is available.
      const token = process.env[`${prefix}_BEARER`];
      if (!token) return null;
      return { type: 'oauth2', headers: { Authorization: `Bearer ${token}` }, queryParams: {} };
    }
    default:
      return null;
  }
}
