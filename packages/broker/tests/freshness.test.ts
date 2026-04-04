import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BundleMeta, computeHash } from '@specrail/core';
import { checkFreshness, getGeneratorVersion, computeExpiresAt } from '../src/freshness.js';

function makeMeta(overrides: Partial<BundleMeta> = {}): BundleMeta {
  return {
    bundleName: 'test-api',
    generatedAt: '2025-01-15T10:00:00Z',
    bundleHash: 'abc123',
    specUrl: 'https://example.com/spec.json',
    capabilityCount: 5,
    provider: 'test',
    generatorVersion: getGeneratorVersion(),
    policyHash: 'policyhash123',
    specHash: 'spechash456',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
}

describe('checkFreshness', () => {
  describe('generator staleness', () => {
    it('reports fresh when generator version matches', async () => {
      const meta = makeMeta();
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(true);
    });

    it('reports stale when generator version differs', async () => {
      const meta = makeMeta({ generatorVersion: '0.0.1' });
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(false);
      expect(result.reason).toBe('generator');
    });

    it('skips generator check when generatorVersion is absent (legacy meta)', async () => {
      const meta = makeMeta({ generatorVersion: undefined });
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(true);
    });
  });

  describe('policy staleness', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'specrail-freshness-test-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('reports stale when policy file hash differs', async () => {
      const policyPath = join(tmpDir, 'policy.json');
      const originalContent = '{"version":"1.0","name":"old","rules":[]}';
      const originalHash = computeHash(originalContent);

      // Write a different policy
      await writeFile(policyPath, '{"version":"1.0","name":"new","rules":[]}', 'utf-8');

      const meta = makeMeta({ policyHash: originalHash });
      const result = await checkFreshness(meta, policyPath);
      expect(result.fresh).toBe(false);
      expect(result.reason).toBe('policy');
    });

    it('reports fresh when policy file hash matches', async () => {
      const policyPath = join(tmpDir, 'policy.json');
      const content = '{"version":"1.0","name":"test","rules":[]}';
      await writeFile(policyPath, content, 'utf-8');

      const meta = makeMeta({ policyHash: computeHash(content) });
      const result = await checkFreshness(meta, policyPath);
      expect(result.fresh).toBe(true);
    });

    it('reports stale when policy file is missing', async () => {
      const meta = makeMeta({ policyHash: 'somehash' });
      const result = await checkFreshness(meta, join(tmpDir, 'nonexistent.json'));
      expect(result.fresh).toBe(false);
      expect(result.reason).toBe('policy');
    });
  });

  describe('TTL', () => {
    it('reports fresh when TTL has not expired', async () => {
      const meta = makeMeta({
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(true);
    });

    it('checks source when TTL has expired', async () => {
      const meta = makeMeta({
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        specUrl: '/nonexistent/local/file.yaml',
        specHash: 'oldhash',
      });
      // Local file doesn't exist → stale
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(false);
      expect(result.reason).toBe('source');
    });
  });

  describe('source staleness (local file)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'specrail-source-test-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('reports fresh when local file hash matches', async () => {
      const specPath = join(tmpDir, 'spec.yaml');
      const content = 'openapi: "3.0.0"\ninfo:\n  title: Test';
      await writeFile(specPath, content, 'utf-8');

      const meta = makeMeta({
        specUrl: specPath,
        specHash: computeHash(content),
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(true);
    });

    it('reports stale when local file hash differs', async () => {
      const specPath = join(tmpDir, 'spec.yaml');
      await writeFile(specPath, 'changed content', 'utf-8');

      const meta = makeMeta({
        specUrl: specPath,
        specHash: 'oldhash',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      const result = await checkFreshness(meta);
      expect(result.fresh).toBe(false);
      expect(result.reason).toBe('source');
    });
  });
});

describe('getGeneratorVersion', () => {
  it('returns a semver-like string', () => {
    const version = getGeneratorVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('computeExpiresAt', () => {
  it('returns a future ISO timestamp', () => {
    const result = computeExpiresAt(3600);
    const parsed = new Date(result);
    expect(parsed.getTime()).toBeGreaterThan(Date.now());
  });

  it('respects the TTL seconds', () => {
    const before = Date.now();
    const result = computeExpiresAt(60);
    const parsed = new Date(result).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before + 59_000);
    expect(parsed).toBeLessThanOrEqual(before + 61_000);
  });
});
