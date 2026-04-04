import { describe, it, expect } from 'vitest';
import { execute, PolicyDeniedError } from '../src/executor.js';
import type { Capability } from '@specrail/core';

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
          description: 'Max results',
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

describe('execute', () => {
  it('throws PolicyDeniedError for denied capability', async () => {
    const denied = makeCapability({
      id: 'petstore:createPet',
      policy: {
        allowed: false,
        denyReason: 'Write operations denied by default policy',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });

    await expect(execute(denied)).rejects.toThrow(PolicyDeniedError);
    await expect(execute(denied)).rejects.toThrow('Write operations denied by default policy');
  });

  it('PolicyDeniedError has correct properties', async () => {
    const denied = makeCapability({
      id: 'petstore:deletePet',
      policy: {
        allowed: false,
        denyReason: 'Delete not permitted',
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });

    try {
      await execute(denied);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PolicyDeniedError);
      const policyErr = err as PolicyDeniedError;
      expect(policyErr.capabilityId).toBe('petstore:deletePet');
      expect(policyErr.reason).toBe('Delete not permitted');
      expect(policyErr.name).toBe('PolicyDeniedError');
    }
  });

  it('uses default deny reason when denyReason is absent', async () => {
    const denied = makeCapability({
      policy: {
        allowed: false,
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });

    await expect(execute(denied)).rejects.toThrow('Operation not allowed by policy');
  });

  it('dry-run returns request without making HTTP call', async () => {
    const cap = makeCapability();
    const result = await execute(cap, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.status).toBe(0);
    expect(result.body).toBeNull();
    expect(result.request.method).toBe('GET');
    expect(result.request.url).toContain('https://petstore.example.com/v1/pets');
  });

  it('resolves path parameters correctly', async () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets/{petId}',
        servers: ['https://petstore.example.com/v1'],
        parameters: [
          {
            name: 'petId',
            location: 'path',
            description: 'Pet ID',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    });

    const result = await execute(cap, { dryRun: true, params: { petId: 'abc-123' } });
    expect(result.request.url).toContain('/pets/abc-123');
    expect(result.request.url).not.toContain('{petId}');
  });

  it('includes query parameters in the URL', async () => {
    const cap = makeCapability();
    const result = await execute(cap, { dryRun: true, params: { limit: 10 } });
    expect(result.request.url).toContain('limit=10');
  });

  it('sets Accept header to application/json', async () => {
    const cap = makeCapability();
    const result = await execute(cap, { dryRun: true });
    expect(result.request.headers.Accept).toBe('application/json');
  });

  it('encodes path parameter values', async () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets/{petId}',
        servers: ['https://petstore.example.com/v1'],
        parameters: [
          {
            name: 'petId',
            location: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    });
    const result = await execute(cap, { dryRun: true, params: { petId: 'hello world' } });
    expect(result.request.url).toContain('hello%20world');
  });
});

describe('PolicyDeniedError', () => {
  it('is an instance of Error', () => {
    const err = new PolicyDeniedError('cap:id', 'reason');
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct name property', () => {
    const err = new PolicyDeniedError('cap:id', 'some reason');
    expect(err.name).toBe('PolicyDeniedError');
  });

  it('message includes the reason', () => {
    const err = new PolicyDeniedError('cap:id', 'Write not allowed');
    expect(err.message).toContain('Write not allowed');
  });
});
