import { Command } from 'commander';
import chalk from 'chalk';
import { readBundle, listBundles } from '@specrail/cache';

export const inspectCommand = new Command('inspect')
  .description('Inspect a cached capability bundle')
  .argument('[bundle-name]', 'Name of the bundle to inspect')
  .option('--json', 'Output raw JSON')
  .option('--capabilities', 'List capabilities summary only')
  .option('--policy', 'Show policy decisions only')
  .action(async (bundleName: string | undefined, options) => {
    try {
      // If no bundle name given, list all available bundles
      if (!bundleName) {
        const bundles = await listBundles();
        if (bundles.length === 0) {
          console.log(chalk.yellow('No cached bundles found. Run `specrail ingest` first.'));
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

      const bundle = await readBundle(bundleName);
      if (!bundle) {
        console.error(chalk.red(`Bundle "${bundleName}" not found in cache.`));
        process.exit(1);
      }

      // Raw JSON output
      if (options.json) {
        console.log(JSON.stringify(bundle, null, 2));
        return;
      }

      // Capabilities summary
      if (options.capabilities) {
        console.log(chalk.bold(`Capabilities in "${bundleName}":`));
        for (const cap of bundle.capabilities) {
          const status = cap.policy.allowed ? chalk.green('ALLOWED') : chalk.red('DENIED');
          console.log(`  ${cap.id} [${cap.classification}] ${status}`);
        }
        return;
      }

      // Policy view
      if (options.policy) {
        console.log(chalk.bold(`Policy decisions for "${bundleName}":`));
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

      // Default: full summary
      console.log(chalk.bold(`Bundle: ${bundleName}`));
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
