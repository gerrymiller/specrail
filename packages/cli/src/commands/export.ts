import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import chalk from 'chalk';
import { readBundle } from '@specrail/cache';
import { exportMcp } from '@specrail/export';
import { exportSkills } from '@specrail/export';

const mcpCommand = new Command('mcp')
  .description('Export MCP-compatible tool definitions')
  .argument('[bundle-name]', 'Name of the bundle to export')
  .option('--output <path>', 'Output file path (default: stdout)')
  .option('--allowed-only', 'Only export policy-allowed capabilities')
  .action(async (bundleName: string | undefined, options) => {
    if (!bundleName) {
      console.error(
        chalk.red('Bundle name required. Use `specrail inspect` to list available bundles.'),
      );
      process.exit(1);
    }

    const bundle = await readBundle(bundleName);
    if (!bundle) {
      console.error(chalk.red(`Bundle "${bundleName}" not found.`));
      process.exit(1);
    }

    const tools = exportMcp(bundle, { allowedOnly: options.allowedOnly });
    const output = JSON.stringify(tools, null, 2);

    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(chalk.green(`MCP tools exported to ${options.output} (${tools.length} tools)`));
    } else {
      console.log(output);
    }
  });

const skillsCommand = new Command('skills')
  .description('Export SKILLS.md capability manifest')
  .argument('[bundle-name]', 'Name of the bundle to export')
  .option('--output <path>', 'Output file path (default: stdout)')
  .action(async (bundleName: string | undefined, options) => {
    if (!bundleName) {
      console.error(
        chalk.red('Bundle name required. Use `specrail inspect` to list available bundles.'),
      );
      process.exit(1);
    }

    const bundle = await readBundle(bundleName);
    if (!bundle) {
      console.error(chalk.red(`Bundle "${bundleName}" not found.`));
      process.exit(1);
    }

    const output = exportSkills(bundle);

    if (options.output) {
      await writeFile(options.output, output, 'utf-8');
      console.log(chalk.green(`SKILLS exported to ${options.output}`));
    } else {
      console.log(output);
    }
  });

export const exportCommand = new Command('export')
  .description('Export capability bundles to agent-consumable formats')
  .addCommand(mcpCommand)
  .addCommand(skillsCommand);
