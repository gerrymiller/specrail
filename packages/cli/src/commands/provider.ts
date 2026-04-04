import { Command } from 'commander';
import chalk from 'chalk';
import { registerProvider, unregisterProvider, providers } from '@specrail/broker';
import { lookupProvider } from '@specrail/resolver';

const addCommand = new Command('add')
  .description('Register a provider in the local registry')
  .argument('<name>', 'Provider name (e.g., petstore, stripe, github)')
  .requiredOption('--spec-url <url>', 'OpenAPI spec URL or file path')
  .option('--docs-url <url>', 'External documentation URL')
  .option('--policy <path>', 'Path to a policy overlay JSON file')
  .option('--auth-env <prefix>', 'Env var prefix for auth credentials')
  .option('--context7-library <name>', 'Context7 library name')
  .option('--ttl <seconds>', 'Cache TTL in seconds', parseInt)
  .action(async (name: string, options) => {
    try {
      await registerProvider(name, {
        specUrl: options.specUrl,
        docsUrl: options.docsUrl,
        policyOverlay: options.policy,
        authEnvPrefix: options.authEnv,
        context7Library: options.context7Library,
        ttl: options.ttl,
      });
      console.log(chalk.green(`Provider "${name}" registered.`));
      console.log(chalk.dim(`  Spec: ${options.specUrl}`));
      console.log(chalk.dim(`  Next: specrail capabilities ${name}`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const listCommand = new Command('list')
  .description('List all registered providers')
  .option('--json', 'Output raw JSON')
  .action(async (options) => {
    try {
      const list = await providers();

      if (list.length === 0) {
        console.log(chalk.yellow('No providers registered.'));
        console.log(chalk.dim('  Register one: specrail provider add <name> --spec-url <url>'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(list, null, 2));
        return;
      }

      console.log(chalk.bold(`Registered providers (${list.length}):`));
      for (const entry of list) {
        console.log(`  ${chalk.cyan(entry.name)}`);
        console.log(`    Spec: ${entry.config.specUrl}`);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const removeCommand = new Command('remove')
  .description('Remove a provider from the local registry')
  .argument('<name>', 'Provider name to remove')
  .action(async (name: string) => {
    try {
      const removed = await unregisterProvider(name);
      if (removed) {
        console.log(chalk.green(`Provider "${name}" removed.`));
      } else {
        console.log(chalk.yellow(`Provider "${name}" not found in local registry.`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

const showCommand = new Command('show')
  .description('Show details for a registered provider')
  .argument('<name>', 'Provider name')
  .option('--json', 'Output raw JSON')
  .action(async (name: string, options) => {
    try {
      const config = await lookupProvider(name);
      if (!config) {
        console.error(chalk.red(`Provider "${name}" not found in registry.`));
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify({ name, ...config }, null, 2));
        return;
      }

      console.log(chalk.bold(`Provider: ${name}`));
      console.log(`  Spec URL:     ${config.specUrl}`);
      if (config.docsUrl) console.log(`  Docs URL:     ${config.docsUrl}`);
      if (config.authEnvPrefix) console.log(`  Auth prefix:  ${config.authEnvPrefix}`);
      if (config.policyOverlay) console.log(`  Policy:       ${config.policyOverlay}`);
      if (config.context7Library) console.log(`  Context7:     ${config.context7Library}`);
      if (config.ttl) console.log(`  TTL:          ${config.ttl}s`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

export const providerCommand = new Command('provider')
  .description('Manage the provider registry')
  .addCommand(addCommand)
  .addCommand(listCommand)
  .addCommand(removeCommand)
  .addCommand(showCommand);
