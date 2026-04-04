import { existsSync } from 'node:fs';
import { type ResolvedProvider, type ProviderConfig } from '@specrail/core';
import { lookupProvider } from './registry.js';

// Determine if the input looks like a URL
function isUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}

// Determine if the input looks like a file path
function isFilePath(input: string): boolean {
  return (
    input.startsWith('/') ||
    input.startsWith('./') ||
    input.startsWith('../') ||
    input.endsWith('.yaml') ||
    input.endsWith('.yml') ||
    input.endsWith('.json')
  );
}

// Probe well-known OpenAPI spec URLs for a given provider name.
// Tries exactly two patterns, returns the first that responds 200.
async function probeWellKnown(name: string): Promise<string | null> {
  const candidates = [
    `https://${name}/.well-known/openapi.json`,
    `https://api.${name}.com/openapi.json`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5_000),
      });
      if (resp.ok) return url;
    } catch {
      // Probe failed, try next
    }
  }

  return null;
}

function configToResolved(
  name: string,
  config: ProviderConfig,
  resolvedVia: ResolvedProvider['resolvedVia'],
): ResolvedProvider {
  return {
    name,
    specUrl: config.specUrl,
    docsUrl: config.docsUrl,
    context7Library: config.context7Library,
    authEnvPrefix: config.authEnvPrefix,
    policyOverlay: config.policyOverlay,
    ttl: config.ttl,
    resolvedVia,
  };
}

export interface ResolveOptions {
  cwd?: string;
  skipProbing?: boolean;
}

// Resolution chain:
// 1. Exact URL or file path → use directly
// 2. Provider registry lookup → primary path
// 3. Well-known probing → silent fallback
// 4. Fail clearly with guidance
export async function resolveProvider(
  input: string,
  options: ResolveOptions = {},
): Promise<ResolvedProvider> {
  // 1. Exact URL
  if (isUrl(input)) {
    return {
      name: input,
      specUrl: input,
      resolvedVia: 'url',
    };
  }

  // 1b. File path
  if (isFilePath(input) && existsSync(input)) {
    return {
      name: input,
      specUrl: input,
      resolvedVia: 'file',
    };
  }

  // 2. Registry lookup
  const config = await lookupProvider(input, options.cwd);
  if (config) {
    return configToResolved(input, config, 'registry');
  }

  // 3. Well-known probing (silent fallback)
  if (!options.skipProbing) {
    const wellKnown = await probeWellKnown(input);
    if (wellKnown) {
      return {
        name: input,
        specUrl: wellKnown,
        resolvedVia: 'well-known',
      };
    }
  }

  // 4. Fail clearly
  throw new ProviderNotFoundError(input);
}

export class ProviderNotFoundError extends Error {
  constructor(public readonly provider: string) {
    super(
      `Provider '${provider}' not found. Register it:\n  specrail provider add ${provider} --spec-url <url>`,
    );
    this.name = 'ProviderNotFoundError';
  }
}
