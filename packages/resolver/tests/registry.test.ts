import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addProvider,
  removeProvider,
  lookupProvider,
  listProviders,
  loadRegistry,
  getLocalRegistryPath,
} from '../src/registry.js';

describe('provider registry', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'specrail-registry-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('addProvider', () => {
    it('creates the registry file and adds a provider', async () => {
      await addProvider('petstore', { specUrl: 'https://example.com/spec.json' }, tmpDir);

      const registryPath = getLocalRegistryPath(tmpDir);
      const raw = await readFile(registryPath, 'utf-8');
      const registry = JSON.parse(raw);

      expect(registry.version).toBe('1.0');
      expect(registry.$schema).toBe('https://specrail.dev/schemas/provider-registry-v1.json');
      expect(registry.providers.petstore.specUrl).toBe('https://example.com/spec.json');
    });

    it('preserves existing providers when adding a new one', async () => {
      await addProvider('petstore', { specUrl: 'https://example.com/pets.json' }, tmpDir);
      await addProvider('github', { specUrl: 'https://example.com/github.json' }, tmpDir);

      const list = await listProviders(tmpDir);
      expect(list).toHaveLength(2);
      expect(list.map((p) => p.name).sort()).toEqual(['github', 'petstore']);
    });

    it('overwrites an existing provider with the same name', async () => {
      await addProvider('petstore', { specUrl: 'https://v1.com/spec.json' }, tmpDir);
      await addProvider('petstore', { specUrl: 'https://v2.com/spec.json' }, tmpDir);

      const config = await lookupProvider('petstore', tmpDir);
      expect(config?.specUrl).toBe('https://v2.com/spec.json');
    });

    it('stores optional fields when provided', async () => {
      await addProvider(
        'stripe',
        {
          specUrl: 'https://stripe.com/spec.json',
          docsUrl: 'https://stripe.com/docs',
          authEnvPrefix: 'STRIPE',
          policyOverlay: './policies/stripe.json',
          ttl: 86400,
          context7Library: 'stripe-api',
        },
        tmpDir,
      );

      const config = await lookupProvider('stripe', tmpDir);
      expect(config?.docsUrl).toBe('https://stripe.com/docs');
      expect(config?.authEnvPrefix).toBe('STRIPE');
      expect(config?.policyOverlay).toBe('./policies/stripe.json');
      expect(config?.ttl).toBe(86400);
      expect(config?.context7Library).toBe('stripe-api');
    });
  });

  describe('removeProvider', () => {
    it('removes an existing provider and returns true', async () => {
      await addProvider('petstore', { specUrl: 'https://example.com/spec.json' }, tmpDir);
      const removed = await removeProvider('petstore', tmpDir);
      expect(removed).toBe(true);

      const config = await lookupProvider('petstore', tmpDir);
      expect(config).toBeNull();
    });

    it('returns false for a non-existent provider', async () => {
      await addProvider('petstore', { specUrl: 'https://example.com/spec.json' }, tmpDir);
      const removed = await removeProvider('nonexistent', tmpDir);
      expect(removed).toBe(false);
    });

    it('returns false when registry does not exist', async () => {
      const removed = await removeProvider('anything', tmpDir);
      expect(removed).toBe(false);
    });
  });

  describe('lookupProvider', () => {
    it('returns null for unknown provider', async () => {
      const config = await lookupProvider('unknown', tmpDir);
      expect(config).toBeNull();
    });

    it('returns the config for a registered provider', async () => {
      await addProvider('petstore', { specUrl: 'https://example.com/spec.json' }, tmpDir);
      const config = await lookupProvider('petstore', tmpDir);
      expect(config).not.toBeNull();
      expect(config!.specUrl).toBe('https://example.com/spec.json');
    });
  });

  describe('listProviders', () => {
    it('returns empty array when no registry exists', async () => {
      const providers = await listProviders(tmpDir);
      expect(providers).toEqual([]);
    });

    it('returns all registered providers', async () => {
      await addProvider('a', { specUrl: 'https://a.com/spec.json' }, tmpDir);
      await addProvider('b', { specUrl: 'https://b.com/spec.json' }, tmpDir);
      await addProvider('c', { specUrl: 'https://c.com/spec.json' }, tmpDir);

      const providers = await listProviders(tmpDir);
      expect(providers).toHaveLength(3);
    });
  });

  describe('loadRegistry', () => {
    it('returns empty registry when no files exist', async () => {
      const registry = await loadRegistry(tmpDir);
      expect(registry.version).toBe('1.0');
      expect(Object.keys(registry.providers)).toHaveLength(0);
    });
  });

  describe('validation', () => {
    it('rejects a corrupted registry file with clear error', async () => {
      const registryDir = join(tmpDir, '.specrail');
      await mkdir(registryDir, { recursive: true });
      await writeFile(
        join(registryDir, 'providers.json'),
        JSON.stringify({ version: '999', providers: {} }),
        'utf-8',
      );

      await expect(loadRegistry(tmpDir)).rejects.toThrow();
    });

    it('rejects a registry with invalid provider config', async () => {
      const registryDir = join(tmpDir, '.specrail');
      await mkdir(registryDir, { recursive: true });
      await writeFile(
        join(registryDir, 'providers.json'),
        JSON.stringify({
          version: '1.0',
          providers: { bad: { noSpecUrl: true } },
        }),
        'utf-8',
      );

      await expect(loadRegistry(tmpDir)).rejects.toThrow();
    });

    it('accepts unknown extra fields in the registry (forward compat)', async () => {
      const registryDir = join(tmpDir, '.specrail');
      await mkdir(registryDir, { recursive: true });
      await writeFile(
        join(registryDir, 'providers.json'),
        JSON.stringify({
          version: '1.0',
          futureField: 'ignored',
          providers: {
            test: { specUrl: 'https://example.com/spec.json', futureOption: true },
          },
        }),
        'utf-8',
      );

      const registry = await loadRegistry(tmpDir);
      expect(registry.providers.test.specUrl).toBe('https://example.com/spec.json');
    });
  });
});
