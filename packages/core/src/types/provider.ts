import { z } from 'zod';

// Configuration for a single API provider in the registry.
// This is the primary way users tell Specrail how to reach an API.
export const ProviderConfigSchema = z.object({
  specUrl: z.string(),
  docsUrl: z.string().optional(),
  context7Library: z.string().optional(),
  authEnvPrefix: z.string().optional(),
  policyOverlay: z.string().optional(),
  ttl: z.number().int().positive().optional(),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// The versioned, schema-validated provider registry file.
// Validated on every read; corrupt registries are rejected immediately.
export const ProviderRegistrySchema = z.object({
  $schema: z.string().optional(),
  version: z.literal('1.0'),
  providers: z.record(z.string(), ProviderConfigSchema),
});
export type ProviderRegistry = z.infer<typeof ProviderRegistrySchema>;

// Result of resolving a provider name to a concrete spec source.
export const ResolvedProviderSchema = z.object({
  name: z.string(),
  specUrl: z.string(),
  docsUrl: z.string().optional(),
  context7Library: z.string().optional(),
  authEnvPrefix: z.string().optional(),
  policyOverlay: z.string().optional(),
  ttl: z.number().int().positive().optional(),
  resolvedVia: z.enum(['url', 'file', 'registry', 'well-known']),
});
export type ResolvedProvider = z.infer<typeof ResolvedProviderSchema>;

// Extended bundle metadata with freshness tracking.
// Backward compatible: new fields are optional so old meta.json files still parse.
export const BundleMetaSchema = z.object({
  bundleName: z.string(),
  generatedAt: z.string(),
  bundleHash: z.string(),
  specUrl: z.string(),
  capabilityCount: z.number(),

  // Fields added for runtime-broker freshness model
  provider: z.string().optional(),
  specHash: z.string().optional(),
  specVersion: z.string().optional(),
  specETag: z.string().optional(),
  specLastModified: z.string().optional(),
  policyHash: z.string().optional(),
  docsExpiresAt: z.string().optional(),
  generatorVersion: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type BundleMeta = z.infer<typeof BundleMetaSchema>;
