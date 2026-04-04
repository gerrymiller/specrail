import { Command } from 'commander';
import chalk from 'chalk';
import { inspect as brokerInspect } from '@specrail/broker';
import { listBundles } from '@specrail/cache';
import type { Capability } from '@specrail/core';

function findCapability(
  capabilities: Capability[],
  query: string,
  provider: string,
): Capability | undefined {
  return (
    capabilities.find((c) => c.id === query) ??
    capabilities.find((c) => c.id === `${provider}:${query}`) ??
    capabilities.find((c) => c.operationId === query) ??
    capabilities.find((c) => c.name.toLowerCase() === query.toLowerCase())
  );
}

function printCapabilityDetail(cap: Capability): void {
  const status = cap.policy.allowed ? chalk.green('ALLOWED') : chalk.red('DENIED');
  const reason = cap.policy.denyReason ? ` (${cap.policy.denyReason})` : '';

  console.log(chalk.bold(cap.id));
  console.log(`  Name:           ${cap.name}`);
  console.log(`  Description:    ${cap.description || chalk.dim('(none)')}`);
  console.log(`  Classification: ${cap.classification}`);
  console.log(`  Policy:         ${status}${reason}`);
  console.log(`  Method:         ${cap.operation.method.toUpperCase()} ${cap.operation.path}`);

  if (cap.operation.servers.length > 0) {
    console.log(`  Server:         ${cap.operation.servers[0]}`);
  }

  if (cap.operation.parameters.length > 0) {
    console.log('');
    console.log(chalk.bold('  Parameters:'));
    for (const p of cap.operation.parameters) {
      const req = p.required ? chalk.red('required') : chalk.dim('optional');
      const type = p.schema?.type ? ` (${p.schema.type})` : '';
      console.log(`    ${p.name} [${p.location}] ${req}${type}`);
      if (p.description) console.log(`      ${chalk.dim(p.description)}`);
    }
  }

  if (cap.operation.requestBody) {
    console.log('');
    console.log(chalk.bold('  Request Body:'));
    const rb = cap.operation.requestBody;
    const req = rb.required ? chalk.red('required') : chalk.dim('optional');
    console.log(`    ${req}`);
    for (const [mediaType, schema] of Object.entries(rb.content)) {
      console.log(`    ${mediaType}:`);
      const props = (schema as Record<string, unknown>).properties as
        | Record<string, unknown>
        | undefined;
      if (props) {
        for (const [name, def] of Object.entries(props)) {
          const propType = (def as Record<string, unknown>)?.type ?? '';
          console.log(`      ${name}: ${propType}`);
        }
      }
    }
  }

  if (cap.auth.length > 0) {
    console.log('');
    console.log(chalk.bold('  Auth:'));
    for (const a of cap.auth) {
      const detail = a.name ? ` (${a.name} in ${a.location})` : '';
      console.log(`    ${a.type}${detail}`);
    }
  }

  const responseCodes = Object.keys(cap.operation.responses);
  if (responseCodes.length > 0) {
    console.log('');
    console.log(chalk.bold('  Responses:'));
    for (const code of responseCodes) {
      const resp = cap.operation.responses[code];
      console.log(`    ${code}: ${resp.description || ''}`);
    }
  }
}

export const inspectCommand = new Command('inspect')
  .description('Inspect a provider bundle or a single capability')
  .argument('[provider]', 'Provider name, spec URL, or file path')
  .option('--capability <name>', 'Inspect a single capability by name or operationId')
  .option('--json', 'Output raw JSON')
  .option('--capabilities', 'List capabilities summary only')
  .option('--policy', 'Show policy decisions only')
  .action(async (provider: string | undefined, options) => {
    try {
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

      // Single capability inspection
      if (options.capability) {
        const cap = findCapability(bundle.capabilities, options.capability, provider);
        if (!cap) {
          console.error(
            chalk.red(`Capability "${options.capability}" not found in provider "${provider}".`),
          );
          console.log(chalk.dim('Available capabilities:'));
          for (const c of bundle.capabilities) {
            console.log(chalk.dim(`  ${c.id}`));
          }
          process.exit(1);
        }

        if (options.json) {
          console.log(JSON.stringify(cap, null, 2));
          return;
        }

        printCapabilityDetail(cap);
        return;
      }

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
        chalk.dim(
          '  Use --capability <name> for detail, --capabilities for list, --policy for decisions',
        ),
      );
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
