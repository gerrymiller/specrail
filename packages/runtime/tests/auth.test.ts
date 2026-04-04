import { describe, it, expect, afterEach } from 'vitest';
import { resolveAuth } from '../src/auth.js';
import type { AuthRequirement } from '@specrail/core';

// Track env vars set during tests for cleanup
const envKeysSet: string[] = [];

function setEnv(key: string, value: string) {
  process.env[key] = value;
  envKeysSet.push(key);
}

afterEach(() => {
  for (const key of envKeysSet) {
    delete process.env[key];
  }
  envKeysSet.length = 0;
});

describe('resolveAuth', () => {
  describe('API key resolution', () => {
    it('resolves API key from env vars into header', () => {
      setEnv('SPECRAIL_AUTH_APIKEY', 'my-secret-key');
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'X-API-Key', location: 'header' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('api-key');
      expect(result[0].headers['X-API-Key']).toBe('my-secret-key');
      expect(Object.keys(result[0].queryParams)).toHaveLength(0);
    });

    it('resolves API key into query param when location is query', () => {
      setEnv('SPECRAIL_AUTH_APIKEY', 'query-key');
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'api_key', location: 'query' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].queryParams['api_key']).toBe('query-key');
      expect(Object.keys(result[0].headers)).toHaveLength(0);
    });

    it('uses default X-API-Key header name when name is not specified', () => {
      setEnv('SPECRAIL_AUTH_APIKEY', 'default-key');
      const requirements: AuthRequirement[] = [{ type: 'api-key', location: 'header' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].headers['X-API-Key']).toBe('default-key');
    });

    it('returns empty array when API key env var is missing', () => {
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'X-API-Key', location: 'header' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(0);
    });
  });

  describe('Bearer token resolution', () => {
    it('resolves bearer token from env vars', () => {
      setEnv('SPECRAIL_AUTH_BEARER', 'jwt-token-here');
      const requirements: AuthRequirement[] = [{ type: 'bearer' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('bearer');
      expect(result[0].headers.Authorization).toBe('Bearer jwt-token-here');
    });

    it('returns empty when bearer env var is missing', () => {
      const requirements: AuthRequirement[] = [{ type: 'bearer' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(0);
    });
  });

  describe('Basic auth resolution', () => {
    it('resolves basic auth with base64 encoding', () => {
      setEnv('SPECRAIL_AUTH_USER', 'myuser');
      setEnv('SPECRAIL_AUTH_PASS', 'mypass');
      const requirements: AuthRequirement[] = [{ type: 'basic' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('basic');

      // Check base64 encoding of "myuser:mypass"
      const expected = Buffer.from('myuser:mypass').toString('base64');
      expect(result[0].headers.Authorization).toBe(`Basic ${expected}`);
    });

    it('returns empty when user env var is missing', () => {
      setEnv('SPECRAIL_AUTH_PASS', 'mypass');
      const requirements: AuthRequirement[] = [{ type: 'basic' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(0);
    });

    it('returns empty when pass env var is missing', () => {
      setEnv('SPECRAIL_AUTH_USER', 'myuser');
      const requirements: AuthRequirement[] = [{ type: 'basic' }];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(0);
    });
  });

  describe('Custom env prefix', () => {
    it('uses custom prefix for API key', () => {
      setEnv('MY_APP_APIKEY', 'custom-key');
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'Authorization', location: 'header' },
      ];
      const result = resolveAuth(requirements, 'MY_APP');
      expect(result).toHaveLength(1);
      expect(result[0].headers.Authorization).toBe('custom-key');
    });

    it('uses custom prefix for bearer token', () => {
      setEnv('CUSTOM_BEARER', 'custom-token');
      const requirements: AuthRequirement[] = [{ type: 'bearer' }];
      const result = resolveAuth(requirements, 'CUSTOM');
      expect(result).toHaveLength(1);
      expect(result[0].headers.Authorization).toBe('Bearer custom-token');
    });
  });

  describe('OAuth2 resolution', () => {
    it('treats oauth2 like bearer when token is available', () => {
      setEnv('SPECRAIL_AUTH_BEARER', 'oauth-token');
      const requirements: AuthRequirement[] = [
        { type: 'oauth2', tokenUrl: 'https://auth.example.com/token', scopes: ['read'] },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('oauth2');
      expect(result[0].headers.Authorization).toBe('Bearer oauth-token');
    });

    it('returns empty when no bearer token set for oauth2', () => {
      const requirements: AuthRequirement[] = [
        { type: 'oauth2', tokenUrl: 'https://auth.example.com/token' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(0);
    });
  });

  describe('Multiple auth requirements', () => {
    it('resolves multiple auth requirements', () => {
      setEnv('SPECRAIL_AUTH_APIKEY', 'key-123');
      setEnv('SPECRAIL_AUTH_BEARER', 'token-456');
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'X-API-Key', location: 'header' },
        { type: 'bearer' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(2);
    });

    it('filters out unresolvable requirements', () => {
      setEnv('SPECRAIL_AUTH_APIKEY', 'key-123');
      // No bearer token set
      const requirements: AuthRequirement[] = [
        { type: 'api-key', name: 'X-API-Key', location: 'header' },
        { type: 'bearer' },
      ];
      const result = resolveAuth(requirements);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('api-key');
    });
  });
});
