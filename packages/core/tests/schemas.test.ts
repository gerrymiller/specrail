import { describe, it, expect } from 'vitest';
import {
  CapabilityBundleSchema,
  PolicyOverlaySchema,
  CapabilitySchema,
  AuthRequirementSchema,
  ProviderConfigSchema,
  ProviderRegistrySchema,
  BundleMetaSchema,
  ResolvedProviderSchema,
} from '../src/types/index.js';

// Minimal valid fixtures used across tests
const validSource = {
  specUrl: 'https://petstore.example.com/openapi.yaml',
  specFormat: 'openapi-3.0' as const,
  title: 'Petstore API',
  version: '1.0.0',
};

const validOperation = {
  method: 'get' as const,
  path: '/pets',
  servers: ['https://petstore.example.com/v1'],
  parameters: [],
  responses: {
    '200': { description: 'OK' },
  },
};

const validCapability = {
  id: 'petstore:listPets',
  name: 'List Pets',
  description: 'Lists all pets',
  operationId: 'listPets',
  operation: validOperation,
  classification: 'read' as const,
  policy: {
    allowed: true,
    sensitivity: 'internal' as const,
    requiresApproval: false,
    exportVisible: true,
    redaction: [],
  },
  auth: [],
};

const validBundle = {
  version: '1.0' as const,
  source: validSource,
  generatedAt: '2025-01-15T10:00:00Z',
  bundleHash: 'abc123def456',
  policy: {
    overlayName: 'default',
    totalCapabilities: 1,
    allowedCount: 1,
    deniedCount: 0,
  },
  capabilities: [validCapability],
};

describe('CapabilityBundleSchema', () => {
  it('validates a complete valid bundle', () => {
    const result = CapabilityBundleSchema.safeParse(validBundle);
    expect(result.success).toBe(true);
  });

  it('rejects bundle with missing version', () => {
    const invalid = { ...validBundle, version: undefined };
    const result = CapabilityBundleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects bundle with wrong version format', () => {
    const invalid = { ...validBundle, version: '2.0' };
    const result = CapabilityBundleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects bundle with missing source', () => {
    const { source: _, ...invalid } = validBundle;
    const result = CapabilityBundleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects bundle with missing capabilities array', () => {
    const { capabilities: _, ...invalid } = validBundle;
    const result = CapabilityBundleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts bundle with empty capabilities array', () => {
    const empty = { ...validBundle, capabilities: [] };
    const result = CapabilityBundleSchema.safeParse(empty);
    expect(result.success).toBe(true);
  });

  it('rejects bundle with invalid specFormat in source', () => {
    const invalid = {
      ...validBundle,
      source: { ...validSource, specFormat: 'swagger-2.0' },
    };
    const result = CapabilityBundleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('PolicyOverlaySchema', () => {
  it('validates a complete valid overlay', () => {
    const overlay = {
      version: '1.0',
      name: 'test-policy',
      description: 'A test policy',
      rules: [
        {
          match: { classification: ['read'] },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const result = PolicyOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('validates overlay with optional $schema field', () => {
    const overlay = {
      $schema: 'https://specrail.dev/schemas/policy-overlay-v1.json',
      version: '1.0',
      name: 'default',
      rules: [],
    };
    const result = PolicyOverlaySchema.safeParse(overlay);
    expect(result.success).toBe(true);
  });

  it('rejects overlay with wrong version', () => {
    const invalid = {
      version: '2.0',
      name: 'test',
      rules: [],
    };
    const result = PolicyOverlaySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects overlay missing name', () => {
    const invalid = {
      version: '1.0',
      rules: [],
    };
    const result = PolicyOverlaySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects overlay with invalid effect in rule', () => {
    const invalid = {
      version: '1.0',
      name: 'test',
      rules: [{ match: {}, effect: 'maybe' }],
    };
    const result = PolicyOverlaySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('applies default values for missing defaults object', () => {
    const overlay = {
      version: '1.0',
      name: 'minimal',
      rules: [],
    };
    const result = PolicyOverlaySchema.parse(overlay);
    expect(result.defaults.sensitivity).toBe('internal');
    expect(result.defaults.requiresApproval).toBe(false);
    expect(result.defaults.exportVisible).toBe(true);
  });
});

describe('CapabilitySchema', () => {
  it('validates a complete valid capability', () => {
    const result = CapabilitySchema.safeParse(validCapability);
    expect(result.success).toBe(true);
  });

  it('rejects capability with missing id', () => {
    const { id: _, ...invalid } = validCapability;
    const result = CapabilitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects capability with invalid classification', () => {
    const invalid = { ...validCapability, classification: 'unknown' };
    const result = CapabilitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts capability without optional operationId', () => {
    const { operationId: _, ...noOpId } = validCapability;
    const result = CapabilitySchema.safeParse(noOpId);
    expect(result.success).toBe(true);
  });

  it('rejects capability with invalid operation method', () => {
    const invalid = {
      ...validCapability,
      operation: { ...validOperation, method: 'FETCH' },
    };
    const result = CapabilitySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates capability with parameters in operation', () => {
    const withParams = {
      ...validCapability,
      operation: {
        ...validOperation,
        parameters: [
          { name: 'limit', location: 'query', required: false, schema: { type: 'integer' } },
        ],
      },
    };
    const result = CapabilitySchema.safeParse(withParams);
    expect(result.success).toBe(true);
  });
});

describe('AuthRequirementSchema', () => {
  it('validates api-key auth type', () => {
    const auth = { type: 'api-key', name: 'X-API-Key', location: 'header' };
    const result = AuthRequirementSchema.safeParse(auth);
    expect(result.success).toBe(true);
  });

  it('validates bearer auth type', () => {
    const auth = { type: 'bearer', description: 'JWT token' };
    const result = AuthRequirementSchema.safeParse(auth);
    expect(result.success).toBe(true);
  });

  it('validates basic auth type', () => {
    const auth = { type: 'basic' };
    const result = AuthRequirementSchema.safeParse(auth);
    expect(result.success).toBe(true);
  });

  it('validates oauth2 auth type with scopes', () => {
    const auth = {
      type: 'oauth2',
      tokenUrl: 'https://auth.example.com/token',
      scopes: ['read:pets', 'write:pets'],
    };
    const result = AuthRequirementSchema.safeParse(auth);
    expect(result.success).toBe(true);
  });

  it('rejects invalid auth type', () => {
    const invalid = { type: 'custom-auth' };
    const result = AuthRequirementSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates api-key with query location', () => {
    const auth = { type: 'api-key', name: 'api_key', location: 'query' };
    const result = AuthRequirementSchema.safeParse(auth);
    expect(result.success).toBe(true);
  });
});

describe('ProviderConfigSchema', () => {
  it('validates a minimal provider config', () => {
    const result = ProviderConfigSchema.safeParse({ specUrl: 'https://example.com/spec.json' });
    expect(result.success).toBe(true);
  });

  it('validates a full provider config', () => {
    const result = ProviderConfigSchema.safeParse({
      specUrl: 'https://example.com/spec.json',
      docsUrl: 'https://example.com/docs',
      context7Library: 'example-lib',
      authEnvPrefix: 'EXAMPLE',
      policyOverlay: './policies/example.json',
      ttl: 3600,
    });
    expect(result.success).toBe(true);
  });

  it('rejects config without specUrl', () => {
    const result = ProviderConfigSchema.safeParse({ docsUrl: 'https://example.com/docs' });
    expect(result.success).toBe(false);
  });

  it('rejects negative ttl', () => {
    const result = ProviderConfigSchema.safeParse({ specUrl: 'https://x.com/s.json', ttl: -1 });
    expect(result.success).toBe(false);
  });
});

describe('ProviderRegistrySchema', () => {
  it('validates an empty registry', () => {
    const result = ProviderRegistrySchema.safeParse({ version: '1.0', providers: {} });
    expect(result.success).toBe(true);
  });

  it('validates a registry with providers', () => {
    const result = ProviderRegistrySchema.safeParse({
      version: '1.0',
      providers: {
        petstore: { specUrl: 'https://petstore.com/spec.json' },
        stripe: { specUrl: 'https://stripe.com/spec.json', ttl: 86400 },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects wrong version', () => {
    const result = ProviderRegistrySchema.safeParse({ version: '2.0', providers: {} });
    expect(result.success).toBe(false);
  });
});

describe('BundleMetaSchema', () => {
  it('validates legacy meta (no freshness fields)', () => {
    const result = BundleMetaSchema.safeParse({
      bundleName: 'test',
      generatedAt: '2025-01-01T00:00:00Z',
      bundleHash: 'abc123',
      specUrl: 'https://example.com/spec.json',
      capabilityCount: 5,
    });
    expect(result.success).toBe(true);
  });

  it('validates extended meta with freshness fields', () => {
    const result = BundleMetaSchema.safeParse({
      bundleName: 'test',
      generatedAt: '2025-01-01T00:00:00Z',
      bundleHash: 'abc123',
      specUrl: 'https://example.com/spec.json',
      capabilityCount: 5,
      provider: 'test-provider',
      specHash: 'sha256hash',
      specVersion: '1.0.0',
      specETag: '"etag123"',
      specLastModified: 'Mon, 01 Jan 2025 00:00:00 GMT',
      policyHash: 'policyhash',
      generatorVersion: '0.2.0',
      expiresAt: '2025-01-02T00:00:00Z',
      docsExpiresAt: '2025-01-02T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('ResolvedProviderSchema', () => {
  it('validates a URL-resolved provider', () => {
    const result = ResolvedProviderSchema.safeParse({
      name: 'test',
      specUrl: 'https://example.com/spec.json',
      resolvedVia: 'url',
    });
    expect(result.success).toBe(true);
  });

  it('validates a registry-resolved provider with all fields', () => {
    const result = ResolvedProviderSchema.safeParse({
      name: 'stripe',
      specUrl: 'https://stripe.com/spec.json',
      docsUrl: 'https://stripe.com/docs',
      authEnvPrefix: 'STRIPE',
      policyOverlay: './stripe-policy.json',
      ttl: 86400,
      resolvedVia: 'registry',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid resolvedVia value', () => {
    const result = ResolvedProviderSchema.safeParse({
      name: 'test',
      specUrl: 'https://example.com/spec.json',
      resolvedVia: 'magic',
    });
    expect(result.success).toBe(false);
  });
});
