import type { Capability, CapabilityBundle } from '@specrail/core';

// MCP tool definition following the Model Context Protocol specification.
// These are the artifacts that MCP-compatible agents consume.
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpJsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    openWorldHint?: boolean;
  };
}

interface McpJsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

export interface McpExportOptions {
  allowedOnly?: boolean;
}

// Export a capability bundle as MCP-compatible tool definitions.
//
// MCP is a first-class export target. Tool definitions include:
//   - A sanitized name suitable for MCP tool registration
//   - An augmented description with policy context
//   - A JSON Schema for input parameters
//   - Annotations for agent hints (readOnly, destructive)
//
// Design decision: We export only exportVisible capabilities by default.
// The --allowed-only flag further restricts to only allowed operations.
// Denied capabilities can still appear in exports (marked as denied) to
// give agents awareness of what exists but is restricted.
export function exportMcp(
  bundle: CapabilityBundle,
  options: McpExportOptions = {},
): McpToolDefinition[] {
  const capabilities = bundle.capabilities.filter((cap) => {
    if (!cap.policy.exportVisible) return false;
    if (options.allowedOnly && !cap.policy.allowed) return false;
    return true;
  });

  return capabilities.map((cap) => capabilityToMcpTool(cap, bundle.source.title));
}

function capabilityToMcpTool(cap: Capability, sourceTitle: string): McpToolDefinition {
  const slug = sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const opName = cap.operationId ?? `${cap.operation.method}_${cap.operation.path.replace(/\//g, '_').replace(/[{}]/g, '').replace(/^_/, '')}`;
  const name = `${slug}_${opName}`;

  // Build description with policy context
  let description = cap.description || cap.name;
  if (!cap.policy.allowed) {
    description = `[DENIED] ${description} (Reason: ${cap.policy.denyReason ?? 'Not allowed by policy'})`;
  }
  if (cap.policy.requiresApproval) {
    description = `[REQUIRES APPROVAL] ${description}`;
  }

  // Build JSON Schema from parameters
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of cap.operation.parameters) {
    properties[param.name] = {
      ...(param.schema ?? { type: 'string' }),
      description: param.description,
    };
    if (param.required) {
      required.push(param.name);
    }
  }

  // Include request body properties if present
  if (cap.operation.requestBody?.content['application/json']) {
    const bodySchema = cap.operation.requestBody.content['application/json'];
    if (bodySchema && typeof bodySchema === 'object' && 'properties' in bodySchema) {
      const bodyProps = (bodySchema as Record<string, unknown>).properties as Record<string, unknown> | undefined;
      if (bodyProps) {
        Object.assign(properties, bodyProps);
      }
      const bodyRequired = (bodySchema as Record<string, unknown>).required as string[] | undefined;
      if (bodyRequired) {
        required.push(...bodyRequired);
      }
    }
  }

  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    annotations: {
      readOnlyHint: cap.classification === 'read',
      destructiveHint: cap.classification === 'delete',
      openWorldHint: true,
    },
  };
}
