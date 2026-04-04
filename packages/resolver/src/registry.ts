import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import envPaths from 'env-paths';
import { ProviderRegistrySchema, type ProviderConfig, type ProviderRegistry } from '@specrail/core';

const globalPaths = envPaths('specrail', { suffix: '' });

export function getLocalRegistryPath(cwd?: string): string {
  return join(cwd ?? process.cwd(), '.specrail', 'providers.json');
}

export function getGlobalRegistryPath(): string {
  return join(globalPaths.config, 'providers.json');
}

function emptyRegistry(): ProviderRegistry {
  return { version: '1.0', providers: {} };
}

// Read and validate a registry file. Returns empty registry if file doesn't exist.
// Throws with Zod issue details if the file exists but fails validation.
async function readRegistryFile(filePath: string): Promise<ProviderRegistry> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return ProviderRegistrySchema.parse(parsed);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return emptyRegistry();
    }
    throw err;
  }
}

async function writeRegistryFile(filePath: string, registry: ProviderRegistry): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const output: ProviderRegistry = {
    $schema: 'https://specrail.dev/schemas/provider-registry-v1.json',
    ...registry,
  };
  await writeFile(filePath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
}

// Load merged provider registry (local overrides global).
export async function loadRegistry(cwd?: string): Promise<ProviderRegistry> {
  const globalReg = await readRegistryFile(getGlobalRegistryPath());
  const localReg = await readRegistryFile(getLocalRegistryPath(cwd));
  return {
    version: '1.0',
    providers: { ...globalReg.providers, ...localReg.providers },
  };
}

// Look up a single provider by name across both tiers.
export async function lookupProvider(name: string, cwd?: string): Promise<ProviderConfig | null> {
  const registry = await loadRegistry(cwd);
  return registry.providers[name] ?? null;
}

// Add or update a provider in the local registry.
export async function addProvider(
  name: string,
  config: ProviderConfig,
  cwd?: string,
): Promise<void> {
  const filePath = getLocalRegistryPath(cwd);
  const registry = await readRegistryFile(filePath);
  registry.providers[name] = config;
  await writeRegistryFile(filePath, registry);
}

// Remove a provider from the local registry. Returns true if it existed.
export async function removeProvider(name: string, cwd?: string): Promise<boolean> {
  const filePath = getLocalRegistryPath(cwd);
  const registry = await readRegistryFile(filePath);
  if (!(name in registry.providers)) return false;
  delete registry.providers[name];
  await writeRegistryFile(filePath, registry);
  return true;
}

// List all providers from the merged registry.
export async function listProviders(
  cwd?: string,
): Promise<Array<{ name: string; config: ProviderConfig }>> {
  const registry = await loadRegistry(cwd);
  return Object.entries(registry.providers).map(([name, config]) => ({ name, config }));
}
