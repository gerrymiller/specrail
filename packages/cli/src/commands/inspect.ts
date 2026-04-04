import { Command } from 'commander';
import chalk from 'chalk';
import { inspect as brokerInspect } from '@specrail/broker';
import { listBundles } from '@specrail/cache';

export const inspectCommand = new Command('inspect')
  .description('Inspect a provider bundle (ensures bundle is current)')
  .argument('[provider]', 'Provider name, spec URL, or file path')
  .option('--json', 'Output raw JSON')
  .option('--capabilities', 'List capabilities summary only')
  .option('--policy', 'Show policy decisions only')
  .action(async (provider: string | undefined, options) => {
    try {
      // If no provider given, list all available bundles
      if (!provider) {
        const bundles = await listBundles();
        if (bundles.length === 0) {
          console.log(
            chalk.yellow(
              'No cached bundles found. Register a provider: specrail provider add <name> --spec-url <url>',
            ),
          );
          return;
        }
        console.log(chalk.bold('Cached bundles:'));
        for (const meta of bundles) {
          console.log(
            `  ${chalk.cyan(meta.bundleName)} - ${meta.capabilityCount} capabilities (${meta.generatedAt})`,
          );
        }
        return;
      }

      const bundle = await brokerInspect(provider);

      if (options.json) {
        console.log(JSON.stringify(bundle, null, 2));
        return;
      }

      if (options.capabilities) {
        console.log(chalk.bold(`Capabilities for "${provider}":`));
        for (const cap of bundle.capabilities) {
          const status = cap.policy.allowed ? chalk.green('ALLOWED') : chalk.red('DENIED');
          console.log(`  ${cap.id} [${cap.classification}] ${status}`);
        }
        return;
      }

      if (options.policy) {
        console.log(chalk.bold(`Policy decisions for "${provider}":`));
        console.log(`  Overlay: ${bundle.policy.overlayName}`);
        console.log(`  Allowed: ${bundle.policy.allowedCount}/${bundle.policy.totalCapabilities}`);
        console.log(`  Denied:  ${bundle.policy.deniedCount}/${bundle.policy.totalCapabilities}`);
        console.log('');
        for (const cap of bundle.capabilities) {
          const status = cap.policy.allowed ? chalk.green('ALLOW') : chalk.red('DENY');
          const reason = cap.policy.denyReason ? ` (${cap.policy.denyReason})` : '';
          console.log(`  ${status} ${cap.id}${reason}`);
        }
        return;
      }

      console.log(chalk.bold(`Provider: ${provider}`));
      console.log(`  Source:       ${bundle.source.title} v${bundle.source.version}`);
      console.log(`  Spec:         ${bundle.source.specUrl}`);
      console.log(`  Format:       ${bundle.source.specFormat}`);
      console.log(`  Generated:    ${bundle.generatedAt}`);
      console.log(`  Hash:         ${bundle.bundleHash.slice(0, 16)}...`);
      console.log(`  Policy:       ${bundle.policy.overlayName}`);
      console.log(
        `  Capabilities: ${bundle.policy.totalCapabilities} (${chalk.green(String(bundle.policy.allowedCount))} allowed, ${chalk.red(String(bundle.policy.deniedCount))} denied)`,
      );
      console.log('');
      console.log(
        chalk.dim('  Use --json for full bundle, --capabilities for list, --policy for decisions'),
      );
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
