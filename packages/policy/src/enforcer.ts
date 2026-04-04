import type {
  OperationClass,
  PolicyOverlay,
  PolicyRule,
  CapabilityPolicy,
  HttpMethod,
} from '@specrail/core';

// Enforcement context: the attributes of a capability being evaluated against policy.
export interface EnforcementContext {
  classification: OperationClass;
  operationId?: string;
  path: string;
  method: HttpMethod;
}

// Evaluate a single policy rule against an enforcement context.
// All specified match conditions must be satisfied (AND logic).
// Returns true if the rule matches.
function matchesRule(rule: PolicyRule, ctx: EnforcementContext): boolean {
  const { match } = rule;

  // Classification match: capability's class must be in the rule's list
  if (match.classification && !match.classification.includes(ctx.classification)) {
    return false;
  }

  // OperationId match: exact string match
  if (match.operationId && match.operationId !== ctx.operationId) {
    return false;
  }

  // Path pattern match: simple glob-like matching
  // Supports * as wildcard for path segments
  if (match.pathPattern) {
    const pattern = match.pathPattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    if (!regex.test(ctx.path)) {
      return false;
    }
  }

  // Method match: case-insensitive
  if (match.method && match.method.toLowerCase() !== ctx.method.toLowerCase()) {
    return false;
  }

  return true;
}

// Evaluate a capability against a policy overlay and produce a CapabilityPolicy.
//
// This is the core policy enforcement logic. Rules are evaluated top-to-bottom,
// and the first matching rule determines the allow/deny decision.
// If no rule matches, the capability is DENIED by default (fail-closed).
//
// TRUST BOUNDARY: This function is the gatekeeper between "what an API can do"
// and "what an agent is allowed to do." Every capability must pass through here.
export function enforce(overlay: PolicyOverlay, ctx: EnforcementContext): CapabilityPolicy {
  const defaults = overlay.defaults ?? {};

  // Start with defaults
  const result: CapabilityPolicy = {
    allowed: false, // Fail-closed: denied until a rule explicitly allows
    sensitivity: defaults.sensitivity ?? 'internal',
    requiresApproval: defaults.requiresApproval ?? false,
    exportVisible: defaults.exportVisible ?? true,
    redaction: [],
  };

  // Evaluate rules top-to-bottom, first match wins for allow/deny
  for (const rule of overlay.rules) {
    if (matchesRule(rule, ctx)) {
      result.allowed = rule.effect === 'allow';
      if (rule.effect === 'deny' && rule.reason) {
        result.denyReason = rule.reason;
      }

      // Rule-level overrides
      if (rule.sensitivity !== undefined) {
        result.sensitivity = rule.sensitivity;
      }
      if (rule.requiresApproval !== undefined) {
        result.requiresApproval = rule.requiresApproval;
      }
      if (rule.exportVisible !== undefined) {
        result.exportVisible = rule.exportVisible;
      }

      break; // First match wins
    }
  }

  return result;
}
