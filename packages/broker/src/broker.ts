import { readFile } from 'node:fs/promises';
import {
  type CapabilityBundle,
  type Capability,
  type BundleMeta,
  type ResolvedProvider,
  type HttpMethod,
  generateCapabilityId,
  humanizeName,
  slugify,
  computeHash,
} from '@specrail/core';
import {
  resolveProvider,
  addProvider as registryAdd,
  removeProvider as registryRemove,
  listProviders as registryList,
} from '@specrail/resolver';
import { parseOpenApiSpec, buildAugmentation } from '@specrail/ingest';
import { classify, enforce, DEFAULT_POLICY, loadOverlay } from '@specrail/policy';
import { writeBundle, readBundle, readMeta } from '@specrail/cache';
import { execute as runtimeExecute, type ExecOptions, type ExecResult } from '@specrail/runtime';
import { checkFreshness, getGeneratorVersion, computeExpiresAt } from './freshness.js';

const DEFAULT_TTL = 3600;

export interface BrokerOptions {
  cwd?: string;
  cacheDir?: string;
  forceRefresh?: boolean;
  skipProbing?: boolean;
}

// Ensure a current capability bundle for a provider.
// This is the core broker operation: resolve → check freshness → rebuild if stale.
export async function ensure(
  provider: string,
  options: BrokerOptions = {},
): Promise<CapabilityBundle> {
  const resolved = await resolveProvider(provider, {
    cwd: options.cwd,
    skipProbing: options.skipProbing,
  });

  const bundleName = slugify(resolved.name);

  // Check cache unless forced
  if (!options.forceRefresh) {
    const meta = await readMeta(bundleName, { cacheDir: options.cacheDir });
    if (meta) {
      const freshnessResult = await checkFreshness(meta, resolved.policyOverlay);
      if (freshnessResult.fresh) {
        const cached = await readBundle(bundleName, { cacheDir: options.cacheDir });
        if (cached) return cached;
      }
    }
  }

  // Build fresh bundle
  return buildAndCache(resolved, bundleName, options);
}

async function buildAndCache(
  resolved: ResolvedProvider,
  bundleName: string,
  options: BrokerOptions,
): Promise<CapabilityBundle> {
  // 1. Parse the spec
  const { source, operations } = await parseOpenApiSpec(resolved.specUrl);

  // Compute spec hash for freshness tracking
  let specContent: string | undefined;
  let specETag: string | undefined;
  let specLastModified: string | undefined;

  if (resolved.specUrl.startsWith('http://') || resolved.specUrl.startsWith('https://')) {
    try {
      const resp = await fetch(resolved.specUrl, { signal: AbortSignal.timeout(30_000) });
      specContent = await resp.text();
      specETag = resp.headers.get('etag') ?? undefined;
      specLastModified = resp.headers.get('last-modified') ?? undefined;
    } catch {
      // Fall through — we already parsed successfully via swagger-parser
    }
  } else {
    try {
      specContent = await readFile(resolved.specUrl, 'utf-8');
    } catch {
      // Fall through
    }
  }

  const specHash = specContent ? computeHash(specContent) : undefined;

  // 2. Augmentation
  const augmentation = await buildAugmentation(source.title, {
    docsUrl: resolved.docsUrl,
    useContext7: !!resolved.context7Library,
    context7Library: resolved.context7Library,
  });

  if (augmentation) {
    if (augmentation.context7LibraryId) source.context7LibraryId = augmentation.context7LibraryId;
    if (resolved.docsUrl) source.docsUrl = resolved.docsUrl;
  }

  // 3. Load policy
  const overlay = resolved.policyOverlay
    ? await loadOverlay(resolved.policyOverlay)
    : DEFAULT_POLICY;

  // Compute policy hash for freshness
  let policyHash: string | undefined;
  if (resolved.policyOverlay) {
    try {
      const policyContent = await readFile(resolved.policyOverlay, 'utf-8');
      policyHash = computeHash(policyContent);
    } catch {
      // No policy hash if file unreadable
    }
  } else {
    policyHash = computeHash(JSON.stringify(DEFAULT_POLICY));
  }

  // 4. Build capabilities
  const capabilities: Capability[] = operations.map((op) => {
    const classification = classify(op.method as HttpMethod, op.path);
    const policy = enforce(overlay, {
      classification,
      operationId: op.operationId,
      path: op.path,
      method: op.method as HttpMethod,
    });

    return {
      id: generateCapabilityId(bundleName, op.operationId, op.method, op.path),
      name: humanizeName(op.operationId, op.method, op.path),
      description: op.description ?? op.summary ?? '',
      operationId: op.operationId,
      operation: op.operation,
      classification,
      policy,
      auth: op.auth,
      augmentation,
    };
  });

  // 5. Assemble bundle
  const allowedCount = capabilities.filter((c) => c.policy.allowed).length;
  const deniedCount = capabilities.filter((c) => !c.policy.allowed).length;

  const bundle: CapabilityBundle = {
    version: '1.0',
    source,
    generatedAt: new Date().toISOString(),
    bundleHash: '',
    policy: {
      overlayName: overlay.name,
      totalCapabilities: capabilities.length,
      allowedCount,
      deniedCount,
    },
    capabilities,
  };

  bundle.bundleHash = computeHash(JSON.stringify(bundle));

  // 6. Write to cache with freshness metadata
  const ttl = resolved.ttl ?? DEFAULT_TTL;
  const metaOverrides: Partial<BundleMeta> = {
    provider: resolved.name,
    specHash,
    specVersion: source.version,
    specETag,
    specLastModified,
    policyHash,
    generatorVersion: getGeneratorVersion(),
    expiresAt: computeExpiresAt(ttl),
  };

  await writeBundle(bundle, bundleName, {
    cacheDir: options.cacheDir,
    metaOverrides,
  });

  return bundle;
}

// List capabilities for a provider (auto-ensures the bundle).
export async function capabilities(
  provider: string,
  options: BrokerOptions & { classification?: string } = {},
): Promise<Capability[]> {
  const bundle = await ensure(provider, options);
  let caps = bundle.capabilities;
  if (options.classification) {
    caps = caps.filter((c) => c.classification === options.classification);
  }
  return caps;
}

// Execute a capability by provider and capability ID.
export async function execute(
  provider: string,
  capabilityId: string,
  execOptions: ExecOptions = {},
  brokerOptions: BrokerOptions = {},
): Promise<ExecResult> {
  const bundle = await ensure(provider, brokerOptions);
  const resolved = await resolveProvider(provider, {
    cwd: brokerOptions.cwd,
    skipProbing: brokerOptions.skipProbing,
  });

  // Find capability — match by full ID or just the operationId/suffix
  const bundleName = slugify(resolved.name);
  const capability = bundle.capabilities.find(
    (c) => c.id === capabilityId || c.id === `${bundleName}:${capabilityId}`,
  );

  if (!capability) {
    throw new Error(
      `Capability '${capabilityId}' not found in provider '${provider}'. ` +
        `Available: ${bundle.capabilities.map((c) => c.id).join(', ')}`,
    );
  }

  return runtimeExecute(capability, {
    ...execOptions,
    authEnvPrefix: execOptions.authEnvPrefix ?? resolved.authEnvPrefix,
  });
}

// Force rebuild a provider's bundle.
export async function refresh(
  provider: string,
  options: BrokerOptions = {},
): Promise<CapabilityBundle> {
  return ensure(provider, { ...options, forceRefresh: true });
}

// Inspect: return the bundle for a provider.
export async function inspect(
  provider: string,
  options: BrokerOptions = {},
): Promise<CapabilityBundle> {
  return ensure(provider, options);
}

// Provider management pass-through
export async function registerProvider(
  name: string,
  config: import('@specrail/core').ProviderConfig,
  cwd?: string,
): Promise<void> {
  await registryAdd(name, config, cwd);
}

export async function unregisterProvider(name: string, cwd?: string): Promise<boolean> {
  return registryRemove(name, cwd);
}

export async function providers(
  cwd?: string,
): Promise<Array<{ name: string; config: { specUrl: string } }>> {
  return registryList(cwd);
}
