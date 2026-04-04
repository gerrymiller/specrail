import { Command } from 'commander';
import chalk from 'chalk';
import { resolveProvider, ProviderNotFoundError } from '@specrail/resolver';

export const resolveCommand = new Command('resolve')
  .description('Resolve a provider name to its spec URL and metadata')
  .argument('<provider>', 'Provider name, spec URL, or file path')
  .option('--json', 'Output raw JSON')
  .action(async (provider: string, options) => {
    try {
      const resolved = await resolveProvider(provider);

      if (options.json) {
        console.log(JSON.stringify(resolved, null, 2));
        return;
      }

      console.log(chalk.bold(`Provider: ${resolved.name}`));
      console.log(`  Spec URL:     ${resolved.specUrl}`);
      console.log(`  Resolved via: ${resolved.resolvedVia}`);
      if (resolved.docsUrl) console.log(`  Docs URL:     ${resolved.docsUrl}`);
      if (resolved.authEnvPrefix) console.log(`  Auth prefix:  ${resolved.authEnvPrefix}`);
      if (resolved.policyOverlay) console.log(`  Policy:       ${resolved.policyOverlay}`);
      if (resolved.ttl) console.log(`  TTL:          ${resolved.ttl}s`);
    } catch (error) {
      if (error instanceof ProviderNotFoundError) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
