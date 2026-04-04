import { describe, it, expect, vi, afterEach } from 'vitest';
import { execute, PolicyDeniedError } from '../src/executor.js';
import type { Capability } from '@specrail/core';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function makeFetchResponse(overrides: {
  status?: number;
  contentType?: string;
  json?: unknown;
  text?: string;
}) {
  const headers = new Map<string, string>();
  if (overrides.contentType) {
    headers.set('content-type', overrides.contentType);
  }
  return {
    status: overrides.status ?? 200,
    headers: {
      forEach: (cb: (value: string, key: string) => void) => headers.forEach(cb),
      get: (key: string) => headers.get(key) ?? null,
    },
    json: vi.fn().mockResolvedValue(overrides.json ?? {}),
    text: vi.fn().mockResolvedValue(overrides.text ?? ''),
  };
}

describe('execute (with mocked fetch)', () => {
  it('makes a real fetch call and returns status and JSON body', async () => {
    const mockResponse = makeFetchResponse({
      status: 200,
      contentType: 'application/json',
      json: [{ id: 1, name: 'Fido' }],
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const cap = makeCapability();
    const result = await execute(cap);

    expect(result.dryRun).toBe(false);
    expect(result.status).toBe(200);
    expect(result.body).toEqual([{ id: 1, name: 'Fido' }]);
  });

  it('returns text body when content-type is not JSON', async () => {
    const mockResponse = makeFetchResponse({
      status: 200,
      contentType: 'text/plain',
      text: 'plain text response',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const cap = makeCapability();
    const result = await execute(cap);

    expect(result.body).toBe('plain text response');
  });

  it('returns headers from response', async () => {
    const headers = new Map([['x-request-id', 'abc123']]);
    const mockResponse = {
      status: 200,
      headers: {
        forEach: (cb: (value: string, key: string) => void) => headers.forEach(cb),
        get: (key: string) => headers.get(key) ?? null,
      },
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const cap = makeCapability();
    const result = await execute(cap);

    expect(result.headers['x-request-id']).toBe('abc123');
  });

  it('sends body params for POST operations', async () => {
    const mockResponse = makeFetchResponse({
      status: 201,
      contentType: 'application/json',
      json: { id: 1, name: 'Fido' },
    });
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const cap = makeCapability({
      id: 'petstore:createPet',
      operation: {
        method: 'post',
        path: '/pets',
        servers: ['https://petstore.example.com/v1'],
        parameters: [],
        requestBody: {
          required: true,
          content: {
            'application/json': { type: 'object', properties: { name: { type: 'string' } } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
      policy: {
        allowed: true,
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });

    await execute(cap, { params: { name: 'Fido' } });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Fido' }));
  });

  it('applies auth header when resolved from env', async () => {
    process.env['SPECRAIL_AUTH_APIKEY'] = 'test-api-key';
    const mockResponse = makeFetchResponse({
      status: 200,
      contentType: 'application/json',
      json: {},
    });
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const cap = makeCapability({
      auth: [{ type: 'api-key', name: 'X-API-Key', location: 'header' }],
    });

    await execute(cap);

    delete process.env['SPECRAIL_AUTH_APIKEY'];
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('test-api-key');
  });

  it('handles server URL that already has a trailing slash', async () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets',
        servers: ['https://petstore.example.com/v1/'], // trailing slash
        parameters: [],
        responses: { '200': { description: 'OK' } },
      },
    });
    const result = await execute(cap, { dryRun: true });
    // Should resolve to the correct URL without a double slash in the path segment
    expect(result.request.url).toBe('https://petstore.example.com/v1/pets');
  });

  it('falls back to empty string when servers array is empty and throws invalid URL', async () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets',
        servers: [], // empty servers → servers[0] ?? '' → ''
        parameters: [],
        responses: { '200': { description: 'OK' } },
      },
    });
    // Empty server string + path produces an invalid URL
    await expect(execute(cap, { dryRun: true })).rejects.toThrow(TypeError);
  });

  it('keeps unreplaced template when path param is not provided', async () => {
    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets/{petId}',
        servers: ['https://petstore.example.com/v1'],
        parameters: [{ name: 'petId', location: 'path', required: true }],
        responses: { '200': { description: 'OK' } },
      },
    });
    // No petId in params → {petId} is not replaced
    const result = await execute(cap, { dryRun: true, params: {} });
    expect(result.request.url).toContain('%7BpetId%7D');
  });

  it('does not set body when requestBody exists but no body params provided', async () => {
    const cap = makeCapability({
      id: 'petstore:createPet',
      operation: {
        method: 'post',
        path: '/pets',
        servers: ['https://petstore.example.com/v1'],
        parameters: [],
        requestBody: {
          required: false,
          content: { 'application/json': { type: 'object' } },
        },
        responses: { '201': { description: 'Created' } },
      },
      policy: {
        allowed: true,
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
        redaction: [],
      },
    });
    // No params provided at all → options.params is undefined → body stays undefined
    const result = await execute(cap, { dryRun: true });
    expect(result.request.body).toBeUndefined();
  });

  it('applies api-key auth in query param location to URL', async () => {
    process.env['SPECRAIL_AUTH_APIKEY'] = 'query-api-key';
    const mockResponse = makeFetchResponse({
      status: 200,
      contentType: 'application/json',
      json: {},
    });
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const cap = makeCapability({
      auth: [{ type: 'api-key', name: 'api_key', location: 'query' }],
    });

    const result = await execute(cap, { dryRun: true });
    delete process.env['SPECRAIL_AUTH_APIKEY'];
    expect(result.request.url).toContain('api_key=query-api-key');
  });

  it('sends header parameter from params', async () => {
    const mockResponse = makeFetchResponse({
      status: 200,
      contentType: 'application/json',
      json: {},
    });
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const cap = makeCapability({
      operation: {
        method: 'get',
        path: '/pets',
        servers: ['https://petstore.example.com/v1'],
        parameters: [{ name: 'X-Trace-Id', location: 'header', required: false }],
        responses: { '200': { description: 'OK' } },
      },
    });

    await execute(cap, { params: { 'X-Trace-Id': 'trace-abc' } });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Trace-Id']).toBe('trace-abc');
  });
});
