// @specrail/cli -- User-facing command-line interface
//
// Provider-first workflow: register providers, then resolve/inspect/exec/export.
// The broker handles resolution, freshness, and policy automatically.

import { Command } from 'commander';
import { providerCommand } from './commands/provider.js';
import { resolveCommand } from './commands/resolve.js';
import { capabilitiesCommand } from './commands/capabilities.js';
import { inspectCommand } from './commands/inspect.js';
import { execCommand } from './commands/exec.js';
import { refreshCommand } from './commands/refresh.js';
import { exportCommand } from './commands/export.js';
import { ingestCommand } from './commands/ingest.js';
import { cacheCommand } from './commands/cache.js';

const program = new Command()
  .name('specrail')
  .description(
    'Runtime capability broker for agents.\n\n' +
      'Register API providers, then resolve, inspect, execute, and export\n' +
      'governed capabilities. The broker handles freshness and policy automatically.\n\n' +
      'Quick start:\n' +
      '  specrail provider add petstore --spec-url ./petstore.yaml\n' +
      '  specrail capabilities petstore\n' +
      '  specrail exec petstore listPets --dry-run\n' +
      '  specrail export mcp petstore',
  )
  .version('0.1.0');

// Primary: provider-first commands
program.addCommand(providerCommand);
program.addCommand(resolveCommand);
program.addCommand(capabilitiesCommand);
program.addCommand(inspectCommand);
program.addCommand(execCommand);
program.addCommand(refreshCommand);
program.addCommand(exportCommand);

// Secondary: manual escape hatches
program.addCommand(ingestCommand);
program.addCommand(cacheCommand);

program.parse();
