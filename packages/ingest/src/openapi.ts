import SwaggerParser from '@apidevtools/swagger-parser';
import type { OpenAPI, OpenAPIV3 } from 'openapi-types';
import {
  type CapabilityOperation,
  type CapabilitySource,
  type ParameterDef,
  type RequestBodyDef,
  type ResponseDef,
  type AuthRequirement,
} from '@specrail/core';

// Result of parsing an OpenAPI spec into raw operations.
// These are pre-policy, pre-classification -- just the facts from the spec.
export interface ParsedOperation {
  operationId?: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  operation: CapabilityOperation;
  auth: AuthRequirement[];
}

export interface ParseResult {
  source: CapabilitySource;
  operations: ParsedOperation[];
}

// Parse an OpenAPI spec from a URL or file path.
// Uses swagger-parser for validation and $ref resolution.
//
// TRUST BOUNDARY: The spec is an external input. We validate its structure
// but do not trust its content for execution without policy evaluation.
export async function parseOpenApiSpec(specPathOrUrl: string): Promise<ParseResult> {
  const api = (await SwaggerParser.validate(specPathOrUrl)) as OpenAPIV3.Document;

  const specFormat = detectSpecFormat(api);
  const servers = extractServers(api);
  const securitySchemes = extractSecuritySchemes(api);

  const source: CapabilitySource = {
    specUrl: specPathOrUrl,
    specFormat,
    title: api.info?.title ?? 'Unknown API',
    version: api.info?.version ?? '0.0.0',
  };

  const operations: ParsedOperation[] = [];

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!pathItem) continue;

    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;
    for (const method of methods) {
      const op = (pathItem as Record<string, unknown>)[method] as
        | OpenAPIV3.OperationObject
        | undefined;
      if (!op) continue;

      const parameters = extractParameters([
        ...((pathItem as OpenAPIV3.PathItemObject).parameters ?? []),
        ...(op.parameters ?? []),
      ]);
      const requestBody = extractRequestBody(
        op.requestBody as OpenAPIV3.RequestBodyObject | undefined,
      );
      const responses = extractResponses(op.responses as OpenAPIV3.ResponsesObject | undefined);
      const auth = resolveAuth(op.security ?? api.security, securitySchemes);

      operations.push({
        operationId: op.operationId,
        method,
        path,
        summary: op.summary,
        description: op.description ?? op.summary ?? '',
        operation: {
          method: method as CapabilityOperation['method'],
          path,
          servers,
          parameters,
          requestBody,
          responses,
        },
        auth,
      });
    }
  }

  return { source, operations };
}

function detectSpecFormat(api: OpenAPI.Document): 'openapi-3.0' | 'openapi-3.1' {
  const version = (api as OpenAPIV3.Document).openapi ?? '';
  if (version.startsWith('3.1')) return 'openapi-3.1';
  return 'openapi-3.0';
}

function extractServers(api: OpenAPIV3.Document): string[] {
  return (api.servers ?? []).map((s: OpenAPIV3.ServerObject) => s.url).filter(Boolean);
}

function extractSecuritySchemes(
  api: OpenAPIV3.Document,
): Record<string, OpenAPIV3.SecuritySchemeObject> {
  const schemes = api.components?.securitySchemes ?? {};
  const result: Record<string, OpenAPIV3.SecuritySchemeObject> = {};
  for (const [name, scheme] of Object.entries(schemes)) {
    // Only include resolved schemes (not $ref)
    if (scheme && typeof scheme === 'object' && 'type' in scheme) {
      result[name] = scheme as OpenAPIV3.SecuritySchemeObject;
    }
  }
  return result;
}

function extractParameters(
  params: (OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject)[],
): ParameterDef[] {
  return params
    .filter((p): p is OpenAPIV3.ParameterObject => 'name' in p)
    .map((p) => ({
      name: p.name,
      location: p.in as ParameterDef['location'],
      description: p.description,
      required: p.required ?? false,
      schema: p.schema ? (p.schema as Record<string, unknown>) : undefined,
      example: p.example,
    }));
}

function extractRequestBody(
  body: OpenAPIV3.RequestBodyObject | undefined,
): RequestBodyDef | undefined {
  if (!body?.content) return undefined;
  const content: Record<string, Record<string, unknown>> = {};
  for (const [mediaType, mediaObj] of Object.entries(body.content)) {
    const mo = mediaObj as OpenAPIV3.MediaTypeObject;
    content[mediaType] = (mo.schema as Record<string, unknown>) ?? {};
  }
  return {
    description: body.description,
    required: body.required ?? false,
    content,
  };
}

function extractResponses(
  responses: OpenAPIV3.ResponsesObject | undefined,
): Record<string, ResponseDef> {
  if (!responses) return {};
  const result: Record<string, ResponseDef> = {};
  for (const [status, resp] of Object.entries(responses)) {
    if (!resp || (typeof resp === 'object' && '$ref' in resp)) continue;
    const response = resp as OpenAPIV3.ResponseObject;
    const content: Record<string, Record<string, unknown>> | undefined = response.content
      ? Object.fromEntries(
          Object.entries(response.content).map(([mt, mediaObj]) => {
            const mo = mediaObj as OpenAPIV3.MediaTypeObject;
            return [mt, (mo.schema as Record<string, unknown>) ?? {}];
          }),
        )
      : undefined;
    result[status] = { description: response.description, content };
  }
  return result;
}

function resolveAuth(
  security: OpenAPIV3.SecurityRequirementObject[] | undefined,
  schemes: Record<string, OpenAPIV3.SecuritySchemeObject>,
): AuthRequirement[] {
  if (!security) return [];

  const result: AuthRequirement[] = [];
  for (const req of security) {
    for (const [schemeName, scopes] of Object.entries(req)) {
      const scheme = schemes[schemeName];
      if (!scheme) continue;

      switch (scheme.type) {
        case 'apiKey':
          result.push({
            type: 'api-key',
            name: scheme.name,
            location: scheme.in === 'query' ? 'query' : 'header',
            description: scheme.description,
          });
          break;
        case 'http':
          if (scheme.scheme === 'bearer') {
            result.push({ type: 'bearer', description: scheme.description });
          } else if (scheme.scheme === 'basic') {
            result.push({ type: 'basic', description: scheme.description });
          }
          break;
        case 'oauth2':
          result.push({
            type: 'oauth2',
            scopes: scopes as string[],
            tokenUrl: extractOAuth2TokenUrl(scheme),
            description: scheme.description,
          });
          break;
      }
    }
  }
  return result;
}

function extractOAuth2TokenUrl(scheme: OpenAPIV3.SecuritySchemeObject): string | undefined {
  if (scheme.type !== 'oauth2' || !scheme.flows) return undefined;
  // Check flows in preference order
  return (
    (scheme.flows as OpenAPIV3.OAuth2SecurityScheme['flows']).clientCredentials?.tokenUrl ??
    (scheme.flows as OpenAPIV3.OAuth2SecurityScheme['flows']).authorizationCode?.tokenUrl ??
    undefined
  );
}
