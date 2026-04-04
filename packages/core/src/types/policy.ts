import { z } from 'zod';

// Operation classification determines what kind of side effects an operation has.
// This is the primary axis for policy decisions.
//
// Classification rules:
//   read   - Retrieves data, no side effects (GET, HEAD, OPTIONS)
//   write  - Creates or updates data (POST for creation, PUT, PATCH)
//   delete - Removes data (DELETE)
//   admin  - Administrative operations (user management, config changes)
//   action - Side-effecting operations that don't fit CRUD (send email, trigger build)
export const OperationClassSchema = z.enum(['read', 'write', 'delete', 'admin', 'action']);
export type OperationClass = z.infer<typeof OperationClassSchema>;

// Sensitivity level controls how carefully the capability should be handled.
// Higher sensitivity = more restrictions on caching, logging, and export.
export const SensitivityLevelSchema = z.enum(['public', 'internal', 'confidential', 'restricted']);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

// Redaction rules define fields that should be masked in logs, exports, or responses.
// This is a foundation for future fine-grained data handling.
export const RedactionRuleSchema = z.object({
  // JSONPath-like expression targeting the field to redact
  path: z.string(),
  reason: z.string().optional(),
});
export type RedactionRule = z.infer<typeof RedactionRuleSchema>;

// Policy state for a single capability after overlay evaluation.
// This is the final "can this operation be used, and under what conditions" answer.
export const CapabilityPolicySchema = z.object({
  // Whether this capability is allowed to execute
  allowed: z.boolean(),
  // If denied, why (from the matching policy rule)
  denyReason: z.string().optional(),
  // Data sensitivity classification
  sensitivity: SensitivityLevelSchema.default('internal'),
  // Whether human approval is required before execution
  requiresApproval: z.boolean().default(false),
  // Whether this capability should appear in MCP/SKILLS exports
  exportVisible: z.boolean().default(true),
  // Fields to redact in logs/responses
  redaction: z.array(RedactionRuleSchema).default([]),
});
export type CapabilityPolicy = z.infer<typeof CapabilityPolicySchema>;

// A single rule in a policy overlay file
export const PolicyRuleSchema = z.object({
  // Match conditions. All specified conditions must match (AND logic).
  match: z.object({
    classification: z.array(OperationClassSchema).optional(),
    operationId: z.string().optional(),
    pathPattern: z.string().optional(),
    method: z.string().optional(),
  }),
  // What to do when matched
  effect: z.enum(['allow', 'deny']),
  // Reason for the policy decision (shown to users on deny)
  reason: z.string().optional(),
  // Override sensitivity for matched operations
  sensitivity: SensitivityLevelSchema.optional(),
  // Override approval requirement
  requiresApproval: z.boolean().optional(),
  // Override export visibility
  exportVisible: z.boolean().optional(),
});
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

// A complete policy overlay document.
// Loaded from JSON files and applied to capability bundles.
export const PolicyOverlaySchema = z.object({
  $schema: z.string().optional(),
  version: z.literal('1.0'),
  name: z.string(),
  description: z.string().optional(),
  // Rules evaluated top-to-bottom, first match wins for allow/deny.
  rules: z.array(PolicyRuleSchema),
  // Default values applied to all capabilities before rule evaluation
  defaults: z
    .object({
      sensitivity: SensitivityLevelSchema.default('internal'),
      requiresApproval: z.boolean().default(false),
      exportVisible: z.boolean().default(true),
    })
    .default({}),
});
export type PolicyOverlay = z.infer<typeof PolicyOverlaySchema>;
