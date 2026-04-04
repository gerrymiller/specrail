import { Command } from 'commander';
import chalk from 'chalk';
import { execute as brokerExecute } from '@specrail/broker';
import { PolicyDeniedError } from '@specrail/runtime';

export const execCommand = new Command('exec')
  .description('Execute a capability against the target API (ensures bundle is current)')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .argument('<capability>', 'Capability name (e.g., listPets)')
  .option('--params <json>', 'Parameters as JSON string')
  .option('--auth-env <prefix>', 'Env var prefix for auth credentials')
  .option('--dry-run', 'Show the request without executing')
  .action(async (provider: string, capabilityId: string, options) => {
    try {
      const params = options.params ? JSON.parse(options.params) : {};

      const result = await brokerExecute(provider, capabilityId, {
        params,
        authEnvPrefix: options.authEnv,
        dryRun: options.dryRun,
      });

      if (result.dryRun) {
        console.log(chalk.yellow('DRY RUN -- request that would be sent:'));
        console.log(JSON.stringify(result.request, null, 2));
        return;
      }

      console.log(chalk.green(`Status: ${result.status}`));
      console.log(JSON.stringify(result.body, null, 2));
    } catch (error) {
      if (error instanceof PolicyDeniedError) {
        console.error(chalk.red(`Policy denied: ${error.message}`));
        process.exit(1);
      }
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
