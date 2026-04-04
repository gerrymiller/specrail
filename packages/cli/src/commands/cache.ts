import { Command } from 'commander';
import chalk from 'chalk';
import { listBundles, cleanCache, getLocalCachePath, getGlobalCachePath } from '@specrail/cache';

const listCommand = new Command('list')
  .description('List cached capability bundles')
  .action(async () => {
    const bundles = await listBundles();
    if (bundles.length === 0) {
      console.log(chalk.yellow('No cached bundles found.'));
      return;
    }
    console.log(chalk.bold('Cached bundles:'));
    for (const meta of bundles) {
      console.log(`  ${chalk.cyan(meta.bundleName)}`);
      console.log(`    Source: ${meta.specUrl}`);
      console.log(`    Capabilities: ${meta.capabilityCount}`);
      console.log(`    Generated: ${meta.generatedAt}`);
      console.log(`    Hash: ${meta.bundleHash.slice(0, 16)}...`);
    }
  });

const cleanCommand = new Command('clean')
  .description('Clean all cached bundles from local cache')
  .action(async () => {
    const count = await cleanCache();
    if (count === 0) {
      console.log(chalk.yellow('No bundles to clean.'));
    } else {
      console.log(chalk.green(`Cleaned ${count} bundle(s) from local cache.`));
    }
  });

const pathCommand = new Command('path')
  .description('Show local and global cache paths')
  .action(() => {
    console.log(`Local:  ${getLocalCachePath()}`);
    console.log(`Global: ${getGlobalCachePath()}`);
  });

export const cacheCommand = new Command('cache')
  .description('Manage the capability bundle cache')
  .addCommand(listCommand)
  .addCommand(cleanCommand)
  .addCommand(pathCommand);
