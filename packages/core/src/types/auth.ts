import { z } from 'zod';

// Auth types supported in the canonical model.
// OAuth2 is modeled but token exchange is deferred to post-MVP.
export const AuthTypeSchema = z.enum(['api-key', 'bearer', 'basic', 'oauth2']);
export type AuthType = z.infer<typeof AuthTypeSchema>;

// Where an API key is injected
export const ApiKeyLocationSchema = z.enum(['header', 'query']);
export type ApiKeyLocation = z.infer<typeof ApiKeyLocationSchema>;

// Auth requirement extracted from an API spec.
// Describes WHAT auth is needed, not the actual credentials.
// Credentials are resolved at execution time from env vars -- never stored in bundles.
export const AuthRequirementSchema = z.object({
  type: AuthTypeSchema,
  // For api-key: the header or query parameter name
  name: z.string().optional(),
  // For api-key: where the key goes
  location: ApiKeyLocationSchema.optional(),
  // For oauth2: the token endpoint
  tokenUrl: z.string().optional(),
  // For oauth2: required scopes
  scopes: z.array(z.string()).optional(),
  // Human-readable description of this auth requirement
  description: z.string().optional(),
});
export type AuthRequirement = z.infer<typeof AuthRequirementSchema>;
