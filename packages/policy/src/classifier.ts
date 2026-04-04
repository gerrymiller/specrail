import { classifyOperation, type HttpMethod, type OperationClass } from '@specrail/core';

// Re-export the core classifier as the default classification strategy.
// The classifier maps HTTP method + path to an operation class.
//
// This is a trust boundary: classification determines what policy rules apply.
// Misclassification could allow a write operation to bypass deny rules.
// The heuristic is conservative -- POST defaults to "write" unless the path
// strongly suggests an action-like operation.
export function classify(method: HttpMethod, path: string): OperationClass {
  return classifyOperation(method, path);
}

// Validate that a classification value is a known operation class.
// Used when loading policy overlays that reference classifications.
export function isValidClassification(value: string): value is OperationClass {
  return ['read', 'write', 'delete', 'admin', 'action'].includes(value);
}
