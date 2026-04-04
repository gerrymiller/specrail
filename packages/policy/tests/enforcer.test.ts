import { describe, it, expect } from 'vitest';
import { enforce, type EnforcementContext } from '../src/enforcer.js';
import type { PolicyOverlay } from '@specrail/core';

// The default policy from overlay.ts logic: reads/actions allowed, writes/deletes/admin denied
const defaultOverlay: PolicyOverlay = {
  version: '1.0',
  name: 'default',
  description: 'Default policy: reads allowed, writes denied',
  rules: [
    {
      match: { classification: ['write', 'delete', 'admin'] },
      effect: 'deny',
      reason: 'Write operations denied by default policy',
    },
    {
      match: { classification: ['read', 'action'] },
      effect: 'allow',
    },
  ],
  defaults: {
    sensitivity: 'internal',
    requiresApproval: false,
    exportVisible: true,
  },
};

describe('enforce', () => {
  it('allows read operations with default policy', () => {
    const ctx: EnforcementContext = {
      classification: 'read',
      operationId: 'listPets',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(defaultOverlay, ctx);
    expect(result.allowed).toBe(true);
    expect(result.denyReason).toBeUndefined();
  });

  it('denies write operations with default policy', () => {
    const ctx: EnforcementContext = {
      classification: 'write',
      operationId: 'createPet',
      path: '/pets',
      method: 'post',
    };
    const result = enforce(defaultOverlay, ctx);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe('Write operations denied by default policy');
  });

  it('denies delete operations with default policy', () => {
    const ctx: EnforcementContext = {
      classification: 'delete',
      operationId: 'deletePet',
      path: '/pets/{petId}',
      method: 'delete',
    };
    const result = enforce(defaultOverlay, ctx);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe('Write operations denied by default policy');
  });

  it('allows action operations with default policy', () => {
    const ctx: EnforcementContext = {
      classification: 'action',
      operationId: 'sendNotification',
      path: '/notifications/send',
      method: 'post',
    };
    const result = enforce(defaultOverlay, ctx);
    expect(result.allowed).toBe(true);
  });

  it('uses first-match-wins semantics', () => {
    // First rule denies all reads, second allows all reads
    // First rule should win
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'conflict-test',
      rules: [
        {
          match: { classification: ['read'] },
          effect: 'deny',
          reason: 'Reads denied by first rule',
        },
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
    const ctx: EnforcementContext = {
      classification: 'read',
      operationId: 'listPets',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(false);
    expect(result.denyReason).toBe('Reads denied by first rule');
  });

  it('denies when no rule matches (fail-closed)', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'empty-rules',
      rules: [],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'read',
      operationId: 'listPets',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(false);
  });

  it('matches rule by operationId', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'opid-match',
      rules: [
        {
          match: { operationId: 'createPet' },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'write',
      operationId: 'createPet',
      path: '/pets',
      method: 'post',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(true);
  });

  it('does not match operationId if different', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'opid-nomatch',
      rules: [
        {
          match: { operationId: 'deletePet' },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'write',
      operationId: 'createPet',
      path: '/pets',
      method: 'post',
    };
    const result = enforce(overlay, ctx);
    // No rule matched, fail-closed
    expect(result.allowed).toBe(false);
  });

  it('matches rule by pathPattern with wildcard', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'path-match',
      rules: [
        {
          match: { pathPattern: '/pets/*' },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'read',
      operationId: 'getPetById',
      path: '/pets/123',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(true);
  });

  it('does not match pathPattern when path is different', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'path-nomatch',
      rules: [
        {
          match: { pathPattern: '/users/*' },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'read',
      operationId: 'listPets',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(false);
  });

  it('overrides sensitivity from rule', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'sensitivity-override',
      rules: [
        {
          match: { classification: ['read'] },
          effect: 'allow',
          sensitivity: 'confidential',
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'read',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(true);
    expect(result.sensitivity).toBe('confidential');
  });

  it('overrides requiresApproval from rule', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'approval-override',
      rules: [
        {
          match: { classification: ['write'] },
          effect: 'allow',
          requiresApproval: true,
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'write',
      path: '/pets',
      method: 'post',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('overrides exportVisible from rule', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'export-override',
      rules: [
        {
          match: { classification: ['admin'] },
          effect: 'deny',
          reason: 'Admin denied',
          exportVisible: false,
        },
      ],
      defaults: {
        sensitivity: 'internal',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'admin',
      path: '/admin/users',
      method: 'post',
    };
    const result = enforce(overlay, ctx);
    expect(result.allowed).toBe(false);
    expect(result.exportVisible).toBe(false);
  });

  it('applies default sensitivity when no rule overrides it', () => {
    const overlay: PolicyOverlay = {
      version: '1.0',
      name: 'defaults-test',
      rules: [
        {
          match: { classification: ['read'] },
          effect: 'allow',
        },
      ],
      defaults: {
        sensitivity: 'public',
        requiresApproval: false,
        exportVisible: true,
      },
    };
    const ctx: EnforcementContext = {
      classification: 'read',
      path: '/pets',
      method: 'get',
    };
    const result = enforce(overlay, ctx);
    expect(result.sensitivity).toBe('public');
  });
});
