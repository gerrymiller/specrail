import { Command } from 'commander';
import chalk from 'chalk';
import { parseOpenApiSpec, buildAugmentation } from '@specrail/ingest';
import { classify, enforce, DEFAULT_POLICY, loadOverlay } from '@specrail/policy';
import { writeBundle } from '@specrail/cache';
import {
  type Capability,
  type CapabilityBundle,
  type HttpMethod,
  generateCapabilityId,
  humanizeName,
  slugify,
  computeHash,
} from '@specrail/core';

export const ingestCommand = new Command('ingest')
  .description('Ingest an OpenAPI spec and generate a governed capability bundle')
  .argument('<spec>', 'Path or URL to an OpenAPI spec')
  .option('--name <name>', 'Bundle name (default: derived from spec title)')
  .option('--docs <url>', 'Augment with external documentation URL')
  .option('--context7', 'Pull Context7 documentation augmentation')
  .option('--context7-library <name>', 'Context7 library name override')
  .option('--policy <path>', 'Path to a policy overlay JSON file')
  .option('--output <dir>', 'Override cache output directory')
  .action(async (spec: string, options) => {
    try {
      console.log(chalk.blue('Ingesting spec:'), spec);

      // 1. Parse the OpenAPI spec
      const { source, operations } = await parseOpenApiSpec(spec);
      console.log(
        chalk.green(
          `  Parsed ${operations.length} operations from "${source.title}" v${source.version}`,
        ),
      );

      // 2. Build augmentation (docs + Context7)
      const augmentation = await buildAugmentation(source.title, {
        docsUrl: options.docs,
        useContext7: options.context7,
        context7Library: options.context7Library,
      });
      if (augmentation) {
        console.log(chalk.green('  Augmentation data retrieved'));
        if (augmentation.context7LibraryId) {
          source.context7LibraryId = augmentation.context7LibraryId;
        }
        if (options.docs) {
          source.docsUrl = options.docs;
        }
      }

      // 3. Load policy overlay
      const overlay = options.policy ? await loadOverlay(options.policy) : DEFAULT_POLICY;
      console.log(chalk.green(`  Using policy: "${overlay.name}"`));

      // 4. Build capabilities with classification and policy enforcement
      const bundleName = slugify(options.name ?? source.title);
      const capabilities: Capability[] = operations.map((op) => {
        const classification = classify(op.method as HttpMethod, op.path);
        const policy = enforce(overlay, {
          classification,
          operationId: op.operationId,
          path: op.path,
          method: op.method as HttpMethod,
        });

        return {
          id: generateCapabilityId(bundleName, op.operationId, op.method, op.path),
          name: humanizeName(op.operationId, op.method, op.path),
          description: op.description ?? op.summary ?? '',
          operationId: op.operationId,
          operation: op.operation,
          classification,
          policy,
          auth: op.auth,
        };
      });

      // 5. Build the capability bundle
      const allowedCount = capabilities.filter((c) => c.policy.allowed).length;
      const deniedCount = capabilities.filter((c) => !c.policy.allowed).length;

      const bundle: CapabilityBundle = {
        version: '1.0',
        source,
        generatedAt: new Date().toISOString(),
        bundleHash: '', // Computed after serialization
        policy: {
          overlayName: overlay.name,
          totalCapabilities: capabilities.length,
          allowedCount,
          deniedCount,
        },
        capabilities,
        augmentation,
      };

      // Compute hash over the normalized bundle content
      bundle.bundleHash = computeHash(JSON.stringify(bundle));

      // 6. Write to cache
      const outputDir = await writeBundle(bundle, bundleName, {
        cacheDir: options.output,
      });

      console.log('');
      console.log(chalk.green.bold('Bundle generated successfully:'));
      console.log(`  Name:         ${bundleName}`);
      console.log(`  Capabilities: ${capabilities.length}`);
      console.log(`  Allowed:      ${chalk.green(String(allowedCount))}`);
      console.log(`  Denied:       ${chalk.red(String(deniedCount))}`);
      console.log(`  Cached at:    ${outputDir}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
