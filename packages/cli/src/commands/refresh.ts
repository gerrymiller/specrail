import { Command } from 'commander';
import chalk from 'chalk';
import { refresh as brokerRefresh } from '@specrail/broker';

export const refreshCommand = new Command('refresh')
  .description('Force-rebuild a provider bundle (re-ingest spec, re-apply policy)')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .action(async (provider: string) => {
    try {
      console.log(chalk.blue(`Refreshing "${provider}"...`));
      const bundle = await brokerRefresh(provider);

      const allowed = bundle.capabilities.filter((c) => c.policy.allowed).length;
      const denied = bundle.capabilities.filter((c) => !c.policy.allowed).length;

      console.log(chalk.green.bold('Bundle refreshed:'));
      console.log(`  Source:       ${bundle.source.title} v${bundle.source.version}`);
      console.log(`  Capabilities: ${bundle.capabilities.length}`);
      console.log(`  Allowed:      ${chalk.green(String(allowed))}`);
      console.log(`  Denied:       ${chalk.red(String(denied))}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
