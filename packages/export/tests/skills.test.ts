import { describe, it, expect } from 'vitest';
import { exportSkills } from '../src/skills.js';
import type { CapabilityBundle, Capability } from '@specrail/core';

function makeCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'petstore:listPets',
    name: 'List Pets',
    description: 'Returns a list of pets',
    operationId: 'listPets',
    operation: {
      method: 'get',
      path: '/pets',
      servers: ['https://petstore.example.com/v1'],
      parameters: [
        {
          name: 'limit',
          location: 'query',
          description: 'Maximum number of pets',
          required: false,
          schema: { type: 'integer' },
        },
      ],
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
    auth: [{ type: 'api-key', name: 'X-API-Key', location: 'header' }],
    ...overrides,
  };
}

function makeBundle(capabilities: Capability[]): CapabilityBundle {
  return {
    version: '1.0',
    source: {
      specUrl: 'https://petstore.example.com/openapi.yaml',
      specFormat: 'openapi-3.0',
      title: 'Petstore API',
      version: '1.0.0',
    },
    generatedAt: '2025-01-15T10:00:00Z',
    bundleHash: 'abc123def456789012345678901234567890123456789012345678901234',
    policy: {
      overlayName: 'default',
      totalCapabilities: capabilities.length,
      allowedCount: capabilities.filter((c) => c.policy.allowed).length,
      deniedCount: capabilities.filter((c) => !c.policy.allowed).length,
    },
    capabilities,
  };
}

describe('exportSkills', () => {
  it('returns valid markdown string', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(typeof markdown).toBe('string');
    expect(markdown.length).toBeGreaterThan(0);
  });

  it('includes title and version in header', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('# SKILLS: Petstore API v1.0.0');
  });

  it('includes policy summary line', () => {
    const allowedCap = makeCapability();
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      name: 'Create Pet',
      classification: 'write',
      policy: {
        allowed: false,
        denyReason: 'Denied',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([allowedCap, deniedCap]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('Policy: default');
    expect(markdown).toContain('Allowed: 1/2');
    expect(markdown).toContain('Denied: 1/2');
  });

  it('shows [DENIED BY POLICY] for denied capabilities', () => {
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      name: 'Create Pet',
      classification: 'write',
      policy: {
        allowed: false,
        denyReason: 'Write operations denied by default policy',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([deniedCap]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('[DENIED BY POLICY]');
  });

  it('does not show [DENIED BY POLICY] for allowed capabilities', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).not.toContain('[DENIED BY POLICY]');
  });

  it('lists parameters correctly', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('**Parameters:**');
    expect(markdown).toContain('limit');
    expect(markdown).toContain('integer');
    expect(markdown).toContain('optional');
  });

  it('lists required parameters', () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets/{petId}',
        servers: ['https://petstore.example.com/v1'],
        parameters: [
          {
            name: 'petId',
            location: 'path',
            description: 'Pet identifier',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    });
    const bundle = makeBundle([cap]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('petId');
    expect(markdown).toContain('required');
  });

  it('includes auth information', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('**Auth:**');
    expect(markdown).toContain('API Key');
  });

  it('includes HTTP method and path', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('GET /pets');
  });

  it('includes source URL in header', () => {
    const bundle = makeBundle([makeCapability()]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('https://petstore.example.com/openapi.yaml');
  });

  it('groups capabilities by classification', () => {
    const readCap = makeCapability();
    const writeCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      name: 'Create Pet',
      classification: 'write',
      policy: {
        allowed: false,
        denyReason: 'Denied',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([readCap, writeCap]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('## Read Operations');
    expect(markdown).toContain('## Write Operations');
  });

  it('shows deny reason for denied capabilities', () => {
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      name: 'Create Pet',
      classification: 'write',
      policy: {
        allowed: false,
        denyReason: 'Write operations denied by default policy',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([deniedCap]);
    const markdown = exportSkills(bundle);
    expect(markdown).toContain('Denied -- Write operations denied by default policy');
  });
});
