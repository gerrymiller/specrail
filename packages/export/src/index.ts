// @specrail/export -- MCP tool definition export and SKILLS.md generation
//
// This package transforms governed capability bundles into agent-consumable
// artifacts. MCP is the primary machine-readable export; SKILLS is the
// primary human/agent-readable export. Both respect policy decisions:
// denied capabilities are marked but can optionally be excluded.

export { exportMcp, type McpToolDefinition, type McpExportOptions } from './mcp.js';
export { exportSkills, type SkillsExportOptions } from './skills.js';
