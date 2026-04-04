import { z } from 'zod';

// HTTP methods supported in capability operations
export const HttpMethodSchema = z.enum([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

// Where a parameter lives in the HTTP request
export const ParameterLocationSchema = z.enum(['query', 'header', 'path', 'cookie']);
export type ParameterLocation = z.infer<typeof ParameterLocationSchema>;

// A single operation parameter, normalized from OpenAPI
export const ParameterDefSchema = z.object({
  name: z.string(),
  location: ParameterLocationSchema,
  description: z.string().optional(),
  required: z.boolean().default(false),
  schema: z.record(z.unknown()).optional(),
  example: z.unknown().optional(),
});
export type ParameterDef = z.infer<typeof ParameterDefSchema>;

// Request body definition
export const RequestBodyDefSchema = z.object({
  description: z.string().optional(),
  required: z.boolean().default(false),
  // JSON Schema describing the request body content.
  // Keyed by media type (e.g., "application/json").
  content: z.record(z.string(), z.record(z.unknown())),
});
export type RequestBodyDef = z.infer<typeof RequestBodyDefSchema>;

// Response definition for a specific status code
export const ResponseDefSchema = z.object({
  description: z.string().optional(),
  // JSON Schema describing the response body content.
  // Keyed by media type.
  content: z.record(z.string(), z.record(z.unknown())).optional(),
});
export type ResponseDef = z.infer<typeof ResponseDefSchema>;

// The normalized operation extracted from an API spec.
// This is the raw "what can this endpoint do" before policy is applied.
export const CapabilityOperationSchema = z.object({
  method: HttpMethodSchema,
  path: z.string(),
  // Base server URLs from the spec. The executor uses the first available.
  servers: z.array(z.string()),
  parameters: z.array(ParameterDefSchema),
  requestBody: RequestBodyDefSchema.optional(),
  responses: z.record(z.string(), ResponseDefSchema),
});
export type CapabilityOperation = z.infer<typeof CapabilityOperationSchema>;
