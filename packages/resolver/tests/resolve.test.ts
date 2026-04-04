import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProvider, ProviderNotFoundError } from '../src/resolve.js';
import { addProvider } from '../src/registry.js';

describe('resolveProvider', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'specrail-resolve-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('URL resolution', () => {
    it('resolves an http URL directly', async () => {
      const result = await resolveProvider('http://example.com/spec.json', { cwd: tmpDir });
      expect(result.specUrl).toBe('http://example.com/spec.json');
      expect(result.resolvedVia).toBe('url');
    });

    it('resolves an https URL directly', async () => {
      const result = await resolveProvider('https://example.com/api/spec.yaml', { cwd: tmpDir });
      expect(result.specUrl).toBe('https://example.com/api/spec.yaml');
      expect(result.resolvedVia).toBe('url');
    });
  });

  describe('file resolution', () => {
    it('resolves an existing file path', async () => {
      const specPath = join(tmpDir, 'spec.yaml');
      await writeFile(specPath, 'openapi: "3.0.0"', 'utf-8');

      const result = await resolveProvider(specPath, { cwd: tmpDir });
      expect(result.specUrl).toBe(specPath);
      expect(result.resolvedVia).toBe('file');
    });

    it('does not resolve a non-existent file path via file resolution', async () => {
      // A .yaml file that doesn't exist should fall through to registry, then fail
      await expect(
        resolveProvider('/nonexistent/path/spec.yaml', { cwd: tmpDir, skipProbing: true }),
      ).rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('registry resolution', () => {
    it('resolves a registered provider by name', async () => {
      await addProvider(
        'petstore',
        {
          specUrl: 'https://petstore.example.com/spec.json',
          authEnvPrefix: 'PETSTORE',
          ttl: 7200,
        },
        tmpDir,
      );

      const result = await resolveProvider('petstore', { cwd: tmpDir, skipProbing: true });
      expect(result.name).toBe('petstore');
      expect(result.specUrl).toBe('https://petstore.example.com/spec.json');
      expect(result.authEnvPrefix).toBe('PETSTORE');
      expect(result.ttl).toBe(7200);
      expect(result.resolvedVia).toBe('registry');
    });

    it('includes docsUrl and context7Library from registry', async () => {
      await addProvider(
        'stripe',
        {
          specUrl: 'https://stripe.com/spec.json',
          docsUrl: 'https://stripe.com/docs',
          context7Library: 'stripe-node',
          policyOverlay: './policies/stripe.json',
        },
        tmpDir,
      );

      const result = await resolveProvider('stripe', { cwd: tmpDir, skipProbing: true });
      expect(result.docsUrl).toBe('https://stripe.com/docs');
      expect(result.context7Library).toBe('stripe-node');
      expect(result.policyOverlay).toBe('./policies/stripe.json');
    });
  });

  describe('file path detection', () => {
    it('recognizes .yaml extension as file path', async () => {
      const specPath = join(tmpDir, 'api.yaml');
      await writeFile(specPath, 'openapi: "3.0.0"', 'utf-8');
      const result = await resolveProvider(specPath, { cwd: tmpDir });
      expect(result.resolvedVia).toBe('file');
    });

    it('recognizes .yml extension as file path', async () => {
      const specPath = join(tmpDir, 'api.yml');
      await writeFile(specPath, 'openapi: "3.0.0"', 'utf-8');
      const result = await resolveProvider(specPath, { cwd: tmpDir });
      expect(result.resolvedVia).toBe('file');
    });

    it('recognizes .json extension as file path', async () => {
      const specPath = join(tmpDir, 'api.json');
      await writeFile(specPath, '{"openapi":"3.0.0"}', 'utf-8');
      const result = await resolveProvider(specPath, { cwd: tmpDir });
      expect(result.resolvedVia).toBe('file');
    });

    it('recognizes relative paths starting with ./', async () => {
      // This won't resolve to a real file but tests the detection logic
      // The file doesn't exist so it falls through to registry/probing
      await expect(
        resolveProvider('./nonexistent.txt', { cwd: tmpDir, skipProbing: true }),
      ).rejects.toThrow(ProviderNotFoundError);
    });

    it('recognizes relative paths starting with ../', async () => {
      await expect(
        resolveProvider('../nonexistent.txt', { cwd: tmpDir, skipProbing: true }),
      ).rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('well-known probing', () => {
    it('skips probing when skipProbing is true', async () => {
      await expect(
        resolveProvider('nonexistent-provider', { cwd: tmpDir, skipProbing: true }),
      ).rejects.toThrow(ProviderNotFoundError);
    });

    it('falls through to failure when probing returns non-200', async () => {
      // probing will fail for this fake domain
      await expect(
        resolveProvider('definitely-not-a-real-domain-xyz123', { cwd: tmpDir }),
      ).rejects.toThrow(ProviderNotFoundError);
    });
  });

  describe('failure', () => {
    it('throws ProviderNotFoundError with guidance message', async () => {
      try {
        await resolveProvider('unknown', { cwd: tmpDir, skipProbing: true });
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProviderNotFoundError);
        expect((err as ProviderNotFoundError).provider).toBe('unknown');
        expect((err as Error).message).toContain('specrail provider add');
      }
    });
  });
});
