import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOpenApiSpec } from '../src/openapi.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PETSTORE_FIXTURE = resolve(__dirname, '../../../fixtures/specs/petstore.yaml');
const MULTI_AUTH_FIXTURE = resolve(__dirname, '../../../fixtures/specs/multi-auth.yaml');

describe('parseOpenApiSpec', () => {
  describe('source metadata', () => {
    it('extracts title from spec', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.source.title).toBe('Petstore API');
    });

    it('extracts version from spec', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.source.version).toBe('1.0.0');
    });

    it('detects openapi-3.0 format', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.source.specFormat).toBe('openapi-3.0');
    });

    it('preserves the original specUrl', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.source.specUrl).toBe(PETSTORE_FIXTURE);
    });
  });

  describe('operation count and structure', () => {
    it('extracts all 4 operations from petstore spec', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.operations).toHaveLength(4);
    });

    it('extracts GET /pets operation', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op).toBeDefined();
      expect(op!.method).toBe('get');
      expect(op!.path).toBe('/pets');
      expect(op!.summary).toBe('List all pets');
    });

    it('extracts POST /pets operation', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'createPet');
      expect(op).toBeDefined();
      expect(op!.method).toBe('post');
      expect(op!.path).toBe('/pets');
    });

    it('extracts GET /pets/{petId} operation', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getPetById');
      expect(op).toBeDefined();
      expect(op!.method).toBe('get');
      expect(op!.path).toBe('/pets/{petId}');
    });

    it('extracts DELETE /pets/{petId} operation', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'deletePet');
      expect(op).toBeDefined();
      expect(op!.method).toBe('delete');
      expect(op!.path).toBe('/pets/{petId}');
    });
  });

  describe('parameters', () => {
    it('extracts query parameter from GET /pets', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      const param = op!.operation.parameters.find((p) => p.name === 'limit');
      expect(param).toBeDefined();
      expect(param!.location).toBe('query');
      expect(param!.required).toBe(false);
    });

    it('extracts path parameter from GET /pets/{petId}', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getPetById');
      const param = op!.operation.parameters.find((p) => p.name === 'petId');
      expect(param).toBeDefined();
      expect(param!.location).toBe('path');
      expect(param!.required).toBe(true);
    });

    it('extracts path parameter from DELETE /pets/{petId}', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'deletePet');
      const param = op!.operation.parameters.find((p) => p.name === 'petId');
      expect(param).toBeDefined();
      expect(param!.location).toBe('path');
      expect(param!.required).toBe(true);
    });

    it('parameter schema is preserved', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      const param = op!.operation.parameters.find((p) => p.name === 'limit');
      expect(param!.schema).toBeDefined();
      expect((param!.schema as Record<string, unknown>).type).toBe('integer');
    });
  });

  describe('request body', () => {
    it('extracts request body for POST /pets', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'createPet');
      expect(op!.operation.requestBody).toBeDefined();
      expect(op!.operation.requestBody!.required).toBe(true);
    });

    it('POST /pets request body has application/json content', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'createPet');
      expect(op!.operation.requestBody!.content['application/json']).toBeDefined();
    });

    it('GET /pets has no request body', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op!.operation.requestBody).toBeUndefined();
    });
  });

  describe('auth requirements', () => {
    it('extracts api-key auth for listPets', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('api-key');
    });

    it('api-key auth has correct name and location', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op!.auth[0].name).toBe('X-API-Key');
      expect(op!.auth[0].location).toBe('header');
    });

    it('all operations share the same api-key auth scheme', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      for (const op of result.operations) {
        expect(op.auth).toHaveLength(1);
        expect(op.auth[0].type).toBe('api-key');
      }
    });
  });

  describe('servers', () => {
    it('extracts server URL from spec', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      expect(result.operations[0].operation.servers).toContain('https://petstore.example.com/v1');
    });
  });

  describe('responses', () => {
    it('extracts 200 response for listPets', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op!.operation.responses['200']).toBeDefined();
      expect(op!.operation.responses['200'].description).toBe('A list of pets');
    });

    it('extracts 204 response for deletePet', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'deletePet');
      expect(op!.operation.responses['204']).toBeDefined();
    });
  });

  describe('description and summary', () => {
    it('extracts description from operation', async () => {
      const result = await parseOpenApiSpec(PETSTORE_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'listPets');
      expect(op!.description).toBe('Returns a list of pets with optional limit.');
    });
  });
});

describe('parseOpenApiSpec - multi-auth fixture', () => {
  it('extracts 8 operations from multi-auth spec', async () => {
    const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
    expect(result.operations).toHaveLength(8);
  });

  describe('bearer auth', () => {
    it('extracts bearer auth requirement', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getBearerResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('bearer');
    });
  });

  describe('basic auth', () => {
    it('extracts basic auth requirement', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getBasicResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('basic');
    });
  });

  describe('oauth2 auth', () => {
    it('extracts oauth2 auth with client_credentials flow', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getOAuthResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('oauth2');
    });

    it('extracts token URL from client_credentials flow', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getOAuthResource');
      expect(op!.auth[0].tokenUrl).toBe('https://auth.example.com/token');
    });

    it('extracts scopes from oauth2 requirement', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getOAuthResource');
      expect(op!.auth[0].scopes).toEqual(['read:data']);
    });

    it('extracts oauth2 auth with authorization_code flow', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getOAuthAuthCodeResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('oauth2');
      expect(op!.auth[0].tokenUrl).toBe('https://auth.example.com/token');
    });
  });

  describe('oauth2 implicit flow', () => {
    it('extracts oauth2 auth with implicit flow (no tokenUrl)', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getOAuthImplicitResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('oauth2');
      // Implicit flow has no tokenUrl
      expect(op!.auth[0].tokenUrl).toBeUndefined();
    });
  });

  describe('api-key in query', () => {
    it('extracts api-key auth with query location', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getQueryKeyResource');
      expect(op!.auth).toHaveLength(1);
      expect(op!.auth[0].type).toBe('api-key');
      expect(op!.auth[0].location).toBe('query');
      expect(op!.auth[0].name).toBe('api_key');
    });
  });

  describe('no security specified on operation', () => {
    it('returns empty auth when neither operation nor api has security', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getNoSecurityResource');
      // No op.security and no global api.security → resolveAuth(undefined, schemes)
      expect(op!.auth).toHaveLength(0);
    });

    it('handles response content with no schema (falls back to empty object)', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getNoSecurityResource');
      // Response has application/json content but no schema → schema ?? {} fires
      expect(op!.operation.responses['200']).toBeDefined();
      expect(op!.operation.responses['200'].content?.['application/json']).toBeDefined();
    });
  });

  describe('no auth', () => {
    it('returns empty auth for public endpoint with security: []', async () => {
      const result = await parseOpenApiSpec(MULTI_AUTH_FIXTURE);
      const op = result.operations.find((o) => o.operationId === 'getPublicResource');
      expect(op!.auth).toHaveLength(0);
    });
  });
});

describe('parseOpenApiSpec - OpenAPI 3.1.2 patch normalization', () => {
  const FIXTURE_312 = resolve(__dirname, '../../../fixtures/specs/openapi-312.yaml');

  it('parses an OpenAPI 3.1.2 spec without error', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    expect(result.source.title).toBe('Weather API (OpenAPI 3.1.2)');
    expect(result.source.version).toBe('2.0.0');
  });

  it('detects openapi-3.1 format from a 3.1.2 spec', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    expect(result.source.specFormat).toBe('openapi-3.1');
  });

  it('extracts operations from a 3.1.2 spec', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    expect(result.operations).toHaveLength(2);
  });

  it('extracts getForecasts operation', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    const op = result.operations.find((o) => o.operationId === 'getForecasts');
    expect(op).toBeDefined();
    expect(op!.method).toBe('get');
    expect(op!.path).toBe('/forecasts');
  });

  it('extracts getAlerts operation', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    const op = result.operations.find((o) => o.operationId === 'getAlerts');
    expect(op).toBeDefined();
    expect(op!.method).toBe('get');
    expect(op!.path).toBe('/alerts');
  });

  it('extracts parameters from 3.1.2 spec', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    const op = result.operations.find((o) => o.operationId === 'getForecasts');
    expect(op!.operation.parameters).toHaveLength(2);
    expect(op!.operation.parameters[0].name).toBe('lat');
    expect(op!.operation.parameters[1].name).toBe('lon');
  });

  it('extracts servers from 3.1.2 spec', async () => {
    const result = await parseOpenApiSpec(FIXTURE_312);
    expect(result.operations[0].operation.servers).toContain('https://api.weather.example.com/v2');
  });
});
