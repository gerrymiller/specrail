import { describe, it, expect } from 'vitest';
import {
  generateCapabilityId,
  slugify,
  humanizeName,
  classifyOperation,
  computeHash,
} from '../src/utils.js';

describe('generateCapabilityId', () => {
  it('uses operationId when present', () => {
    const id = generateCapabilityId('Petstore API', 'listPets', 'get', '/pets');
    expect(id).toBe('petstore-api:listPets');
  });

  it('falls back to method_path when operationId is undefined', () => {
    const id = generateCapabilityId('Petstore API', undefined, 'get', '/pets');
    expect(id).toBe('petstore-api:get_pets');
  });

  it('handles nested paths in fallback format', () => {
    const id = generateCapabilityId('My API', undefined, 'get', '/pets/{petId}/toys');
    expect(id).toBe('my-api:get_pets_petId_toys');
  });

  it('strips curly braces from path parameters in fallback', () => {
    const id = generateCapabilityId('API', undefined, 'delete', '/pets/{petId}');
    expect(id).toBe('api:delete_pets_petId');
  });

  it('slugifies the bundle name', () => {
    const id = generateCapabilityId('My Cool API!', 'doSomething', 'post', '/do');
    expect(id).toBe('my-cool-api:doSomething');
  });
});

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('HelloWorld')).toBe('helloworld');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('My API Name')).toBe('my-api-name');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugify('foo@bar#baz')).toBe('foo-bar-baz');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---hello---')).toBe('hello');
  });

  it('collapses multiple non-alphanumeric chars into single hyphen', () => {
    expect(slugify('hello   world!!!')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles string with only special chars', () => {
    expect(slugify('!@#$%')).toBe('');
  });
});

describe('humanizeName', () => {
  it('splits camelCase operationId into title case', () => {
    expect(humanizeName('listPets', 'get', '/pets')).toBe('List Pets');
  });

  it('handles single-word operationId', () => {
    expect(humanizeName('list', 'get', '/pets')).toBe('List');
  });

  it('handles multi-word camelCase', () => {
    expect(humanizeName('getPetById', 'get', '/pets/{petId}')).toBe('Get Pet By Id');
  });

  it('falls back to method + path when operationId is undefined', () => {
    expect(humanizeName(undefined, 'get', '/pets')).toBe('Get Pets');
  });

  it('handles path parameters in fallback', () => {
    expect(humanizeName(undefined, 'delete', '/pets/{petId}')).toBe('Delete Pets Petid');
  });

  it('capitalizes first letter of each path segment', () => {
    expect(humanizeName(undefined, 'post', '/users/{userId}/orders')).toBe(
      'Post Users Userid Orders',
    );
  });
});

describe('classifyOperation', () => {
  it('classifies GET as read', () => {
    expect(classifyOperation('get', '/pets')).toBe('read');
  });

  it('classifies HEAD as read', () => {
    expect(classifyOperation('head', '/pets')).toBe('read');
  });

  it('classifies OPTIONS as read', () => {
    expect(classifyOperation('options', '/pets')).toBe('read');
  });

  it('classifies POST as write by default', () => {
    expect(classifyOperation('post', '/pets')).toBe('write');
  });

  it('classifies POST to action-like path /send as action', () => {
    expect(classifyOperation('post', '/notifications/send')).toBe('action');
  });

  it('classifies POST to /trigger path as action', () => {
    expect(classifyOperation('post', '/workflows/trigger')).toBe('action');
  });

  it('classifies POST to /notify path as action', () => {
    expect(classifyOperation('post', '/alerts/notify')).toBe('action');
  });

  it('classifies POST to /execute path as action', () => {
    expect(classifyOperation('post', '/jobs/execute')).toBe('action');
  });

  it('classifies POST to /run path as action', () => {
    expect(classifyOperation('post', '/tests/run')).toBe('action');
  });

  it('classifies POST to /invoke path as action', () => {
    expect(classifyOperation('post', '/functions/invoke')).toBe('action');
  });

  it('classifies PUT as write', () => {
    expect(classifyOperation('put', '/pets/{petId}')).toBe('write');
  });

  it('classifies PATCH as write', () => {
    expect(classifyOperation('patch', '/pets/{petId}')).toBe('write');
  });

  it('classifies DELETE as delete', () => {
    expect(classifyOperation('delete', '/pets/{petId}')).toBe('delete');
  });

  it('is case-sensitive on action pattern matching for POST', () => {
    // /Send contains action pattern /send (case-insensitive check in impl)
    expect(classifyOperation('post', '/Email/Send')).toBe('action');
  });
});

describe('computeHash', () => {
  it('returns a hex string', () => {
    const hash = computeHash('hello world');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns consistent hash for same content', () => {
    const hash1 = computeHash('test content');
    const hash2 = computeHash('test content');
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different content', () => {
    const hash1 = computeHash('content A');
    const hash2 = computeHash('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = computeHash('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles unicode content', () => {
    const hash = computeHash('こんにちは世界');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
