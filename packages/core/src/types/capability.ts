import { z } from 'zod';
import { CapabilityOperationSchema } from './operation.js';
import { AuthRequirementSchema } from './auth.js';
import { CapabilityPolicySchema, OperationClassSchema } from './policy.js';

// Augmentation data from external documentation sources.
// This enriches capability descriptions beyond what the raw spec provides.
export const AugmentationSchema = z.object({
  // Free-form documentation fetched from an external URL
  docsContext: z.string().optional(),
  // Documentation retrieved via Context7 API
  context7Docs: z.string().optional(),
  // The Context7 library ID used for augmentation
  context7LibraryId: z.string().optional(),
});
export type Augmentation = z.infer<typeof AugmentationSchema>;

// Where this capability bundle was sourced from
export const CapabilitySourceSchema = z.object({
  specUrl: z.string(),
  specFormat: z.enum(['openapi-3.0', 'openapi-3.1']),
  title: z.string(),
  version: z.string(),
  docsUrl: z.string().optional(),
  context7LibraryId: z.string().optional(),
});
export type CapabilitySource = z.infer<typeof CapabilitySourceSchema>;

// A single governed capability -- the normalized, policy-evaluated representation
// of one API operation. This is the atomic unit of the Specrail model.
export const CapabilitySchema = z.object({
  // Unique identifier in the format "bundleName:operationId"
  id: z.string(),
  // Human-readable name derived from operationId or path
  name: z.string(),
  // Description, potentially augmented with external docs
  description: z.string(),
  // Original operationId from the spec, if present
  operationId: z.string().optional(),

  // The normalized HTTP operation
  operation: CapabilityOperationSchema,
  // How this operation is classified for policy purposes
  classification: OperationClassSchema,
  // Policy evaluation result
  policy: CapabilityPolicySchema,
  // Auth requirements from the spec
  auth: z.array(AuthRequirementSchema).default([]),
  // External documentation augmentation
  augmentation: AugmentationSchema.optional(),
});
export type Capability = z.infer<typeof CapabilitySchema>;

// Bundle-level policy metadata summarizing the overall policy posture
export const BundlePolicyMetaSchema = z.object({
  overlayName: z.string(),
  totalCapabilities: z.number(),
  allowedCount: z.number(),
  deniedCount: z.number(),
});
export type BundlePolicyMeta = z.infer<typeof BundlePolicyMetaSchema>;

// The top-level capability bundle -- a complete governed view of an API.
// This is what gets written to cache and consumed by exporters.
//
// CRITICAL: Bundles are NEVER committed to the repository.
// They are generated artifacts that live in cache (.specrail/ or ~/.cache/specrail/).
export const CapabilityBundleSchema = z.object({
  // Schema version for forward compatibility
  version: z.literal('1.0'),
  // Where this bundle came from
  source: CapabilitySourceSchema,
  // When this bundle was generated (ISO 8601)
  generatedAt: z.string(),
  // SHA-256 hash of the normalized bundle content for integrity checking
  bundleHash: z.string(),
  // Summary of policy decisions across all capabilities
  policy: BundlePolicyMetaSchema,
  // The governed capabilities
  capabilities: z.array(CapabilitySchema),
});
export type CapabilityBundle = z.infer<typeof CapabilityBundleSchema>;
