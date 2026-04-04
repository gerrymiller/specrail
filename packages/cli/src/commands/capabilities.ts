import { Command } from 'commander';
import chalk from 'chalk';
import { capabilities as brokerCapabilities } from '@specrail/broker';

export const capabilitiesCommand = new Command('capabilities')
  .description('List capabilities for a provider (ensures bundle is current)')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .option('--allowed-only', 'Show only policy-allowed capabilities')
  .option('--json', 'Output raw JSON')
  .action(async (provider: string, options) => {
    try {
      const caps = await brokerCapabilities(provider);

      const filtered = options.allowedOnly ? caps.filter((c) => c.policy.allowed) : caps;

      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      console.log(chalk.bold(`Capabilities for "${provider}" (${filtered.length}):`));
      for (const cap of filtered) {
        const status = cap.policy.allowed ? chalk.green('ALLOW') : chalk.red('DENY');
        const reason = cap.policy.denyReason ? chalk.dim(` (${cap.policy.denyReason})`) : '';
        console.log(`  ${status} ${cap.id} [${cap.classification}]${reason}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
