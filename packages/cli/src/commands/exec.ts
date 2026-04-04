import { Command } from 'commander';
import chalk from 'chalk';
import { readBundle } from '@specrail/cache';
import { execute, PolicyDeniedError } from '@specrail/runtime';

export const execCommand = new Command('exec')
  .description('Execute a capability directly against the target API')
  .argument('<capability-id>', 'Capability ID (e.g., petstore:listPets)')
  .option('--params <json>', 'Parameters as JSON string')
  .option('--auth-env <prefix>', 'Env var prefix for auth credentials', 'SPECRAIL_AUTH')
  .option('--dry-run', 'Show the request without executing')
  .action(async (capabilityId: string, options) => {
    try {
      // Parse capability ID into bundle name and operation
      const [bundleName, ...rest] = capabilityId.split(':');
      const opId = rest.join(':');

      if (!bundleName || !opId) {
        console.error(chalk.red('Invalid capability ID format. Expected: bundleName:operationId'));
        process.exit(1);
      }

      const bundle = await readBundle(bundleName);
      if (!bundle) {
        console.error(chalk.red(`Bundle "${bundleName}" not found.`));
        process.exit(1);
      }

      const capability = bundle.capabilities.find((c) => c.id === capabilityId);
      if (!capability) {
        console.error(chalk.red(`Capability "${capabilityId}" not found in bundle.`));
        console.log(chalk.dim('Available capabilities:'));
        for (const cap of bundle.capabilities) {
          console.log(chalk.dim(`  ${cap.id}`));
        }
        process.exit(1);
      }

      const params = options.params ? JSON.parse(options.params) : {};

      const result = await execute(capability, {
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
