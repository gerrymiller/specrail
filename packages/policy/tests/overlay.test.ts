import { describe, it, expect } from 'vitest';
import { loadOverlay, DEFAULT_POLICY } from '../src/overlay.js';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('loadOverlay', () => {
  it('loads the default-policy.json fixture successfully', async () => {
    const fixturePath = resolve(__dirname, '../../../fixtures/policies/default-policy.json');
    const overlay = await loadOverlay(fixturePath);
    expect(overlay.name).toBe('default');
    expect(overlay.version).toBe('1.0');
    expect(overlay.rules).toHaveLength(2);
    expect(overlay.rules[0].effect).toBe('deny');
    expect(overlay.rules[1].effect).toBe('allow');
  });

  it('parses overlay defaults correctly from fixture', async () => {
    const fixturePath = resolve(__dirname, '../../../fixtures/policies/default-policy.json');
    const overlay = await loadOverlay(fixturePath);
    expect(overlay.defaults.sensitivity).toBe('internal');
    expect(overlay.defaults.requiresApproval).toBe(false);
    expect(overlay.defaults.exportVisible).toBe(true);
  });

  it('throws on invalid JSON file', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'specrail-test-'));
    const badFile = join(tmpDir, 'bad.json');
    await writeFile(badFile, 'not valid json {{{', 'utf-8');
    try {
      await expect(loadOverlay(badFile)).rejects.toThrow();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws Zod validation error on structurally invalid overlay', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'specrail-test-'));
    const invalidFile = join(tmpDir, 'invalid-overlay.json');
    // Valid JSON but wrong structure: missing version, wrong version format
    await writeFile(
      invalidFile,
      JSON.stringify({
        version: '9.9',
        name: 'bad-overlay',
        rules: [{ match: {}, effect: 'maybe' }],
      }),
      'utf-8',
    );
    try {
      await expect(loadOverlay(invalidFile)).rejects.toThrow();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws when file does not exist', async () => {
    await expect(loadOverlay('/nonexistent/path/overlay.json')).rejects.toThrow();
  });

  it('loads a valid overlay written to a temp file', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'specrail-test-'));
    const validFile = join(tmpDir, 'valid-overlay.json');
    await writeFile(
      validFile,
      JSON.stringify({
        version: '1.0',
        name: 'custom',
        description: 'Custom overlay for testing',
        rules: [
          {
            match: { classification: ['read'] },
            effect: 'allow',
          },
        ],
      }),
      'utf-8',
    );
    try {
      const overlay = await loadOverlay(validFile);
      expect(overlay.name).toBe('custom');
      expect(overlay.rules).toHaveLength(1);
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('DEFAULT_POLICY', () => {
  it('has the correct name', () => {
    expect(DEFAULT_POLICY.name).toBe('default');
  });

  it('has version 1.0', () => {
    expect(DEFAULT_POLICY.version).toBe('1.0');
  });

  it('has two rules', () => {
    expect(DEFAULT_POLICY.rules).toHaveLength(2);
  });
});
