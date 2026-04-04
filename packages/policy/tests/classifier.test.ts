import { describe, it, expect } from 'vitest';
import { classify, isValidClassification } from '../src/classifier.js';

describe('classify', () => {
  it('classifies GET as read', () => {
    expect(classify('get', '/pets')).toBe('read');
  });

  it('classifies HEAD as read', () => {
    expect(classify('head', '/pets')).toBe('read');
  });

  it('classifies OPTIONS as read', () => {
    expect(classify('options', '/pets')).toBe('read');
  });

  it('classifies DELETE as delete', () => {
    expect(classify('delete', '/pets/123')).toBe('delete');
  });

  it('classifies POST as write by default', () => {
    expect(classify('post', '/pets')).toBe('write');
  });

  it('classifies POST to /send as action', () => {
    expect(classify('post', '/notifications/send')).toBe('action');
  });

  it('classifies POST to /trigger as action', () => {
    expect(classify('post', '/trigger')).toBe('action');
  });

  it('classifies POST to /notify as action', () => {
    expect(classify('post', '/emails/notify')).toBe('action');
  });

  it('classifies POST to /execute as action', () => {
    expect(classify('post', '/jobs/execute')).toBe('action');
  });

  it('classifies POST to /run as action', () => {
    expect(classify('post', '/pipeline/run')).toBe('action');
  });

  it('classifies POST to /invoke as action', () => {
    expect(classify('post', '/functions/invoke')).toBe('action');
  });

  it('classifies PUT as write', () => {
    expect(classify('put', '/pets/123')).toBe('write');
  });

  it('classifies PATCH as write', () => {
    expect(classify('patch', '/pets/123')).toBe('write');
  });
});

describe('isValidClassification', () => {
  it('returns true for read', () => {
    expect(isValidClassification('read')).toBe(true);
  });

  it('returns true for write', () => {
    expect(isValidClassification('write')).toBe(true);
  });

  it('returns true for delete', () => {
    expect(isValidClassification('delete')).toBe(true);
  });

  it('returns true for admin', () => {
    expect(isValidClassification('admin')).toBe(true);
  });

  it('returns true for action', () => {
    expect(isValidClassification('action')).toBe(true);
  });

  it('returns false for unknown string', () => {
    expect(isValidClassification('unknown')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidClassification('')).toBe(false);
  });

  it('returns false for uppercase READ', () => {
    expect(isValidClassification('READ')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isValidClassification('rea')).toBe(false);
  });
});
