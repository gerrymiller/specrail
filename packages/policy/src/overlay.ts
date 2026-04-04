import { readFile } from 'node:fs/promises';
import { PolicyOverlaySchema, type PolicyOverlay } from '@specrail/core';

// Load and validate a policy overlay from a JSON file.
// Returns a strongly-typed PolicyOverlay or throws on validation failure.
//
// Policy overlays are the primary mechanism for controlling what capabilities
// are allowed, denied, or require special handling. They are intentionally
// JSON-based (not code) to support auditing, versioning, and review.
export async function loadOverlay(filePath: string): Promise<PolicyOverlay> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return PolicyOverlaySchema.parse(parsed);
}

// The built-in default policy: reads only. All side-effecting operations denied.
// This is the safety net -- if no overlay is provided, only reads can execute.
export const DEFAULT_POLICY: PolicyOverlay = {
  version: '1.0',
  name: 'specrail-default',
  description: 'Built-in default: reads only. All side-effecting operations denied.',
  rules: [
    {
      match: { classification: ['read'] },
      effect: 'allow',
    },
    {
      match: { classification: ['write', 'delete', 'admin', 'action'] },
      effect: 'deny',
      reason: 'Side-effecting operations denied by default policy',
    },
  ],
  defaults: {
    sensitivity: 'internal',
    requiresApproval: false,
    exportVisible: true,
  },
};
