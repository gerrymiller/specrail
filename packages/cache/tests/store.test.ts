import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeBundle, readBundle, listBundles, cleanCache } from '../src/store.js';
import type { CapabilityBundle } from '@specrail/core';

// Minimal valid CapabilityBundle fixture
function makeBundle(overrides: Partial<CapabilityBundle> = {}): CapabilityBundle {
  return {
    version: '1.0',
    source: {
      specUrl: 'https://petstore.example.com/openapi.yaml',
      specFormat: 'openapi-3.0',
      title: 'Petstore API',
      version: '1.0.0',
    },
    generatedAt: '2025-01-15T10:00:00Z',
    bundleHash: 'a1b2c3d4e5f6',
    policy: {
      overlayName: 'default',
      totalCapabilities: 1,
      allowedCount: 1,
      deniedCount: 0,
    },
    capabilities: [
      {
        id: 'petstore:listPets',
        name: 'List Pets',
        description: 'Returns a list of pets',
        operationId: 'listPets',
        operation: {
          method: 'get',
          path: '/pets',
          servers: ['https://petstore.example.com/v1'],
          parameters: [],
          responses: { '200': { description: 'OK' } },
        },
        classification: 'read',
        policy: {
          allowed: true,
          sensitivity: 'internal',
          requiresApproval: false,
          exportVisible: true,
          redaction: [],
        },
        auth: [],
      },
    ],
    ...overrides,
  };
}

describe('cache store', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'specrail-cache-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('writeBundle', () => {
    it('creates files in the correct directory structure', async () => {
      const bundle = makeBundle();
      const resultDir = await writeBundle(bundle, 'petstore', { cacheDir: tmpDir });
      expect(resultDir).toContain('petstore');

      // Verify both bundle.json and meta.json exist
      const { readFile } = await import('node:fs/promises');
      const bundleContent = await readFile(join(resultDir, 'bundle.json'), 'utf-8');
      const metaContent = await readFile(join(resultDir, 'meta.json'), 'utf-8');

      expect(JSON.parse(bundleContent)).toHaveProperty('version', '1.0');
      expect(JSON.parse(metaContent)).toHaveProperty('bundleName', 'petstore');
    });

    it('writes valid meta.json with correct fields', async () => {
      const bundle = makeBundle();
      const resultDir = await writeBundle(bundle, 'petstore', { cacheDir: tmpDir });

      const { readFile } = await import('node:fs/promises');
      const meta = JSON.parse(await readFile(join(resultDir, 'meta.json'), 'utf-8'));

      expect(meta.bundleName).toBe('petstore');
      expect(meta.generatedAt).toBe('2025-01-15T10:00:00Z');
      expect(meta.bundleHash).toBe('a1b2c3d4e5f6');
      expect(meta.specUrl).toBe('https://petstore.example.com/openapi.yaml');
      expect(meta.capabilityCount).toBe(1);
    });
  });

  describe('readBundle', () => {
    it('reads back what was written', async () => {
      const bundle = makeBundle();
      await writeBundle(bundle, 'petstore', { cacheDir: tmpDir });
      const read = await readBundle('petstore', { cacheDir: tmpDir });
      expect(read).not.toBeNull();
      expect(read!.version).toBe('1.0');
      expect(read!.source.title).toBe('Petstore API');
      expect(read!.capabilities).toHaveLength(1);
      expect(read!.capabilities[0].id).toBe('petstore:listPets');
    });

    it('returns null for a missing bundle', async () => {
      const result = await readBundle('nonexistent', { cacheDir: tmpDir });
      expect(result).toBeNull();
    });

    it('returns null for empty cache directory', async () => {
      const result = await readBundle('petstore', { cacheDir: tmpDir });
      expect(result).toBeNull();
    });
  });

  describe('listBundles', () => {
    it('returns written bundles', async () => {
      const bundle1 = makeBundle();
      const bundle2 = makeBundle({
        source: {
          specUrl: 'https://github.example.com/openapi.yaml',
          specFormat: 'openapi-3.0',
          title: 'GitHub API',
          version: '2.0.0',
        },
        bundleHash: 'xyz789',
      });

      await writeBundle(bundle1, 'petstore', { cacheDir: tmpDir });
      await writeBundle(bundle2, 'github', { cacheDir: tmpDir });

      const bundles = await listBundles({ cacheDir: tmpDir });
      expect(bundles).toHaveLength(2);

      const names = bundles.map((b) => b.bundleName).sort();
      expect(names).toEqual(['github', 'petstore']);
    });

    it('returns empty array when no bundles exist', async () => {
      const bundles = await listBundles({ cacheDir: tmpDir });
      expect(bundles).toEqual([]);
    });
  });

  describe('cleanCache', () => {
    it('removes all bundles and returns count', async () => {
      const bundle = makeBundle();
      await writeBundle(bundle, 'petstore', { cacheDir: tmpDir });
      await writeBundle(bundle, 'another', { cacheDir: tmpDir });

      const removed = await cleanCache({ cacheDir: tmpDir });
      expect(removed).toBe(2);

      const remaining = await listBundles({ cacheDir: tmpDir });
      expect(remaining).toEqual([]);
    });

    it('returns 0 when cache is already empty', async () => {
      const removed = await cleanCache({ cacheDir: tmpDir });
      expect(removed).toBe(0);
    });
  });

  describe('readBundle without explicit cacheDir (default path)', () => {
    it('returns null when bundle does not exist in default caches', async () => {
      // Uses the default local + global search path.
      // The bundle name is deliberately unique so it will not be found.
      const result = await readBundle('__specrail_test_nonexistent_bundle_xyz__');
      expect(result).toBeNull();
    });
  });

  describe('listBundles without explicit cacheDir (default path)', () => {
    it('returns an array (may be empty or contain existing bundles)', async () => {
      const result = await listBundles();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('skips bundles with corrupted meta.json', async () => {
      const bundleDir = join(tmpDir, 'bundles', 'corrupt-bundle');
      await mkdir(bundleDir, { recursive: true });
      await writeFile(join(bundleDir, 'meta.json'), 'NOT VALID JSON', 'utf-8');

      const bundles = await listBundles({ cacheDir: tmpDir });
      expect(bundles).toHaveLength(0);
    });

    it('skips bundles with corrupted bundle.json when reading', async () => {
      const bundleDir = join(tmpDir, 'bundles', 'corrupt-bundle');
      await mkdir(bundleDir, { recursive: true });
      await writeFile(join(bundleDir, 'bundle.json'), 'NOT VALID JSON', 'utf-8');

      const result = await readBundle('corrupt-bundle', { cacheDir: tmpDir });
      expect(result).toBeNull();
    });
  });
});
