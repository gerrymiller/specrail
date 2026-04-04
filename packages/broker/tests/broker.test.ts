import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addProvider } from '@specrail/resolver';
import { readMeta, readBundle } from '@specrail/cache';
import {
  ensure,
  capabilities,
  execute,
  refresh,
  inspect,
  registerProvider,
  unregisterProvider,
  providers,
} from '../src/broker.js';
import { getGeneratorVersion } from '../src/freshness.js';

// Use the local petstore fixture for integration tests
const PETSTORE_SPEC = join(process.cwd(), 'fixtures', 'specs', 'petstore.yaml');

describe('broker', () => {
  let tmpDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'specrail-broker-test-'));
    cacheDir = join(tmpDir, 'cache');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('ensure', () => {
    it('resolves a registered provider, builds bundle, and caches it', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const bundle = await ensure('petstore', {
        cwd: tmpDir,
        cacheDir,
        skipProbing: true,
      });

      expect(bundle.version).toBe('1.0');
      expect(bundle.source.title).toBe('Petstore API');
      expect(bundle.capabilities.length).toBeGreaterThan(0);
    });

    it('writes freshness metadata to cache', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });

      const meta = await readMeta('petstore', { cacheDir });
      expect(meta).not.toBeNull();
      expect(meta!.provider).toBe('petstore');
      expect(meta!.generatorVersion).toBe(getGeneratorVersion());
      expect(meta!.specHash).toBeDefined();
      expect(meta!.policyHash).toBeDefined();
      expect(meta!.expiresAt).toBeDefined();
    });

    it('returns cached bundle on second call (no rebuild)', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const bundle1 = await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });
      const bundle2 = await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });

      // Same bundle hash means it was served from cache
      expect(bundle2.bundleHash).toBe(bundle1.bundleHash);
    });

    it('resolves a direct URL/file path without registry', async () => {
      const bundle = await ensure(PETSTORE_SPEC, { cwd: tmpDir, cacheDir });
      expect(bundle.source.title).toBe('Petstore API');
    });

    it('applies the default policy (denies writes and actions)', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const bundle = await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });

      const allowed = bundle.capabilities.filter((c) => c.policy.allowed);
      const denied = bundle.capabilities.filter((c) => !c.policy.allowed);

      // Petstore has read (GET) and write (POST/DELETE) operations
      // Default policy: only reads allowed
      expect(allowed.length).toBeGreaterThan(0);
      expect(allowed.every((c) => c.classification === 'read')).toBe(true);
      expect(denied.length).toBeGreaterThan(0);
    });
  });

  describe('capabilities', () => {
    it('returns all capabilities for a provider', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const caps = await capabilities('petstore', {
        cwd: tmpDir,
        cacheDir,
        skipProbing: true,
      });

      expect(caps.length).toBeGreaterThan(0);
    });

    it('filters by classification', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const readCaps = await capabilities('petstore', {
        cwd: tmpDir,
        cacheDir,
        skipProbing: true,
        classification: 'read',
      });

      expect(readCaps.length).toBeGreaterThan(0);
      expect(readCaps.every((c) => c.classification === 'read')).toBe(true);
    });
  });

  describe('refresh', () => {
    it('forces a rebuild even when cache is fresh', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const original = await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });
      const refreshed = await refresh('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });

      // Different generatedAt timestamp proves it was rebuilt
      expect(refreshed.generatedAt).not.toBe(original.generatedAt);
    });
  });

  describe('inspect', () => {
    it('returns the bundle for a provider', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const bundle = await inspect('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });
      expect(bundle.version).toBe('1.0');
      expect(bundle.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('provider management', () => {
    it('registers and lists providers', async () => {
      await registerProvider('test-api', { specUrl: 'https://example.com/spec.json' }, tmpDir);

      const list = await providers(tmpDir);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('test-api');
    });

    it('unregisters a provider', async () => {
      await registerProvider('test-api', { specUrl: 'https://example.com/spec.json' }, tmpDir);
      const removed = await unregisterProvider('test-api', tmpDir);
      expect(removed).toBe(true);

      const list = await providers(tmpDir);
      expect(list).toHaveLength(0);
    });

    it('returns false when unregistering non-existent provider', async () => {
      const removed = await unregisterProvider('nonexistent', tmpDir);
      expect(removed).toBe(false);
    });
  });

  describe('execute', () => {
    it('throws when capability is not found', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      await expect(
        execute('petstore', 'nonexistentCap', {}, { cwd: tmpDir, cacheDir, skipProbing: true }),
      ).rejects.toThrow("Capability 'nonexistentCap' not found");
    });

    it('executes a read capability in dry-run mode', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const result = await execute(
        'petstore',
        'listPets',
        { dryRun: true },
        { cwd: tmpDir, cacheDir, skipProbing: true },
      );

      expect(result.dryRun).toBe(true);
      expect(result.request.method).toBe('GET');
    });

    it('denies a write capability', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      await expect(
        execute(
          'petstore',
          'createPet',
          { dryRun: true },
          { cwd: tmpDir, cacheDir, skipProbing: true },
        ),
      ).rejects.toThrow('denied');
    });

    it('resolves capability by short name (without bundle prefix)', async () => {
      await addProvider('petstore', { specUrl: PETSTORE_SPEC }, tmpDir);

      const result = await execute(
        'petstore',
        'listPets',
        { dryRun: true },
        { cwd: tmpDir, cacheDir, skipProbing: true },
      );

      expect(result.dryRun).toBe(true);
    });
  });

  describe('ensure with custom policy', () => {
    it('uses a custom policy overlay from the provider config', async () => {
      const policyPath = join(tmpDir, 'allow-writes.json');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        policyPath,
        JSON.stringify({
          version: '1.0',
          name: 'allow-all',
          rules: [
            {
              match: { classification: ['read', 'write', 'delete', 'action', 'admin'] },
              effect: 'allow',
            },
          ],
          defaults: {},
        }),
        'utf-8',
      );

      await addProvider('petstore', { specUrl: PETSTORE_SPEC, policyOverlay: policyPath }, tmpDir);

      const bundle = await ensure('petstore', { cwd: tmpDir, cacheDir, skipProbing: true });
      const denied = bundle.capabilities.filter((c) => !c.policy.allowed);
      expect(denied).toHaveLength(0);
    });
  });
});
