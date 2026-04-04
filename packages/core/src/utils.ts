import { createHash } from 'node:crypto';
import type { HttpMethod, OperationClass } from './types/index.js';

// Generate a stable capability ID from a bundle name and operation identifier.
// Format: "bundleName:operationId" or "bundleName:method_path" as fallback.
export function generateCapabilityId(
  bundleName: string,
  operationId: string | undefined,
  method: string,
  path: string,
): string {
  const slug = slugify(bundleName);
  if (operationId) {
    return `${slug}:${operationId}`;
  }
  // Fallback: method + path with slashes replaced
  const pathSlug = path.replace(/\//g, '_').replace(/[{}]/g, '').replace(/^_/, '');
  return `${slug}:${method}_${pathSlug}`;
}

// Convert a string to a URL-safe slug
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Generate a human-readable name from an operationId or method+path.
// "listPets" -> "List Pets", "get /pets/{id}" -> "Get Pets By Id"
export function humanizeName(operationId: string | undefined, method: string, path: string): string {
  if (operationId) {
    return operationId
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  }
  const pathParts = path
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/[{}]/g, ''));
  return [method, ...pathParts]
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Classify an HTTP method + path into an operation class.
// This is the default heuristic classifier. Policy overlays can override.
//
// Classification heuristic:
//   GET, HEAD, OPTIONS -> read
//   POST -> write (may be action if path suggests it, e.g. /send, /trigger)
//   PUT, PATCH -> write
//   DELETE -> delete
export function classifyOperation(method: HttpMethod, path: string): OperationClass {
  switch (method) {
    case 'get':
    case 'head':
    case 'options':
      return 'read';
    case 'delete':
      return 'delete';
    case 'post': {
      // Heuristic: POST to action-like paths are classified as "action"
      const actionPatterns = ['/send', '/trigger', '/notify', '/execute', '/run', '/invoke'];
      const lowerPath = path.toLowerCase();
      if (actionPatterns.some((pattern) => lowerPath.includes(pattern))) {
        return 'action';
      }
      return 'write';
    }
    case 'put':
    case 'patch':
      return 'write';
    default:
      return 'action';
  }
}

// Compute a SHA-256 hash of the given content for bundle integrity.
export function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
