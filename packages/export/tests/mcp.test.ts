import { describe, it, expect } from 'vitest';
import { exportMcp } from '../src/mcp.js';
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
    auth: [],
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
    bundleHash: 'abc123',
    policy: {
      overlayName: 'default',
      totalCapabilities: capabilities.length,
      allowedCount: capabilities.filter((c) => c.policy.allowed).length,
      deniedCount: capabilities.filter((c) => !c.policy.allowed).length,
    },
    capabilities,
  };
}

describe('exportMcp', () => {
  it('returns correct tool definition shape', () => {
    const bundle = makeBundle([makeCapability()]);
    const tools = exportMcp(bundle);
    expect(tools).toHaveLength(1);
    const tool = tools[0];
    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('inputSchema');
    expect(tool.inputSchema).toHaveProperty('type', 'object');
    expect(tool.inputSchema).toHaveProperty('properties');
  });

  it('formats tool name as source_operationId', () => {
    const bundle = makeBundle([makeCapability()]);
    const tools = exportMcp(bundle);
    // "Petstore API" -> "petstore_api", operationId = "listPets"
    expect(tools[0].name).toBe('petstore_api_listPets');
  });

  it('uses fallback name when operationId is absent', () => {
    const cap = makeCapability({
      operationId: undefined,
      operation: {
        method: 'get',
        path: '/pets',
        servers: ['https://petstore.example.com/v1'],
        parameters: [],
        responses: { '200': { description: 'OK' } },
      },
    });
    const bundle = makeBundle([cap]);
    const tools = exportMcp(bundle);
    expect(tools[0].name).toBe('petstore_api_get_pets');
  });

  it('marks denied capabilities in description', () => {
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      name: 'Create Pet',
      description: 'Creates a new pet',
      classification: 'write',
      policy: {
        allowed: false,
        denyReason: 'Write operations denied',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([deniedCap]);
    const tools = exportMcp(bundle);
    expect(tools[0].description).toContain('[DENIED]');
    expect(tools[0].description).toContain('Write operations denied');
  });

  it('filters denied capabilities with allowedOnly option', () => {
    const allowedCap = makeCapability();
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
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
    const tools = exportMcp(bundle, { allowedOnly: true });
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toContain('listPets');
  });

  it('includes all capabilities when allowedOnly is false', () => {
    const allowedCap = makeCapability();
    const deniedCap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
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
    const tools = exportMcp(bundle, { allowedOnly: false });
    expect(tools).toHaveLength(2);
  });

  it('builds inputSchema with correct properties from parameters', () => {
    const bundle = makeBundle([makeCapability()]);
    const tools = exportMcp(bundle);
    const schema = tools[0].inputSchema;
    expect(schema.properties).toHaveProperty('limit');
    const limitProp = schema.properties.limit as Record<string, unknown>;
    expect(limitProp.type).toBe('integer');
    expect(limitProp.description).toBe('Maximum number of pets');
  });

  it('marks required parameters in inputSchema', () => {
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
    const tools = exportMcp(bundle);
    expect(tools[0].inputSchema.required).toContain('petId');
  });

  it('excludes capabilities with exportVisible=false', () => {
    const hiddenCap = makeCapability({
      policy: {
        allowed: true,
        sensitivity: 'restricted',
        requiresApproval: false,
        exportVisible: false,
        redaction: [],
      },
    });
    const bundle = makeBundle([hiddenCap]);
    const tools = exportMcp(bundle);
    expect(tools).toHaveLength(0);
  });

  it('includes annotations with readOnlyHint for read operations', () => {
    const bundle = makeBundle([makeCapability()]);
    const tools = exportMcp(bundle);
    expect(tools[0].annotations?.readOnlyHint).toBe(true);
    expect(tools[0].annotations?.destructiveHint).toBe(false);
  });

  it('includes annotations with destructiveHint for delete operations', () => {
    const deleteCap = makeCapability({
      classification: 'delete',
      operation: {
        method: 'delete',
        path: '/pets/{petId}',
        servers: ['https://petstore.example.com/v1'],
        parameters: [],
        responses: { '204': { description: 'Deleted' } },
      },
    });
    const bundle = makeBundle([deleteCap]);
    const tools = exportMcp(bundle);
    expect(tools[0].annotations?.destructiveHint).toBe(true);
    expect(tools[0].annotations?.readOnlyHint).toBe(false);
  });

  it('marks requiresApproval capabilities in description', () => {
    const cap = makeCapability({
      policy: {
        allowed: true,
        sensitivity: 'internal',
        requiresApproval: true,
        exportVisible: true,
        redaction: [],
      },
    });
    const bundle = makeBundle([cap]);
    const tools = exportMcp(bundle);
    expect(tools[0].description).toContain('[REQUIRES APPROVAL]');
  });

  it('extracts properties from requestBody into inputSchema', () => {
    const cap = makeCapability({
      id: 'petstore:createPet',
      operationId: 'createPet',
      description: 'Creates a new pet',
      classification: 'write',
      operation: {
        method: 'post',
        path: '/pets',
        servers: ['https://petstore.example.com/v1'],
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Pet name' },
                tag: { type: 'string', description: 'Optional tag' },
              },
              required: ['name'],
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    });
    const bundle = makeBundle([cap]);
    const tools = exportMcp(bundle);
    expect(tools[0].inputSchema.properties).toHaveProperty('name');
    expect(tools[0].inputSchema.properties).toHaveProperty('tag');
    expect(tools[0].inputSchema.required).toContain('name');
  });

  it('uses capability name as fallback description when description is empty', () => {
    const cap = makeCapability({ description: '' });
    const bundle = makeBundle([cap]);
    const tools = exportMcp(bundle);
    expect(tools[0].description).toBe('List Pets');
  });
});
