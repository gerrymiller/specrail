import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import { ensure } from '@specrail/broker';
import { exportMcp, exportSkills } from '@specrail/export';

const mcpCommand = new Command('mcp')
  .description('Export MCP-compatible tool definitions')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .option('--output <path>', 'Output file path (default: stdout)')
  .option('--allowed-only', 'Only export policy-allowed capabilities')
  .action(async (provider: string, options) => {
    try {
      const bundle = await ensure(provider);
      const tools = exportMcp(bundle, { allowedOnly: options.allowedOnly });
      const output = JSON.stringify(tools, null, 2);

      if (options.output) {
        await writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`MCP tools exported to ${options.output} (${tools.length} tools)`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const skillsCommand = new Command('skills')
  .description('Export SKILLS.md capability manifest')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .option('--output <path>', 'Output file path (default: stdout)')
  .action(async (provider: string, options) => {
    try {
      const bundle = await ensure(provider);
      const output = exportSkills(bundle);

      if (options.output) {
        await writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`SKILLS exported to ${options.output}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

export const exportCommand = new Command('export')
  .description('Export capability bundles to agent-consumable formats')
  .addCommand(mcpCommand)
  .addCommand(skillsCommand);
